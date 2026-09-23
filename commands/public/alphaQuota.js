import { getGroupData, group } from "../../db/groupData.js";
import { getAlphaGroupAiUsage } from "../../utils/alphaQuota.js";
import { isConfiguredModerator } from "../../utils/moderatorAuthority.js";

const handler = async (_sock, msg, from, args, info) => {
  const { isGroup, senderJid, isOwner, isGroupAdmin, groupMetadata, sendMessageWTyping } = info;
  const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });

  if (!isGroup) return reply("⚡ Alpha usage limits are tracked per group.");

  const data = await getGroupData(from);
  const requestedLimit = Number(args[0]);
  const moderator = isConfiguredModerator(groupMetadata, [
    senderJid,
    msg?.key?.participantPn,
    msg?.key?.participantAlt,
  ]);

  if (Number.isFinite(requestedLimit)) {
    if (!(isOwner || isGroupAdmin || moderator)) {
      return reply("🛡️ Only a group admin or configured moderator can change Alpha's daily limit.");
    }
    const nextLimit = Math.min(50, Math.max(1, Math.trunc(requestedLimit)));
    await group.updateOne({ _id: from }, { $set: { alphaDailyQuota: nextLimit } });
    return reply(`✅ Alpha daily AI limit set to *${nextLimit} requests per member*.`);
  }

  const status = await getAlphaGroupAiUsage({
    groupJid: from,
    senderJid,
    groupMetadata,
    isOwner,
    candidates: [msg?.key?.participantPn, msg?.key?.participantAlt],
    limit: data?.alphaDailyQuota,
  });

  if (status.unlimited) {
    return reply("♾️ *Alpha AI Usage*\nYou have unlimited AI usage in this group.");
  }

  return reply(
    `📊 *Alpha AI Usage*\nUsed today: *${status.used}/${status.limit}*\nRemaining today: *${status.remaining}*\nUsage date: *${status.dayKey}*`,
  );
};

export default () => ({
  cmd: ["alphaquota", "aiquota"],
  desc: "Show your Alpha AI daily usage; admins can set the group daily limit",
  usage: "alphaquota | alphaquota <1-50>",
  handler,
});
