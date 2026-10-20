import { auraProfilePayload } from "../../utils/aura/profile.js";
import { aura, auraStore } from "../../db/auraData.js";
import { auraIdentity } from "../../utils/aura/identity.js";
import {
  dayKey,
  key,
  xpRank,
  rpRank,
  EVO,
  SHOP,
  PRICES,
} from "../../utils/aura/policy.js";
import { alphaPanel } from "../../utils/alphaStyle.js";
import { learningQuest } from "../../utils/aura/quests.js";
import { participantJids } from "../../utils/groupParticipants.js";
const help =
  "Aura has no cash value. Earn with $daily, $quests, ranked wins and scheduled $redeem codes. Spend with $aurashop or priced commands. Only the primary creator has unlimited Aura. Wallets are global; old virtual coins remain separate. Use $auraprices, $auratransactions, $auraprofile, $aurarank, $evo, $aurarules.";
const handler = async (sock, msg, from, args, info) => {
  const reply = (text) =>
    info.sendMessageWTyping(from, { text }, { quoted: msg });
  try {
    const actor = await auraIdentity(sock, info),
      owner = aura.owned(actor),
      cmd = info.command;
    const event = key(from, msg.key?.id, cmd);
    if (!msg.key?.id) throw Error("Missing message identity.");
    if (["aurarules", "aurahelp"].includes(cmd))
      return reply(
        help +
          "\n\nPenalties require creator review: max 1,000 per incident / 5,000 per member daily; balances never go negative. No penalty for silence, normal losses or failed APIs. Appeals: $auraappeal <receipt> <reason>. Ranked seasons follow Lagos calendar months; the previous season’s best rank is retained. Evo and XP remain permanent.",
      );
    if (["auraprices", "prices"].includes(cmd))
      return reply(
        "✨ *AURA PRICES — per successful command*\n" +
          PRICES.map(
            (x) => `${x.commands.map((c) => "$" + c).join(" / ")} — ${x.price}`,
          ).join("\n") +
          "\nAll unlisted commands remain free, including help, safety and moderation. Commands priced 1,000+ require a trailing --confirm. Refunds on failure; existing provider quotas still apply. Old virtual coins cannot pay Aura prices.",
      );
    if (["aura", "balance", "auraprofile", "aurarank"].includes(cmd)) {
      const w = await aura.profile(actor);
      const current =
        w.season === new Date(Date.now() + 3600000).toISOString().slice(0, 7)
          ? w.rp || 0
          : Math.min(300, Math.floor((w.rp || 0) / 2));
      const caption = alphaPanel({
        icon: "✨",
        title: "YOUR AURA PROFILE",
        lines: [
          `Aura: ${owner ? "∞ · CREATOR" : w.balance}`,
          `Lifetime XP: ${w.xp} · ${xpRank(w.xp)[1]}`,
          `Ranked: ${rpRank(current)} · ${current} RP`,
          `Evo: ${EVO[w.evo].name} · Completed quests: ${w.quests}`,
          `Conduct: ${w.conduct}/100`,
          `Equipped cosmetic: ${w.equipped || "Default"}`,
          `Daily streak: ${w.streak || 0}`,
        ],
        footer: "Spending Aura never lowers lifetime XP. $aurahelp",
      });
      return info.sendMessageWTyping(
        from,
        await auraProfilePayload(sock, info.senderJid, caption, w.equipped),
        { quoted: msg },
      );
    }
    if (cmd === "auraboard") {
      if (!info.isGroup)
        throw Error("Group Aura leaderboards require a group.");
      const roster = (info.groupMetadata?.participants || [])
        .flatMap((p) => participantJids(p))
        .filter((j) => /^\d{7,15}@s\.whatsapp\.net$/.test(j) && !aura.owned(j));
      const rows = await auraStore.find(
        "AuraWallets",
        { _id: { $in: roster.slice(0, 1024) } },
        { xp: -1 },
        10,
      );
      return reply(
        rows.length
          ? "🏆 *GROUP AURA XP BOARD*\n" +
              rows
                .map(
                  (w, i) =>
                    `${i + 1}. Member …${w._id.split("@")[0].slice(-4)} · ${xpRank(w.xp)[1]} · ${w.xp} XP`,
                )
                .join("\n") +
              "\nCurrent group members only; creator excluded. XP board, not a wallet-rich list."
          : "No Aura XP recorded for identifiable current members yet.",
      );
    }
    if (cmd === "aurabadges") {
      const w = await aura.profile(actor);
      return reply(
        w.badges?.length
          ? w.badges.join(" · ")
          : "No Aura badges yet. Try $quests and $daily.",
      );
    }
    if (cmd === "daily") {
      const r = await aura.daily(actor);
      return reply(
        r.duplicate
          ? "Today's daily reward is already claimed."
          : `✨ +${r.reward} Aura · Balance ${r.balance} · Streak ${r.streak}`,
      );
    }
    if (cmd === "redeem") {
      const r = await aura.redeem(
        actor,
        String(args[0] || "").toUpperCase(),
        from,
        event,
      );
      return reply(
        r.duplicate
          ? "This redemption was already processed."
          : `🎉 You won ${r.reward} Aura! Balance: ${r.balance}`,
      );
    }
    if (cmd === "auratransactions" || cmd === "transactions") {
      const rows = await aura.history(actor);
      return info.sendMessageWTyping(actor, {
        text: rows.length
          ? rows
              .map(
                (x) =>
                  `${x.kind} · ${x.delta >= 0 ? "+" : ""}${x.delta} Aura\nReceipt: ${x._id}${x.reason ? "\nReason: " + x.reason : ""}`,
              )
              .join("\n\n")
          : "No Aura transactions yet.",
      });
    }
    if (cmd === "aurashop")
      return reply(
        "✨ *AURA SHOP*\n" +
          SHOP.map((x) => `${x.id} — ${x.price} Aura · ${x.name}`).join("\n") +
          "\n$aurabuy <item-id>\n$aurainventory · $auraequip <item-id>\nCosmetics appear on $auraprofile; no moderation powers.",
      );
    if (cmd === "aurabuy") {
      const r = await aura.buy(actor, args[0], event);
      return reply(
        `Purchased ${r.item}. Spent ${r.spent}; balance ${r.balance}.`,
      );
    }
    if (cmd === "aurainventory") {
      const w = await aura.profile(actor);
      return reply(
        w.inventory.join("\n") || "No Aura cosmetics yet. See $aurashop.",
      );
    }
    if (cmd === "auraequip") {
      await auraStore.transaction(async (tx) => {
        const w = await tx.get("AuraWallets", actor);
        if (!w?.inventory.includes(args[0]))
          throw Error("You do not own that cosmetic.");
        w.equipped = args[0];
        await tx.put("AuraWallets", w);
      });
      return reply("Cosmetic equipped on $auraprofile.");
    }
    if (cmd === "evo") {
      if (args[0] !== "upgrade")
        return reply(
          EVO.map(
            (x, i) =>
              `${i}. ${x.name}: ${x.price} Aura + ${x.quests} completed quests`,
          ).join("\n") +
            "\n$evo upgrade --confirm buys the next stage. Permanent; no power advantage.",
        );
      if (args[1] !== "--confirm")
        return reply("Read $evo, then use $evo upgrade --confirm.");
      const r = await aura.evolve(actor, event);
      return reply(
        `Evolved to ${r.evo}. Spent ${r.spent}; balance ${r.balance}.`,
      );
    }
    if (cmd === "aurasend" || cmd === "auragift" || cmd === "aurapenalty") {
      const targetRaw =
        info.extendedMessageOriginal?.mentionedJid?.[0] ||
        info.extendedMessageOriginal?.participant;
      if (!targetRaw)
        throw Error("Mention or reply to a member, then give an amount.");
      const target = await auraIdentity(sock, info, targetRaw);
      const amount = args.find((x) => /^\d+$/.test(x));
      if (!amount) throw Error("Provide a whole positive amount.");
      if (cmd === "aurapenalty") {
        const at = args.indexOf(amount),
          reason = args.slice(at + 1).join(" ");
        const r = await aura.discipline(actor, target, amount, reason, event);
        await info
          .sendMessageWTyping(target, {
            text: `${r.warning ? "Aura warning — no deduction" : "Aura penalty: " + r.deducted}. Reason: ${reason}\nReceipt: ${r.receipt}\n${r.warning ? "Further reviewed violations today may incur a deduction." : "Appeal privately: $auraappeal " + r.receipt + " <reason>"}`,
          })
          .catch(() => {});
        return reply(
          `${r.warning ? "Warning recorded; no deduction" : "Penalty recorded"}. Receipt ${r.receipt}. Private delivery attempted; history remains available.`,
        );
      }
      if (cmd === "aurasend" && args.at(-1) !== "--confirm") {
        const principal = Number(amount),
          fee = Math.ceil(principal * 0.05);
        if (
          !Number.isSafeInteger(principal) ||
          principal < 1 ||
          principal > 10000
        )
          throw Error("Transfer amount must be 1–10,000 Aura.");
        return reply(
          `Recipient gets ${principal} Aura; fee ${fee}; total debit ${principal + fee}. Repeat the transfer with --confirm to proceed. Daily principal limit: 20,000.`,
        );
      }
      const r =
        cmd === "auragift"
          ? await aura.gift(actor, target, amount, event)
          : await aura.transfer(actor, target, amount, event);
      await info
        .sendMessageWTyping(target, {
          text: `✨ You received ${amount} Aura. Check $auratransactions privately.`,
        })
        .catch(() => {});
      return reply(
        `${r.duplicate ? "Already processed. " : ""}${cmd === "auragift" ? "Gift" : "Transfer"} recorded. ${r.fee ? `Fee: ${r.fee}.` : ""}`,
      );
    }
    if (cmd === "auracoupon") {
      const r = await aura.createCoupon(actor, args[0], event);
      await info.sendMessageWTyping(actor, {
        text: `Private Aura coupon: ${r.code}\nValue: ${r.reward}; expires in 30 minutes. Share with your intended audience.`,
      });
      return reply("Coupon details sent to your private chat.");
    }
    if (cmd === "aurarefund") {
      const r = await aura.refund(actor, args[0], event);
      return reply(`Penalty reversed; ${r.reward} Aura restored.`);
    }
    if (cmd === "auraappeal") {
      const receipt = args[0],
        reason = args.slice(1).join(" ").slice(0, 300);
      if (!/^[a-f0-9]{64}$/.test(receipt || "") || reason.length < 8)
        throw Error(
          "Use $auraappeal <receipt> <reason of at least 8 characters>.",
        );
      const entry = await auraStore.get("AuraLedger", receipt);
      if (entry?.actor !== actor || entry.kind !== "penalty")
        throw Error("You can appeal only your own penalty receipt.");
      await auraStore.transaction(async (tx) => {
        const id = key("appeal", receipt);
        if (await tx.get("AuraAppeals", id)) return;
        await tx.put("AuraAppeals", {
          _id: id,
          actor,
          receipt,
          reason,
          status: "open",
          at: new Date(),
        });
      });
      return reply("Appeal recorded for creator review. No extra fee.");
    }
    if (cmd === "auraappeals") {
      if (!owner) throw Error("Creator only.");
      const rows = await auraStore.find(
        "AuraAppeals",
        { status: "open" },
        { at: 1 },
        10,
      );
      return info.sendMessageWTyping(actor, {
        text:
          rows.map((x) => `${x.receipt}\n${x.reason}`).join("\n\n") ||
          "No open appeals.",
      });
    }
    if (cmd === "auradrops") {
      if (!owner || !info.isGroup)
        throw Error(
          "Only the creator can configure drops inside a selected group.",
        );
      if (!["on", "off"].includes(args[0]))
        throw Error(
          "Use $auradrops on or $auradrops off in each chosen group.",
        );
      await auraStore.transaction(async (tx) => {
        const row = (await tx.get("AuraSettings", "drops")) || {
          _id: "drops",
          groups: [],
        };
        row.groups = row.groups.filter((x) => x !== from);
        if (args[0] === "on") {
          if (row.groups.length >= 20)
            throw Error("Maximum 20 selected drop groups.");
          row.groups.push(from);
        }
        await tx.put("AuraSettings", row);
      });
      return reply(
        "Drop group updated. Times: 08:00 / 14:00 / 20:00 Africa/Lagos. One shared 20,000-Aura code per slot; first valid global claim wins.",
      );
    }
    if (cmd === "quests") {
      const id = key("quest", actor, dayKey(), String(args[0] || "1"));
      if (!["1", "2"].includes(args[0] || "1"))
        throw Error("Use $quests 1 or $quests 2.");
      let row = await auraStore.get("AuraQuests", id);
      if (!row) {
        const { prompt, options, answer } = learningQuest(
          actor,
          dayKey(),
          args[0] || "1",
        );
        row = {
          _id: id,
          actor,
          prompt,
          options,
          answer,
          expiresAt: new Date(Date.now() + 10 * 60000),
        };
        await auraStore.transaction(async (tx) => {
          const existing = await tx.get("AuraQuests", id);
          if (existing) row = existing;
          else await tx.put("AuraQuests", row);
        });
      }
      return reply(
        `${row.done ? "Quest already answered. " : ""}${row.prompt}\n${row.options.map((x, i) => `${i + 1}. ${x}`).join("\n")}\n$questanswer ${args[0] || 1} <option 1–3> · One attempt; expires after 10 minutes. Reward: 750 Aura.`,
      );
    }
    if (cmd === "questanswer") {
      if (!["1", "2"].includes(args[0]) || !/^[1-3]$/.test(args[1] || ""))
        throw Error("Use $questanswer 1 2 (quest number, answer option).");
      const r = await aura.quest(
        actor,
        key("quest", actor, dayKey(), args[0]),
        args[1],
        event,
      );
      return reply(
        r.correct
          ? `Correct! +${r.reward} Aura · Balance ${r.balance}`
          : "Not correct this time. No Aura deducted.",
      );
    }
  } catch (error) {
    const message = /Mongo|transaction|ECONN|timed out|server|topology/i.test(
      error.message,
    )
      ? "Aura database is unavailable or does not support transactions. No unsafe balance change was attempted."
      : error.message;
    return reply(`⚠️ ${message}`);
  }
};
export default () => ({
  cmd: [
    "aurabadges",
    "auraboard",
    "aura",
    "balance",
    "auraprofile",
    "aurarank",
    "daily",
    "redeem",
    "auraprices",
    "prices",
    "auratransactions",
    "transactions",
    "aurashop",
    "aurabuy",
    "aurainventory",
    "auraequip",
    "aurasend",
    "auragift",
    "aurapenalty",
    "auracoupon",
    "aurarefund",
    "auraappeal",
    "auraappeals",
    "auradrops",
    "quests",
    "questanswer",
    "evo",
    "aurarules",
    "aurahelp",
  ],
  desc: "Aura wallets, redeem drops, daily quests, cosmetic Evo upgrades and private creator controls",
  usage:
    "aura | daily | redeem CODE | prices | quests 1 | questanswer 1 2 | aurashop | evo | aurahelp",
  handler,
});
