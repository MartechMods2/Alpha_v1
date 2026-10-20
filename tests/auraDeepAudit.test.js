import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setup } from "./helpers/auraStore.js";
import { createAuraChargeRunner } from "../utils/aura/charging.js";
import { applyPrices } from "../utils/aura/pricing.js";
import { isUnexpired, assertAuraWallet } from "../utils/aura/walletSafety.js";
const a = "2348000000001@s.whatsapp.net",
  b = "2348000000002@s.whatsapp.net",
  owner = "2348000000000@s.whatsapp.net";
async function seed(f, id, balance) {
  await f.store.put("AuraWallets", {
    ...(await f.engine.profile(id)),
    balance,
  });
}
test("incoming transfers and gifts cannot consume space reserved for refunds", async () => {
  const f = setup(),
    e = f.engine;
  await seed(f, a, 1e12);
  await seed(f, b, 1000);
  const charge = await e.charge(a, "alpha", 200, "hold");
  assert.equal((await e.profile(a)).heldAura, 200);
  await assert.rejects(
    e.transfer(b, a, 100, "incoming"),
    /including reserved fees/,
  );
  await assert.rejects(
    e.gift(owner, a, 100, "gift"),
    /including reserved fees/,
  );
  assert.equal((await e.profile(b)).balance, 1000);
  await e.settle(a, charge.reservation, false);
  await e.settle(a, charge.reservation, false);
  assert.equal((await e.profile(a)).balance, 1e12);
  assert.equal((await e.profile(a)).heldAura, 0);
});
test("multiple holds release exactly once, and settlement cannot disclose another actor result", async () => {
  const f = setup(),
    e = f.engine;
  await seed(f, a, 1000);
  const first = await e.charge(a, "alpha", 200, "one"),
    second = await e.charge(a, "alpha", 300, "two");
  assert.equal((await e.profile(a)).heldAura, 500);
  await e.settle(a, first.reservation, true);
  assert.equal((await e.profile(a)).heldAura, 300);
  const r = await e.settle(a, second.reservation, false);
  assert.equal(r.status, "refunded");
  assert.equal((await e.profile(a)).balance, 800);
  assert.equal((await e.profile(a)).heldAura, 0);
  await assert.rejects(
    e.settle(b, second.reservation, false),
    /Unknown charge/,
  );
});
test("legacy pending reservations migrate transactionally without losing refundable Aura", async () => {
  const f = setup(),
    e = f.engine;
  await seed(f, a, 800);
  const w = await e.profile(a);
  delete w.heldAura;
  await f.store.put("AuraWallets", w);
  await f.store.put("AuraCharges", {
    _id: "legacy",
    actor: a,
    amount: 200,
    status: "reserved",
    expiresAt: new Date("2026-10-20T08:00:00Z"),
  });
  await e.settle(a, "legacy", false);
  assert.equal((await e.profile(a)).balance, 1000);
  assert.equal((await e.profile(a)).heldAura, 0);
});
test("invalid hold data, null pricing sections and malformed expiries fail closed", () => {
  for (const heldAura of [-1, 1.5, Infinity])
    assert.throws(
      () => assertAuraWallet({ balance: 10, heldAura }),
      /safety limit/,
    );
  assert.throws(
    () => assertAuraWallet({ balance: 1e12, heldAura: 1 }),
    /safety limit/,
  );
  assert.throws(
    () => applyPrices([], "shop", (x) => x.id, { shop: null }),
    /must be an object/,
  );
  assert.equal(isUnexpired("not-a-date"), false);
  assert.equal(isUnexpired(null), false);
});
test("invalid coupon reward or expiry cannot be claimed and invalid quest expiry cannot pay", async () => {
  const f = setup(),
    e = f.engine;
  const coupon = await e.createCoupon(owner, 100, "coupon");
  const row = (await f.store.find("AuraCoupons", {}))[0];
  row.expiresAt = "bad";
  await f.store.put("AuraCoupons", row);
  await assert.rejects(e.redeem(a, coupon.code, "g", "bad-date"), /expired/);
  row.expiresAt = new Date("2026-10-21");
  row.amount = -10;
  await f.store.put("AuraCoupons", row);
  await assert.rejects(
    e.redeem(a, coupon.code, "g", "bad-amount"),
    /invalid reward/,
  );
  await f.store.put("AuraQuests", {
    _id: "bad-quest",
    actor: a,
    answer: 1,
    expiresAt: "invalid",
  });
  await assert.rejects(e.quest(a, "bad-quest", 1, "q"), /expired/);
  assert.equal((await e.profile(a)).balance, 0);
  assert.equal((await f.store.get("AuraCoupons", row._id)).status, "open");
});
test("expired or already-refunded work cannot send a new paid result", async () => {
  const f = setup(),
    e = f.engine;
  await seed(f, a, 1000);
  const sent = [];
  const run = createAuraChargeRunner({
    getEngine: async () => e,
    identify: async () => a,
  });
  await run(
    async (_s, _m, from, _args, info) => {
      const row = (
        await f.store.find("AuraCharges", { actor: a, status: "reserved" })
      )[0];
      await e.settle(a, row._id, false);
      info.auraSuccess();
      await info.sendMessageWTyping(from, { text: "late-result" });
    },
    {},
    { key: { id: "late" } },
    "g",
    [],
    {
      command: "alpha",
      sendMessageWTyping: async (to, p) => sent.push(p.text),
    },
  );
  assert.ok(!sent.includes("late-result"));
  assert.match(sent.at(-1), /reservation expired/);
  assert.equal((await e.profile(a)).balance, 1000);
});
test("a concurrent recovery is reported as refunded rather than falsely reporting a charge", async () => {
  const f = setup(),
    e = f.engine;
  await seed(f, a, 1000);
  const sent = [];
  const run = createAuraChargeRunner({
    getEngine: async () => e,
    identify: async () => a,
  });
  await run(
    async (_s, _m, from, _args, info) => {
      info.auraSuccess();
      await info.sendMessageWTyping(from, { text: "answer" });
    },
    {},
    { key: { id: "race" } },
    "g",
    [],
    {
      command: "alpha",
      sendMessageWTyping: async (to, p) => {
        sent.push(p.text);
        if (p.text === "answer") {
          const row = (
            await f.store.find("AuraCharges", { actor: a, status: "reserved" })
          )[0];
          await e.settle(a, row._id, false);
        }
      },
    },
  );
  assert.match(sent.at(-1), /Reservation refunded: 200/);
  assert.ok(!sent.some((x) => /Spent:/.test(x)));
  assert.equal((await e.profile(a)).balance, 1000);
});
async function loadScheduler() {
  const url = new URL("../utils/aura/scheduler.js", import.meta.url);
  let source = await readFile(url, "utf8");
  source = source.replace(/from "([^"]+)"/g, (whole, path) =>
    path.endsWith("db/auraData.js")
      ? 'from "data:text/javascript,export const aura={};export const auraStore={};"'
      : path.startsWith(".")
        ? `from "${new URL(path, url).href}"`
        : whole,
  );
  return (
    await import(
      `data:text/javascript;base64,${Buffer.from(source).toString("base64")}#${Math.random()}`
    )
  ).checkAuraSchedules;
}
async function schedulerFixture() {
  const check = await loadScheduler(),
    instant = new Date("2026-10-20T07:01:00Z"),
    sent = [],
    recovered = [];
  let enabled = true,
    groups = ["12345@g.us"],
    queued;
  const coupon = {
    _id: "drop",
    status: "open",
    groups: [...groups],
    posted: [],
    code: "0123456789ABCDEF",
    expiresAt: new Date(+instant + 1800000),
  };
  const store = {
    find: async (name) =>
      name === "AuraCharges"
        ? [
            { actor: a, _id: "bad" },
            { actor: b, _id: "good" },
          ]
        : [],
    get: async (name, id) =>
      name === "AuraCoupons"
        ? coupon
        : id === "economy"
          ? { enabled }
          : { groups },
    transaction: async (fn) =>
      fn({ get: async () => coupon, put: async () => {} }),
  };
  const deps = {
    store,
    now: instant,
    sock: {
      user: {},
      alphaConnected: true,
      sendMessage: async (to, p) => sent.push(p),
    },
    queue: {
      enqueue: async (_to, fn) => {
        queued = fn;
      },
    },
    engine: {
      settle: async (actor, id) => {
        recovered.push(id);
        if (id === "bad") throw Error("simulated unavailable row");
      },
      createDrop: async () => coupon,
    },
  };
  return {
    check,
    deps,
    coupon,
    sent,
    recovered,
    runQueued: () => queued(),
    disable: () => {
      enabled = false;
    },
    optOut: () => {
      groups = [];
    },
  };
}
test("one failed recovery does not block other refunds or queued drop dispatch", async () => {
  const f = await schedulerFixture();
  await f.check(f.deps);
  assert.deepEqual(f.recovered, ["bad", "good"]);
  await f.runQueued();
  assert.equal(f.sent.length, 1);
});
test("queued drops recheck claim, expiry, activation and group opt-out before delivery", async () => {
  for (const mode of ["claimed", "expired", "off", "optout"]) {
    const f = await schedulerFixture();
    await f.check(f.deps);
    if (mode === "claimed") f.coupon.status = "claimed";
    if (mode === "expired")
      f.coupon.expiresAt = new Date("2026-10-20T06:00:00Z");
    if (mode === "off") f.disable();
    if (mode === "optout") f.optOut();
    await f.runQueued();
    assert.equal(f.sent.length, 0, mode);
  }
});
test("the free first daily ranked loss does not waste a promotion shield", async () => {
  const f = setup(),
    e = f.engine;
  const loss = await e.profile(b);
  loss.shields = 2;
  await f.store.put("AuraWallets", loss);
  for (let i = 0; i < 2; i++) {
    await f.store.put("AuraDuels", {
      _id: "duel" + i,
      matchId: "shield" + i,
      state: "result",
      winner: a,
      loser: b,
    });
    const r = await e.ranked(a, b, "shield" + i, "duel" + i);
    assert.equal(r.protectedLoss, true);
    assert.equal((await e.profile(b)).shields, i === 0 ? 2 : 1);
  }
});
test("ranked results at wallet capacity settle RP and XP without blocking the group or minting excess Aura", async () => {
  const f = setup(),
    e = f.engine;
  await seed(f, a, 1e12);
  const winner = await e.profile(a);
  winner.xp = 450;
  await f.store.put("AuraWallets", winner);
  await f.store.put("AuraDuels", {
    _id: "cap-duel",
    matchId: "cap-match",
    state: "result",
    winner: a,
    loser: b,
  });
  const r = await e.ranked(a, b, "cap-match", "cap-duel");
  assert.equal(r.reward, 0);
  assert.equal(r.capReached, true);
  assert.equal(r.rp, 30);
  assert.equal((await e.profile(a)).balance, 1e12);
  assert.equal((await e.profile(a)).xp, 550);
  assert.equal((await f.store.get("AuraDuels", "cap-duel")).state, "settled");
});
test("a null legacy hold counter is rebuilt from reservations rather than silently treated as zero", async () => {
  const f = setup(),
    e = f.engine;
  await seed(f, a, 800);
  const w = await e.profile(a);
  w.heldAura = null;
  await f.store.put("AuraWallets", w);
  await f.store.put("AuraCharges", {
    _id: "old-null",
    actor: a,
    amount: 200,
    status: "reserved",
  });
  await e.settle(a, "old-null", false);
  assert.equal((await e.profile(a)).balance, 1000);
});
test("operational error details never cross the public boundary while authored validation errors remain useful", async () => {
  const { AuraUserError, publicAuraError } = await import(
    "../utils/aura/errors.js"
  );
  const native = Error(
    "E11000 duplicate key database.internal-index test-secret",
  );
  assert.equal(publicAuraError(native, "Safe fallback"), "Safe fallback");
  assert.equal(
    publicAuraError(new AuraUserError("Choose one item."), "fallback"),
    "Choose one item.",
  );
  const sent = [];
  const run = createAuraChargeRunner({
    getEngine: async () => {
      throw native;
    },
    identify: async () => a,
  });
  await run(
    () => assert.fail("paid work must not start"),
    {},
    { key: { id: "native-error" } },
    "g",
    [],
    {
      command: "alpha",
      sendMessageWTyping: async (to, p) => sent.push(p.text),
    },
  );
  assert.ok(!sent.join("").includes("internal-index"));
  assert.ok(!sent.join("").includes("test-secret"));
  assert.match(sent.at(-1), /history before retrying/);
});
test("reservation records override stale cached hold counters before new monetary changes", async () => {
  const f = setup(),
    e = f.engine;
  await seed(f, a, 800);
  const w = await e.profile(a);
  w.heldAura = 0;
  await f.store.put("AuraWallets", w);
  await f.store.put("AuraCharges", {
    _id: "old-writer",
    actor: a,
    status: "reserved",
    amount: 200,
  });
  await e.gift(owner, a, 100, "income");
  assert.equal((await e.profile(a)).heldAura, 200);
  await e.settle(a, "old-writer", false);
  assert.equal((await e.profile(a)).balance, 1100);
  const stale = await e.profile(a);
  stale.heldAura = 200;
  await f.store.put("AuraWallets", stale);
  await e.thank(a, b, "social");
  assert.equal((await e.profile(a)).heldAura, 0);
});
