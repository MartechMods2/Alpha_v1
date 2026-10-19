import test from "node:test";
import assert from "node:assert/strict";
import {
  defenseConfig,
  validateMessage,
  IngestionDefense,
  declaredMediaBytes,
} from "../utils/ingestionDefense.js";
const message = (
  id = "id",
  chat = "test@g.us",
  sender = "member@lid",
  text = "Hello",
) => ({
  key: { id, remoteJid: chat, participant: sender },
  message: { conversation: text },
});
const config = (patch) => ({ ...defenseConfig({}), ...patch });
const turn = () => new Promise((resolve) => setImmediate(resolve));
test("configuration rejects invalid and extreme values", () => {
  const c = defenseConfig({
    ALPHA_INGEST_CONCURRENCY: "Infinity",
    ALPHA_INGEST_QUEUE: "-1",
    ALPHA_INGEST_TEXT_CHARS: "NaN",
  });
  assert.equal(c.concurrency, 4);
  assert.equal(c.queue, 128);
  assert.equal(c.maxText, 16384);
});
test("malformed fields, missing senders and unsupported text types fail closed", () => {
  for (const input of [
    null,
    undefined,
    [],
    {},
    { key: null },
    { ...message(), message: null },
    { ...message(), key: { ...message().key, participant: null } },
    { ...message(), message: { conversation: { text: "wrong" } } },
    { ...message(), key: { ...message().key, fromMe: "true" } },
  ])
    assert.equal(validateMessage(input).ok, false);
});
test("legitimate multilingual text, emojis and zero-width joiners survive while C0 is normalized", () => {
  const text = "Ẹ káàárọ̀ • مرحبا • 中文 👨‍👩‍👧‍👦\n\tHello\u0000";
  const result = validateMessage(
    message("unicode", undefined, undefined, text),
  );
  assert.equal(result.ok, true);
  assert.equal(result.message.message.conversation, text.replace("\u0000", ""));
});
test("text and binary budgets, quoted depth, metadata width and cycles are bounded", () => {
  assert.equal(
    validateMessage(
      message("long", undefined, undefined, "a".repeat(1024)),
      config({ maxText: 1024 }),
    ).ok,
    true,
  );
  assert.equal(
    validateMessage(
      message("long", undefined, undefined, "a".repeat(1025)),
      config({ maxText: 1024 }),
    ).ok,
    false,
  );
  const nested = message();
  let value = nested.message;
  for (let i = 0; i < 30; i++) {
    value.quotedMessage = {};
    value = value.quotedMessage;
  }
  assert.equal(validateMessage(nested).ok, false);
  const huge = message();
  huge.message.metadata = Object.fromEntries(
    Array.from({ length: 200 }, (_, i) => ["key" + i, i]),
  );
  assert.equal(validateMessage(huge).ok, false);
  const circular = message();
  circular.message.loop = circular;
  assert.equal(validateMessage(circular).ok, false);
  const binary = message();
  binary.message.thumbnail = Buffer.alloc(300000);
  assert.equal(validateMessage(binary).ok, false);
});
test("descriptors are inspected without invoking getters or toJSON", () => {
  const input = message();
  let called = false;
  Object.defineProperty(input.message, "text", {
    enumerable: true,
    get() {
      called = true;
      return "x";
    },
  });
  assert.equal(validateMessage(input).ok, false);
  assert.equal(called, false);
  const media = message();
  media.message = { imageMessage: {} };
  Object.defineProperty(media.message.imageMessage, "fileLength", {
    enumerable: true,
    get() {
      called = true;
      return 1;
    },
  });
  assert.equal(validateMessage(media).ok, false);
  assert.equal(called, false);
});
test("announced media sizes handle numeric protobuf Long and BigInt without coercion tricks", () => {
  assert.equal(declaredMediaBytes({ low: 1024, high: 0 }), 1024);
  assert.equal(declaredMediaBytes(32n), 32);
  assert.equal(declaredMediaBytes(-1), Infinity);
  assert.equal(
    validateMessage({
      ...message(),
      message: { imageMessage: { fileLength: 100000000 } },
    }).ok,
    false,
  );
});
test("supported wrappers are unwrapped without recursively invoking handlers", () => {
  const input = message();
  input.message = {
    ephemeralMessage: {
      message: { viewOnceMessageV2: { message: { conversation: "Hi 👋" } } },
    },
  };
  const result = validateMessage(input);
  assert.equal(result.ok, true);
  assert.equal(result.message.message.conversation, "Hi 👋");
});
test("sender, chat and global token buckets limit abusive bursts without replying", async () => {
  for (const patch of [
    { senderBurst: 2, chatBurst: 100, globalBurst: 100 },
    { senderBurst: 100, chatBurst: 2, globalBurst: 100 },
    { senderBurst: 100, chatBurst: 100, globalBurst: 2 },
  ]) {
    let now = 0;
    const d = new IngestionDefense({ clock: () => now, config: config(patch) });
    let calls = 0;
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        d.submit(
          message(
            String(i),
            patch.globalBurst === 2 ? "chat" + i + "@g.us" : "test@g.us",
            patch.senderBurst === 2 ? "member@lid" : "user" + i + "@lid",
          ),
          async () => calls++,
        ),
      ),
    );
    assert.equal(results.filter(Boolean).length, 2);
    assert.equal(calls, 2);
    now = 11000;
    assert.equal(await d.submit(message("refilled"), async () => {}), true);
    d.stop();
  }
});
test("global sender quota spans different chats and cannot be reset by chat rotation", async () => {
  const d = new IngestionDefense({
    config: config({ senderBurst: 2, chatBurst: 100, globalBurst: 100 }),
  });
  let count = 0;
  await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      d.submit(message(String(i), "group" + i + "@g.us"), async () => count++),
    ),
  );
  assert.equal(count, 4);
  d.stop();
});
test("bounded queues serialize each chat, permit other chats and suppress concurrent duplicates", async () => {
  const d = new IngestionDefense({
    config: config({
      concurrency: 2,
      queue: 3,
      chatQueue: 2,
      senderBurst: 100,
      chatBurst: 100,
    }),
  });
  let release;
  const blocked = new Promise((r) => (release = r));
  let activeChat = 0,
    maxChat = 0;
  const first = d.submit(message("first"), async () => {
    activeChat++;
    maxChat = Math.max(maxChat, activeChat);
    await blocked;
    activeChat--;
  });
  assert.equal(
    await d.submit(message("first"), async () => assert.fail("duplicate ran")),
    false,
  );
  const second = d.submit(message("second"), async () => {
    activeChat++;
    maxChat = Math.max(maxChat, activeChat);
    activeChat--;
  });
  const third = d.submit(message("third"), async () => {});
  assert.equal(await d.submit(message("fourth"), async () => {}), false);
  assert.equal(
    await d.submit(message("other", "other@g.us"), async () => {}),
    true,
  );
  release();
  await Promise.all([first, second, third]);
  assert.equal(maxChat, 1);
  d.stop();
});
test("handler exceptions are contained and never replayed automatically", async () => {
  const d = new IngestionDefense();
  assert.equal(
    await d.submit(message(), async () => {
      throw Error("private body");
    }),
    false,
  );
  assert.equal(
    await d.submit(message(), async () => assert.fail("replayed")),
    false,
  );
  assert.equal(await d.submit(message("next"), async () => {}), true);
  assert.equal(d.stats().failed, 1);
  d.stop();
});
test("distinct poll-state updates sharing a creation ID are not mistaken for duplicate votes", async () => {
  const d = new IngestionDefense();
  const one = message(),
    two = message();
  one.message = { pollState: { pollUpdates: [{ voter: "one" }] } };
  two.message = { pollState: { pollUpdates: [{ voter: "two" }] } };
  assert.equal(
    await d.submit(one, async () => {}, { kind: "poll-state" }),
    true,
  );
  assert.equal(
    await d.submit(two, async () => {}, { kind: "poll-state" }),
    true,
  );
  assert.equal(
    await d.submit(two, async () => {}, { kind: "poll-state" }),
    false,
  );
  d.stop();
});
test("deadline closes admission and retains the active permit until work really settles", async () => {
  let fatal = 0,
    release;
  const pending = new Promise((r) => (release = r));
  const d = new IngestionDefense({
    config: config({ deadline: 15 }),
    onDeadline: () => fatal++,
  });
  const work = d.submit(message(), async () => pending);
  await new Promise((r) => setTimeout(r, 35));
  assert.equal(fatal, 1);
  assert.equal(d.stats().active, 1);
  assert.equal(d.stats().stopped, true);
  assert.equal(await d.submit(message("late"), async () => {}), false);
  release();
  await work;
  await turn();
  assert.equal(d.stats().active, 0);
});
test("identity and duplicate maps never exceed configured capacity under churn", async () => {
  let now = 0;
  const d = new IngestionDefense({
    config: config({
      stateCap: 100,
      senderBurst: 100,
      chatBurst: 100,
      globalBurst: 10000,
    }),
    clock: () => now,
  });
  for (let i = 0; i < 300; i++) {
    await d.submit(
      message(String(i), "chat" + i + "@g.us", "user" + i + "@lid"),
      async () => {},
    );
    now += 1;
  }
  assert.ok(d.stats().identities <= 100);
  assert.ok(d.stats().dedup <= 100);
  d.stop();
});

test("unsupported content is ignored instead of reaching expensive handlers", () => {
  assert.equal(
    validateMessage({
      ...message(),
      message: { unknownAttachment: { url: "https://example.test/file" } },
    }).ok,
    false,
  );
});

test("group metadata validates roles and preserves a normal large group", async () => {
  const { boundedGroupMetadata } = await import(
    "../utils/groupMetadataDefense.js"
  );
  const metadata = {
    id: "test@g.us",
    subject: "Ẹ káàárọ̀ 👋",
    participants: Array.from({ length: 1024 }, (_, i) => ({
      id: "member" + i + "@lid",
      admin: i === 0 ? "admin" : null,
    })),
  };
  assert.equal(
    boundedGroupMetadata(metadata, "test@g.us").participants.length,
    1024,
  );
  assert.throws(() =>
    boundedGroupMetadata(
      {
        ...metadata,
        participants: [{ id: "member@lid", admin: "owner-imposter" }],
      },
      "test@g.us",
    ),
  );
  assert.throws(() =>
    boundedGroupMetadata(
      { ...metadata, participants: [{ id: { bad: true } }] },
      "test@g.us",
    ),
  );
});

test("global queue backpressure drops excess work across different chats", async () => {
  const d = new IngestionDefense({
    config: config({ concurrency: 1, queue: 2, chatQueue: 2 }),
  });
  let release;
  const gate = new Promise((r) => (release = r));
  const first = d.submit(message("one", "one@g.us"), async () => gate);
  const second = d.submit(message("two", "two@g.us"), async () => {});
  const third = d.submit(message("three", "three@g.us"), async () => {});
  assert.equal(
    await d.submit(message("four", "four@g.us"), async () =>
      assert.fail("overflow ran"),
    ),
    false,
  );
  assert.equal(d.stats().queued, 2);
  release();
  await Promise.all([first, second, third]);
  d.stop();
});
