import { getGroupData } from "../../db/groupData.js";
import { getAlphaUsage } from "../../db/alphaUsage.js";
import { isConfiguredModerator } from "../../utils/moderatorAuthority.js";

const handler = async (_sock, msg, from, _args, info) => {
  const { isGroup, senderJid, isOwner, groupMetadata, sendMessageWTyping } = info;
  const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });

  if (!isGroup) return reply("⚡ Alpha usage limits are tracked per group.");

  const data = await getGroupData(from);
  const limit = Number.isFinite(Number(data?.alphaDailyQuota))
    ? Number(data.alphaDailyQuota)
    : Number(process.env.ALPHA_MEMBER_DAILY_LIMIT || 10);
  const unlimited = Boolean(isOwner || isConfiguredModerator(groupMetadata, [senderJid]));

  const status = await getAlphaUsage({
    groupJid: from,
    memberJid: senderJid,
    limit,
    unlimited,
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
  desc: "Show your Alpha AI daily usage in this group",
  usage: "alphaquota",
  handler,
});
