import { getAlphaUsage, consumeAlphaUsage, refundAlphaUsage } from "../db/alphaUsage.js";
import { getGroupData } from "../db/groupData.js";
import { extractPhoneNumber } from "./lid.js";
import { isSameGroupUser } from "./groupParticipants.js";

const configuredUnlimitedNumbers = () => String(process.env.ALPHA_UNLIMITED_NUMBERS || "")
  .split(/[,;\s]+/)
  .map((value) => value.replace(/\D/g, ""))
  .filter(Boolean);

const digitsOf = (jid) => {
  try { return String(extractPhoneNumber(jid) || "").replace(/\D/g, ""); }
  catch { return String(jid || "").replace(/\D/g, ""); }
};

const asPn = (number) => `${number}@s.whatsapp.net`;

export const isAlphaUnlimitedUser = ({
  isOwner = false,
  groupMetadata,
  candidates = [],
}) => {
  const values = (Array.isArray(candidates) ? candidates : [candidates]).filter(Boolean);
  const explicit = configuredUnlimitedNumbers();

  // When ALPHA_UNLIMITED_NUMBERS is set, it becomes the authoritative bypass list.
  // This lets one moderator remain unlimited without granting the same privilege
  // to every configured Moderator or ordinary group admin.
  if (explicit.length) {
    return values.some((candidate) => {
      const digits = digitsOf(candidate);
      if (digits && explicit.includes(digits)) return true;
      return explicit.some((number) => isSameGroupUser(groupMetadata, candidate, asPn(number)));
    });
  }

  // By default only the bot owner/creator bypasses the quota. Other configured
  // moderators and ordinary group admins remain limited. If the moderator who
  // should be unlimited is a different account, set ALPHA_UNLIMITED_NUMBERS.
  return Boolean(isOwner);
};

export const getAlphaGroupLimit = async (groupJid, suppliedLimit) => {
  if (Number.isFinite(Number(suppliedLimit))) return Math.min(50, Math.max(1, Math.trunc(Number(suppliedLimit))));
  const data = await getGroupData(groupJid).catch(() => null);
  const value = Number(data?.alphaDailyQuota);
  if (Number.isFinite(value)) return Math.min(50, Math.max(1, Math.trunc(value)));
  const fallback = Number(process.env.ALPHA_MEMBER_DAILY_LIMIT || 10);
  return Number.isFinite(fallback) ? Math.min(50, Math.max(1, Math.trunc(fallback))) : 10;
};

export const getAlphaGroupAiUsage = async ({
  groupJid,
  senderJid,
  groupMetadata,
  isOwner = false,
  candidates = [],
  limit,
}) => {
  const unlimited = isAlphaUnlimitedUser({
    isOwner,
    groupMetadata,
    candidates: [senderJid, ...candidates].filter(Boolean),
  });
  const resolvedLimit = await getAlphaGroupLimit(groupJid, limit);
  return getAlphaUsage({
    groupJid,
    memberJid: senderJid,
    limit: resolvedLimit,
    unlimited,
  });
};

export const claimAlphaGroupAiUsage = async ({
  groupJid,
  senderJid,
  memberName = "",
  groupMetadata,
  isOwner = false,
  candidates = [],
  limit,
}) => {
  const unlimited = isAlphaUnlimitedUser({
    isOwner,
    groupMetadata,
    candidates: [senderJid, ...candidates].filter(Boolean),
  });
  const resolvedLimit = await getAlphaGroupLimit(groupJid, limit);
  const status = await consumeAlphaUsage({
    groupJid,
    memberJid: senderJid,
    memberName,
    limit: resolvedLimit,
    unlimited,
  });
  return {
    ...status,
    groupJid,
    memberJid: senderJid,
    charged: Boolean(status.allowed && !status.unlimited),
  };
};

export const refundAlphaGroupAiUsage = async (claim) => {
  if (!claim?.charged || !claim?.groupJid || !claim?.memberJid) return { refunded: false };
  return refundAlphaUsage({
    groupJid: claim.groupJid,
    memberJid: claim.memberJid,
    dayKey: claim.dayKey,
    unlimited: Boolean(claim.unlimited),
  });
};
