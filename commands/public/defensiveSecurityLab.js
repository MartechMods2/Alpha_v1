import { claimSecurityQuota, runDefensiveCheck, SECURITY_COMMANDS, SECURITY_COMMAND_GROUPS } from "../../utils/defensiveSecurityLab.js";

const help = (prefix) => `🛡️ *Alpha Defensive Security Lab — Martech*\n\n110 offline, defensive commands. No scanning, exploitation, cracking or shell access.\n\nCategories:\n• ${prefix}sechelp url\n• ${prefix}sechelp ioc\n• ${prefix}sechelp auth\n• ${prefix}sechelp headers\n• ${prefix}sechelp logs\n\nExamples:\n${prefix}securlrisk https://example.com/login?next=x\n${prefix}seciocdetect <paste indicators>\n${prefix}secpasswordstrength <password>\n${prefix}secheaderreport <paste headers>\n${prefix}seclogsummary <paste log excerpt>\n\nOnly analyse information you own or are authorised to review. Sensitive inputs are processed in memory and are not intentionally saved by this feature.`;

const handler = async (_sock, msg, from, args, info) => {
	const { command, prefix, senderJid, sendMessageWTyping } = info;
	const reply = (text) => sendMessageWTyping(from, { text: String(text).slice(0, 4000) }, { quoted: msg });
	if (command === "sechelp" || command === "seccommands") {
		const group = String(args[0] || "").toLowerCase();
		if (!SECURITY_COMMAND_GROUPS[group]) return reply(help(prefix));
		return reply(`🛡️ *${group.toUpperCase()} commands*\n\n${SECURITY_COMMAND_GROUPS[group].map((name) => `${prefix}${name}`).join(" · ")}\n\nUse ${prefix}<command> <value or pasted text>.`);
	}
	if (String(process.env.SECURITY_TOOLS_ENABLED || "true").toLowerCase() === "false") return reply("🔒 Defensive Security Lab is disabled by the owner.");
	const quota = claimSecurityQuota(senderJid);
	if (!quota.allowed) return reply(`⏳ Security-tool limit reached. Try again in about ${Math.ceil(quota.retryAfterSeconds / 60)} minute(s).`);
	const input = args.join(" ");
	if (!input && !["sechmacguide"].includes(command)) return reply(`❌ Usage: ${prefix}${command} <value or pasted text>`);
	try { return reply(`🛡️ *${command}*\n\n${runDefensiveCheck(command, input)}`); }
	catch (error) { return reply(`❌ Defensive check failed: ${error.message || "invalid input"}`); }
};

export default () => ({
	cmd: ["sechelp", "seccommands", ...SECURITY_COMMANDS],
	desc: "110 free offline defensive-security checks for URLs, IOCs, authentication, headers and logs",
	usage: "sechelp | securlrisk <url> | seciocdetect <text> | seclogsummary <log>",
	handler,
});
