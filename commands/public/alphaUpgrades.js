import { AI_FEATURE_CATEGORIES, AI_FEATURE_COMMANDS } from "../../utils/alphaFeatureCatalog.js";

const handler = async (_sock, msg, from, _args, info) => {
  const prefix = info.prefix || process.env.PREFIX || "$";
  const categoryCount = Object.keys(AI_FEATURE_CATEGORIES).length;
  const text = [
    "⚡🧠 *ALPHA RESPONSE INTELLIGENCE v9*",
    "",
    `AI workflow tools: *${AI_FEATURE_COMMANDS.length}*`,
    `Workflow categories: *${categoryCount}*`,
    "New workflow additions in this upgrade: *120*",
    "Inline answer modes: *24*",
    "Persistent tones: *15*",
    "Reply lengths: *4*",
    "Reply formats: *4*",
    "Emoji levels: *3*",
    "Expertise levels: *4*",
    "Answer profiles: *7*",
    "",
    "*What changed in normal Alpha replies*" ,
    "- Direct-answer-first behavior with less filler",
    "- Better debugging and deployment diagnosis",
    "- Better rewrite/drafting behavior: finished text first",
    "- Adaptive detail based on prompt complexity and your preferences",
    "- Smarter comparison, brainstorming, teaching and step-by-step formatting",
    "- Response token budgets adapt to the task instead of always using one size",
    "- Duplicate-line cleanup and WhatsApp-friendly heading cleanup",
    "",
    `Use *${prefix}alphamodes* for inline modes.`,
    `Use *${prefix}myalpha* to personalize Alpha.`,
    `Use *${prefix}aifeatures* to browse all AI workflow categories.`,
  ].join("\n");
  return info.sendMessageWTyping(from, { text }, { quoted: msg });
};

export default () => ({
  cmd: ["alphaupgrades", "alphaenhancements", "whatsnewalpha"],
  desc: "Show Alpha response-intelligence upgrades and workflow counts",
  usage: "alphaupgrades",
  handler,
});
