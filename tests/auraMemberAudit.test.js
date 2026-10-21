import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/auraStore.js";
import { COLLECTIBLES } from "../utils/aura/policy.js";
import { auraIdentity, withAuraSenderAliases } from "../utils/aura/identity.js";
import { createGroupTextRewards } from "../utils/aura/groupTextRewards.js";
const a = "2348111111111@s.whatsapp.net", b = "2348222222222@s.whatsapp.net";
const owner = "2348000000000@s.whatsapp.net", lid = "12345678@lid";
async function full(extra = {}) {
  const f = setup();
  await f.store.put("AuraWallets", { ...(await f.engine.profile(a)), balance: 1e12, ...extra });
  return f;
}
test("daily streak, conduct and XP still progress at the wallet cap without exceeding held-fee headroom", async () => {
  const f = await full({ balance: 1e12 - 20, conduct: 90 });
  await f.store.put("AuraCharges", { _id: "held", actor: a, status: "reserved", amount: 10 });
  const r = await f.engine.daily(a);
  assert.equal(r.reward, 10);
  assert.equal(r.capReached, true);
  const w = await f.engine.profile(a);
  assert.equal(w.balance + w.heldAura, 1e12);
  assert.equal(w.xp, 50);
  assert.equal(w.streak, 1);
  assert.equal(w.conduct, 91);
  assert.equal((await f.engine.daily(a)).duplicate, true);
});
test("a correct quest completes and awards XP even when no Aura fits", async () => {
  const f = await full();
  await f.store.put("AuraQuests", { _id: "q", actor: a, answer: 1,
    expiresAt: new Date("2026-10-20T08:00:00Z") });
  const r = await f.engine.quest(a, "q", "1", "answer");
  assert.equal(r.correct, true);
  assert.equal(r.reward, 0);
  assert.equal(r.capReached, true);
  const w = await f.engine.profile(a);
  assert.equal(w.xp, 100);
  assert.equal(w.quests, 1);
  assert.equal((await f.store.get("AuraQuests", "q")).done, true);
});
test("the final collectible and Curator badge are not blocked by a full wallet", async () => {
  const f = await full({ collection: COLLECTIBLES.slice(0, -1).map((x) => x.id) });
  const r = await f.engine.collect(a);
  assert.equal(r.complete, true);
  assert.equal(r.reward, 0);
  assert.equal(r.capReached, true);
  const w = await f.engine.profile(a);
  assert.equal(w.collection.length, COLLECTIBLES.length);
  assert.ok(w.badges.includes("Collection Curator"));
  assert.equal(w.balance, 1e12);
});
test("salvage reports insufficient headroom without removing an item or its purchase basis", async () => {
  const f = await full({ inventory: ["ruby-frame"], purchaseCosts: { "ruby-frame": 600000 } });
  await assert.rejects(f.engine.salvage(a, "ruby-frame", "sale"), /wallet space.*item was not removed/);
  const w = await f.engine.profile(a);
  assert.deepEqual(w.inventory, ["ruby-frame"]);
  assert.equal(w.purchaseCosts["ruby-frame"], 600000);
});
test("a coupon is never consumed for a truncated payout when the winner's wallet is full", async () => {
  const f = await full();
  const coupon = await f.engine.createCoupon(owner, "20000", "create");
  await assert.rejects(f.engine.redeem(a, coupon.code, "12345@g.us", "blocked"), /code was not consumed/);
  const w = await f.engine.profile(a);
  w.balance -= 20000;
  await f.store.put("AuraWallets", w);
  assert.equal((await f.engine.redeem(a, coupon.code, "12345@g.us", "retry")).reward, 20000);
});
test("history views keep purchases visible separately from passive chat credits", async () => {
  const f = setup();
  await f.store.put("AuraSettings", { _id: "economy", enabled: true });
  await f.engine.gift(owner, a, 10000, "seed");
  await f.engine.buy(a, "tagline-ticket", "buy");
  for (let i = 0; i < 20; i++) await f.engine.rewardGroupText(a, "12345@g.us", "text-" + i);
  const main = await f.engine.history(a, "important"), chat = await f.engine.history(a, "chat");
  assert.ok(main.some((x) => x.kind === "buy"));
  assert.ok(main.every((x) => x.kind !== "group-text"));
  assert.ok(chat.every((x) => x.kind === "group-text"));
  await assert.rejects(async () => f.engine.history(a, "__proto__"), /history/);
});
test("protocol phone aliases resolve only the paired sender, never another recipient or role flag", async () => {
  const info = withAuraSenderAliases({ senderJid: lid, isOwner: true }, {
    key: { participant: lid, participantPn: a, remoteJid: "12345@g.us" } });
  assert.equal(await auraIdentity({}, info), a);
  await assert.rejects(auraIdentity({}, info, "99999999@lid"), /cannot verify/);
  const unrelated = withAuraSenderAliases({ senderJid: lid }, {
    key: { participant: "87654321@lid", participantPn: owner } });
  await assert.rejects(auraIdentity({}, unrelated), /cannot verify/);
  assert.equal(await auraIdentity({}, info, b), b);
});
test("LID text rewards use the real paired phone alias even without metadata or mapping cache", async () => {
  const f = setup();
  await f.store.put("AuraSettings", { _id: "economy", enabled: true });
  const reward = createGroupTextRewards({ engine: f.engine, store: f.store, resolveIdentity: auraIdentity });
  await reward({ sock: {}, senderJid: lid, groupMetadata: { participants: [] },
    msg: { key: { id: "paired", participant: lid, participantAlt: a, remoteJid: "12345@g.us" },
      messageTimestamp: Date.now() / 1000, message: { conversation: "Hello!" } } });
  assert.equal((await f.engine.profile(a)).balance, 20);
});
test("hung identity mappings have a timeout and at most four outstanding lookups", async () => {
  const releases = [];
  let calls = 0;
  const sock = { signalRepository: { lidMapping: { getPNForLID: () => {
    calls++;
    return new Promise((resolve) => releases.push(resolve));
  } } } };
  try {
    const result = await Promise.allSettled(Array.from({ length: 5 }, (_, i) =>
      auraIdentity(sock, { senderJid: (12345670 + i) + "@lid" })));
    assert.equal(calls, 4);
    assert.ok(result.every((x) => x.status === "rejected" && /cannot verify/.test(x.reason.message)));
  } finally { releases.forEach((resolve) => resolve(a)); }
});
