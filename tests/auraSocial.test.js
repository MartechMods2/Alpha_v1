import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/auraStore.js";
import { SHOP } from "../utils/aura/policy.js";
import { inventoryStatus } from "../utils/aura/inventory.js";
const a = "2348000000001@s.whatsapp.net",
  b = "2348000000002@s.whatsapp.net",
  c = "2348000000003@s.whatsapp.net",
  owner = "2348000000000@s.whatsapp.net";
async function seed(f, id, extra = {}) {
  await f.store.put("AuraWallets", {
    ...(await f.engine.profile(id)),
    ...extra,
  });
}
test("item gifts atomically move ownership and paid cost, clear equipment and never mint Aura", async () => {
  const f = setup(),
    e = f.engine;
  await seed(f, a, { balance: 20000 });
  await e.buy(a, "byte-fox", "buy");
  let w = await e.profile(a);
  w.pet = "byte-fox";
  w.petBonds = { "byte-fox": 19 };
  await seed(f, a, w);
  const r = await e.giftItem(a, b, "byte-fox", "gift");
  assert.equal(r.item, "byte-fox");
  assert.equal((await e.giftItem(a, b, "byte-fox", "gift")).duplicate, true);
  w = await e.profile(a);
  const receiver = await e.profile(b);
  assert.equal(w.balance, 12000);
  assert.equal(receiver.balance, 0);
  assert.equal(w.pet, undefined);
  assert.equal(w.petBonds["byte-fox"], 19);
  assert.equal(receiver.petBonds, undefined);
  assert.deepEqual(receiver.inventory, ["byte-fox"]);
  assert.equal(receiver.purchaseCosts["byte-fox"], 8000);
  assert.equal(inventoryStatus(w).used, 0);
  assert.equal(inventoryStatus(receiver).used, 1);
  assert.ok((await e.history(b)).some((x) => x.kind === "item-gift-received"));
});
test("competing item gifts cannot duplicate ownership", async () => {
  const f = setup(),
    e = f.engine;
  await seed(f, a, { inventory: ["byte-fox"] });
  const r = await Promise.allSettled([
    e.giftItem(a, b, "byte-fox", "one"),
    e.giftItem(a, c, "byte-fox", "two"),
  ]);
  assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(
    (await e.profile(b)).inventory.length +
      (await e.profile(c)).inventory.length,
    1,
  );
});
test("full bags, duplicate items, unlock gates and nontransferable rewards reject without removing sender stock", async () => {
  const f = setup(),
    e = f.engine;
  await seed(f, a, { inventory: ["byte-fox", "royal-frame", "evo-phoenix"] });
  await assert.rejects(e.giftItem(a, a, "byte-fox", "self"), /another member/);
  await seed(f, b, {
    inventory: Array.from({ length: 20 }, (_, i) => "old-" + i),
  });
  await assert.rejects(e.giftItem(a, b, "byte-fox", "full"), /Inventory full/);
  await seed(f, b, { inventory: ["byte-fox"] });
  await assert.rejects(e.giftItem(a, b, "byte-fox", "dup"), /already owns/);
  await assert.rejects(
    e.giftItem(a, b, "royal-frame", "xp"),
    /2000 lifetime XP/,
  );
  await assert.rejects(e.giftItem(a, b, "evo-phoenix", "evo"), /unlock Evo/);
  await assert.rejects(
    e.giftItem(a, b, "legendary-infinity-frame", "reward"),
    /prestige rewards/,
  );
  assert.equal((await e.profile(a)).inventory.length, 3);
});
test("tool gifts transfer one unit and preserve zero-cost creator provenance", async () => {
  const f = setup(),
    e = f.engine;
  await e.buy(owner, "tagline-ticket", "ownerbuy");
  await e.giftItem(owner, b, "tagline-ticket", "gift");
  assert.equal((await e.profile(b)).items["tagline-ticket"], 1);
  assert.equal((await e.salvage(b, "tagline-ticket", "sale")).reward, 0);
  await seed(f, a, {
    items: { "pet-treat": 2 },
    purchaseCosts: { "pet-treat": [100, 200] },
  });
  await seed(f, b, { items: { "pet-treat": 10 } });
  await assert.rejects(
    e.giftItem(a, b, "pet-treat", "fullstack"),
    /quantity limit/,
  );
  await seed(f, b, {
    items: { "pet-treat": 1 },
    purchaseCosts: { "pet-treat": [300] },
  });
  await e.giftItem(a, b, "pet-treat", "treat");
  assert.equal((await e.profile(a)).items["pet-treat"], 1);
  assert.deepEqual((await e.profile(b)).purchaseCosts["pet-treat"], [300, 100]);
});
test("daily item gift limits reset and generosity badges grant no currency or XP", async () => {
  const f = setup(),
    e = f.engine;
  const stock = SHOP.filter((x) => x.kind !== "tool" && !x.evo && !x.xp)
    .slice(0, 11)
    .map((x) => x.id);
  await seed(f, a, { inventory: stock });
  for (let i = 0; i < 10; i++)
    await e.giftItem(
      a,
      `234800000000${2 + (i % 5)}@s.whatsapp.net`,
      stock[i],
      "g" + i,
    );
  await assert.rejects(
    e.giftItem(a, b, stock[10], "limited"),
    /ten per Lagos day/,
  );
  const w = await e.profile(a);
  assert.ok(w.badges.includes("Community Giver"));
  assert.equal(w.xp, 0);
  assert.equal(w.balance, 0);
  f.advance(1);
  await e.giftItem(a, b, stock[10], "nextday");
});
test("thanks are replay safe, limited to three unique members daily and never mint Aura or XP", async () => {
  const f = setup(),
    e = f.engine;
  await e.thank(a, b, "one");
  await e.thank(a, b, "one");
  assert.equal((await e.profile(b)).kudos, 1);
  await assert.rejects(e.thank(a, b, "again"), /already thanked/);
  await assert.rejects(e.thank(a, a, "self"), /another member/);
  await e.thank(a, c, "two");
  await e.thank(a, owner, "three");
  await assert.rejects(
    e.thank(a, "2348000000004@s.whatsapp.net", "four"),
    /Three thank/,
  );
  f.advance(1);
  await e.thank(a, b, "newday");
  assert.equal((await e.profile(b)).kudos, 2);
  for (const id of [a, b]) {
    const w = await e.profile(id);
    assert.equal(w.balance, 0);
    assert.equal(w.xp, 0);
  }
});
test("recipient balance cap is enforced without losing the sender's transfer or creator budget", async () => {
  const f = setup(),
    e = f.engine;
  await seed(f, a, { balance: 20000 });
  await seed(f, b, { balance: 1e12 });
  await assert.rejects(
    e.transfer(a, b, 100, "cap"),
    /Recipient Aura balance limit/,
  );
  assert.equal((await e.profile(a)).balance, 20000);
  await assert.rejects(
    e.gift(owner, b, 100, "giftcap"),
    /Recipient Aura balance limit/,
  );
  assert.equal((await e.profile(b)).balance, 1e12);
});
