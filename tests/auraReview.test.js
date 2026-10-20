import test from "node:test";
import assert from "node:assert/strict";
import {
  selectedRecipient,
  selectedAmount,
  selectedItem,
} from "../utils/aura/selection.js";
import { auraQuickGuide } from "../utils/aura/quickGuide.js";
import { setup } from "./helpers/auraStore.js";
const a = "2348000000001@s.whatsapp.net",
  b = "2348000000002@s.whatsapp.net";
test("sharing selectors reject ambiguous recipients, amounts and items", () => {
  assert.equal(
    selectedRecipient({ extendedMessageOriginal: { mentionedJid: [b] } }),
    b,
  );
  assert.equal(
    selectedRecipient({ extendedMessageOriginal: { participant: b } }),
    b,
  );
  for (const mentions of [[a, b], b, []])
    assert.throws(() =>
      selectedRecipient({
        extendedMessageOriginal: { mentionedJid: mentions },
      }),
    );
  assert.equal(selectedAmount(["@member", "1000", "--confirm"]), "1000");
  for (const args of [["1000", "2000"], ["1.5"], []])
    assert.throws(() => selectedAmount(args), /exactly one/);
  const shop = [{ id: "one" }, { id: "two" }];
  assert.equal(selectedItem(["@member", "one", "--confirm"], shop).id, "one");
  for (const args of [["one", "two"], ["one", "one"], ["bad"]])
    assert.throws(() => selectedItem(args, shop), /exactly one/);
});
test("repeated gifts to one peer cannot earn the distinct-recipient generosity badge", async () => {
  const f = setup(),
    e = f.engine;
  await f.store.put("AuraWallets", {
    ...(await e.profile(a)),
    inventory: ["byte-fox"],
    purchaseCosts: { "byte-fox": 8000 },
  });
  for (let i = 0; i < 5; i++) {
    await e.giftItem(a, b, "byte-fox", "out" + i);
    await e.giftItem(b, a, "byte-fox", "back" + i);
  }
  const w = await e.profile(a);
  assert.equal(w.itemsGiven, 5);
  assert.equal(w.giftPeers.length, 1);
  assert.ok(!w.badges.includes("Community Giver"));
  assert.equal(w.purchaseCosts["byte-fox"], 8000);
  assert.equal(w.balance, 0);
  assert.equal(w.xp, 0);
});
test("favourite badge requires ten different thankers, bounded peer tracking and no extra currency", async () => {
  const f = setup(),
    e = f.engine;
  for (let i = 0; i < 10; i++) {
    await e.thank(a, b, "repeat" + i);
    f.advance(1);
  }
  let w = await e.profile(b);
  assert.equal(w.kudos, 10);
  assert.equal(w.thanksPeers.length, 1);
  assert.ok(!w.badges.includes("Community Favourite"));
  for (let i = 0; i < 12; i++)
    await e.thank(
      `23480000001${String(i).padStart(2, "0")}@s.whatsapp.net`,
      b,
      "unique" + i,
    );
  w = await e.profile(b);
  assert.equal(w.thanksPeers.length, 10);
  assert.ok(w.badges.includes("Community Favourite"));
  assert.equal(w.balance, 0);
  assert.equal(w.xp, 0);
});
test("short guide has simple grouped commands, essential limits and correct custom prefix", () => {
  const guide = auraQuickGuide("!");
  assert.ok(guide.length < 4000);
  for (const word of [
    "!aura",
    "--confirm",
    "20 slots",
    "5%",
    "10,000",
    "20,000",
    "ten item gifts",
    "different members",
    "OFF",
  ])
    assert.ok(guide.includes(word), word);
  assert.ok(!guide.includes("$aura"));
});
