import test from "node:test";
import assert from "node:assert/strict";
import { applyPrices, priceConfig } from "../utils/aura/pricing.js";
import { SHOP, EVO, PRICES, priceFor } from "../utils/aura/policy.js";
import { BAG_TIERS } from "../utils/aura/inventory.js";
test("editable prices cover the full catalogue, bags, Evo and command groups", () => {
  for (const [section, rows, id] of [
    ["shop", SHOP, (x) => x.id],
    ["bags", BAG_TIERS.slice(1), (x) => x.slots],
    ["evo", EVO.slice(1), (x) => x.name],
    ["commands", PRICES, (x) => x.commands[0]],
  ]) {
    assert.equal(Object.keys(priceConfig[section]).length, rows.length);
    for (const row of rows)
      assert.equal(row.price, priceConfig[section][id(row)]);
  }
  assert.equal(BAG_TIERS[0].price, 0);
  assert.equal(EVO[0].price, 0);
  assert.equal(priceFor("img").price, priceFor("imagegen").price);
});
test("overrides affect the price while preserving item identity and requirements", () => {
  const rows = [
    { id: "ruby-frame", price: 8000, xp: 2000 },
    { id: "other", price: 30 },
  ];
  applyPrices(rows, "shop", (x) => x.id, { shop: { "ruby-frame": 2500 } });
  assert.deepEqual(rows, [
    { id: "ruby-frame", price: 2500, xp: 2000 },
    { id: "other", price: 30 },
  ]);
});
test("unsafe amounts and misspelled configuration are rejected", () => {
  for (const value of [0, -1, 1.5, "500", null, 500001, Infinity])
    assert.throws(
      () =>
        applyPrices([{ id: "x" }], "shop", (x) => x.id, { shop: { x: value } }),
      /whole number/,
    );
  assert.throws(
    () =>
      applyPrices([{ id: "x" }], "shop", (x) => x.id, { shop: { typo: 1 } }),
    /Unknown Aura price ID/,
  );
  assert.throws(
    () => applyPrices([], "shop", (x) => x.id, { shpo: {} }),
    /Unknown Aura price section/,
  );
  assert.throws(
    () => applyPrices([], "shop", (x) => x.id, { shop: [] }),
    /must be an object/,
  );
});
