import { getSafeSettings, listSafeAudit, updateSafeSettings } from "../../../db/safePackData.js";
import { getGroupData, group } from "../../../db/groupData.js";
import { getAiProviderNames, getAiRuntimeStatus, askSafeAi } from "../../../utils/safeAi.js";
import { claimAlphaGroupAiUsage, refundAlphaGroupAiUsage } from "../../../utils/alphaQuota.js";
import { cleanSafeText } from "../../../utils/safePack.js";
import { getGroupTools } from "../../../db/groupTools.js";

const providerSummary = (status) => getAiProviderNames().map((name) => {
	const provider = status.providers[name];
	if (!provider?.configured) return `⚪ ${name.toUpperCase()}: not configured`;
	if (provider.enabled === false) return `⚫ ${name.toUpperCase()}: disabled`;
	if (provider.circuitOpen) return `🟠 ${name.toUpperCase()}: circuit open`;
	if (provider.ok === true) return `🟢 ${name.toUpperCase()}: healthy`;
	if (provider.ok === false) return `🔴 ${name.toUpperCase()}: ${provider.code || "failed"}`;
	return `🟡 ${name.toUpperCase()}: not tested`;
}).join("\n");

const claimUsage = (from, msg, info) => claimAlphaGroupAiUsage({
	groupJid: from,
	senderJid: info.senderJid,
	memberName: msg?.pushName || "",
	groupMetadata: info.groupMetadata,
	isOwner: info.isOwner,
	candidates: [msg?.key?.participantPn, msg?.key?.participantAlt],
});

const handler = async (_sock, msg, from, args, info) => {
	const { command, senderJid, sendMessageWTyping } = info;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });

	try {
		if (command === "aiproviders") {
			const status = getAiRuntimeStatus();
			return reply(
				`🤖 *AI Providers*\n\n${providerSummary(status)}\n\n` +
				`Active: *${status.activeProvider || "none confirmed"}*\n` +
				`Next fallback: *${status.nextProvider || "none"}*\n` +
				`Order: *${status.preferredOrder.join(" → ") || "none"}*`,
			);
		}

		if (command === "aibudget") {
			const data = await getGroupData(from);
			const raw = String(args[0] || "status").toLowerCase();
			if (raw === "status") {
				return reply(`💳 Alpha AI daily limit: *${Number(data?.alphaDailyQuota) || 10} requests per member*\nThis is the same limit shown by *alphaquota*.`);
			}
			const limit = Number(raw);
			if (!Number.isInteger(limit) || limit < 1 || limit > 50) return reply("❌ Usage: `aibudget 1-50`.");
			await group.updateOne({ _id: from }, { $set: { alphaDailyQuota: limit } });
			return reply(`✅ Alpha AI limit set to *${limit} requests/member/day*.`);
		}

		if (command === "aiprivacy") {
			const settings = await getSafeSettings(from);
			const value = String(args[0] || "status").toLowerCase();
			if (value === "status") return reply(`🔐 PII redaction before external AI: *${settings.aiPiiRedaction !== false ? "ON" : "OFF"}*`);
			if (!["on", "off"].includes(value)) return reply("❌ Use `aiprivacy on|off`.");
			await updateSafeSettings(from, { aiPiiRedaction: value === "on" });
			return reply(`✅ AI privacy redaction ${value.toUpperCase()}.`);
		}

		if (command === "webfactcheck") {
			const claim = cleanSafeText(args.join(" "), 800);
			if (!claim) return reply("❌ Usage: `webfactcheck <claim>`.");
			if (!process.env.FACTCHECK_API_URL) return reply("🔎 Live cited fact-checking is safely disabled until `FACTCHECK_API_URL` is configured. Alpha will not invent citations.");
			const response = await fetch(process.env.FACTCHECK_API_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(process.env.FACTCHECK_API_KEY ? { Authorization: `Bearer ${process.env.FACTCHECK_API_KEY}` } : {}),
				},
				body: JSON.stringify({ claim }),
			});
			if (!response.ok) throw new Error(`Fact-check service ${response.status}`);
			const data = await response.json();
			return reply(`🔎 *Fact Check*\n${String(data.summary || data.answer || "No result").slice(0, 3000)}\n\n${(data.sources || []).slice(0, 5).map((x) => `- ${x.title || x.url}: ${x.url}`).join("\n")}`);
		}

		if (command === "smartminutes") {
			const quotaClaim = await claimUsage(from, msg, info);
			if (!quotaClaim.allowed) return reply(`⏳ Alpha AI daily quota reached (*${quotaClaim.used}/${quotaClaim.limit}*).`);
			try {
				const data = await getGroupTools(from);
				const minutes = (data.minutes || []).at(-1);
				if (!minutes) {
					await refundAlphaGroupAiUsage(quotaClaim).catch(() => {});
					return reply("❌ No completed meeting minutes found.");
				}
				const points = (minutes.entries || []).map((x, i) => `${i + 1}. ${x.text}`).join("\n");
				const result = await askSafeAi({
					groupJid: from,
					systemPrompt: "Create concise professional meeting minutes using only the supplied approved notes. Include decisions and action items. Do not invent facts.",
					messages: [{ role: "user", content: `Title: ${minutes.title}\n${points}` }],
				});
				return reply(`📝 *Smart Minutes* _(${result.provider})_\n\n${result.text.slice(0, 3800)}`);
			} catch (error) {
				await refundAlphaGroupAiUsage(quotaClaim).catch(() => {});
				throw error;
			}
		}

		if (command === "modassist") {
			const context = msg.message?.extendedTextMessage?.contextInfo;
			const quoted = context?.quotedMessage?.conversation ||
				context?.quotedMessage?.extendedTextMessage?.text ||
				cleanSafeText(args.join(" "), 1000);
			if (!quoted) return reply("❌ Reply to a message or provide text.");
			const quotaClaim = await claimUsage(from, msg, info);
			if (!quotaClaim.allowed) return reply(`⏳ Alpha AI daily quota reached (*${quotaClaim.used}/${quotaClaim.limit}*).`);
			try {
				const audit = await listSafeAudit(from, 10);
				const result = await askSafeAi({
					groupJid: from,
					systemPrompt: "You are an advisory-only group moderation assistant. Assess the supplied message conservatively. Recommend no action, remind, warn, mute, or admin review. Never order automatic removal. Explain uncertainty briefly.",
					messages: [{ role: "user", content: `Message: ${quoted}\nRecent case count: ${audit.length}` }],
				});
				return reply(`🛡️ *Advisory Only* _(${result.provider})_\n${result.text.slice(0, 3000)}\n\nAn administrator must decide and act manually.`);
			} catch (error) {
				await refundAlphaGroupAiUsage(quotaClaim).catch(() => {});
				throw error;
			}
		}
	} catch (error) {
		console.error("Safe AI admin failed:", error.message);
		return reply(`❌ ${error.message}`);
	}
};

export default () => ({
	cmd: ["aiproviders", "aibudget", "aiprivacy", "webfactcheck", "smartminutes", "modassist"],
	desc: "AI provider health, Alpha quotas, privacy, cited fact checks and advisory moderation",
	usage: "aiproviders | aibudget 10 | aiprivacy on | smartminutes",
	handler,
});
