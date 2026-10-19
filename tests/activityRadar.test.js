import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyActivity,
  parseRadarWindow,
  createActivityHandler,
} from "../utils/activityRadar.js";
const now = Date.now();
const members = [
  { hasTrackedActivity: true, lastMessageAt: new Date(now - 3600000) },
  { hasTrackedActivity: true, lastMessageAt: new Date(now - 48 * 3600000) },
  { hasTrackedActivity: false },
  { hasTrackedActivity: true, lastMessageAt: "bad" },
  { hasTrackedActivity: true, lastMessageAt: new Date(now + 99999) },
];
test("radar windows are strictly bounded", () => {
  assert.equal(parseRadarWindow([]), 24);
  assert.equal(parseRadarWindow(["168h"]), 168);
  for (const input of ["0h", "169h", "-1h", "Infinityh", "1.5h", "01h"])
    assert.equal(parseRadarWindow([input]), null);
  assert.equal(parseRadarWindow(["24h", "extra"]), null);
});
test("unknown and future history is never labelled quiet", () => {
  const result = classifyActivity(members, 24, now);
  assert.equal(result.recent.length, 1);
  assert.equal(result.quiet.length, 1);
  assert.equal(result.unknown.length, 3);
});
const run = async (
  mode,
  overrides = {},
  find = async () => ({ members: [] }),
  args = [],
) => {
  const replies = [];
  const info = {
    isGroup: true,
    isGroupAdmin: true,
    senderJid: "1@s.whatsapp.net",
    groupMetadata: {
      participants: [
        { id: "1@s.whatsapp.net", lid: "one@lid" },
        { id: "2@s.whatsapp.net" },
      ],
    },
    sendMessageWTyping: async (_, payload) => replies.push(payload),
    ...overrides,
  };
  await createActivityHandler(find, mode)(null, {}, "test@g.us", args, info);
  return replies;
};
test("spy denies nonadmins before querying and refuses private chats", async () => {
  const fail = () => {
    throw Error("must not query");
  };
  assert.match(
    (await run("spy", { isGroupAdmin: false }, fail))[0].text,
    /Only group admins/,
  );
  assert.match(
    (await run("spy", { isGroup: false }, fail))[0].text,
    /inside a group/,
  );
});
test("spy caps output, escapes names and never mentions people", async () => {
  const participants = Array.from({ length: 25 }, (_, i) => ({
    id: `${i}@s.whatsapp.net`,
  }));
  const data = participants.map((p) => ({
    id: p.id,
    name: "bad\n*name*",
    count: 2,
    lastMessageAt: new Date(now - 48 * 3600000),
  }));
  const [reply] = await run(
    "spy",
    { groupMetadata: { participants } },
    async () => ({ members: data }),
  );
  assert.equal((reply.text.match(/last message .* UTC/g) || []).length, 10);
  assert.equal(reply.mentions, undefined);
  assert.ok(!reply.text.includes("*name*"));
  assert.match(reply.text, /cannot detect online/);
});
test("activitycard matches LID aliases and groupmood exposes aggregates only", async () => {
  const find = async () => ({
    members: [
      {
        id: "one@lid",
        name: "Private Name",
        count: 110,
        lastMessageAt: new Date(now),
      },
    ],
  });
  assert.match(
    (await run("activitycard", {}, find))[0].text,
    /Conversation spark/,
  );
  const mood = (await run("groupmood", {}, find))[0].text;
  assert.ok(!mood.includes("Private Name"));
  assert.match(mood, /1\/2/);
});
test("database and roster failures produce safe responses", async () => {
  assert.match(
    (
      await run("spy", {}, async () => {
        throw Error("private connection details");
      })
    )[0].text,
    /temporarily unavailable/,
  );
  assert.match(
    (await run("spy", { groupMetadata: null }))[0].text,
    /roster is unavailable/,
  );
});

test("member command adapter dispatches using the five-argument command contract", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = (
    await readFile(
      new URL("../commands/group/members/activityRadar.js", import.meta.url),
      "utf8",
    )
  )
    .replace(
      'import { group } from "../../../db/groupData.js";',
      "const group = { findOne: async () => ({members: []}) };",
    )
    .replace(
      '"../../../utils/activityRadar.js"',
      JSON.stringify(
        new URL("../utils/activityRadar.js", import.meta.url).href,
      ),
    );
  const { default: factory } = await import(
    `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
  );
  const replies = [];
  await factory().handler(null, {}, "test@g.us", [], {
    isGroup: true,
    command: "groupmood",
    groupMetadata: { participants: [{ id: "1@s.whatsapp.net" }] },
    sendMessageWTyping: async (_, p) => replies.push(p.text),
  });
  assert.match(replies[0], /Group Mood/);
});
