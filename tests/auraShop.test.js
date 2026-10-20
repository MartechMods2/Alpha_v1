import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/auraStore.js";
import { COLLECTIBLES, SHOP } from "../utils/aura/policy.js";
import { collectionCardPayload } from "../utils/aura/collectionCard.js";
const owner = "2348000000000@s.whatsapp.net",
  a = "2348000000001@s.whatsapp.net";
test("new shop stock keeps existing item IDs and enforces XP locks", async () => {
  const { engine: e } = setup();
  await e.gift(owner, a, 100000, "gift");
  for (const id of ["gold-title", "aurora-frame", "midnight-theme"])
    assert.ok(SHOP.some((x) => x.id === id));
  await assert.rejects(e.buy(a, "royal-frame", "locked"), /2000 lifetime XP/);
  assert.equal((await e.profile(a)).balance, 100000);
  await e.buy(a, "ruby-frame", "ruby");
  assert.equal((await e.profile(a)).balance, 92000);
  await assert.rejects(e.buy(a, "ruby-frame", "dup"), /already own/);
});
test("consumable inventory is capped and concurrent buys cannot duplicate receipts", async () => {
  const { engine: e } = setup();
  await e.gift(owner, a, 10000, "gift");
  const buys = await Promise.all(
    Array.from({ length: 10 }, () => e.buy(a, "streak-shield", "same-event")),
  );
  assert.equal(buys.filter((x) => !x.duplicate).length, 1);
  assert.equal((await e.profile(a)).items["streak-shield"], 1);
  await e.buy(a, "streak-shield", "two");
  await e.buy(a, "streak-shield", "three");
  await assert.rejects(e.buy(a, "streak-shield", "four"), /Inventory limit/);
  assert.equal((await e.profile(a)).balance, 4000);
});
test("streak shield protects one missed day, consumes once and never grants missed rewards", async () => {
  const { engine: e, advance } = setup();
  await e.gift(owner, a, 5000, "g");
  await e.buy(a, "streak-shield", "buy");
  await e.daily(a);
  advance(2);
  const claim = await e.daily(a);
  assert.equal(claim.shieldUsed, true);
  assert.equal(claim.streak, 2);
  assert.equal(claim.reward, 500);
  assert.equal((await e.profile(a)).items["streak-shield"], 0);
  await e.daily(a);
  assert.equal((await e.profile(a)).balance, 4000);
});
test("a longer absence does not consume a shield or fake a continuous streak", async () => {
  const { engine: e, advance } = setup();
  await e.gift(owner, a, 5000, "g");
  await e.buy(a, "streak-shield", "buy");
  await e.daily(a);
  advance(3);
  const claim = await e.daily(a);
  assert.equal(claim.shieldUsed, false);
  assert.equal(claim.streak, 1);
  assert.equal((await e.profile(a)).items["streak-shield"], 1);
});
test("tagline tickets consume transactionally, preserve multilingual text, and reject formatting abuse", async () => {
  const { engine: e } = setup();
  await e.gift(owner, a, 5000, "g");
  await e.buy(a, "tagline-ticket", "buy");
  for (const text of [
    "",
    "x".repeat(41),
    "@everyone",
    "https://evil.example",
    "*fake heading*",
    "line\nbreak",
  ])
    await assert.rejects(
      e.useItem(a, "tagline-ticket", text, text || "empty"),
      /plain tagline/,
    );
  assert.equal((await e.profile(a)).items["tagline-ticket"], 1);
  const r = await e.useItem(a, "tagline-ticket", "Ẹ káàárọ̀ 🌟", "use");
  assert.equal(r.remaining, 0);
  await e.useItem(a, "tagline-ticket", "Ẹ káàárọ̀ 🌟", "use");
  assert.equal((await e.profile(a)).tagline, "Ẹ káàárọ̀ 🌟");
  await assert.rejects(
    e.useItem(a, "tagline-ticket", "Another", "new"),
    /do not own/,
  );
});
test("daily collections survive engine reload, avoid duplicate cards, and award completion exactly once", async () => {
  const { engine: e, advance } = setup();
  const cards = new Set();
  for (let day = 0; day < COLLECTIBLES.length; day++) {
    const r = await e.collect(a);
    assert.ok(!cards.has(r.card));
    cards.add(r.card);
    assert.equal((await e.collect(a)).duplicate, true);
    if (day < 7) assert.equal(r.reward, 0);
    else assert.equal(r.reward, 2500);
    advance(1);
  }
  const w = await e.profile(a);
  assert.equal(w.balance, 2500);
  assert.ok(w.badges.includes("Collection Curator"));
  await assert.rejects(e.collect(a), /complete/);
  assert.equal((await e.profile(a)).balance, 2500);
});
test("collection cards render a PNG with complete caption and unknown cards safely use text", () => {
  const p = collectionCardPayload("Byte Bot", 1, "Collected Byte Bot!");
  assert.ok(Buffer.isBuffer(p.image));
  assert.equal(p.image.toString("hex", 0, 8), "89504e470d0a1a0a");
  assert.equal(p.caption, "Collected Byte Bot!");
  assert.deepEqual(collectionCardPayload("Unknown", 1, "hello"), {
    text: "hello",
  });
});
