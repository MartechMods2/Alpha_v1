import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/auraStore.js";
import { PACKS, packStock } from "../utils/aura/packs.js";
import { SHOP, EVO } from "../utils/aura/policy.js";
import { inventoryStatus } from "../utils/aura/inventory.js";
import { salvageRefund } from "../utils/aura/refunds.js";
const actor = "2348111111111@s.whatsapp.net";
const owner = "2348000000000@s.whatsapp.net";
async function funded(balance = 20000000, extras = {}) {
  const ctx = setup();
  await ctx.store.put("AuraWallets", { _id: actor, balance, xp: 0, quests: 0,
    evo: 0, inventory: [], items: {}, badges: [], conduct: 100, ...extras });
  return ctx;
}
test("Infinity costs exactly 9,999,999 and grants all shop stock, top Evo and sparse maximum bag", async () => {
  const { engine } = await funded();
  const result = await engine.buyPack(actor, "infinity", "first");
  const w = await engine.profile(actor);
  assert.equal(result.spent, 9999999);
  assert.equal(w.balance, 10000001);
  assert.equal(w.evo, EVO.length - 1);
  assert.equal(w.equipped, EVO.at(-1).frame);
  assert.equal(w.prestigeTitle, EVO.at(-1).title);
  assert.equal(w.bagSlots, 9999999);
  assert.equal(w.xp, 0);
  assert.equal(w.quests, 0);
  assert.equal(engine.owned(actor), false);
  for (const item of SHOP) {
    if (item.kind === "tool") assert.equal(w.items[item.id], item.max);
    else assert.ok(w.inventory.includes(item.id));
    assert.equal(salvageRefund(w, item), 0);
  }
  assert.ok(inventoryStatus(w).used < 100);
});
test("transaction rollback leaves poor wallets unchanged and unknown packs fail", async () => {
  const { engine } = await funded(9999998);
  const before = await engine.profile(actor);
  await assert.rejects(engine.buyPack(actor, "infinity", "poor"), /Not enough Aura/);
  assert.deepEqual(await engine.profile(actor), before);
  await assert.rejects(engine.buyPack(actor, "__proto__", "invalid"), /Choose a pack/);
});
test("same event replay spends once; a different event cannot refill an owned pack", async () => {
  const { engine } = await funded();
  const [a,b] = await Promise.all([
    engine.buyPack(actor, "infinity", "same"), engine.buyPack(actor, "infinity", "same")
  ]);
  assert.equal(a.spent, 9999999);
  assert.equal(b.duplicate, true);
  await assert.rejects(engine.buyPack(actor, "infinity", "again"), /already owned/);
  assert.equal((await engine.profile(actor)).balance, 10000001);
});
test("two concurrent distinct purchases cannot buy the same one-time pack twice", async () => {
  const { engine } = await funded();
  const r = await Promise.allSettled([
    engine.buyPack(actor, "infinity", "one"), engine.buyPack(actor, "infinity", "two")
  ]);
  assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal((await engine.profile(actor)).balance, 10000001);
});
test("overlapping packs skip owned cosmetics, preserve paid basis and do not lower progress or storage", async () => {
  const tool = SHOP.find((x) => x.kind === "tool");
  const cosmetic = SHOP.find((x) => x.kind !== "tool" && !x.evo);
  const { engine } = await funded(20000000, {
    evo: 6, xp: 12345, quests: 222, rp: 777, bagSlots: 9999999,
    inventory: [cosmetic.id], items: { [tool.id]: 1 },
    purchaseCosts: { [cosmetic.id]: 123, [tool.id]: [456] }
  });
  await engine.buyPack(actor, "pro", "pro");
  let w = await engine.profile(actor);
  assert.equal(w.purchaseCosts[cosmetic.id], 123);
  assert.equal(w.purchaseCosts[tool.id][0], 456);
  assert.ok(w.purchaseCosts[tool.id].slice(1).every((n) => n === 0));
  assert.equal(w.evo, 6);
  assert.equal(w.bagSlots, 9999999);
  assert.equal(w.xp, 12345);
  assert.equal(w.quests, 222);
  assert.equal(w.rp, 777);
  await engine.buyPack(actor, "infinity", "upgrade");
  w = await engine.profile(actor);
  assert.equal(new Set(w.inventory).size, w.inventory.length);
  assert.equal(w.items[tool.id], tool.max);
  assert.deepEqual(w.packs, ["pro", "infinity"]);
});
test("pack tiers cover their advertised stock and creator alone spends zero", async () => {
  for (const pack of PACKS) {
    const { engine } = await funded();
    await engine.buyPack(actor, pack.id, pack.id);
    const w = await engine.profile(actor);
    for (const item of packStock(pack))
      assert.ok(item.kind === "tool" ? w.items[item.id] === item.max : w.inventory.includes(item.id));
    assert.equal(w.evo, pack.evo);
    assert.equal(w.bagSlots, pack.slots);
    assert.ok(inventoryStatus(w).used <= inventoryStatus(w).capacity);
  }
  const { engine } = setup();
  assert.equal((await engine.buyPack(owner, "infinity", "owner")).spent, 0);
  assert.equal(engine.owned(actor), false);
});
