import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/auraStore.js";
import { inventoryStatus, inventoryUsed } from "../utils/aura/inventory.js";
import { AuraUserError } from "../utils/aura/errors.js";
const owner = "2348000000000@s.whatsapp.net";
const members = Array.from(
  { length: 4 },
  (_, i) => `234800000000${i + 1}@s.whatsapp.net`,
);
test("bounded randomized transactions conserve Aura, holdings and item counts across replays and rejected actions", async () => {
  const f = setup(),
    e = f.engine;
  for (const id of members) await e.gift(owner, id, 40000, "seed-" + id);
  let expectedMoney = 160000,
    expectedItems = 0,
    seed = 0xa17a,
    successes = 0;
  const pick = (n) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed >>> 8) % n;
  };
  const products = [
    "pet-treat",
    "tagline-ticket",
    "leaf-emblem",
    "star-emblem",
    "creative-title",
  ];
  const holds = [];
  for (let step = 0; step < 300; step++) {
    const actor = members[pick(4)],
      target = members[(members.indexOf(actor) + 1 + pick(3)) % 4],
      event = "fuzz-" + step;
    const wallet = await e.profile(actor),
      type = pick(8);
    const owned = [
      ...(wallet.inventory || []),
      ...Object.entries(wallet.items || {})
        .filter(([, q]) => q > 0)
        .map(([id]) => id),
    ];
    let execute,
      change = () => {};
    if (type === 0) {
      const amount = 1 + pick(200);
      execute = () => e.transfer(actor, target, amount, event);
      change = (r) => {
        expectedMoney -= r.fee;
      };
    }
    if (type === 1) {
      const item = products[pick(products.length)];
      execute = () => e.buy(actor, item, event);
      change = (r) => {
        expectedMoney -= r.spent;
        expectedItems++;
      };
    }
    if (type === 2) {
      const item = owned[pick(Math.max(1, owned.length))] || "byte-fox";
      execute = () => e.giftItem(actor, target, item, event);
    }
    if (type === 3) {
      const item = owned[pick(Math.max(1, owned.length))] || "byte-fox";
      execute = () => e.salvage(actor, item, event);
      change = (r) => {
        expectedMoney += r.reward;
        expectedItems--;
      };
    }
    if (type === 4) {
      execute = () => e.useItem(actor, "tagline-ticket", "Audit", event);
      change = () => {
        expectedItems--;
      };
    }
    if (type === 5) {
      execute = () => e.charge(actor, "alpha", 200, event);
      change = (r) => {
        holds.push({ actor, reservation: r.reservation });
      };
    }
    if (type === 6 && holds.length) {
      const hold = holds[pick(holds.length)],
        delivered = Boolean(pick(2));
      execute = () => e.settle(hold.actor, hold.reservation, delivered);
      change = (r) => {
        expectedMoney -= r.spent || 0;
      };
    }
    if (!execute) execute = () => e.thank(actor, target, event);
    try {
      const result = await execute();
      if (!result.duplicate) {
        change(result);
        successes++;
      }
      if (step % 7 === 0) {
        const replay = await execute();
        assert.equal(replay.duplicate, true);
      }
    } catch (error) {
      if (!(error instanceof AuraUserError)) throw error;
    }
    let actualMoney = 0,
      actualItems = 0;
    for (const id of members) {
      const w = await e.profile(id);
      assert.ok(Number.isSafeInteger(w.balance) && w.balance >= 0);
      assert.ok(w.heldAura >= 0);
      assert.ok(w.balance + w.heldAura <= 1e12);
      actualMoney += w.balance + w.heldAura;
      actualItems += inventoryUsed(w);
      assert.ok(inventoryStatus(w).used <= inventoryStatus(w).capacity);
    }
    assert.equal(actualMoney, expectedMoney, "money at step " + step);
    assert.equal(actualItems, expectedItems, "items at step " + step);
  }
  assert.ok(successes > 50);
  assert.ok(holds.length > 0);
});
