import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { setup } from "./helpers/auraStore.js";
import { SHOP, EVO } from "../utils/aura/policy.js";
import { inventoryStatus } from "../utils/aura/inventory.js";
import { auraProfilePayload } from "../utils/aura/profile.js";
import { shopCardPayload } from "../utils/aura/shopCard.js";
import { salvageRefund } from "../utils/aura/refunds.js";
const a = "2348000000001@s.whatsapp.net";
async function seeded(evo = 4) {
  const f = setup();
  await f.store.put("AuraWallets", {
    ...(await f.engine.profile(a)),
    balance: 10000000000,
    evo,
    quests: 500,
    bagSlots: 128,
  });
  return f;
}
test("Evo and ultimate ranks award permanent signature frames and titles atomically", async () => {
  const { engine: e } = await seeded();
  const first = await e.evolve(a, "rank5");
  assert.equal(first.evo, "Evo");
  assert.equal((await e.evolve(a, "rank5")).duplicate, true);
  let w = await e.profile(a);
  assert.equal(w.balance, 9900000000);
  assert.equal(w.equipped, "evo-sovereign-frame");
  assert.equal(w.prestigeTitle, "Evo Sovereign");
  assert.equal(inventoryStatus(w).used, 0);
  await e.evolve(a, "rank6");
  w = await e.profile(a);
  assert.equal(w.equipped, "legendary-infinity-frame");
  assert.equal(w.prestigeTitle, "Evo-Legendary+ Sovereign");
  assert.equal(w.balance, 8900000000);
  await assert.rejects(e.evolve(a, "rank7"), /ultimate/);
  assert.equal((await e.profile(a)).balance, w.balance);
});
test("prestige requires quests and funds; gated items and storage cannot bypass rank", async () => {
  const { engine: e, store } = await seeded(4);
  await assert.rejects(e.buy(a, "evo-phoenix", "locked"), /Unlock Evo/);
  await assert.rejects(e.expandBag(a, "lockedbag"), /Unlock Evo/);
  const w = await e.profile(a);
  w.quests = 199;
  await store.put("AuraWallets", w);
  await assert.rejects(e.evolve(a, "quests"), /200 quests/);
  w.quests = 200;
  w.balance = 99999999;
  await store.put("AuraWallets", w);
  await assert.rejects(e.evolve(a, "funds"), /Not enough/);
  assert.equal((await e.profile(a)).evo, 4);
});
test("huge bag capacities stay sparse and each upgrade is charged once", async () => {
  const { engine: e } = await seeded(5);
  await e.expandBag(a, "evobag");
  assert.equal((await e.expandBag(a, "evobag")).duplicate, true);
  assert.equal(inventoryStatus(await e.profile(a)).capacity, 10000);
  await assert.rejects(
    e.expandBag(a, "ultimate-locked"),
    /Unlock Evo-Legendary/,
  );
  await e.evolve(a, "ultimate");
  await e.expandBag(a, "ultimatebag");
  const w = await e.profile(a);
  assert.equal(inventoryStatus(w).capacity, 9999999);
  assert.equal(w.inventory.length, 0);
  assert.ok(JSON.stringify(w).length < 2000);
  await assert.rejects(e.expandBag(a, "max"), /maximum/);
});
test("price increases cannot turn salvage into profit and permanent rewards cannot be sold", async () => {
  const { engine: e, store } = await seeded(5);
  const product = SHOP.find((x) => x.id === "ruby-frame");
  assert.equal(
    salvageRefund({ purchaseCosts: { "ruby-frame": 8000 } }, product),
    2000,
  );
  assert.equal(salvageRefund({}, product), 2000);
  await e.buy(a, "ruby-frame", "purchase");
  let w = await e.profile(a);
  assert.equal(w.purchaseCosts["ruby-frame"], 600000);
  const result = await e.salvage(a, "ruby-frame", "sale");
  assert.equal(result.reward, 150000);
  await assert.rejects(
    e.salvage(a, "evo-sovereign-frame", "reward-sale"),
    /Unknown shop item/,
  );
});
test("shop catalogue is ordered descending, with bounded image pages and distinct prestige portraits", async () => {
  for (let i = 1; i < SHOP.length; i++)
    assert.ok(SHOP[i - 1].price >= SHOP[i].price);
  const page = shopCardPayload(SHOP, "all", 1, 7, "Accessible price list");
  assert.ok(page.image);
  assert.equal(page.caption, "Accessible price list");
  const meta = await sharp(page.image).metadata();
  assert.equal(meta.width, 1000);
  assert.equal(meta.height, 1420);
  const sock = {
    profilePictureUrl: async () => {
      throw Error("private");
    },
  };
  const evo = await auraProfilePayload(sock, a, "Evo", "evo-sovereign-frame");
  const ultimate = await auraProfilePayload(
    sock,
    a,
    "Ultimate",
    "legendary-infinity-frame",
  );
  assert.equal((await sharp(ultimate.image).metadata()).height, 820);
  assert.notDeepEqual(evo.image, ultimate.image);
  assert.ok(EVO.at(-1).price > EVO.at(-2).price);
});
