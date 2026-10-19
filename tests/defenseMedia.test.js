import test from "node:test";
import assert from "node:assert/strict";
import { Readable, PassThrough } from "node:stream";
import { boundedDownload, mediaDownloadStats } from "../utils/boundedMedia.js";
import { assertImageBudget } from "../utils/imageBudget.js";
test("media is rejected before download when its declared size is too large", async () => {
  let started = 0;
  await assert.rejects(
    boundedDownload(
      () => {
        started++;
        return Readable.from([Buffer.alloc(5)]);
      },
      { fileLength: 100 },
      { maxBytes: 10 },
    ),
  );
  assert.equal(started, 0);
});
test("stream limit does not trust declared sizes and cleans up failures", async () => {
  await assert.rejects(
    boundedDownload(
      () => Readable.from([Buffer.alloc(8), Buffer.alloc(8)]),
      { fileLength: 1 },
      { maxBytes: 10 },
    ),
  );
  await assert.rejects(
    boundedDownload(
      async () => {
        throw Error("download failed");
      },
      { fileLength: 1 },
    ),
  );
  assert.equal(mediaDownloadStats().active, 0);
  assert.equal(
    (
      await boundedDownload(() => Readable.from([Buffer.from("ok")]), {})
    ).toString(),
    "ok",
  );
});
test("media timeout closes stalled streams and retains permits for late downloads", async () => {
  const stream = new PassThrough();
  await assert.rejects(
    boundedDownload(async () => stream, {}, { timeoutMs: 15 }),
    /timed out/,
  );
  let deliver;
  const source = new Promise((r) => (deliver = r));
  await assert.rejects(
    boundedDownload(() => source, {}, { timeoutMs: 15 }),
    /timed out/,
  );
  assert.ok(mediaDownloadStats().active >= 1);
  const late = new PassThrough();
  deliver(late);
  await new Promise((r) => setImmediate(r));
  assert.equal(late.destroyed, true);
  assert.equal(mediaDownloadStats().active, 0);
});
test("media permits bound simultaneous downloads even before headers arrive", async () => {
  const resolvers = [];
  const promises = Array.from({ length: 4 }, () =>
    boundedDownload(
      () => new Promise((resolve) => resolvers.push(resolve)),
      {},
    ),
  );
  await new Promise((r) => setImmediate(r));
  await assert.rejects(
    boundedDownload(() => Readable.from([Buffer.from("x")]), {}),
    /busy/,
  );
  resolvers.forEach((resolve) => resolve(Readable.from([Buffer.from("x")])));
  await Promise.all(promises);
  assert.equal(mediaDownloadStats().active, 0);
});
test("image header budgets reject compressed dimension bombs before decoding", () => {
  const png = Buffer.alloc(24);
  png.writeUInt32BE(640, 16);
  png.writeUInt32BE(480, 20);
  assert.deepEqual(assertImageBudget(png, "png"), { width: 640, height: 480 });
  png.writeUInt32BE(100000, 16);
  assert.throws(() => assertImageBudget(png, "png"));
  assert.throws(() => assertImageBudget(Buffer.alloc(3), "webp"));
});

test("outbound backpressure bounds queued sends and preserves results", async () => {
  const { MessageQueue } = await import("../queue/messageQueue.js");
  const queue = new MessageQueue();
  queue.maxQueue = 2;
  queue.chatCap = 2;
  queue.maxConcurrent = 1;
  queue.messageDelay = 0;
  queue.groupMessageDelay = 0;
  let release;
  const gate = new Promise((r) => (release = r));
  const first = queue.enqueue("first@lid", async () => {
    await gate;
    return { id: "sent" };
  });
  const second = queue.enqueue("second@lid", async () => 2),
    third = queue.enqueue("third@lid", async () => 3);
  await assert.rejects(
    queue.enqueue("fourth@lid", async () => 4),
    /capacity/,
  );
  assert.equal(queue.getStats().totalQueued, 2);
  release();
  assert.deepEqual(await first, { id: "sent" });
  assert.equal(await second, 2);
  assert.equal(await third, 3);
  queue.stop();
});

test("a decoder exception rejects its operation without terminating the bot process", async () => {
  const { createMemeImage } = await import("../utils/mediaStudio.js");
  await assert.rejects(
    createMemeImage(Buffer.from("not an image"), "Top", "Bottom"),
  );
});

test("attachment URLs cannot turn a media command into an arbitrary network fetch", async () => {
  const { assertMediaSource } = await import("../utils/boundedMedia.js");
  assert.doesNotThrow(() =>
    assertMediaSource({
      url: "https://mmg.whatsapp.net/v/t62.example/file.enc",
      directPath: "/v/t62.example/file.enc",
    }),
  );
  for (const node of [
    { url: "http://mmg.whatsapp.net/file" },
    { url: "https://127.0.0.1/file" },
    { url: "https://mmg.whatsapp.net.evil.test/file" },
    { url: "https://user:password@mmg.whatsapp.net/file" },
    { directPath: "//localhost/private" },
    { directPath: "/\\localhost/private" },
  ])
    assert.throws(() => assertMediaSource(node));
});
