import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createAuraEngine } from "../utils/aura/engine.js";
import { setup } from "./helpers/auraStore.js";
import { createGroupTextRewards } from "../utils/aura/groupTextRewards.js";
const a = "2348111111111@s.whatsapp.net", owner = "2348000000000@s.whatsapp.net";
const chat = "12345@g.us";
async function fixture() {
  const f = setup();
  await f.store.put("AuraSettings", { _id: "economy", enabled: true });
  let errors = 0;
  const clock = +new Date("2026-10-20T07:00:00Z");
  const reward = createGroupTextRewards({ engine: f.engine, store: f.store,
    resolveIdentity: async () => a, now: () => clock, onError: () => { errors++; } });
  const event = (id = "one", text = "Hello everyone 👋") => ({
    msg: { key: { id, remoteJid: chat, participant: a },
      message: { conversation: text }, messageTimestamp: clock / 1000 },
    senderJid: a, sock: {}, groupMetadata: { participants: [] },
  });
  return { ...f, reward, event, errors: () => errors, clock };
}
test("each distinct eligible group text earns exactly 20 with no XP or gift budget use", async () => {
  const f = await fixture();
  for (let i = 0; i < 3; i++) await f.reward(f.event(String(i)));
  const w = await f.engine.profile(a);
  assert.equal(w.balance, 60);
  assert.equal(w.xp, 0);
  assert.equal(w.chatAuraEarned, 60);
  assert.equal(w.rewardedTextMessages, 3);
  assert.equal((await f.engine.giftBudget(owner)).remaining, 512000000);
  assert.equal((await f.engine.history(a)).length, 3);
  assert.ok(!(JSON.stringify(await f.engine.history(a))).includes("Hello everyone"));
});
test("duplicate concurrent delivery credits once and receipt remains valid after engine restart", async () => {
  const f = await fixture();
  await Promise.all([f.reward(f.event()), f.reward(f.event())]);
  assert.equal((await f.engine.profile(a)).balance, 20);
  const restarted = createAuraEngine(f.store, { owner: () => owner });
  const again = await restarted.rewardGroupText(a, chat, "one");
  assert.equal(again.duplicate, true);
  assert.equal((await f.engine.profile(a)).balance, 20);
});
test("different messages with the same text and text commands remain eligible", async () => {
  const f = await fixture();
  await f.reward(f.event("one", "yes"));
  await f.reward(f.event("two", "yes"));
  await f.reward(f.event("three", "$aura"));
  assert.equal((await f.engine.profile(a)).balance, 60);
});
test("OFF and disabled group, private chats, self/bot, media, blank and history do not pay", async () => {
  const f = await fixture();
  const cases = [
    { groupEnabled: false },
    { botJids: [a] },
    { msg: { ...f.event().msg, key: { id: "dm", remoteJid: a } } },
    { msg: { ...f.event().msg, key: { id: "self", remoteJid: chat, fromMe: true } } },
    { msg: { ...f.event().msg, message: { imageMessage: { caption: "media" } } } },
    { msg: { ...f.event().msg, message: { conversation: " \n\u200b " } } },
    { msg: { ...f.event().msg, messageTimestamp: f.clock / 1000 - 121 } },
    { msg: { ...f.event().msg, messageTimestamp: f.clock / 1000 + 31 } },
    { msg: { ...f.event().msg, messageTimestamp: undefined } },
  ];
  for (const patch of cases) await f.reward({ ...f.event(), ...patch });
  assert.equal((await f.engine.profile(a)).balance, 0);
  await f.store.put("AuraSettings", { _id: "economy", enabled: false });
  await f.reward(f.event());
  assert.equal((await f.engine.profile(a)).balance, 0);
  assert.equal((await f.engine.history(a)).length, 0);
  assert.equal((await f.engine.rewardGroupText(a, chat, "direct-off")).disabled, true);
});
test("extended text, multilingual text and normal emoji qualify without content logging", async () => {
  const f = await fixture(), e = f.event();
  e.msg.message = { extendedTextMessage: { text: "Ẹ káàrọ̀ 👨‍👩‍👧‍👦 العربية" } };
  await f.reward(e);
  assert.equal((await f.engine.profile(a)).balance, 20);
});
test("creator is unlimited and does not receive passive minted rewards", async () => {
  const f = await fixture();
  assert.equal((await f.engine.rewardGroupText(owner, chat, "owner")).creator, true);
  assert.equal((await f.engine.profile(owner)).balance, 0);
});
test("wallet cap includes held fees, clips reward safely and never mints twice after space opens", async () => {
  const f = await fixture();
  await f.store.put("AuraWallets", { ...(await f.engine.profile(a)), balance: 999999999985 });
  await f.store.put("AuraCharges", { _id: "hold", actor: a, status: "reserved", amount: 10 });
  const r = await f.reward(f.event());
  assert.equal(r.reward, 5);
  assert.equal(r.capReached, true);
  const w = await f.engine.profile(a);
  w.balance -= 100;
  await f.store.put("AuraWallets", w);
  await f.reward(f.event());
  assert.equal((await f.engine.profile(a)).balance, 999999999890);
});
test("identity/database/malformed timestamp errors are silent and diagnostics are rate bounded", async () => {
  const f = await fixture();
  const bad = createGroupTextRewards({ engine: f.engine, store: f.store,
    resolveIdentity: async () => { throw Error("private detail"); },
    now: () => f.clock, onError: () => { throw Error("logger failed"); } });
  await bad(f.event());
  const broken = createGroupTextRewards({ engine: f.engine,
    store: { get: async () => { throw Error("db"); } },
    now: () => f.clock, onError: () => {} });
  await broken(f.event());
  const e = f.event();
  e.msg.messageTimestamp = { toNumber: () => { throw Error("malformed"); } };
  await f.reward(e);
  await f.reward(e);
  assert.equal(f.errors(), 1);
  assert.equal((await f.engine.profile(a)).balance, 0);
});
test("reward boundary follows moderation and precedes passive community handling", async () => {
  const source = await readFile(new URL("../core/messages.js", import.meta.url), "utf8");
  assert.ok(source.indexOf("await rewardGroupText({") > source.indexOf("if (safeResult.handled) return"));
  assert.ok(source.indexOf("await handlePassiveCommunityMessage(sock, msg)") > source.indexOf("await rewardGroupText({"));
  const events = await readFile(new URL("../core/events.js", import.meta.url), "utf8");
  assert.ok(!events.includes("await handlePassiveCommunityMessage("));
  assert.match(events, /upsert.type !== "notify"/);
});
