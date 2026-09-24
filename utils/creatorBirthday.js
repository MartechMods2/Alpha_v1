const fallbackClaims = new Set();

const configuredBirthday = () => {
  const raw = String(process.env.ALPHA_CREATOR_BIRTHDAY || "09-25").trim();
  const match = raw.match(/^(\d{2})-(\d{2})$/);
  if (!match) return { month: "09", day: "25" };
  return { month: match[1], day: match[2] };
};

const creatorName = () => String(process.env.ALPHA_CREATOR_NAME || "Martech").trim() || "Martech";

const dateParts = (date = new Date(), timeZone = process.env.BOT_TIMEZONE || "Africa/Lagos") => {
  try {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const get = (type) => parts.find((part) => part.type === type)?.value || "";
    return { year: get("year"), month: get("month"), day: get("day") };
  } catch {
    const iso = date.toISOString().slice(0, 10).split("-");
    return { year: iso[0], month: iso[1], day: iso[2] };
  }
};

export const creatorBirthdayDateKey = (date = new Date()) => {
  const { year, month, day } = dateParts(date);
  return `${year}-${month}-${day}`;
};

export const isCreatorBirthdayToday = (date = new Date()) => {
  const current = dateParts(date);
  const birthday = configuredBirthday();
  return current.month === birthday.month && current.day === birthday.day;
};

export const getCreatorBirthdayKnowledge = (date = new Date()) => {
  const name = creatorName();
  const today = isCreatorBirthdayToday(date);
  return [
    `Creator birthday rule: ${name}'s birthday is September 25.`,
    "Never send advance birthday reminders or countdown reminders.",
    today
      ? `Today is ${name}'s birthday in the bot's local timezone. A birthday greeting may be shown naturally when the creator directly uses Alpha.`
      : "Do not proactively mention the birthday outside September 25 unless the creator directly asks about it.",
  ].join(" ");
};

export const buildCreatorBirthdayGreeting = (date = new Date()) => {
  const name = creatorName();
  const { year } = dateParts(date);
  return [
    "🎂⚡ *CREATOR DAY DETECTED* ⚡🎂",
    "",
    `*Happy Birthday, ${name}!* 🥳`,
    "*AURA FARMING · TECH EDITION*",
    "",
    "🟣 Aura Level: *MAXED*",
    "💻 Creator Mode: *LEGENDARY*",
    "🧠 Innovation Buff: *+100*",
    "⚙️ Build Energy: *OVERDRIVE*",
    "🐛 Bugs Defeated: *still counting 😭*",
    "🚀 Shipping Energy: *NO SLEEP MODE*",
    "🛡️ Resilience Patch: *INSTALLED*",
    "✨ Main Character Protocol: *ACTIVE*",
    "",
    `📦 *${year} Birthday Patch Notes*`,
    "• More ideas, less hesitation",
    "• Bigger builds, cleaner execution",
    "• Stronger discipline, sharper instincts",
    "• More wins worth remembering",
    "• Zero permission needed to keep creating",
    "",
    "👑 *Creator signature:* Build it. Break it. Fix it. Upgrade it.",
    "⚡ Alpha proudly running on creator energy today.",
  ].join("\n");
};

export const claimCreatorBirthdayGreeting = async ({ scope = "global", date = new Date() } = {}) => {
  if (!isCreatorBirthdayToday(date)) return false;

  const key = `${creatorBirthdayDateKey(date)}|${String(scope || "global").slice(0, 180)}`;
  try {
    const { default: mdClient } = await import("../db/client.js");
    const events = mdClient.db("MyBotDataDB").collection("AlphaCreatorEvents");
    await events.insertOne({
      _id: key,
      type: "creator-birthday-greeting",
      dateKey: creatorBirthdayDateKey(date),
      scope: String(scope || "global").slice(0, 180),
      createdAt: new Date(),
    });
    return true;
  } catch (error) {
    if (error?.code === 11000) return false;
    console.warn("[CREATOR_BIRTHDAY] Could not persist greeting claim:", error.message);
    if (fallbackClaims.has(key)) return false;
    fallbackClaims.add(key);
    if (fallbackClaims.size > 100) {
      const first = fallbackClaims.values().next().value;
      if (first) fallbackClaims.delete(first);
    }
    return true;
  }
};
