import { AI_FEATURE_COMMANDS } from "../alphaFeatureCatalog.js";
import { createHash } from "node:crypto";
export const dayKey = (now = new Date()) =>
  new Date(+now + 3600000).toISOString().slice(0, 10);
export const seasonKey = (now = new Date()) => dayKey(now).slice(0, 7);
export const key = (...parts) =>
  createHash("sha256").update(JSON.stringify(parts)).digest("hex");
export const amountValue = (value, max = 500000) => {
  if (!/^\d{1,9}$/.test(String(value)))
    throw Error("Enter a whole positive Aura amount.");
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1 || n > max)
    throw Error(`Amount must be 1–${max}.`);
  return n;
};
export const XP_RANKS = [
  [0, "Rookie"],
  [500, "Bronze"],
  [2000, "Silver"],
  [5000, "Gold"],
  [12000, "Platinum"],
  [25000, "Diamond"],
  [50000, "Master"],
  [100000, "Grandmaster"],
  [200000, "Legendary"],
];
export const xpRank = (xp) =>
  XP_RANKS.filter(([n]) => xp >= n).at(-1) || XP_RANKS[0];
export const EVO = [
  { name: "Spark", price: 0, quests: 0 },
  { name: "Pulse", price: 5000, quests: 5 },
  { name: "Surge", price: 15000, quests: 20 },
  { name: "Nova", price: 35000, quests: 50 },
  { name: "Apex", price: 75000, quests: 100 },
];
export const SHOP = [
  { id: "gold-title", name: "Golden title", price: 5000 },
  { id: "aurora-frame", name: "Aurora frame", price: 15000 },
  { id: "midnight-theme", name: "Midnight theme", price: 10000 },
];
// Canonical aliases share one price. All unlisted commands remain free.
export const PRICES = [
  { commands: AI_FEATURE_COMMANDS, price: 500, kind: "ai" },
  {
    commands: ["img", "imagegen", "drawai", "aipicture"],
    price: 2500,
    kind: "media",
  },
  {
    commands: ["voice", "voiceask", "askvoice", "aivoice", "vnote"],
    price: 1000,
    kind: "media",
  },
  { commands: ["say", "speak", "tts"], price: 300, kind: "media" },
  { commands: ["alpha", "gemini", "stylealpha"], price: 500, kind: "ai" },
  {
    commands: [
      "textsticker",
      "ts",
      "reactionsticker",
      "sticker",
      "s",
      "steal",
      "stealn",
      "videosticker",
      "gifsticker",
      "image",
      "toimg",
    ],
    price: 100,
    kind: "media",
  },
  {
    commands: ["aisticker", "cutoutsticker", "removebg", "bg"],
    price: 1500,
    kind: "media",
  },
  {
    commands: ["transcribe", "voicesummary", "voicetranslate"],
    price: 1000,
    kind: "ai",
  },
  { commands: ["autocaption"], price: 1000, kind: "media" },
  {
    commands: ["img2pdf", "pdf2img", "pdfmerge", "pdfsplit", "pdfcompress"],
    price: 300,
    kind: "media",
  },
];
export const priceFor = (command) =>
  PRICES.find((row) => row.commands.includes(command));
export const scheduledSlot = (now = new Date()) => {
  const lagos = new Date(+now + 3600000),
    h = lagos.getUTCHours(),
    minute = lagos.getUTCMinutes();
  return [8, 14, 20].includes(h) && minute < 5 ? `${dayKey(now)}:${h}` : null;
};
export const rpRank = (points) => {
  const names = [
    "Rookie",
    "Bronze",
    "Silver",
    "Gold",
    "Platinum",
    "Diamond",
    "Master",
    "Grandmaster",
    "Legendary",
  ];
  const tier = Math.min(8, Math.floor(Math.max(0, points) / 300));
  return `${names[tier]}${tier > 0 && tier < 8 ? " " + ["III", "II", "I"][Math.floor((points % 300) / 100)] : ""}`;
};
