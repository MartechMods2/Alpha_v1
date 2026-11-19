import { enforceConfirmedBot, botRemovalNotice } from "../../../utils/antiBotEnforcement.js";
import { isSameGroupUser } from "../../../utils/groupParticipants.js";
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
    const action = String(args[0] || "status").toLowerCase(),
      target =
        info.extendedMessageOriginal?.mentionedJid?.[0] ||
        info.extendedMessageOriginal?.participant;
    if (["on", "off"].includes(action)) {
      if (action === "on" && !isBotAdmin) return reply("Make Alpha a group admin before enabling anti-bot removal.");
      await updateSafeSettings(from, { antiBotEnabled: action === "on" });
      return reply(
        "Anti-bot enforcement " + action + ". Admin-confirmed bots are removed when they post or rejoin. Use antibot block @member to confirm and remove a bot; antibot scan checks the confirmed list. Uncertain signals only prompt review.",
      );
    }
    if (["block", "allow"].includes(action)) {
      if (!target)
        return reply(
          "Tag or reply to the confirmed account: antibot block|allow @member",
        );
      if (action === "block" && !isBotAdmin) return reply("Make Alpha a group admin before blocking and removing accounts.");
      const metadata = await sock.groupMetadata(from);
      const list = settings.blockedBotJids || [];
      if (action === "block" && list.length >= 100 && !list.some(jid=>isSameGroupUser(metadata,jid,target))) return reply("Confirmed bot list is full. Allow an old entry before adding another.");
      const updated = await updateSafeSettings(from, {
        blockedBotJids:
          action === "block"
            ? [...new Set([...list, target])].slice(0, 100)
            : list.filter((x) => !isSameGroupUser(metadata,x,target)),
      });
      const result = action === "block" ? await enforceConfirmedBot({sock, groupJid:from, memberJid:target, settings:updated, force:true}) : null;
      await recordSafeAudit({groupJid:from,action:"antibot-"+action,actorJid:senderJid,targetJid:target,reason:result?.status || "allowed"});
      return reply(action === "block" ? "Admin-confirmed bot list updated. " + botRemovalNotice(result) : "Account allowed; its confirmed-bot block was removed.");
    }
    if (action === "scan") {
      const metadata = await sock.groupMetadata(from);
      const present = (settings.blockedBotJids || []).filter(jid => (metadata.participants || []).some(p => isSameGroupUser(metadata,jid,p.id || p.lid || p.phoneNumber)));
      return reply(`Confirmed blocked accounts still present: ${present.length}. Use antibot block @member to remove one. This scan cannot identify silent or disguised bots.`);
    }
    return reply(
      `Anti-bot enforcement: ${settings.antiBotEnabled ? "ON" : "OFF"}\nConfirmed blocked accounts: ${(settings.blockedBotJids || []).length}\nWhatsApp does not provide a reliable bot-account flag. Silent bots cannot be detected.`,
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
  desc: "Compact mentions, word bans, confirmed-bot enforcement and premium presentation",
  usage: "everyone <message> | ban <phrase> | antibot on | replydesign premium",
  handler,
});
