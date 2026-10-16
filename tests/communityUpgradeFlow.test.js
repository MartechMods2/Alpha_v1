import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const moduleURL = (code) =>
  "data:text/javascript;base64," + Buffer.from(code).toString("base64");
async function loadWithMocks(file, mocks) {
  const url = new URL(file, import.meta.url);
  let source = await readFile(url, "utf8");
  source = source.replace(
    /from ['"]([^'"]+)['"]/g,
    (_m, specifier) =>
      `from "${mocks[specifier] || new URL(specifier, url).href}"`,
  );
  return import(moduleURL(source));
}
test("admin community controls reject members, persist literal bans and send compact live mentions", async () => {
  globalThis.__communityTest = {
    settings: { blockedPhrases: [] },
    writes: [],
    sent: [],
  };
  try {
    const mock =
      moduleURL(`export const getSafeSettings=async()=>globalThis.__communityTest.settings;
 export const updateSafeSettings=async(_group,patch)=>{Object.assign(globalThis.__communityTest.settings,patch);globalThis.__communityTest.writes.push(patch);};
 export const recordSafeAudit=async()=>{};`);
    const { default: factory } = await loadWithMocks(
      "../commands/group/admins/communityUpgrade.js",
      { "../../../db/safePackData.js": mock },
    );
    const handler = factory().handler,
      send = async (_from, payload) =>
        globalThis.__communityTest.sent.push(payload);
    const info = {
      isGroup: true,
      isGroupAdmin: false,
      senderJid: "member@lid",
      command: "ban",
      sendMessageWTyping: send,
      isBotAdmin: true,
    };
    const sock = {
      groupMetadata: async () => ({
        participants: [{ id: "one@lid" }, { id: "two@s.whatsapp.net" }],
      }),
    };
    await handler(sock, {}, "group@g.us", ["bad"], info);
    assert.equal(globalThis.__communityTest.writes.length, 0);
    info.isGroupAdmin = true;
    info.isBotAdmin = false;
    await handler(sock, {}, "group@g.us", ["bad"], info);
    assert.equal(globalThis.__communityTest.writes.length, 0);
    info.isBotAdmin = true;
    await handler(sock, {}, "group@g.us", ["BAD"], info);
    assert.deepEqual(globalThis.__communityTest.settings.blockedPhrases, [
      "bad",
    ]);
    assert.equal(globalThis.__communityTest.settings.wordFilterEnabled, true);
    info.command = "everyone";
    await handler(sock, {}, "group@g.us", ["Meeting", "today"], info);
    const sent = globalThis.__communityTest.sent.at(-1);
    assert.deepEqual(sent.mentions, ["one@lid", "two@s.whatsapp.net"]);
    assert.ok(sent.text.includes("Meeting today"));
    assert.equal(sent.text.includes("@lid"), false);
    assert.equal(sent.text.includes("@s.whatsapp.net"), false);
  } finally {
    delete globalThis.__communityTest;
  }
});
test("reaction contributions remain pending until an administrator approves, and cannot be deleted by other members", async () => {
  globalThis.__reactionTest = { rows: [], sent: [] };
  try {
    const db =
      moduleURL(`export const listSafeItems=async()=>globalThis.__reactionTest.rows;
 export const createSafeItem=async item=>{const row={...item,_id:'sticker-id'};globalThis.__reactionTest.rows.push(row);return row;};
 export const updateSafeItem=async(_g,_t,id,patch)=>Object.assign(globalThis.__reactionTest.rows.find(x=>x._id===id),patch);
 export const removeSafeItem=async(_g,_t,id)=>{globalThis.__reactionTest.rows=globalThis.__reactionTest.rows.filter(x=>x._id!==id);};`);
    const media = moduleURL(
      `export const downloadResolvedMedia=async()=>({buffer:Buffer.from('approved image')});`,
    );
    const { default: factory } = await loadWithMocks(
      "../commands/group/members/reactionLibrary.js",
      {
        "../../../db/safePackData.js": db,
        "../../../utils/mediaInput.js": media,
      },
    );
    const handler = factory().handler,
      info = {
        isGroup: true,
        senderJid: "member@lid",
        command: "reactionadd",
        sendMessageWTyping: async (_g, p) =>
          globalThis.__reactionTest.sent.push(p),
      };
    await handler({}, {}, "group@g.us", ["laugh"], info);
    assert.equal(globalThis.__reactionTest.rows[0].status, "pending");
    info.command = "reactionapprove";
    await handler({}, {}, "group@g.us", ["sticker-id"], info);
    assert.equal(globalThis.__reactionTest.rows[0].status, "pending");
    info.command = "reactiondelete";
    info.senderJid = "other@lid";
    await handler({}, {}, "group@g.us", ["sticker-id"], info);
    assert.equal(globalThis.__reactionTest.rows.length, 1);
    info.command = "reactionapprove";
    info.isGroupAdmin = true;
    await handler({}, {}, "group@g.us", ["sticker-id"], info);
    assert.equal(globalThis.__reactionTest.rows[0].status, "approved");
  } finally {
    delete globalThis.__reactionTest;
  }
});
test("member cards include live count, matching rank and a fallback image when profile photos are private", async () => {
  const { memberEventPayload } = await import("../utils/memberEventCard.js");
  const payload = await memberEventPayload(
    {
      profilePictureUrl: async () => {
        throw Error("private");
      },
    },
    "group@g.us",
    "member@lid",
    "add",
    {
      subject: "Alpha Friends",
      participants: [{ id: "member@lid" }, { id: "other@lid" }],
    },
    { members: [{ id: "member@lid", count: 120 }], grpName: "Old name" },
    "Welcome friend",
  );
  assert.ok(Buffer.isBuffer(payload.image));
  assert.deepEqual(payload.mentions, ["member@lid"]);
  assert.match(payload.caption, /Members: 2/);
  assert.match(payload.caption, /Welcome friend/);
  assert.match(payload.caption, /Alpha Friends/);
  assert.doesNotMatch(payload.caption, /Rank: undefined/);
});

test("new command aliases cannot be shadowed by another command file", async () => {
  const { readdir } = await import("node:fs/promises");
  const root = new URL("../commands/", import.meta.url),
    all = new Map();
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = new URL(entry.name + (entry.isDirectory() ? "/" : ""), dir);
      if (entry.isDirectory()) {
        await walk(file);
        continue;
      }
      if (!entry.name.endsWith(".js")) continue;
      const source = await readFile(file, "utf8");
      for (const match of source.matchAll(/cmd\s*:\s*\[([^\]]+)\]/g))
        for (const name of match[1].matchAll(/["']([^"']+)["']/g)) {
          const paths = all.get(name[1]) || [];
          paths.push(file.pathname);
          all.set(name[1], paths);
        }
    }
  }
  await walk(root);
  const files = [
    "communityUpgrade.js",
    "integrationWatches.js",
    "communityPlus.js",
    "compactGames.js",
    "reactionLibrary.js",
    "discoveryPlus.js",
    "groupMembership.js",
    "mediaDiscoveryPlus.js",
  ];
  for (const [alias, paths] of all)
    if (paths.some((p) => files.some((f) => p.endsWith("/" + f))))
      assert.equal(
        paths.length,
        1,
        alias + " is registered by " + paths.join(", "),
      );
  assert.equal(all.get("ban")?.length, 1);
  assert.ok(all.get("ban")[0].endsWith("/communityUpgrade.js"));
});

test("word and confirmed-bot enforcement deletes only when Alpha has admin rights", async () => {
  globalThis.__moderationTest = {
    settings: {
      wordFilterEnabled: true,
      blockedPhrases: ["bad"],
      blockedBotJids: [],
    },
    sent: [],
    deleted: [],
  };
  try {
    const db = moduleURL(
      `export const getSafeSettings=async()=>globalThis.__moderationTest.settings;export const updateSafeSettings=async()=>{};export const recordSafeAudit=async()=>{};export const createSafeItem=async()=>{};export const listSafeItems=async()=>[];`,
    );
    const protection = moduleURL(
      "export const isProtectedGroupMember=()=>false;",
    );
    const circuit = moduleURL(
      "export const claimDeletionBudget=()=>true;export const moderationCircuitStatus=()=>({});",
    );
    const { handleSafeModerationMessage: moderate } = await loadWithMocks(
      "../utils/safeModeration.js",
      {
        "../db/safePackData.js": db,
        "./moderation.js": protection,
        "./moderationCircuit.js": circuit,
      },
    );
    const info = {
      sock: {
        sendMessage: async (_g, p) =>
          globalThis.__moderationTest.deleted.push(p),
      },
      msg: { key: { id: "message" }, message: { conversation: "bad" } },
      groupJid: "moderation@g.us",
      senderJid: "sender@lid",
      body: "bad",
      isBotAdmin: false,
      groupMetadata: { participants: [] },
      sendMessageWTyping: async (_g, p) =>
        globalThis.__moderationTest.sent.push(p),
    };
    assert.equal((await moderate(info)).handled, false);
    assert.equal(globalThis.__moderationTest.deleted.length, 0);
    info.isBotAdmin = true;
    assert.equal((await moderate(info)).handled, true);
    assert.equal(globalThis.__moderationTest.deleted.length, 1);
    info.body = "badminton";
    assert.equal((await moderate(info)).handled, false);
    globalThis.__moderationTest.settings.blockedBotJids = ["sender@lid"];
    assert.equal((await moderate(info)).handled, true);
    info.isGroupAdmin = true;
    assert.equal((await moderate(info)).handled, false);
    assert.equal(globalThis.__moderationTest.deleted.length, 2);
  } finally {
    delete globalThis.__moderationTest;
  }
});

test("public fetch handles HEAD content length and bypasses stale payment-verification cache", async () => {
  const { EventEmitter } = await import("node:events");
  const { PassThrough } = await import("node:stream");
  let calls = 0;
  globalThis.__featureHTTP = {
    request: (_url, options, callback) => {
      const req = new EventEmitter();
      req.setTimeout = () => {};
      req.write = () => {};
      req.destroy = (error) => {
        req.emit("error", error);
        req.emit("close");
      };
      req.end = () =>
        queueMicrotask(() => {
          calls++;
          const res = new PassThrough();
          res.statusCode = 200;
          res.headers = {
            "content-length": options.method === "HEAD" ? "1000000" : undefined,
          };
          res.once("close", () => req.emit("close"));
          callback(res);
          res.end(
            options.method === "HEAD"
              ? ""
              : JSON.stringify({ sequence: calls }),
          );
        });
      return req;
    },
  };
  try {
    const https = moduleURL("export default globalThis.__featureHTTP;");
    const dns = moduleURL(
      `export default {lookup:async()=>[{address:'8.8.8.8',family:4}]};`,
    );
    const { publicRequest, featureJSON } = await loadWithMocks(
      "../utils/featureHttp.js",
      { "node:https": https, "node:dns/promises": dns },
    );
    assert.equal(
      (
        await publicRequest("https://example.com", {
          method: "HEAD",
          maxBytes: 1024,
        })
      ).status,
      200,
    );
    assert.equal((await featureJSON("https://example.com/verify")).sequence, 2);
    assert.equal((await featureJSON("https://example.com/verify")).sequence, 2);
    assert.equal(
      (await featureJSON("https://example.com/verify", { cache: false }))
        .sequence,
      3,
    );
    assert.equal(
      (await featureJSON("https://example.com/verify", { cache: false }))
        .sequence,
      4,
    );
  } finally {
    delete globalThis.__featureHTTP;
  }
});

test("contextual stickers require opt-in and use only approved group matches, with a concurrent cooldown", async () => {
  globalThis.__stickerTest = { enabled: false, queries: [], sent: [] };
  try {
    const db =
      moduleURL(`export const getSafeSettings=async()=>({contextStickers:globalThis.__stickerTest.enabled});
  export const listSafeItems=async(group,type,filter)=>{globalThis.__stickerTest.queries.push({group,type,filter});await Promise.resolve();return[{payload:{data:Buffer.from('sticker').toString('base64')}}];};`);
    const crypto = moduleURL("export const randomInt=()=>0;");
    const { maybeContextSticker: react } = await loadWithMocks(
      "../utils/contextualStickers.js",
      { "../db/safePackData.js": db, "node:crypto": crypto },
    );
    const info = {
      groupJid: "stickers@g.us",
      body: "thank you",
      isCommand: false,
      sendMessageWTyping: async (group, payload) =>
        globalThis.__stickerTest.sent.push({ group, payload }),
    };
    await react(info);
    assert.equal(globalThis.__stickerTest.queries.length, 0);
    globalThis.__stickerTest.enabled = true;
    await react({ ...info, isCommand: true });
    assert.equal(globalThis.__stickerTest.queries.length, 0);
    await Promise.all([react(info), react(info)]);
    assert.equal(globalThis.__stickerTest.sent.length, 1);
    for (const query of globalThis.__stickerTest.queries) {
      assert.equal(query.group, "stickers@g.us");
      assert.equal(query.filter.status, "approved");
      assert.equal(query.filter.text, "thanks");
    }
    await react(info);
    assert.equal(globalThis.__stickerTest.sent.length, 1);
  } finally {
    delete globalThis.__stickerTest;
  }
});
