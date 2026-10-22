import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createModerationDeleter, moderationDeleteKey, deletionNotice, participantActionSucceeded } from "../utils/moderationDelete.js";
import { validateMessage } from "../utils/ingestionDefense.js";
import { isGroupStatusMentionMessage } from "../utils/groupSafety.js";
const bot = "2348000000000@s.whatsapp.net", user = "2348111111111@s.whatsapp.net";
const group = "123456789@g.us";
const metadata = (admin = true, protectedUser = false) => ({ id: group, participants: [
  { id: bot, admin: admin ? "admin" : null }, { id: user, admin: protectedUser ? "admin" : null },
] });
const fixture = (overrides = {}) => {
  const sent = [];
  const sock = { user: { id: bot }, groupMetadata: async () => metadata(),
    sendMessage: async (to, p) => { sent.push({ to, ...p }); return { key: { id: "ack" } }; }, ...overrides };
  const input = { sock, groupJid: group, memberJid: user, botJids: [bot],
    groupMetadata: metadata(), isBotAdmin: false,
    msg: { key: { id: "original", participant: user, remoteJid: group },
      statusMentionMessageInfo: { quotedStatus: { key: { id: "status", remoteJid: "status@broadcast" } } } } };
  return { input, sent, sock };
};
test("delete requests preserve the original message and author rather than a quoted status", async () => {
  const f = fixture(), del = createModerationDeleter({ claim: () => true });
  const result = await del(f.input);
  assert.equal(result.status, "requested");
  assert.equal(result.isBotAdmin, true);
  assert.equal(f.sent.length, 1);
  assert.equal(f.sent[0].delete.id, "original");
  assert.equal(f.sent[0].delete.remoteJid, group);
  assert.equal(f.sent[0].delete.participant, user);
  assert.equal(f.sent[0].delete.fromMe, false);
});
test("fresh roles override stale bot-admin flags and protect newly promoted members", async () => {
  for (const [admin, protectedUser, expected] of [[false,false,"not-admin"],[true,true,"protected"]]) {
    const f = fixture({ groupMetadata: async () => metadata(admin, protectedUser) });
    f.input.isBotAdmin = true;
    const result = await createModerationDeleter({ claim: () => true })(f.input);
    assert.equal(result.status, expected);
    assert.equal(f.sent.length, 0);
  }
});
test("one failed send refreshes permissions and retries the exact same key once", async () => {
  const f = fixture(); let calls = 0, refreshes = 0;
  f.sock.groupMetadata = async () => { refreshes++; return metadata(); };
  f.sock.sendMessage = async (to,p) => { f.sent.push({ to, ...p }); if (++calls === 1) throw Error("network"); };
  const r = await createModerationDeleter({ claim: () => true })(f.input);
  assert.equal(r.status, "requested");
  assert.equal(calls, 2);
  assert.equal(refreshes, 2);
  assert.deepEqual(f.sent[0].delete, f.sent[1].delete);
});
test("permanent failures and rate-limit denial report failure without unbounded retries", async () => {
  const f = fixture(); let calls = 0;
  f.sock.sendMessage = async () => { calls++; throw Error("private server detail"); };
  assert.equal((await createModerationDeleter({ claim: () => true })(f.input)).status, "failed");
  assert.equal(calls, 2);
  assert.equal((await createModerationDeleter({ claim: () => false })(f.input)).status, "limited");
  assert.equal(calls, 2);
  assert.ok(!deletionNotice({ status: "failed" }).includes("private"));
});
test("concurrent copies share one deletion and hung sends stop at four outstanding operations", async () => {
  const f = fixture();
  const del = createModerationDeleter({ claim: () => true });
  await Promise.all([del(f.input), del(f.input)]);
  assert.equal(f.sent.length, 1);
  let calls = 0; const releases = [];
  f.sock.sendMessage = () => { calls++; return new Promise((r) => releases.push(r)); };
  const bounded = createModerationDeleter({ claim: () => true, sendTimeoutMs: 10 });
  try {
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => bounded({ ...f.input,
      msg: { key: { ...f.input.msg.key, id: "hung-" + i } } })));
    assert.equal(calls, 4);
    assert.equal(results.filter((r) => r.status === "timeout").length, 4);
    assert.equal(results.filter((r) => r.status === "limited").length, 4);
  } finally { releases.forEach((r) => r()); }
});
test("invalid cross-chat, missing-author and own-message keys are never sent for deletion", () => {
  assert.equal(moderationDeleteKey({ key: { id: "x", remoteJid: "other@g.us", participant: user } }, group), null);
  assert.equal(moderationDeleteKey({ key: { id: "x", remoteJid: group } }, group), null);
  assert.equal(moderationDeleteKey({ key: { id: "x", fromMe: true, participant: user } }, group), null);
});
test("all supported group status shapes reach moderation, including wrapped v2 content", () => {
  for (const name of ["groupStatusMentionMessage", "statusMentionMessage", "groupStatusMessage", "groupStatusMessageV2"]) {
    const event = { key: { id: "status-" + name, remoteJid: group, participant: user }, message: { [name]: { message: {} } } };
    assert.equal(validateMessage(event).ok, true);
    assert.equal(isGroupStatusMentionMessage(event), true);
    assert.equal(isGroupStatusMentionMessage({ message: { ephemeralMessage: { message: event.message } } }), true);
  }
});
test("resolved participant-update promises with denial status are not successful removal", () => {
  assert.equal(participantActionSucceeded([{ jid: user, status: "403" }], user), false);
  assert.equal(participantActionSucceeded([], user), false);
  assert.equal(participantActionSucceeded([{ jid: user, status: "200" }], user), true);
});
const dataModule = (s) => "data:text/javascript;base64," + Buffer.from(s).toString("base64");
async function load(file, replacements = {}) {
  const url = new URL(file, import.meta.url);
  const source = (await readFile(url,"utf8")).replace(/from "([^"]+)"/g, (_, spec) =>
    `from "${replacements[spec] ? dataModule(replacements[spec]) : spec.startsWith(".") ? new URL(spec,url).href : import.meta.resolve(spec)}"`);
  return import(dataModule(source) + "#" + Math.random());
}
test("anti-link deletes links in commands; explicit warn mode is reported without deleting", async () => {
  const warnings = [];
  globalThis.__modWarn = warnings;
  try {
    const mod = await load("../utils/automod.js", {
      "./moderation.js": "export const isProtectedGroupMember=()=>false; export const enforceMemberMute=async()=>({handled:false}); export const warnStatusMentionMember=async()=>({handled:false}); export const warnGroupMember=async(x)=>{globalThis.__modWarn.push(x);return {count:1};};",
      "./moderatorAuthority.js": "export const enforceModeratorMute=async()=>({handled:false});",
    });
    const f = fixture();
    const context = { ...f.input, senderJid: user, isOwner: false, isGroupAdmin: false,
      body: "$yta https://youtu.be/example", isCommand: true,
      groupData: { isAntiLinkOn: true, antiLinkAction: "delete" }, sendMessageWTyping: async()=>{} };
    assert.equal((await mod.handleAutomodMessage(context)).handled, true);
    assert.equal(f.sent.length, 1);
    assert.equal(warnings[0].deletion.status, "requested");
    await mod.handleAutomodMessage({ ...context, groupData: { isAntiLinkOn: true, antiLinkAction: "warn" } });
    assert.equal(f.sent.length, 1);
    assert.equal(warnings[1].deletion.status, "warn-only");
  } finally { delete globalThis.__modWarn; }
});
test("denied status removals retain strikes and warnings report deletion separately", async () => {
  const writes = [], texts = [];
  globalThis.__modDb = { findOne: async()=>({statusMentionWarnCount:[{member:user,count:2}]}),
    updateOne: async(...args)=>{writes.push(args);return {matchedCount:1};} };
  try {
    const mod = await load("../utils/moderation.js", {
      "../db/groupData.js": "export const group=globalThis.__modDb;",
      "../db/members.js": "export const member=globalThis.__modDb;",
      "../db/safePackData.js": "export const getSafeSettings=async()=>({warningExpiryDays:0});",
    });
    const f = fixture({ groupParticipantsUpdate: async()=>[{jid:user,status:"403"}] });
    const result = await mod.warnStatusMentionMember({ ...f.input,
      groupData:{isAntiStatusMentionOn:true}, sendMessageWTyping:async(_,p)=>texts.push(p.text) });
    assert.equal(result.count, 3);
    assert.equal(result.removed, false);
    assert.ok(!writes.some(([,update])=>update.$pull));
    assert.match(texts[0], /deletion requested/);
    assert.match(texts[0], /removal failed/);
  } finally { delete globalThis.__modDb; }
});
