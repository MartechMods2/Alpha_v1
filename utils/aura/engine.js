import { randomBytes } from "node:crypto";
import {
  amountValue,
  dayKey,
  seasonKey,
  key,
  xpRank,
  EVO,
  SHOP,
} from "./policy.js";
const fresh = (id) => ({
  _id: id,
  balance: 0,
  xp: 0,
  quests: 0,
  evo: 0,
  inventory: [],
  badges: [],
  conduct: 100,
});
const requireUser = (id) => {
  if (typeof id !== "string" || !/^\d{7,15}@s\.whatsapp\.net$/.test(id))
    throw Error(
      "A verified phone identity is required for Aura. Try again after group metadata refresh.",
    );
};
export function createAuraEngine(
  store,
  { now = () => new Date(), owner = () => "" } = {},
) {
  const owned = (id) => Boolean(owner()) && id === owner();
  const mutate = (id, actor, fn) => {
    requireUser(actor);
    return store.transaction(async (tx) => {
      const eventId = key(id);
      const previous = await tx.get("AuraLedger", eventId);
      if (previous) return { ...previous.result, duplicate: true };
      const wallet = (await tx.get("AuraWallets", actor)) || fresh(actor);
      wallet.badges ||= [];
      const before = wallet.balance;
      const result = await fn(tx, wallet);
      if (
        !Number.isSafeInteger(wallet.balance) ||
        wallet.balance < 0 ||
        wallet.balance > 1e12
      )
        throw Error("Aura balance limit reached.");
      await tx.put("AuraWallets", wallet);
      await tx.put("AuraLedger", {
        _id: eventId,
        actor,
        kind: String(id[0]),
        at: now(),
        delta: wallet.balance - before,
        result,
      });
      return result;
    });
  };
  const addXp = (wallet, n) => {
    const before = xpRank(wallet.xp)[0];
    wallet.xp += n;
    let bonus = 0;
    if (xpRank(wallet.xp)[0] > before) {
      wallet.badges = [
        ...new Set([...(wallet.badges || []), xpRank(wallet.xp)[1]]),
      ];
      bonus = Math.min(10000, 1000 + Math.floor(wallet.xp / 10));
      wallet.balance += bonus;
    }
    return bonus;
  };
  const spend = (w, n, id) => {
    if (!owned(id)) {
      if (w.balance < n)
        throw Error(
          `Not enough Aura. You need ${n}; balance ${w.balance}. Use $daily or $quests.`,
        );
      w.balance -= n;
    }
  };
  return {
    owned,
    profile: async (id) => {
      requireUser(id);
      return (await store.get("AuraWallets", id)) || fresh(id);
    },
    history: (id) => store.find("AuraLedger", { actor: id }, { at: -1 }, 10),
    daily: (id) =>
      mutate(["daily", id, dayKey(now())], id, async (_tx, w) => {
        const yesterday = dayKey(new Date(+now() - 86400000));
        w.streak = w.dailyDay === yesterday ? (w.streak || 0) + 1 : 1;
        w.dailyDay = dayKey(now());
        w.conduct = Math.min(100, w.conduct + 1);
        if (w.streak % 7 === 0)
          w.badges = [...new Set([...w.badges, "Seven-day streak"])];
        const reward = 500 + (w.streak % 7 === 0 ? 2000 : 0);
        w.balance += reward;
        const rankBonus = addXp(w, 50);
        return {
          reward: reward + rankBonus,
          rankBonus,
          balance: w.balance,
          streak: w.streak,
        };
      }),
    gift: (actor, target, value, event) =>
      mutate(["gift", actor, event], actor, async (tx, w) => {
        requireUser(target);
        if (!owned(actor))
          throw Error("Only the configured creator can issue Aura gifts.");
        if (owned(target)) throw Error("The owner already has unlimited Aura.");
        const n = amountValue(value);
        const budgetId = key("gift-budget", dayKey(now()));
        const budget = (await tx.get("AuraLimits", budgetId)) || {
          _id: budgetId,
          total: 0,
        };
        if (budget.total + n > 500000)
          throw Error(
            "The combined owner gift/coupon budget is 500,000 Aura per Lagos day.",
          );
        budget.total += n;
        await tx.put("AuraLimits", budget);
        const recipient =
          (await tx.get("AuraWallets", target)) || fresh(target);
        recipient.balance += n;
        await tx.put("AuraWallets", recipient);
        await tx.put("AuraLedger", {
          _id: key("gift-receipt", actor, event),
          actor: target,
          kind: "gift-received",
          delta: n,
          at: now(),
          result: { reward: n, balance: recipient.balance },
        });
        return { reward: n, target, balance: recipient.balance };
      }),
    transfer: (actor, target, value, event) =>
      mutate(["transfer", actor, event], actor, async (tx, w) => {
        requireUser(target);
        if (actor === target || owned(actor) || owned(target))
          throw Error(
            "Use owner gifting for the creator; ordinary transfers require two different members.",
          );
        const n = amountValue(value, 10000),
          fee = Math.ceil(n * 0.05);
        const today = dayKey(now());
        if (w.transferDay !== today) {
          w.transferDay = today;
          w.transferred = 0;
        }
        if ((w.transferred || 0) + n > 20000)
          throw Error("Daily transfer limit is 20,000 Aura.");
        spend(w, n + fee, actor);
        w.transferred = (w.transferred || 0) + n;
        const targetW = (await tx.get("AuraWallets", target)) || fresh(target);
        targetW.balance += n;
        await tx.put("AuraWallets", targetW);
        await tx.put("AuraLedger", {
          _id: key("transfer-receipt", actor, event),
          actor: target,
          kind: "transfer-received",
          delta: n,
          at: now(),
          result: { reward: n, balance: targetW.balance },
        });
        return { spent: n + fee, fee, balance: w.balance };
      }),
    buy: (actor, item, event) =>
      mutate(["buy", actor, event], actor, async (_tx, w) => {
        const product = SHOP.find((x) => x.id === item);
        if (!product) throw Error("Choose an item from $aurashop.");
        if (w.inventory.includes(item))
          throw Error("You already own this item.");
        spend(w, product.price, actor);
        w.inventory.push(item);
        return {
          item,
          spent: owned(actor) ? 0 : product.price,
          balance: w.balance,
        };
      }),
    evolve: (actor, event) =>
      mutate(["evolve", actor, event], actor, async (_tx, w) => {
        const next = EVO[w.evo + 1];
        if (!next) throw Error("Your emblem is already Apex.");
        if (w.quests < next.quests && !owned(actor))
          throw Error(`Complete ${next.quests} quests to unlock ${next.name}.`);
        spend(w, next.price, actor);
        w.evo++;
        w.badges = [...new Set([...w.badges, "Evo " + next.name])];
        return {
          evo: next.name,
          spent: owned(actor) ? 0 : next.price,
          balance: w.balance,
        };
      }),
    charge: (actor, command, value, event) =>
      mutate(["charge", actor, event, command], actor, async (tx, w) => {
        const n = amountValue(value, 10000);
        if (w.conduct < 40 && !owned(actor))
          throw Error(
            "Conduct score is too low for paid features. Use $aurarules or appeal a mistaken penalty.",
          );
        spend(w, n, actor);
        const reservation = key("charge", actor, event, command);
        await tx.put("AuraCharges", {
          _id: reservation,
          actor,
          amount: owned(actor) ? 0 : n,
          status: "reserved",
          at: now(),
          expiresAt: new Date(+now() + 10 * 60000),
        });
        return { reservation, spent: owned(actor) ? 0 : n, balance: w.balance };
      }),
    settle: (actor, reservation, success) =>
      mutate(["settle", reservation], actor, async (tx, w) => {
        const charge = await tx.get("AuraCharges", reservation);
        if (!charge || charge.actor !== actor) throw Error("Unknown charge.");
        if (charge.status !== "reserved") return { balance: w.balance };
        charge.status = success ? "spent" : "refunded";
        if (!success) w.balance += charge.amount;
        await tx.put("AuraCharges", charge);
        return {
          balance: w.balance,
          refunded: success ? 0 : charge.amount,
          spent: success ? charge.amount : 0,
        };
      }),
    createDrop: async (slot, groups) =>
      store.transaction(async (tx) => {
        const id = key("drop", slot),
          existing = await tx.get("AuraCoupons", id);
        if (existing) return existing;
        const code = randomBytes(8).toString("hex").toUpperCase(),
          row = {
            _id: id,
            codeHash: key(code),
            code,
            groups,
            amount: 20000,
            slot,
            expiresAt: new Date(+now() + 30 * 60000),
            status: "open",
            posted: [],
          };
        await tx.put("AuraCoupons", row);
        return row;
      }),
    createCoupon: (actor, value, event) =>
      mutate(["coupon", actor, event], actor, async (tx) => {
        if (!owned(actor)) throw Error("Only the creator can issue coupons.");
        const n = amountValue(value);
        const id = key("gift-budget", dayKey(now()));
        const budget = (await tx.get("AuraLimits", id)) || {
          _id: id,
          total: 0,
        };
        if (budget.total + n > 500000)
          throw Error("Daily gift/coupon budget exceeded.");
        budget.total += n;
        await tx.put("AuraLimits", budget);
        const code = randomBytes(8).toString("hex").toUpperCase();
        await tx.put("AuraCoupons", {
          _id: key("coupon", event),
          codeHash: key(code),
          amount: n,
          expiresAt: new Date(+now() + 30 * 60000),
          status: "open",
        });
        return { code, reward: n };
      }),
    redeem: (actor, code, chat, event) =>
      mutate(["redeem", actor, event], actor, async (tx, w) => {
        if (owned(actor))
          throw Error("The creator cannot claim member coupons.");
        if (!/^[A-F0-9]{16}$/.test(code))
          throw Error("Enter the exact 16-character coupon code.");
        const coupon = await tx.findOne("AuraCoupons", { codeHash: key(code) });
        if (
          !coupon ||
          coupon.status !== "open" ||
          +new Date(coupon.expiresAt) <= +now()
        )
          throw Error("Coupon expired, invalid or already claimed.");
        if (coupon.slot) {
          if (!coupon.groups.includes(chat))
            throw Error("Redeem this drop in a selected group.");
          if (w.dropDay === dayKey(now()))
            throw Error("One scheduled drop win per member per Lagos day.");
          w.dropDay = dayKey(now());
        }
        coupon.status = "claimed";
        coupon.winner = actor;
        delete coupon.code;
        await tx.put("AuraCoupons", coupon);
        w.balance += coupon.amount;
        return { reward: coupon.amount, balance: w.balance };
      }),
    quest: (actor, questionId, answer, event) =>
      mutate(["quest-answer", actor, event], actor, async (tx, w) => {
        const q = await tx.get("AuraQuests", questionId);
        if (
          !q ||
          q.actor !== actor ||
          q.done ||
          +new Date(q.expiresAt) <= +now()
        )
          throw Error("Quest expired or already answered. Use $quests.");
        q.done = true;
        await tx.put("AuraQuests", q);
        if (String(answer).trim() !== String(q.answer))
          return { correct: false, balance: w.balance };
        const today = dayKey(now());
        if (w.questDay !== today) {
          w.questDay = today;
          w.questToday = 0;
        }
        if (w.questToday >= 2)
          throw Error("Two rewarded learning quests per day.");
        w.questToday++;
        w.quests++;
        w.balance += 750;
        const rankBonus = addXp(w, 100);
        return {
          correct: true,
          reward: 750 + rankBonus,
          rankBonus,
          balance: w.balance,
        };
      }),
    discipline: (actor, target, value, reason, event) =>
      mutate(["penalty", actor, event], actor, async (tx) => {
        if (!owned(actor))
          throw Error("Only the creator may confirm a penalty.");
        requireUser(target);
        if (owned(target)) throw Error("Cannot penalize the creator.");
        const n = amountValue(value, 1000);
        if (
          typeof reason !== "string" ||
          reason.trim().length < 8 ||
          reason.length > 160
        )
          throw Error("Provide a reason of 8–160 characters.");
        const w = (await tx.get("AuraWallets", target)) || fresh(target),
          today = dayKey(now());
        if (w.penaltyDay !== today) {
          w.penaltyDay = today;
          w.penaltyToday = 0;
        }
        if (w.conductWarningDay !== today) {
          w.conductWarningDay = today;
          await tx.put("AuraWallets", w);
          const receipt = key("warning-receipt", event);
          await tx.put("AuraLedger", {
            _id: receipt,
            actor: target,
            kind: "warning",
            delta: 0,
            reason: reason.trim(),
            at: now(),
            result: { balance: w.balance },
          });
          return {
            warning: true,
            receipt,
            deducted: 0,
            target,
            balance: w.balance,
          };
        }
        if (w.penaltyToday + n > 5000)
          throw Error("Member daily penalty cap is 5,000 Aura.");
        const deducted = Math.min(n, w.balance);
        w.balance -= deducted;
        w.penaltyToday += n;
        w.conduct = Math.max(0, w.conduct - 10);
        await tx.put("AuraWallets", w);
        const receipt = key("penalty-receipt", event);
        await tx.put("AuraLedger", {
          _id: receipt,
          actor: target,
          kind: "penalty",
          delta: -deducted,
          reason: reason.trim(),
          conductLoss: 10,
          at: now(),
          result: { balance: w.balance },
        });
        return { receipt, deducted, target, balance: w.balance };
      }),
    refund: (actor, receipt, event) =>
      mutate(["owner-refund", actor, event], actor, async (tx) => {
        if (!owned(actor))
          throw Error("Only the creator can reverse deductions.");
        const entry = await tx.get("AuraLedger", receipt);
        if (!entry || entry.kind !== "penalty" || entry.reversed)
          throw Error("Penalty receipt not found or already reversed.");
        const w =
          (await tx.get("AuraWallets", entry.actor)) || fresh(entry.actor);
        w.balance -= entry.delta;
        w.conduct = Math.min(100, w.conduct + (entry.conductLoss || 0));
        await tx.put("AuraWallets", w);
        entry.reversed = true;
        await tx.put("AuraLedger", entry);
        const appeal = await tx.get("AuraAppeals", key("appeal", receipt));
        if (appeal) {
          appeal.status = "resolved";
          await tx.put("AuraAppeals", appeal);
        }
        await tx.put("AuraLedger", {
          _id: key("refund-receipt", receipt),
          actor: entry.actor,
          kind: "penalty-refund",
          delta: -entry.delta,
          at: now(),
          result: { balance: w.balance },
        });
        return { reward: -entry.delta, target: entry.actor };
      }),
    ranked: (winner, loser, matchId, duelId) =>
      mutate(["ranked", matchId], winner, async (tx, w) => {
        const duel = await tx.get("AuraDuels", duelId);
        if (
          !duel ||
          duel.matchId !== matchId ||
          duel.state !== "result" ||
          duel.winner !== winner ||
          duel.loser !== loser
        )
          throw Error("Ranked result is not verified.");
        duel.state = "settled";
        await tx.put("AuraDuels", duel);
        requireUser(loser);
        if (winner === loser) throw Error("Ranked players must be different.");
        const loss = (await tx.get("AuraWallets", loser)) || fresh(loser);
        const season = seasonKey(now()),
          today = dayKey(now());
        for (const account of [w, loss]) {
          if (account.season !== season) {
            account.previousSeason = account.season || null;
            account.previousBest = account.bestRp || 0;
            account.bestRp = 0;
            account.rp = Math.min(300, Math.floor((account.rp || 0) / 2));
            account.season = season;
            account.seasonWins = 0;
          }
          if (account.matchDay !== today) {
            account.matchDay = today;
            account.rewardedWins = 0;
            account.matches = 0;
          }
        }
        const pairId = key("pair", ...[winner, loser].sort(), today);
        const pair = (await tx.get("AuraLimits", pairId)) || {
          _id: pairId,
          total: 0,
        };
        if (
          pair.total >= 3 ||
          w.matches >= 10 ||
          loss.matches >= 10 ||
          w.conduct < 60 ||
          loss.conduct < 60
        ) {
          await tx.put("AuraWallets", loss);
          return {
            reward: 0,
            balance: w.balance,
            rp: w.rp || 0,
            loserRp: loss.rp || 0,
            ineligible: true,
            reason:
              "Daily match/opponent limit or conduct requirement reached; no RP or Aura changed.",
          };
        }
        pair.total++;
        await tx.put("AuraLimits", pair);
        w.matches++;
        loss.matches++;
        const previousTier = Math.floor((w.rp || 0) / 300);
        w.rp = (w.rp || 0) + 30;
        w.seasonWins++;
        w.bestRp = Math.max(w.bestRp || 0, w.rp);
        const protectedLoss = loss.lossDay !== today || (loss.shields || 0) > 0;
        loss.lossDay = today;
        if (loss.shields > 0) loss.shields--;
        const floor = (loss.rp || 0) >= 300 ? 300 : 0;
        loss.rp = Math.max(floor, (loss.rp || 0) - (protectedLoss ? 0 : 15));
        if (Math.floor(w.rp / 300) > previousTier) w.shields = 2;
        let reward = 0;
        if (w.rewardedWins < 3 && !owned(winner)) {
          reward = 1000;
          w.balance += reward;
          w.rewardedWins++;
        }
        const rankBonus = addXp(w, 100);
        reward += rankBonus;
        await tx.put("AuraWallets", loss);
        await tx.put("AuraLedger", {
          _id: key("ranked-loss", matchId),
          actor: loser,
          kind: "ranked-loss",
          delta: 0,
          at: now(),
          result: { rp: loss.rp, protectedLoss },
        });
        return {
          reward,
          balance: w.balance,
          rp: w.rp,
          loserRp: loss.rp,
          protectedLoss,
        };
      }),
    store,
  };
}
