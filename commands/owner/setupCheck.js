import { getCookiePath } from "../../functions/cookieManager.js";
import { auditRuntimeTools, FEATURE_REQUIREMENTS, missingForRequirement, requirementReady } from "../../utils/setupAudit.js";
import { existsSync } from "node:fs";

const handler = async (_sock, msg, from, _args, info) => {
	const { command, sendMessageWTyping } = info;
	const reply = (text) => sendMessageWTyping(from, { text: String(text).slice(0, 4000) }, { quoted: msg });

	try {
		const cookiePath = await getCookiePath().catch(() => null);
		const runtime = await auditRuntimeTools({ youtubeCookies: Boolean(cookiePath && existsSync(cookiePath)) });

		if (command === "cookiestatus") {
			const ytdlp = runtime.binaries.find((entry) => entry.name === "yt-dlp");
			return reply(`🍪 *YouTube Cookie Status*\nCookies: *${runtime.youtubeCookies ? "CONFIGURED" : "NOT CONFIGURED"}*\nyt-dlp: *${ytdlp?.ready ? "READY" : "MISSING"}*\n\nCookies are optional for ordinary public videos but may be required when YouTube challenges the server. Upload them only through the protected dashboard; never paste session cookies into a WhatsApp group.`);
		}

		const features = FEATURE_REQUIREMENTS.map((entry) => {
			const ready = requirementReady(entry);
			const state = ready ? "✅ READY" : entry.required ? "❌ REQUIRED" : entry.discouraged ? "⚪ OFF (recommended)" : "⚪ OPTIONAL";
			const missing = ready ? "" : ` — missing: ${missingForRequirement(entry).join(" OR ")}`;
			return `${state} *${entry.name}*${missing}`;
		});
		const tools = runtime.binaries.map((entry) => `${entry.ready ? "✅" : entry.optional ? "⚪" : "❌"} ${entry.name}: ${entry.ready ? "ready" : entry.detail}`);
		return reply(`🧰 *Alpha Feature Setup Check*\n\n*Keys, IDs and services*\n${features.join("\n")}\n\n*Server tools*\n${tools.join("\n")}\n${runtime.youtubeCookies ? "✅" : "⚪"} YouTube cookies: ${runtime.youtubeCookies ? "configured" : "optional / not configured"}\n\nNo secret values are displayed. Add secrets only in Render Environment or the protected dashboard.`);
	} catch (error) {
		return reply(`❌ Setup check failed: ${String(error.message || error).slice(0, 500)}`);
	}
};

export default () => ({
	cmd: ["setupcheck", "featurecheck", "keycheck", "cookiestatus"],
	desc: "Owner-only audit of feature keys, IDs, cookies and required server tools without revealing secrets",
	usage: "setupcheck | cookiestatus",
	handler,
});
