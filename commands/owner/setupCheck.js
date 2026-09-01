import { getCookiePath, getCookieStatus } from "../../functions/cookieManager.js";
import { auditRuntimeTools, FEATURE_REQUIREMENTS, missingForRequirement, requirementReady } from "../../utils/setupAudit.js";
import { existsSync } from "node:fs";

const handler = async (_sock, msg, from, _args, info) => {
	const { command, sendMessageWTyping } = info;
	const reply = (text) => sendMessageWTyping(from, { text: String(text).slice(0, 4000) }, { quoted: msg });

	try {
		const [cookiePath, cookieStatus] = await Promise.all([
			getCookiePath().catch(() => null),
			getCookieStatus().catch(() => ({ configured: false, valid: false, count: 0, reason: "Status unavailable" })),
		]);
		const runtime = await auditRuntimeTools({ youtubeCookies: Boolean(cookiePath && existsSync(cookiePath) && cookieStatus.valid) });

		if (["cookiestatus", "downloadhealth", "ythealth"].includes(command)) {
			const ytdlp = runtime.binaries.find((entry) => entry.name === "yt-dlp");
			return reply(`🍪 *YouTube Download Health*\nyt-dlp: *${ytdlp?.ready ? "READY" : "MISSING"}*${ytdlp?.detail ? ` — ${ytdlp.detail}` : ""}\nJavaScript runtime: *${runtime.ytDlpJsRuntime || "MISSING"}*\nCookies: *${cookieStatus.valid ? `VALID (${cookieStatus.count} rows)` : cookieStatus.configured ? "INVALID" : "NOT CONFIGURED"}*${cookieStatus.valid || !cookieStatus.reason ? "" : `\nCookie issue: ${cookieStatus.reason}`}\n\nCookies are optional for ordinary public videos. Replace them only through the protected dashboard; saved values are never displayed again.`);
		}

		const features = FEATURE_REQUIREMENTS.map((entry) => {
			const ready = requirementReady(entry);
			const state = ready ? "✅ READY" : entry.required ? "❌ REQUIRED" : entry.discouraged ? "⚪ OFF (recommended)" : "⚪ OPTIONAL";
			const missing = ready ? "" : ` — missing: ${missingForRequirement(entry).join(" OR ")}`;
			return `${state} *${entry.name}*${missing}`;
		});
		const tools = runtime.binaries.map((entry) => `${entry.ready ? "✅" : entry.optional ? "⚪" : "❌"} ${entry.name}: ${entry.ready ? "ready" : entry.detail}`);
		return reply(`🧰 *Alpha Feature Setup Check*\n\n*Keys, IDs and services*\n${features.join("\n")}\n\n*Server tools*\n${tools.join("\n")}\n${cookieStatus.valid ? "✅" : cookieStatus.configured ? "❌" : "⚪"} YouTube cookies: ${cookieStatus.valid ? `valid (${cookieStatus.count} rows)` : cookieStatus.configured ? `invalid — ${cookieStatus.reason}` : "optional / not configured"}\n${runtime.ytDlpJsRuntime ? "✅" : "❌"} YouTube JS runtime: ${runtime.ytDlpJsRuntime || "missing"}\n\nNo secret values are displayed. Add secrets only in Render Environment or the protected dashboard.`);
	} catch (error) {
		return reply(`❌ Setup check failed: ${String(error.message || error).slice(0, 500)}`);
	}
};

export default () => ({
	cmd: ["setupcheck", "featurecheck", "keycheck", "cookiestatus", "downloadhealth", "ythealth"],
	desc: "Owner-only audit of feature keys, IDs, cookies and required server tools without revealing secrets",
	usage: "setupcheck | cookiestatus | downloadhealth",
	handler,
});
