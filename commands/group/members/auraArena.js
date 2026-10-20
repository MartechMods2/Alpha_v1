import { isAuraEnabled } from "../../../utils/aura/activation.js";
import { randomUUID } from "node:crypto";
import { aura, auraStore } from "../../../db/auraData.js";
import { auraIdentity } from "../../../utils/aura/identity.js";
import { key, rpRank } from "../../../utils/aura/policy.js";
import {
  createGameRound,
  isCorrectGameAnswer,
} from "../../../utils/gameEngine.js";
const handler = async (sock, msg, from, args, info) => {
  const reply = (text) =>
    info.sendMessageWTyping(from, { text }, { quoted: msg });
  try {
    if (!(await isAuraEnabled(auraStore)))
      return reply(
        "Aura is currently OFF. Ranked Aura duels are paused; no points or currency are deducted.",
      );
    if (!info.isGroup) throw Error("Aura ranked duels require a group.");
    const actor = await auraIdentity(sock, info),
      id = key("duel-group", from),
      command = info.command;
    if (command === "auraduel") {
      const targetRaw =
        info.extendedMessageOriginal?.mentionedJid?.[0] ||
        info.extendedMessageOriginal?.participant;
      if (!targetRaw) throw Error("Use $auraduel @member.");
      const target = await auraIdentity(sock, info, targetRaw);
      if (actor === target) throw Error("Choose another member.");
      await auraStore.transaction(async (tx) => {
        const row = await tx.get("AuraDuels", id);
        if (
          row &&
          (row.state === "result" ||
            (["pending", "active"].includes(row.state) &&
              +new Date(row.expiresAt) > Date.now()))
        )
          throw Error(
            "A duel is already pending, active or settling in this group.",
          );
        await tx.put("AuraDuels", {
          _id: id,
          matchId: randomUUID(),
          chat: from,
          challenger: actor,
          target,
          state: "pending",
          attempts: [],
          expiresAt: new Date(Date.now() + 120000),
        });
      });
      return reply(
        "⚔️ Aura ranked invitation sent. The challenged member can use $auraaccept within two minutes. Free entry; +30 RP for a win, −15 for a loss, daily first-loss protection. Both players get one answer attempt. $auradecline to decline.",
      );
    }
    if (command === "auraaccept") {
      const round = createGameRound("trivia", "tech");
      const duel = await auraStore.transaction(async (tx) => {
        const row = await tx.get("AuraDuels", id);
        if (
          !row ||
          row.state !== "pending" ||
          row.target !== actor ||
          +new Date(row.expiresAt) <= Date.now()
        )
          throw Error("No valid invitation for you.");
        row.state = "active";
        row.prompt = round.prompt;
        row.answers = round.answers;
        row.expiresAt = new Date(Date.now() + 120000);
        await tx.put("AuraDuels", row);
        return row;
      });
      return reply(
        `⚔️ *AURA RANKED DUEL*\n${duel.prompt}\n\nBoth invited players: $auraanswer <answer>\nOne attempt each · two-minute limit · cancelled/expired matches cost nothing.`,
      );
    }
    if (command === "auradecline") {
      await auraStore.transaction(async (tx) => {
        const row = await tx.get("AuraDuels", id);
        if (
          !row ||
          row.state !== "pending" ||
          ![row.target, row.challenger].includes(actor)
        )
          throw Error("No pending invitation for you.");
        row.state = "cancelled";
        await tx.put("AuraDuels", row);
      });
      return reply("Invitation cancelled without charge.");
    }
    if (command === "auraanswer") {
      if (!args.length) throw Error("Use $auraanswer <answer>.");
      const result = await auraStore.transaction(async (tx) => {
        const row = await tx.get("AuraDuels", id);
        if (
          !row ||
          row.state !== "active" ||
          +new Date(row.expiresAt) <= Date.now() ||
          ![row.target, row.challenger].includes(actor)
        )
          throw Error("No active ranked duel for you.");
        if (row.attempts.includes(actor))
          throw Error("You have already answered this duel.");
        row.attempts.push(actor);
        if (isCorrectGameAnswer(args.join(" "), row.answers)) {
          row.state = "result";
          row.winner = actor;
          row.loser = actor === row.target ? row.challenger : row.target;
        } else if (row.attempts.length === 2) row.state = "cancelled";
        await tx.put("AuraDuels", row);
        return row;
      });
      if (result.state !== "result")
        return reply(
          result.state === "cancelled"
            ? "Neither answer was correct; duel cancelled without RP or Aura deductions."
            : "Not correct. Your opponent can still answer. No Aura deducted.",
        );
      const r = await aura.ranked(
        result.winner,
        result.loser,
        result.matchId,
        id,
      );
      if (r.ineligible) return reply(r.reason);
      return reply(
        `🏆 Correct answer! Winner: ${rpRank(r.rp)} (${r.rp} RP), +${r.reward} Aura. Opponent: ${r.loserRp} RP${r.protectedLoss ? " · loss protected" : ""}. Use $auraprofile for your balances.`,
      );
    }
  } catch (error) {
    return reply(
      /Mongo|transaction|ECONN|topology/i.test(error.message)
        ? "Aura ranked storage is temporarily unavailable; no unsafe result was awarded."
        : `⚠️ ${error.message}`,
    );
  }
};
export default () => ({
  cmd: ["auraduel", "auraaccept", "auradecline", "auraanswer"],
  desc: "Free opt-in ranked technical trivia duels with RP, protected losses and capped Aura prizes",
  usage: "auraduel @member | auraaccept | auraanswer <answer> | auradecline",
  handler,
});
