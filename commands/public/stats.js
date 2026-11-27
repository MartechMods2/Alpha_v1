import { cmdToText } from "../../utils/commandLoader.js";
import { visibleCommandSections } from "../../utils/botMenu.js";

const formatUptime = (seconds) => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours || days) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(" ");
};

const handler = async (sock, msg, from, args, info = {}) => {
  const prefix = info.prefix || process.env.PREFIX || "$";
  const catalogue = await cmdToText();
  const sections = visibleCommandSections(catalogue, info);
  const entries = Object.values(sections).flat();
  const commandNames = new Set(entries.flatMap((entry) => entry.cmd));
  const sectionLines = Object.entries(sections)
    .map(([name, rows]) => `• ${name[0].toUpperCase() + name.slice(1)}: ${rows.length} entries`)
    .join("\n");

  const message =
    `╭─ ✦ *ALPHA BOT STATS* ✦
╰─ *Created and maintained by Martech*

*📊 Command power*
• ${entries.length} registered command entries
• ${commandNames.size} command names, including aliases
${sectionLines}

*🌟 What makes Alpha special*
One WhatsApp assistant bringing together AI help, creative media tools, games and quizzes, learning and productivity, and community features.

*💪 Strength snapshot*
Alpha’s modular command library is loaded from its live registry. Its tools cover everyday requests as well as group activities, with access controls for restricted commands.

*⏱️ Current process uptime:* ${formatUptime(process.uptime())}

_Command counts reflect the sections visible to your account. Some commands still require a group, suitable permissions, or enabled features._
Try ${prefix}menu all to browse the command catalogue.`;

  return info.sendMessageWTyping(from, { text: message }, { quoted: msg });
};

export default () => ({
  cmd: ["stats"],
  desc: "Show Alpha's command totals, capabilities and uptime",
  usage: "stats",
  handler,
});
