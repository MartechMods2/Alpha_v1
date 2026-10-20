import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/auraStore.js";
import { SHOP } from "../utils/aura/policy.js";
import { inventoryStatus, inventoryUsed } from "../utils/aura/inventory.js";
const owner = "2348000000000@s.whatsapp.net",
  a = "2348000000001@s.whatsapp.net";
const funded = async () => {
  const f = setup();
  await f.store.put("AuraWallets", {
    ...(await f.engine.profile(a)),
    balance: 10000000000,
  });
  return f;
};
const choices = () => SHOP.filter((x) => x.kind !== "tool" && !x.xp && !x.evo);
const fill = async (e) => {
  for (const item of choices().slice(0, 20))
    await e.buy(a, item.id, "buy-" + item.id);
};
test("catalogue has varied, unique stock with valid prices and categories", () => {
  assert.equal(SHOP.length, 53);
  assert.equal(new Set(SHOP.map((x) => x.id)).size, 53);
  for (const kind of ["pet", "emblem", "frame", "theme", "title", "tool"])
    assert.ok(SHOP.some((x) => x.kind === kind));
  for (const item of SHOP)
    assert.ok(Number.isSafeInteger(item.price) && item.price > 0);
});
test("starter inventory counts each cosmetic and consumable unit, while album is separate", () => {
  const w = {
    inventory: ["one", "two"],
    items: { ticket: 2 },
    collection: ["card"],
    badges: ["badge"],
  };
  assert.equal(inventoryUsed(w), 4);
  assert.equal(inventoryStatus(w).capacity, 20);
});
test("full inventory cannot charge or add an item; expansion and replay are atomic", async () => {
  const { engine: e } = await funded();
  await fill(e);
  const before = (await e.profile(a)).balance;
  const next = SHOP.find((x) => x.id === "pet-treat");
  await assert.rejects(e.buy(a, next.id, "full"), /Inventory full/);
  assert.equal((await e.profile(a)).balance, before);
  const r = await e.expandBag(a, "expand");
  assert.equal(r.slots, 24);
  assert.equal((await e.expandBag(a, "expand")).duplicate, true);
  assert.equal((await e.profile(a)).balance, before - 120000);
  await e.buy(a, next.id, "after");
  assert.equal(inventoryStatus(await e.profile(a)).used, 21);
});
test("concurrent buys for the last slot never overfill", async () => {
  const { engine: e } = await funded();
  const stock = choices();
  for (const item of stock.slice(0, 19)) await e.buy(a, item.id, item.id);
  const r = await Promise.allSettled(
    stock.slice(19, 22).map((x) => e.buy(a, x.id, x.id)),
  );
  assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(inventoryStatus(await e.profile(a)).used, 20);
});
test("old oversized inventories are preserved and upgrades skip tiers that add no space", async () => {
  const { engine: e, store } = setup();
  await e.gift(owner, a, 200000, "g");
  let w = await e.profile(a);
  delete w.inventoryFloor;
  w.inventory = SHOP.filter((x) => x.kind !== "tool")
    .slice(0, 20)
    .map((x) => x.id);
  await store.put("AuraWallets", w);
  assert.equal(inventoryStatus(await e.profile(a)).capacity, 20);
  await assert.rejects(e.buy(a, "pet-treat", "full"), /full/);
  assert.equal((await e.profile(a)).inventory.length, 20);
  const upgraded = await e.expandBag(a, "upgrade");
  assert.equal(upgraded.slots, 24);
  assert.equal(upgraded.spent, 120000);
});
test("maximum bag upgrade refuses further debits", async () => {
  const { engine: e } = await funded();
  for (let i = 0; i < 4; i++) await e.expandBag(a, "e" + i);
  const before = (await e.profile(a)).balance;
  await assert.rejects(e.expandBag(a, "e5"), /Unlock Evo/);
  assert.equal((await e.profile(a)).balance, before);
  assert.equal(inventoryStatus(await e.profile(a)).capacity, 128);
});
test("salvage frees space, clears equipped state and returns only 25 percent once", async () => {
  const { engine: e, store } = await funded();
  await e.buy(a, "ruby-frame", "buy");
  let w = await e.profile(a);
  w.equipped = "ruby-frame";
  await store.put("AuraWallets", w);
  const r = await e.salvage(a, "ruby-frame", "salvage");
  assert.equal(r.reward, 150000);
  assert.equal((await e.salvage(a, "ruby-frame", "salvage")).duplicate, true);
  w = await e.profile(a);
  assert.equal(w.balance, 9999550000);
  assert.equal(w.equipped, undefined);
  assert.equal(inventoryStatus(w).used, 0);
  await assert.rejects(e.salvage(a, "ruby-frame", "again"), /do not own/);
});
test("pet treats consume a slot, grow a separate pet bond and enforce shared daily limit", async () => {
  const { engine: e, store, advance } = setup();
  await e.gift(owner, a, 30000, "g");
  await e.buy(a, "byte-fox", "pet");
  let w = await e.profile(a);
  w.pet = "byte-fox";
  await store.put("AuraWallets", w);
  for (let i = 0; i < 4; i++) await e.buy(a, "pet-treat", "t" + i);
  for (let i = 0; i < 3; i++) await e.useItem(a, "pet-treat", "", "u" + i);
  await assert.rejects(
    e.useItem(a, "pet-treat", "", "limit"),
    /Three companion/,
  );
  w = await e.profile(a);
  assert.equal(w.items["pet-treat"], 1);
  assert.equal(w.petBonds["byte-fox"], 3);
  assert.equal(w.xp, 0);
  assert.equal(inventoryStatus(w).used, 2);
  advance(1);
  await e.useItem(a, "pet-treat", "", "tomorrow");
  assert.equal((await e.profile(a)).petBonds["byte-fox"], 4);
});
