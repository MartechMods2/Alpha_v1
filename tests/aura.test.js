import test from "node:test";
import assert from "node:assert/strict";
import { createAuraEngine } from "../utils/aura/engine.js";
import { createAuraChargeRunner } from "../utils/aura/charging.js";
import {
  dayKey,
  scheduledSlot,
  key,
  amountValue,
  priceFor,
} from "../utils/aura/policy.js";
const owner = "2348000000000@s.whatsapp.net",
  a = "2348000000001@s.whatsapp.net",
  b = "2348000000002@s.whatsapp.net";
// Serial snapshot transactions simulate all-or-nothing persistence; no real network or groups.
function setup() {
  let data = new Map(),
    queue = Promise.resolve(),
    clock = new Date("2026-10-20T07:00:00Z");
  const k = (c, id) => c + ":" + id;
  const get = async (c, id) => structuredClone(data.get(k(c, id)) || null);
  const put = async (c, row) => {
    data.set(k(c, row._id), structuredClone(row));
  };
  const match = (row, query) =>
    Object.entries(query).every(([name, value]) => row[name] === value);
  const store = {
    get,
    put,
    find: async (c, q) =>
      [...data.entries()]
        .filter(([id, r]) => id.startsWith(c + ":") && match(r, q))
        .map(([, r]) => structuredClone(r)),
    transaction(fn) {
      const work = queue.then(async () => {
        const snapshot = structuredClone(data);
        try {
          return await fn({
            get,
            put,
            reservedTotal: async (actor) =>
              (
                await store.find("AuraCharges", { actor, status: "reserved" })
              ).reduce((n, row) => n + row.amount, 0),
            findOne: async (c, q) => (await store.find(c, q))[0] || null,
          });
        } catch (e) {
          data = snapshot;
          throw e;
        }
      });
      queue = work.catch(() => {});
      return work;
    },
  };
  const engine = createAuraEngine(store, {
    owner: () => owner,
    now: () => clock,
  });
  return {
    engine,
    store,
    advance: (days) => {
      clock = new Date(+clock + days * 86400000);
    },
    setTime: (date) => {
      clock = new Date(date);
    },
  };
}
test("Aura validates amounts and uses Lagos days and exact drop windows", () => {
  for (const input of [
    -1,
    0,
    Infinity,
    NaN,
    1.5,
    "1e4",
    "-100",
    "001x",
    500001,
  ])
    assert.throws(() => amountValue(input));
  assert.equal(dayKey(new Date("2026-10-20T23:30:00Z")), "2026-10-21");
  assert.equal(scheduledSlot(new Date("2026-10-20T07:01:00Z")), "2026-10-20:8");
  assert.equal(scheduledSlot(new Date("2026-10-20T07:06:00Z")), null);
  assert.equal(priceFor("alpha").price, priceFor("gemini").price);
  assert.equal(priceFor("help"), undefined);
});
test("daily claims are once globally and replay-safe under concurrent calls", async () => {
  const { engine: e } = setup();
  const r = await Promise.all(Array.from({ length: 20 }, () => e.daily(a)));
  assert.equal(r.filter((x) => !x.duplicate).length, 1);
  assert.equal((await e.profile(a)).balance, 500);
});
test("daily streak bonus and missed days behave predictably", async () => {
  const { engine: e, advance } = setup();
  for (let i = 0; i < 7; i++) {
    await e.daily(a);
    if (i < 6) advance(1);
  }
  assert.equal((await e.profile(a)).balance, 5500);
  advance(2);
  await e.daily(a);
  assert.equal((await e.profile(a)).streak, 1);
});
test("only primary creator gifts and combined daily coupon/gift budget is atomic", async () => {
  const { engine: e } = setup();
  await assert.rejects(e.gift(a, b, 20, "bad"), /creator/);
  const r = await Promise.allSettled([
    e.gift(owner, a, 300000, "1"),
    e.createCoupon(owner, 300000, "2"),
  ]);
  assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal((await e.profile(a)).balance, 300000);
});
test("daily gift budget resets at Lagos midnight", async () => {
  const { engine: e, advance } = setup();
  await e.gift(owner, a, 500000, "1");
  await assert.rejects(e.gift(owner, a, 1, "2"), /budget/);
  advance(1);
  await e.gift(owner, a, 1, "3");
  assert.equal((await e.profile(a)).balance, 500001);
});
test("one coupon has one winner across simultaneous claims and cannot be guessed or reused", async () => {
  const { engine: e } = setup();
  const c = await e.createCoupon(owner, 20000, "coupon");
  const results = await Promise.allSettled([
    e.redeem(a, c.code, "g", "1"),
    e.redeem(b, c.code, "g", "2"),
  ]);
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(
    (await e.profile(a)).balance + (await e.profile(b)).balance,
    20000,
  );
  await assert.rejects(e.redeem(b, "BAD", "g", "3"), /exact/);
});
test("scheduled drops persist across restarts, limit recipients and one daily win", async () => {
  const { engine: e } = setup();
  const c = await e.createDrop("slot1", ["g"]);
  assert.equal((await e.createDrop("slot1", ["g"])).code, c.code);
  await assert.rejects(e.redeem(a, c.code, "wrong", "x"), /selected/);
  await e.redeem(a, c.code, "g", "a");
  const d = await e.createDrop("slot2", ["g"]);
  await assert.rejects(e.redeem(a, d.code, "g", "b"), /One scheduled/);
  await e.redeem(b, d.code, "g", "c");
});
test("expired coupons and owner claims do not credit wallets", async () => {
  const { engine: e, advance } = setup();
  const c = await e.createCoupon(owner, 20000, "c");
  await assert.rejects(e.redeem(owner, c.code, "g", "x"), /creator/);
  advance(1);
  await assert.rejects(e.redeem(a, c.code, "g", "y"), /expired/);
  assert.equal((await e.profile(a)).balance, 0);
});
test("transfers conserve principal, burn disclosed fees, enforce daily cap and rollback on insufficient funds", async () => {
  const { engine: e } = setup();
  await e.gift(owner, a, 30000, "gift");
  await e.transfer(a, b, 10000, "1");
  await e.transfer(a, b, 10000, "2");
  assert.equal((await e.profile(a)).balance, 9000);
  assert.equal((await e.profile(b)).balance, 20000);
  await assert.rejects(e.transfer(a, b, 1, "3"), /Daily transfer/);
  await assert.rejects(
    e
      .transfer(b, a, 10000, "4bad" + "x".repeat(1))
      .then(() => e.transfer(b, a, 10000, "5")),
    /Not enough/,
  );
  assert.equal((await e.profile(b)).balance, 9500);
});
test("concurrent charges cannot overdraw, refund and settlement are exactly once", async () => {
  const { engine: e } = setup();
  await e.daily(a);
  const r = await Promise.allSettled([
    e.charge(a, "alpha", 500, "1"),
    e.charge(a, "alpha", 500, "2"),
  ]);
  assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
  const charge = r.find((x) => x.status === "fulfilled").value;
  await e.settle(a, charge.reservation, false);
  await e.settle(a, charge.reservation, false);
  assert.equal((await e.profile(a)).balance, 500);
});
test("quest rewards are one attempt, two daily, preserve XP and add milestone rewards", async () => {
  const { engine: e, store } = setup();
  for (let i = 0; i < 3; i++) {
    await store.put("AuraQuests", {
      _id: "q" + i,
      actor: a,
      answer: 1,
      expiresAt: new Date("2026-10-21"),
    });
  }
  await e.quest(a, "q0", "1", "1");
  await e.quest(a, "q1", "1", "2");
  await assert.rejects(e.quest(a, "q2", "1", "3"), /Two rewarded/);
  await assert.rejects(e.quest(a, "q1", "1", "4"), /already/);
  const w = await e.profile(a);
  assert.equal(w.balance, 1500);
  assert.equal(w.xp, 200);
  assert.equal(w.quests, 2);
});
test("Evo upgrades and shop spend Aura without lowering XP, repeat purchases roll back", async () => {
  const { engine: e, store } = setup();
  await e.gift(owner, a, 200000, "g");
  let w = await e.profile(a);
  w.quests = 5;
  w.xp = 1000;
  await store.put("AuraWallets", w);
  await e.evolve(a, "e");
  await e.buy(a, "gold-title", "b");
  await assert.rejects(e.buy(a, "gold-title", "b2"), /already own/);
  w = await e.profile(a);
  assert.equal(w.balance, 60000);
  assert.equal(w.xp, 1000);
  assert.equal(w.evo, 1);
});
test("penalties are creator-reviewed, capped, nonnegative and reversible once", async () => {
  const { engine: e } = setup();
  await e.daily(a);
  await assert.rejects(
    e.discipline(b, a, 500, "spam repeated", "x"),
    /creator/,
  );
  const warning = await e.discipline(
    owner,
    a,
    1000,
    "repeated command spam",
    "warn",
  );
  assert.equal(warning.warning, true);
  assert.equal((await e.profile(a)).balance, 500);
  const r = await e.discipline(owner, a, 1000, "repeated command spam", "1");
  assert.equal(r.deducted, 500);
  assert.equal((await e.profile(a)).conduct, 90);
  await e.refund(owner, r.receipt, "refund");
  await assert.rejects(e.refund(owner, r.receipt, "refund2"), /reversed/);
  assert.equal((await e.profile(a)).balance, 500);
  assert.equal((await e.profile(a)).conduct, 100);
});
test("ranked results require server-side proof, protect first loss and cap repeat opponents", async () => {
  const { engine: e, store } = setup();
  await assert.rejects(e.ranked(a, b, "unverified", "duel"), /not verified/);
  for (let i = 0; i < 3; i++) {
    await store.put("AuraDuels", {
      _id: "d" + i,
      matchId: "m" + i,
      state: "result",
      winner: a,
      loser: b,
    });
    await e.ranked(a, b, "m" + i, "d" + i);
  }
  assert.equal((await e.profile(a)).rp, 90);
  assert.equal((await e.profile(b)).rp, 0);
  assert.equal((await e.profile(a)).balance, 3000);
  await store.put("AuraDuels", {
    _id: "d4",
    matchId: "m4",
    state: "result",
    winner: a,
    loser: b,
  });
  assert.equal((await e.ranked(a, b, "m4", "d4")).ineligible, true);
  const replay = await e.ranked(a, b, "m0", "d0");
  assert.equal(replay.duplicate, true);
});
test("charging runner bills only delivered success, not errors, code retries or insufficient funds", async () => {
  const { engine: e } = setup();
  await e.daily(a);
  const sent = [];
  const info = {
    command: "airewrite",
    senderJid: a,
    sendMessageWTyping: async (_, p) => sent.push(p.text),
  };
  const run = createAuraChargeRunner({
    getEngine: async () => e,
    identify: async () => a,
  });
  const msg = { key: { id: "a" } };
  await run(
    async (_s, _m, f, _args, i) => {
      i.auraSuccess();
      await i.sendMessageWTyping(f, { text: "answer" });
    },
    null,
    msg,
    "g",
    [],
    info,
  );
  assert.equal((await e.profile(a)).balance, 0);
  await run(() => assert.fail(), null, msg, "g", [], info);
  assert.match(sent.at(-1), /already processed/);
  await run(() => assert.fail(), null, { key: { id: "b" } }, "g", [], info);
  assert.match(sent.at(-1), /Not enough/);
});
test("failed output refunds, high-cost work requires confirmation, moderator flags never bypass", async () => {
  const { engine: e } = setup();
  await e.daily(a);
  const sent = [];
  const run = createAuraChargeRunner({
    getEngine: async () => e,
    identify: async () => a,
  });
  const info = {
    command: "alpha",
    isOwner: true,
    isModerator: true,
    sendMessageWTyping: async (_, p) => sent.push(p.text),
  };
  await run(
    async (_s, _m, f, _args, i) =>
      i.sendMessageWTyping(f, { text: "❌ API failed" }),
    null,
    { key: { id: "fail" } },
    "g",
    [],
    info,
  );
  assert.equal((await e.profile(a)).balance, 500);
  await run(() => assert.fail(), null, { key: { id: "cost" } }, "g", [], {
    ...info,
    command: "img",
  });
  assert.match(sent.at(-1), /--confirm/);
});

test("XP milestone bonuses are included in receipts and cannot be farmed by spending", async () => {
  const { engine: e, store } = setup();
  await e.daily(a);
  const wallet = await e.profile(a);
  wallet.xp = 450;
  await store.put("AuraWallets", wallet);
  const next = await e.charge(a, "alpha", 100, "spend");
  await e.settle(a, next.reservation, true);
  assert.equal((await e.profile(a)).xp, 450);
  const w = await e.profile(a);
  w.dailyDay = "2026-10-19";
  await store.put("AuraWallets", w);
  const q = {
    _id: "milestone",
    actor: a,
    answer: 1,
    expiresAt: new Date("2026-10-21"),
  };
  await store.put("AuraQuests", q);
  const reward = await e.quest(a, "milestone", "1", "milestone-answer");
  assert.ok(reward.rankBonus > 0);
  assert.equal(reward.reward, 750 + reward.rankBonus);
  assert.ok((await e.profile(a)).badges.includes("Bronze"));
});
