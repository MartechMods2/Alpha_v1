import mdClient from "./client.js";

const database = mdClient.db("MyBotDataDB");
export const alphaAiUsage = database.collection("AlphaAiUsage");
const fallbackUsage = new Map();

const clampLimit = (value, fallback = 10) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(100, Math.max(1, Math.trunc(number))) : fallback;
};

export const alphaUsageDayKey = () => {
  const timeZone = process.env.BOT_TIMEZONE || "Africa/Lagos";
  try {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const part = (type) => parts.find((item) => item.type === type)?.value || "";
    const year = part("year");
    const month = part("month");
    const day = part("day");
    if (year && month && day) return `${year}-${month}-${day}`;
  } catch {}
  return new Date().toISOString().slice(0, 10);
};

const usageId = (groupJid, memberJid, dayKey = alphaUsageDayKey()) =>
  `${dayKey}:${groupJid}:${memberJid}`;

const expiryDate = () => new Date(Date.now() + 4 * 86_400_000);

alphaAiUsage.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch((error) => {
  console.warn("[ALPHA_QUOTA] Could not ensure TTL index:", error.message);
});

const fallbackConsume = ({ groupJid, memberJid, limit }) => {
  const id = usageId(groupJid, memberJid);
  const used = fallbackUsage.get(id) || 0;
  if (used >= limit) return { allowed: false, used, remaining: 0, limit, persisted: false };

  const next = used + 1;
  fallbackUsage.set(id, next);
  if (fallbackUsage.size > 5000) {
    const prefix = `${alphaUsageDayKey()}:`;
    for (const key of fallbackUsage.keys()) {
      if (!key.startsWith(prefix)) fallbackUsage.delete(key);
    }
  }

  return { allowed: true, used: next, remaining: Math.max(0, limit - next), limit, persisted: false };
};

export const getAlphaUsage = async ({
  groupJid,
  memberJid,
  limit = process.env.ALPHA_MEMBER_DAILY_LIMIT || 10,
  unlimited = false,
}) => {
  const normalizedLimit = clampLimit(limit);
  if (unlimited) {
    return {
      allowed: true,
      unlimited: true,
      used: 0,
      remaining: null,
      limit: null,
      persisted: true,
      dayKey: alphaUsageDayKey(),
    };
  }

  const dayKey = alphaUsageDayKey();
  try {
    const row = await alphaAiUsage.findOne({ _id: usageId(groupJid, memberJid, dayKey) });
    const used = Math.max(0, Number(row?.used || 0));
    return {
      allowed: used < normalizedLimit,
      unlimited: false,
      used,
      remaining: Math.max(0, normalizedLimit - used),
      limit: normalizedLimit,
      persisted: true,
      dayKey,
    };
  } catch (error) {
    console.warn("[ALPHA_QUOTA] Mongo read failed; using process fallback:", error.message);
    const used = fallbackUsage.get(usageId(groupJid, memberJid, dayKey)) || 0;
    return {
      allowed: used < normalizedLimit,
      unlimited: false,
      used,
      remaining: Math.max(0, normalizedLimit - used),
      limit: normalizedLimit,
      persisted: false,
      dayKey,
    };
  }
};


export const refundAlphaUsage = async ({
  groupJid,
  memberJid,
  dayKey = alphaUsageDayKey(),
  unlimited = false,
}) => {
  if (unlimited) return { refunded: false, unlimited: true, dayKey };

  const id = usageId(groupJid, memberJid, dayKey);
  try {
    const result = await alphaAiUsage.findOneAndUpdate(
      { _id: id, used: { $gt: 0 } },
      {
        $inc: { used: -1 },
        $set: { updatedAt: new Date(), expiresAt: expiryDate() },
      },
      { returnDocument: "after" },
    );
    return {
      refunded: Boolean(result),
      unlimited: false,
      used: Math.max(0, Number(result?.used || 0)),
      dayKey,
      persisted: true,
    };
  } catch (error) {
    console.warn("[ALPHA_QUOTA] Mongo refund failed; using process fallback:", error.message);
    const used = fallbackUsage.get(id) || 0;
    if (used > 0) fallbackUsage.set(id, used - 1);
    return {
      refunded: used > 0,
      unlimited: false,
      used: Math.max(0, used - 1),
      dayKey,
      persisted: false,
    };
  }
};

export const consumeAlphaUsage = async ({
  groupJid,
  memberJid,
  memberName = "",
  limit = process.env.ALPHA_MEMBER_DAILY_LIMIT || 10,
  unlimited = false,
}) => {
  const normalizedLimit = clampLimit(limit);
  if (unlimited) {
    return {
      allowed: true,
      unlimited: true,
      used: 0,
      remaining: null,
      limit: null,
      persisted: true,
      dayKey: alphaUsageDayKey(),
    };
  }

  const dayKey = alphaUsageDayKey();
  const id = usageId(groupJid, memberJid, dayKey);

  try {
    let result;
    try {
      result = await alphaAiUsage.findOneAndUpdate(
        {
          _id: id,
          $or: [{ used: { $lt: normalizedLimit } }, { used: { $exists: false } }],
        },
        {
          $inc: { used: 1 },
          $set: {
            groupJid,
            memberJid,
            memberName,
            dayKey,
            limit: normalizedLimit,
            updatedAt: new Date(),
            expiresAt: expiryDate(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true, returnDocument: "after" },
      );
    } catch (error) {
      if (error?.code !== 11000) throw error;
      result = await alphaAiUsage.findOneAndUpdate(
        { _id: id, used: { $lt: normalizedLimit } },
        {
          $inc: { used: 1 },
          $set: {
            memberName,
            limit: normalizedLimit,
            updatedAt: new Date(),
            expiresAt: expiryDate(),
          },
        },
        { returnDocument: "after" },
      );
    }

    if (!result) {
      const current = await alphaAiUsage.findOne({ _id: id });
      const used = Math.max(normalizedLimit, Number(current?.used || normalizedLimit));
      return {
        allowed: false,
        unlimited: false,
        used,
        remaining: 0,
        limit: normalizedLimit,
        persisted: true,
        dayKey,
      };
    }

    const used = Math.max(0, Number(result.used || 0));
    return {
      allowed: true,
      unlimited: false,
      used,
      remaining: Math.max(0, normalizedLimit - used),
      limit: normalizedLimit,
      persisted: true,
      dayKey,
    };
  } catch (error) {
    console.warn("[ALPHA_QUOTA] Mongo write failed; using process fallback:", error.message);
    return {
      ...fallbackConsume({ groupJid, memberJid, limit: normalizedLimit }),
      unlimited: false,
      dayKey,
    };
  }
};
