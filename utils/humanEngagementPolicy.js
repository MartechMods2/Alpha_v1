export const HUMAN_ENGAGEMENT_DEFAULTS = Object.freeze({
  enabled: true,
  level: "balanced",
  silenceMinutes: 75,
  dailyLimit: 3,
  activeJoinEnabled: true,
  adminReminderEnabled: true,
  adminReminderTime: "21:30",
});

export const parseMinutesToken = (value, fallback = 75) => {
  const text = String(value || "").trim().toLowerCase();
  const match = text.match(/^(\d{1,3})(m|min|mins|h|hr|hrs)?$/);
  if (!match) return fallback;
  let minutes = Number(match[1]);
  if (["h", "hr", "hrs"].includes(match[2])) minutes *= 60;
  return Math.min(240, Math.max(30, minutes));
};

export const normalizeHumanSettings = (groupData = {}) => ({
  enabled: groupData.humanEngagementEnabled == null ? Boolean(groupData.isChatBotOn) : Boolean(groupData.humanEngagementEnabled),
  level: ["chill", "balanced", "lively"].includes(groupData.humanEngagementLevel) ? groupData.humanEngagementLevel : "balanced",
  silenceMinutes: Math.min(240, Math.max(30, Number(groupData.humanSilenceMinutes) || HUMAN_ENGAGEMENT_DEFAULTS.silenceMinutes)),
  dailyLimit: Math.min(5, Math.max(1, Number(groupData.humanDailyLimit) || HUMAN_ENGAGEMENT_DEFAULTS.dailyLimit)),
  activeJoinEnabled: groupData.humanActiveJoinEnabled !== false,
  adminReminderEnabled: groupData.humanAdminReminderEnabled !== false,
  adminReminderTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(groupData.humanAdminReminderTime || "") ? groupData.humanAdminReminderTime : HUMAN_ENGAGEMENT_DEFAULTS.adminReminderTime,
});

export const silenceCooldownMinutes = (level) => level === "lively" ? 90 : level === "chill" ? 180 : 120;
export const activeCooldownMinutes = (level) => level === "lively" ? 35 : level === "chill" ? 90 : 55;
export const activeBurstThreshold = (level) => level === "lively" ? 5 : level === "chill" ? 10 : 7;

export const sanitizeEngagementLine = (text, max = 180) => String(text || "")
  .replace(/```[\s\S]*?```/g, "")
  .replace(/[\r\n]+/g, " ")
  .replace(/\s+/g, " ")
  .replace(/^[-–—•*#]+\s*/, "")
  .trim()
  .slice(0, max);

export const isSocialHour = (hour) => hour >= 8 && hour < 24;

export const shouldSilenceEngage = ({ nowMs, lastHumanAt, lastAlphaAt, dailyCount, settings, localHour }) => {
  if (!settings.enabled || !lastHumanAt || !isSocialHour(localHour)) return false;
  if (dailyCount >= settings.dailyLimit) return false;
  if (nowMs - lastHumanAt < settings.silenceMinutes * 60_000) return false;
  if (lastAlphaAt && nowMs - lastAlphaAt < silenceCooldownMinutes(settings.level) * 60_000) return false;
  return true;
};

export const shouldActiveEngage = ({ nowMs, recent, lastAlphaAt, dailyCount, settings, localHour, chanceSeed = 0 }) => {
  if (!settings.enabled || !settings.activeJoinEnabled || !isSocialHour(localHour)) return false;
  if (dailyCount >= settings.dailyLimit) return false;
  if (lastAlphaAt && nowMs - lastAlphaAt < activeCooldownMinutes(settings.level) * 60_000) return false;
  const windowStart = nowMs - 6 * 60_000;
  const fresh = recent.filter((item) => item.at >= windowStart && item.text);
  const senders = new Set(fresh.map((item) => item.sender).filter(Boolean));
  if (fresh.length < activeBurstThreshold(settings.level) || senders.size < 2) return false;
  const divisor = settings.level === "lively" ? 4 : settings.level === "chill" ? 10 : 6;
  return Math.abs(Number(chanceSeed) || 0) % divisor === 0;
};
