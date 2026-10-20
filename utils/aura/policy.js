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
  {
    id: "gold-title",
    name: "Golden Voice",
    price: 5000,
    kind: "title",
    color: "#e4bc58",
  },
  {
    id: "aurora-frame",
    name: "Aurora frame",
    price: 15000,
    kind: "frame",
    color: "#72e2c1",
  },
  {
    id: "midnight-theme",
    name: "Midnight theme",
    price: 10000,
    kind: "theme",
    color: "#354a7c",
  },
  {
    id: "ruby-frame",
    name: "Ruby frame",
    price: 8000,
    kind: "frame",
    color: "#dc5468",
  },
  {
    id: "ocean-frame",
    name: "Ocean frame",
    price: 8000,
    kind: "frame",
    color: "#429ae0",
  },
  {
    id: "emerald-frame",
    name: "Emerald frame",
    price: 8000,
    kind: "frame",
    color: "#3dbb85",
  },
  {
    id: "royal-frame",
    name: "Royal frame",
    price: 20000,
    kind: "frame",
    color: "#a77be5",
    xp: 2000,
  },
  {
    id: "legend-frame",
    name: "Legend frame",
    price: 30000,
    kind: "frame",
    color: "#efcd79",
    xp: 5000,
  },
  {
    id: "tech-title",
    name: "Terminal Explorer",
    price: 6000,
    kind: "title",
    color: "#59d8db",
    xp: 500,
  },
  {
    id: "veteran-title",
    name: "Community Veteran",
    price: 12000,
    kind: "title",
    color: "#c6c9db",
    xp: 2000,
  },
  {
    id: "streak-shield",
    name: "Daily streak shield",
    price: 2000,
    kind: "tool",
    max: 3,
    description:
      "Automatically protects one missed daily-claim day. Consumed on the next claim; no reward for the missed day.",
  },
  {
    id: "tagline-ticket",
    name: "Profile tagline ticket",
    price: 1000,
    kind: "tool",
    max: 3,
    description:
      "Use once to set a short tagline on your Aura card. Up to 40 characters; no links or mentions.",
  },
];
// Static, bounded stock: no random paid boxes or power advantages.
SHOP.push(
  ...[
    ["neon-frame", "Neon Circuit", 9000, "#55efc4"],
    ["solar-frame", "Solar Flare", 10000, "#ffb347"],
    ["lunar-frame", "Lunar Halo", 10000, "#c3c8ef"],
    ["rose-frame", "Rose Quartz", 9000, "#f69ec4"],
    ["ice-frame", "Ice Crystal", 11000, "#a8e9f7"],
    ["obsidian-frame", "Obsidian Edge", 14000, "#727489"],
    ["firefly-frame", "Firefly Glow", 12000, "#c8e77b"],
    ["sapphire-frame", "Sapphire Crown", 18000, "#718cf0"],
  ].map(([id, name, price, color]) => ({
    id,
    name,
    price,
    color,
    kind: "frame",
  })),
  ...[
    ["forest-theme", "Forest Retreat", 7000, "#387a58"],
    ["sunset-theme", "Lagos Sunset", 8000, "#dc8a6b"],
    ["cyber-theme", "Cyber Night", 11000, "#8d64c7"],
    ["lavender-theme", "Lavender Lounge", 7000, "#bda5dc"],
    ["coffee-theme", "Coffee Corner", 6000, "#99745a"],
    ["arctic-theme", "Arctic Blue", 8000, "#88c5d4"],
  ].map(([id, name, price, color]) => ({
    id,
    name,
    price,
    color,
    kind: "theme",
  })),
  ...[
    ["quiz-title", "Quiz Captain", 7500, 500],
    ["creative-title", "Creative Spark", 5000, 0],
    ["night-title", "Night Owl", 4500, 0],
    ["sunrise-title", "Early Bird", 4500, 0],
    ["linux-title", "Linux Voyager", 9000, 1000],
    ["peace-title", "Peace Keeper", 6000, 500],
    ["legend-title", "Living Legend", 25000, 5000],
    ["curator-title", "Digital Curator", 8000, 1000],
  ].map(([id, name, price, xp]) => ({
    id,
    name,
    price,
    xp,
    kind: "title",
    color: "#d5bd7c",
  })),
  ...[
    ["byte-fox", "Byte Fox", 8000],
    ["cloud-cat", "Cloud Cat", 8000],
    ["pixel-owl", "Pixel Owl", 10000],
    ["cyber-penguin", "Cyber Penguin", 12000],
    ["circuit-dragon", "Circuit Dragon", 20000],
    ["comet-bunny", "Comet Bunny", 9000],
  ].map(([id, name, price]) => ({
    id,
    name,
    price,
    kind: "pet",
    color: "#a7d6e8",
    description:
      "A cosmetic companion on your Aura profile. Equip with $aurapet equip <id>, then use pet treats to grow its bond. No XP or financial advantage.",
  })),
  ...[
    ["star-emblem", "Starlight", 4000],
    ["leaf-emblem", "Green Leaf", 3000],
    ["bolt-emblem", "Lightning Bolt", 4500],
    ["moon-emblem", "Crescent Moon", 4000],
    ["shield-emblem", "Guardian Shield", 5000],
    ["heart-emblem", "Community Heart", 3500],
  ].map(([id, name, price]) => ({
    id,
    name,
    price,
    kind: "emblem",
    color: "#8edacb",
  })),
  {
    id: "pet-treat",
    name: "Companion treat",
    price: 300,
    kind: "tool",
    max: 10,
    description:
      "Consume with $aurause pet-treat after equipping a pet. Adds one bond point, at most three interactions per Lagos day. Cosmetic only.",
  },
);
export const COLLECTIBLES = [
  { id: "byte-bot", name: "Byte Bot" },
  { id: "linux-penguin", name: "Linux Penguin" },
  { id: "neon-terminal", name: "Neon Terminal" },
  { id: "lagos-sunset", name: "Lagos Sunset" },
  { id: "cyber-shield", name: "Cyber Shield" },
  { id: "circuit-heart", name: "Circuit Heart" },
  { id: "pixel-crown", name: "Pixel Crown" },
  { id: "alpha-comet", name: "Alpha Comet" },
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
