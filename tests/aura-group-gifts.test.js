import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/auraStore.js";
import { cleanAuraName, auraDisplayName, escapeAuraSvg } from "../utils/aura/displayName.js";
import { auraGiftRoster } from "../utils/aura/groupGiftRoster.js";
const owner = "2348000000000@s.whatsapp.net";
const a = "2348111111111@s.whatsapp.net", b = "2348222222222@s.whatsapp.net";
const group = "12345@g.us";
async function enabled() {
  const ctx = setup();
  await ctx.store.put("AuraSettings", { _id: "economy", enabled: true });
  return ctx;
}
test("all members can set display-only names without gaining creator privileges", async () => {
  const { engine } = await enabled();
  await engine.setNickname(a, "Martech Fan", "name");
  const w = await engine.profile(a);
  assert.equal(w.nickname, "Martech Fan");
  assert.equal(w.balance, 0);
  assert.equal(engine.owned(a), false);
  await engine.setNickname(a, "reset", "reset");
  assert.equal((await engine.profile(a)).nickname, undefined);
  await assert.rejects(engine.setNickname(a, "*", "bad"), /2–40/);
});
test("display names preserve multilingual emoji, bound text, strip injected lines/formatting and never fall back to phone numbers", () => {
  assert.equal(cleanAuraName("  Ẹ káàrọ̀ 👨‍👩‍👧‍👦  "), "Ẹ káàrọ̀ 👨‍👩‍👧‍👦".normalize("NFC"));
  assert.equal(cleanAuraName("*Boss*\n@all<admin>"), "Boss alladmin");
  assert.equal([...cleanAuraName("a".repeat(5000))].length, 40);
  assert.equal(auraDisplayName({}, {}, {}), "Alpha member");
  assert.equal(auraDisplayName({ nickname: "Custom" }, { updateName: "WA" }), "Custom");
  assert.equal(escapeAuraSvg("A&B<"), "A&amp;B&lt;");
});
test("fresh group roster deduplicates PN/LID and excludes bot plus creator", async () => {
  const sock = { user: { id: "9999999@lid" }, groupMetadata: async () => ({ participants: [
    { id: "9999999@lid", phoneNumber: "2348333333333@s.whatsapp.net" },
    { id: owner }, { id: a, lid: "1111111@lid" }, { id: "1111111@lid", phoneNumber: a },
    { id: b }, { id: "7777777@lid" },
  ] }) };
  const r = await auraGiftRoster(sock, group, (id) => id === owner);
  assert.deepEqual(r.targets, [a, b]);
  assert.equal(r.unverified, 1);
  assert.equal(r.excluded, 2);
  await assert.rejects(auraGiftRoster({}, group, () => false), /refresh/);
  await assert.rejects(auraGiftRoster({ groupMetadata: async () => ({ participants: [] }) }, group, () => false), /Invalid/);
});
test("group preview spends nothing and confirmation credits everyone with private receipts", async () => {
  const { engine, store } = await enabled();
  const p = await engine.previewGroupGift(owner, group, [a, b, a, owner], "50000");
  assert.equal(p.count, 2);
  assert.equal(p.total, 100000);
  assert.equal((await engine.profile(a)).balance, 0);
  const r = await engine.giftGroup(owner, group, [b, a], "50000", "gift");
  assert.equal(r.total, 100000);
  assert.equal(r.remaining, 400000);
  assert.equal((await engine.profile(a)).balance, 50000);
  assert.equal((await engine.profile(b)).balance, 50000);
  const receipt = await store.get("AuraLedger", r.receipt);
  assert.equal(receipt.kind, "group-gift");
  for (const target of [a,b]) {
    const history = await engine.history(target);
    assert.equal(history.length, 1);
    assert.equal(history[0].kind, "group-gift-received");
    assert.equal(history[0].result.receipt, r.receipt);
  }
});
test("missing, expired, changed and already-used previews cannot pay", async () => {
  const { engine, advance } = await enabled();
  await assert.rejects(engine.giftGroup(owner, group, [a], 1, "missing"), /Preview/);
  await engine.previewGroupGift(owner, group, [a], 1);
  await assert.rejects(engine.giftGroup(owner, group, [a,b], 1, "roster"), /Preview/);
  await assert.rejects(engine.giftGroup(owner, group, [a], 2, "amount"), /Preview/);
  advance(1);
  await assert.rejects(engine.giftGroup(owner, group, [a], 1, "expired"), /Preview/);
  await engine.previewGroupGift(owner, group, [a], 1);
  await engine.giftGroup(owner, group, [a], 1, "first");
  await assert.rejects(engine.giftGroup(owner, group, [a], 1, "second"), /Preview/);
  assert.equal((await engine.profile(a)).balance, 1);
});
test("same confirmation replay and concurrent confirmations pay only once", async () => {
  const { engine } = await enabled();
  await engine.previewGroupGift(owner, group, [a,b], 50000);
  const [x,y] = await Promise.all([
    engine.giftGroup(owner, group, [a,b], 50000, "same"),
    engine.giftGroup(owner, group, [a,b], 50000, "same"),
  ]);
  assert.equal(y.duplicate, true);
  assert.equal(x.receipt, y.receipt);
  assert.equal((await engine.profile(a)).balance, 50000);
  await engine.previewGroupGift(owner, group, [a,b], 50000);
  const r = await Promise.allSettled([
    engine.giftGroup(owner, group, [a,b], 50000, "one"),
    engine.giftGroup(owner, group, [a,b], 50000, "two"),
  ]);
  assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal((await engine.profile(a)).balance, 100000);
});
test("group gifts share daily gift/coupon mint budget and reject oversized totals before writing", async () => {
  const { engine } = await enabled();
  await engine.gift(owner, a, 400000, "personal");
  await assert.rejects(engine.previewGroupGift(owner, group, [a,b], 50001), /Maximum per member.*50000/);
  await engine.previewGroupGift(owner, group, [a,b], 50000);
  await engine.giftGroup(owner, group, [a,b], 50000, "all");
  assert.equal((await engine.giftBudget(owner)).remaining, 0);
  await assert.rejects(engine.gift(owner, b, 1, "over"), /budget/);
});
test("recipient wallet cap includes held fees and aborts the entire group gift", async () => {
  const { engine, store } = await enabled();
  await store.put("AuraWallets", { ...(await engine.profile(b)), balance: 999999999999 });
  await store.put("AuraCharges", { _id: "hold", actor: b, status: "reserved", amount: 1 });
  await engine.previewGroupGift(owner, group, [a,b], 1);
  await assert.rejects(engine.giftGroup(owner, group, [a,b], 1, "capped"), /balance limit/);
  assert.equal((await engine.profile(a)).balance, 0);
  assert.equal((await engine.giftBudget(owner)).remaining, 500000);
  assert.equal((await engine.history(a)).length, 0);
});
test("owner identity, positive amount, group, bounded roster and enabled economy are required", async () => {
  const { engine, store } = await enabled();
  await assert.rejects(engine.previewGroupGift(a, group, [b], 1), /Only the configured creator/);
  await assert.rejects(engine.previewGroupGift(owner, a, [b], 1), /group chat/);
  await assert.rejects(engine.previewGroupGift(owner, group, [b], "0"));
  await assert.rejects(engine.previewGroupGift(owner, group, ["bad@lid"], 1), /verified phone/);
  await assert.rejects(engine.previewGroupGift(owner, group, Array(1025).fill(a), 1), /1,024/);
  await store.put("AuraSettings", { _id: "economy", enabled: false });
  await assert.rejects(engine.previewGroupGift(owner, group, [a], 1), /OFF/);
  assert.equal((await engine.giftBudget(owner)).remaining, 500000);
});
test("activation changes and budget races are checked again on confirmation", async () => {
  const { engine, store } = await enabled();
  await engine.previewGroupGift(owner, group, [a], 300000);
  await store.put("AuraSettings", { _id: "economy", enabled: false });
  await assert.rejects(engine.giftGroup(owner, group, [a], 300000, "off"), /OFF/);
  await store.put("AuraSettings", { _id: "economy", enabled: true });
  await engine.previewGroupGift(owner, "99999@g.us", [b], 300000);
  const r = await Promise.allSettled([
    engine.giftGroup(owner, group, [a], 300000, "one"),
    engine.giftGroup(owner, "99999@g.us", [b], 300000, "two"),
  ]);
  assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal((await engine.giftBudget(owner)).remaining, 200000);
});
