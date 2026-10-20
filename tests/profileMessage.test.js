import test from "node:test";
import assert from "node:assert/strict";
import { createCanvas } from "@napi-rs/canvas";
import { createProfileMessages } from "../utils/profileMessage.js";
const photo = createCanvas(20, 20).toBuffer("image/png");
test("profile photo is attached above full caption and preserves mentions", async () => {
  let target;
  const build = createProfileMessages({
    request: async () => ({ buffer: photo }),
  });
  const result = await build(
    {
      profilePictureUrl: async (jid) => {
        target = jid;
        return "https://example.com/photo";
      },
    },
    "member@lid",
    "Welcome!",
    { mentions: ["member@lid"] },
  );
  assert.equal(target, "member@lid");
  assert.equal(result.image, photo);
  assert.equal(result.caption, "Welcome!");
  assert.deepEqual(result.mentions, ["member@lid"]);
});
test("private, unsupported and oversized decoded photos use fallback", async () => {
  const tooLarge = Buffer.from(photo);
  tooLarge.writeUInt32BE(16000, 16);
  tooLarge.writeUInt32BE(16000, 20);
  for (const buffer of [Buffer.from("bad image"), tooLarge]) {
    const build = createProfileMessages({
      request: async () => ({ buffer }),
      fallbackImage: () => photo,
    });
    assert.equal(
      (
        await build(
          { profilePictureUrl: async () => "https://example.com/p" },
          "1@lid",
          "text",
        )
      ).image,
      photo,
    );
  }
  const build = createProfileMessages({ fallbackImage: () => photo });
  assert.equal(
    (
      await build(
        {
          profilePictureUrl: async () => {
            throw Error("private");
          },
        },
        "1@lid",
        "text",
      )
    ).image,
    photo,
  );
});
test("long captions and failed fallback remain complete text", async () => {
  const build = createProfileMessages({ fallbackImage: () => photo });
  const text = "x".repeat(4100);
  assert.deepEqual(await build({}, "", text), { text });
  const broken = createProfileMessages({
    fallbackImage: () => {
      throw Error("decoder unavailable");
    },
  });
  assert.deepEqual(await broken({}, "", "hello"), { text: "hello" });
});
test("concurrent profile work is capped at two without making other replies wait", async () => {
  const releases = [];
  let lookups = 0;
  const build = createProfileMessages({
    request: async () => ({ buffer: photo }),
    fallbackImage: () => photo,
  });
  const sock = {
    profilePictureUrl: async () => {
      lookups++;
      return new Promise((r) => releases.push(r));
    },
  };
  const a = build(sock, "1@lid", "one"),
    b = build(sock, "2@lid", "two");
  await Promise.resolve();
  const c = await build(sock, "3@lid", "three");
  assert.equal(c.image, photo);
  assert.equal(lookups, 2);
  releases.forEach((r) => r("https://example.com/p"));
  await Promise.all([a, b]);
});
test("farewell preserves member details when roster no longer includes departed member", async () => {
  const { memberEventPayload } = await import("../utils/memberEventCard.js");
  const payload = await memberEventPayload(
    {
      profilePictureUrl: async () => {
        throw Error("gone");
      },
    },
    "group@g.us",
    "1@s.whatsapp.net",
    "remove",
    { subject: "Friends", participants: [] },
    { members: [{ id: "1@s.whatsapp.net", count: 120 }] },
    "Safe travels",
  );
  assert.match(payload.caption, /FAREWELL/);
  assert.match(payload.caption, /Members: 0/);
  assert.match(payload.caption, /Bronze/);
  assert.match(payload.caption, /Safe travels/);
  assert.ok(payload.image);
});

test("menu command sends Alpha portrait and quoted caption in a single message", async () => {
  const { readFile } = await import("node:fs/promises");
  let source = await readFile(
    new URL("../commands/public/help.js", import.meta.url),
    "utf8",
  );
  source = source.replace(
    /import \{ cmdToText \} from [^;]+;/,
    "const cmdToText=async()=>({publicCommands:[]});",
  );
  source = source.replace(
    /import \{ searchCommands \} from [^;]+;/,
    "const searchCommands=()=>[];",
  );
  for (const name of ["profileMessage", "botMenu"])
    source = source.replace(
      `"../../utils/${name}.js"`,
      JSON.stringify(new URL(`../utils/${name}.js`, import.meta.url).href),
    );
  const { default: factory } = await import(
    `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
  );
  const sent = [],
    msg = { key: { id: "test" } };
  await factory().handler(
    {
      user: { id: "bot@s.whatsapp.net" },
      profilePictureUrl: async () => {
        throw Error("private");
      },
    },
    msg,
    "group@g.us",
    [],
    { sendMessageWTyping: async (...args) => sent.push(args) },
  );
  assert.equal(sent.length, 1);
  assert.ok(sent[0][1].image);
  assert.match(sent[0][1].caption, /ALPHA/);
  assert.equal(sent[0][2].quoted, msg);
});
