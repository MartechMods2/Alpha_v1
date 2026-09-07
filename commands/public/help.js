import dotenv from "dotenv";
dotenv.config();

import { cmdToText } from "../../utils/commandLoader.js";
import { searchCommands } from "../../utils/commandSearch.js";

const more = String.fromCharCode(8206);
const readMore = more.repeat(4001);

const handler = async (sock, msg, from, args, msgInfoObj) => {
	let { isGroup, sendMessageWTyping } = msgInfoObj;
	let prefix = process.env.PREFIX;

	const { publicCommands, groupCommands, adminCommands, ownerCommands, directCommands } = await cmdToText();

	if (args.length > 0 && !["all", "public", "group", "admin", "owner", "categories"].includes(String(args[0]).toLowerCase())) {
		const rawQuery = args[0].toLowerCase() === "search" ? args.slice(1).join(" ") : args.join(" ");
		const query = rawQuery.toLowerCase().replace(/^[-/]/, "");
		const all = [...publicCommands, ...groupCommands, ...adminCommands, ...ownerCommands];
		const found = all.find((c) => c.cmd.includes(query));
		if (!found) {
			const matches = searchCommands(all, query, 8);
			return sendMessageWTyping(from, { text: matches.length
				? `🔎 *Closest commands for “${query}”*\n\n${matches.map((entry) => `• *${prefix}${entry.cmd[0]}* — ${entry.desc}`).join("\n")}\n\nUse *${prefix}help <command>* for details.`
				: `❌ No command found: *${query}*. Try *${prefix}help categories* or *${prefix}smarthelp*.` }, { quoted: msg });
		}
		const aliases = found.cmd.filter((c) => c !== found.cmd[0]).map((c) => `${prefix}${c}`).join("  |  ");
		const text =
			`📖 *${prefix}${found.cmd[0]}*\n\n` +
			`*Description:* ${found.desc}\n` +
			`*Usage:* \`${prefix}${found.usage}\`` +
			(aliases ? `\n*Aliases:* ${aliases}` : "");
		return sendMessageWTyping(from, { text }, { quoted: msg });
	}

	const section = String(args[0] || "").toLowerCase();
	if (section === "categories") return sendMessageWTyping(from, { text: `🗂️ *Alpha Command Categories*\n\n• *${prefix}help public* — utilities, AI, media and security\n• *${prefix}help group* — games and member tools\n• *${prefix}help admin* — moderation and automation\n• *${prefix}help owner* — deployment and reliability\n• *${prefix}help all* — complete menu\n• *${prefix}help search <words>* — search by purpose\n\nYou can also say *${prefix}do <what you want>*.` }, { quoted: msg });
	const sections = { public: publicCommands, group: groupCommands, admin: adminCommands, owner: ownerCommands };
	if (sections[section]) {
		const rows = sections[section].map((entry) => `• *${prefix}${entry.cmd[0]}* — ${entry.desc}`);
		return sendMessageWTyping(from, { text: `📚 *${section[0].toUpperCase() + section.slice(1)} Commands* (${rows.length})\n\n${rows.join("\n")}\n\nUse *${prefix}help <command>* for usage.` }, { quoted: msg });
	}
	if (!section) return sendMessageWTyping(from, { text: `👋 *Alpha by Martech*\n\nI can help with media, stickers, games, group management, productivity, safe security checks, events, support tools and natural-language requests.\n\n*Start here*\n• ${prefix}smarthelp — tell Alpha what you want naturally\n• ${prefix}help categories — browse command groups\n• ${prefix}help search <words> — find a feature\n• ${prefix}help <command> — usage and aliases\n• ${prefix}help all — the complete menu\n\nExample: *${prefix}help search birthday reminder*` }, { quoted: msg });

	const adminCmd = adminCommands.filter((cmd) => cmd.cmd.includes("admin"));
	const ownerCmd = ownerCommands.filter((cmd) => cmd.cmd.includes("owner"));

	const help = `
---------------------------------------------------------------
    *Welcome to Alpha by Martech*
---------------------------------------------------------------
${readMore}

${publicCommands
	.map((cmd) => `*${prefix}${cmd.cmd.join(", ")}* - ${cmd.desc}\nUsage: ${prefix}${cmd.usage}`)
	.join("\n\n")}

${groupCommands
	.map((cmd) => `*${prefix}${cmd.cmd.join(", ")}* - ${cmd.desc}\nUsage: ${prefix}${cmd.usage}`)
	.join("\n\n")}

${adminCmd.map((cmd) => `*${prefix}${cmd.cmd.join(", ")}* - ${cmd.desc}\nUsage: ${prefix}${cmd.usage}`).join("\n\n")}

${ownerCmd.map((cmd) => `*${prefix}${cmd.cmd.join(", ")}* - ${cmd.desc}\nUsage: ${prefix}${cmd.usage}`).join("\n\n")}


⚡ Created and maintained by Martech\n github.com/MartechMods2/Alpha_v1`;

	const helpInDm = `
─「 *Dm Commands* 」─

---------------------------------------------------------------
    *Welcome to Alpha by Martech*
---------------------------------------------------------------

${directCommands
	.map((cmd) => `*${prefix}${cmd.cmd.join(", ")}* - ${cmd.desc}\nUsage: ${prefix}${cmd.usage}`)
	.join("\n\n")}

⚡ Created and maintained by Martech\n github.com/MartechMods2/Alpha_v1`;

	await sendMessageWTyping(from, {
		text: isGroup ? help : helpInDm,
	});
};

export default () => ({
	cmd: ["help", "menu"],
	desc: "Help menu",
	usage: "help [command]",
	handler,
});
