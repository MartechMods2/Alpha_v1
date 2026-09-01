import { getCookiePath, getCookieStatus } from "../../functions/cookieManager.js";
import { auditRuntimeTools, FEATURE_REQUIREMENTS, missingForRequirement, requirementReady } from "../../utils/setupAudit.js";
import { existsSync } from "node:fs";
import { describeYtDlpError, isYouTubeUrl, probeYoutubeAccess } from "../../utils/ytdlp.js";

let liveProbeCache = null;
const LIVE_PROBE_TTL_MS = 2 * 60_000;

const handler = async (_sock, msg, from, args, info) => {
	const { command, sendMessageWTyping } = info;
	const reply = (text) => sendMessageWTyping(from, { text: String(text).slice(0, 4000) }, { quoted: msg });

	try {
		const [cookiePath, cookieStatus] = await Promise.all([
			getCookiePath().catch(() => null),
			getCookieStatus().catch(() => ({ configured: false, valid: false, count: 0, reason: "Status unavailable" })),
		]);
		const runtime = await auditRuntimeTools({ youtubeCookies: Boolean(cookiePath && existsSync(cookiePath) && cookieStatus.valid) });

		if (["cookiestatus", "downloadhealth", "ythealth", "yttest"].includes(command)) {
			const ytdlp = runtime.binaries.find((entry) => entry.name === "yt-dlp");
			const wantsLiveTest = command === "yttest" || String(args[0] || "").toLowerCase() === "test";
			let liveText = "";
			if (wantsLiveTest) {
				const suppliedTarget = command === "yttest" ? args[0] : args[1];
				const target = isYouTubeUrl(suppliedTarget) ? suppliedTarget : undefined;
				try {
					if (!liveProbeCache || liveProbeCache.expires <= Date.now() || target) {
						liveProbeCache = { value: await probeYoutubeAccess(target), expires: Date.now() + LIVE_PROBE_TTL_MS };
					}
					const probe = liveProbeCache.value;
					liveText = `\nLive YouTube test: *PASS* (${probe.authMode})\nTest video: ${probe.title}${probe.duration ? ` — ${probe.duration}s` : ""}`;
				} catch (error) {
					liveText = `\nLive YouTube test: *FAIL*\n${describeYtDlpError(error)}`;
				}
			}
			return reply(`🍪 *YouTube Download Health*\nyt-dlp: *${ytdlp?.ready ? "READY" : "MISSING"}*${ytdlp?.detail ? ` — ${ytdlp.detail}` : ""}\nJavaScript runtime: *${runtime.ytDlpJsRuntime || "MISSING"}*\nCookie file: *${cookieStatus.valid ? `FORMAT VALID (${cookieStatus.count} rows)` : cookieStatus.configured ? "INVALID" : "NOT CONFIGURED"}*${cookieStatus.valid || !cookieStatus.reason ? "" : `\nCookie issue: ${cookieStatus.reason}`}${liveText}\n\nPublic videos are tried without account cookies first. Cookies are used once only when login is required. Saved values are never displayed again.`);
		}

		const features = FEATURE_REQUIREMENTS.map((entry) => {
			const ready = requirementReady(entry);
			const state = ready ? "✅ READY" : entry.required ? "❌ REQUIRED" : entry.discouraged ? "⚪ OFF (recommended)" : "⚪ OPTIONAL";
			const missing = ready ? "" : ` — missing: ${missingForRequirement(entry).join(" OR ")}`;
			return `${state} *${entry.name}*${missing}`;
		});
		const tools = runtime.binaries.map((entry) => `${entry.ready ? "✅" : entry.optional ? "⚪" : "❌"} ${entry.name}: ${entry.ready ? "ready" : entry.detail}`);
		return reply(`🧰 *Alpha Feature Setup Check*\n\n*Keys, IDs and services*\n${features.join("\n")}\n\n*Server tools*\n${tools.join("\n")}\n${cookieStatus.valid ? "✅" : cookieStatus.configured ? "❌" : "⚪"} YouTube cookie format: ${cookieStatus.valid ? `valid (${cookieStatus.count} rows; acceptance not yet tested)` : cookieStatus.configured ? `invalid — ${cookieStatus.reason}` : "optional / not configured"}\n${runtime.ytDlpJsRuntime ? "✅" : "❌"} YouTube JS runtime: ${runtime.ytDlpJsRuntime || "missing"}\n\nNo secret values are displayed. Add secrets only in Render Environment or the protected dashboard.`);
	} catch (error) {
		return reply(`❌ Setup check failed: ${String(error.message || error).slice(0, 500)}`);
	}
};

export default () => ({
	cmd: ["setupcheck", "featurecheck", "keycheck", "cookiestatus", "downloadhealth", "ythealth", "yttest"],
	desc: "Owner-only audit of feature keys, IDs, cookies and required server tools without revealing secrets",
	usage: "setupcheck | cookiestatus | downloadhealth [test] | yttest [YouTube URL]",
	handler,
});
