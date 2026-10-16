import {
  getSafeSettings,
  updateSafeSettings,
  recordSafeAudit,
} from "../../../db/safePackData.js";
import { mentionIds, normalizeWords } from "../../../utils/premiumReplies.js";
const handler = async (sock, msg, from, args, info) => {
  const { command, sendMessageWTyping: send, senderJid, isBotAdmin } = info;
  if (!info.isGroup || !(info.isOwner || info.isGroupAdmin))
    return send(from, { text: "Group administrators only." }, { quoted: msg });
  const reply = (text) => send(from, { text }, { quoted: msg });
  const settings = await getSafeSettings(from);
  if (["tag", "everyone", "hidetag", "mentionall"].includes(command)) {
    const metadata = await sock.groupMetadata(from);
    const mentions = mentionIds(metadata);
    if (!mentions.length)
      return reply("No mentionable members were returned by WhatsApp.");
    const text = args.join(" ").trim() || "A message for everyone";
    return send(
      from,
      {
        text: `📣 *GROUP NOTICE*\n\n${text}\n\n_${mentions.length} members mentioned_`,
        mentions,
      },
      { quoted: msg },
    );
  }
  if (["ban", "unban", "banlist"].includes(command)) {
    const word = normalizeWords(args.join(" ")).slice(0, 100);
    const phrases = settings.blockedPhrases || [];
    if (command === "banlist")
      return reply(
        `🛡️ *Restricted words*\n\n${phrases.join("\n") || "No restricted words."}`,
      );
    if (!word)
      return reply(
        `Usage: ${command} <word or phrase>. This controls words, not member removal.`,
      );
    if (command === "ban" && !isBotAdmin)
      return reply(
        "Make Alpha a group admin so it can delete restricted messages.",
      );
    if (command === "ban" && phrases.length >= 100 && !phrases.includes(word))
      return reply(
        "Limit reached: remove a phrase before adding another (100 maximum).",
      );
    await updateSafeSettings(from, {
      blockedPhrases:
        command === "ban"
          ? [...new Set([...phrases, word])]
          : phrases.filter((x) => normalizeWords(x) !== word),
      wordFilterEnabled: command === "ban" ? true : settings.wordFilterEnabled,
    });
    await recordSafeAudit({
      groupJid: from,
      action: command + "-word",
      actorJid: senderJid,
      reason: word,
    });
    return reply(
      command === "ban"
        ? "Restricted phrase added. Matching uses whole words; admins are exempt."
        : "Restricted phrase removed.",
    );
  }
  if (command === "replydesign") {
    if (!["premium", "plain"].includes(args[0]))
      return reply(
        `Reply design: ${settings.replyDesign || "premium"}\nUsage: replydesign premium|plain`,
      );
    await updateSafeSettings(from, { replyDesign: args[0] });
    return reply("Reply design updated.");
  }
  if (command === "antibot") {
    const action = args[0] || "status",
      target =
        info.extendedMessageOriginal?.mentionedJid?.[0] ||
        info.extendedMessageOriginal?.participant;
    if (["on", "off"].includes(action)) {
      await updateSafeSettings(from, { antiBotEnabled: action === "on" });
      return reply(
        "Anti-bot review " +
          action +
          ". Suspicious automation alerts are advisory. Use antibot block @member for confirmed bots.",
      );
    }
    if (["block", "allow"].includes(action)) {
      if (!target)
        return reply(
          "Tag or reply to the confirmed account: antibot block|allow @member",
        );
      const list = settings.blockedBotJids || [];
      await updateSafeSettings(from, {
        blockedBotJids:
          action === "block"
            ? [...new Set([...list, target])].slice(0, 100)
            : list.filter((x) => x !== target),
      });
      return reply(
        "Confirmed-bot list updated. Blocking deletes future messages when Alpha is admin; it does not remove the account.",
      );
    }
    return reply(
      `Anti-bot review: ${settings.antiBotEnabled ? "ON" : "OFF"}\nConfirmed blocked accounts: ${(settings.blockedBotJids || []).length}\nWhatsApp does not provide a reliable bot-account flag. Silent bots cannot be detected.`,
    );
  }
  if (command === "stickerreplies") {
    if (!["on", "off"].includes(args[0]))
      return reply(
        `Contextual stickers: ${settings.contextStickers ? "ON" : "OFF"}\nUse stickerreplies on|off. Only approved stickers from this group are used.`,
      );
    await updateSafeSettings(from, { contextStickers: args[0] === "on" });
    return reply(
      "Contextual sticker replies " +
        args[0] +
        ". Members can contribute using reactionadd; admins approve them with reactionapprove.",
    );
  }
};
export default () => ({
  cmd: [
    "tag",
    "everyone",
    "hidetag",
    "mentionall",
    "ban",
    "unban",
    "banlist",
    "antibot",
    "replydesign",
    "stickerreplies",
  ],
  desc: "Compact mentions, word bans, honest bot review and premium presentation",
  usage: "everyone <message> | ban <phrase> | antibot on | replydesign premium",
  handler,
});
