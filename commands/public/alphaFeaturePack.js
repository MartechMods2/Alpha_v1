import { askSafeAi } from "../../utils/safeAi.js";
import { claimAlphaGroupAiUsage, refundAlphaGroupAiUsage } from "../../utils/alphaQuota.js";
import { alphaPublicFailureMessage, notifyAlphaOwnerFailure } from "../../utils/alphaErrorReporter.js";
import { getMemberPreferences } from "../../db/members.js";
import { applyAlphaTextStyle } from "../../utils/alphaPresentation.js";
import { alphaResponseTokenBudget, buildAdaptiveResponseInstruction } from "../../utils/alphaBrain.js";
import {
	AI_FEATURE_CATEGORIES,
	AI_FEATURE_COMMANDS,
	getAiFeature,
} from "../../utils/alphaFeatureCatalog.js";

const directUsage = new Map();
const today = () => new Date().toISOString().slice(0, 10);

const claimDirectBudget = (memberJid, limit = 30) => {
	const key = `${today()}:${memberJid || "unknown"}`;
	const used = directUsage.get(key) || 0;
	if (used >= limit) return false;
	directUsage.set(key, used + 1);
	if (directUsage.size > 1500) {
		for (const item of [...directUsage.keys()]) if (!item.startsWith(`${today()}:`)) directUsage.delete(item);
	}
	return true;
};

const quotedText = (context = {}) => {
	const q = context?.quotedMessage || {};
	return String(
		q.conversation ??
		q.extendedTextMessage?.text ??
		q.imageMessage?.caption ??
		q.videoMessage?.caption ??
		q.documentMessage?.caption ??
		"",
	).trim();
};

const categoryHelp = (prefix, category) => {
	const commands = AI_FEATURE_CATEGORIES[category];
	if (!commands) return null;
	return `🧠 *Alpha AI — ${category.replace(/_/g, " ").toUpperCase()}*\n\n${commands.map((name) => `${prefix}${name}`).join(" · ")}\n\nReply to a text or add your input after the command.`;
};

const generalHelp = (prefix) => {
	const lines = Object.entries(AI_FEATURE_CATEGORIES).map(([category, commands]) =>
		`• *${category.replace(/_/g, " ")}* — ${commands.length} tools — ${prefix}aifeatures ${category}`,
	);
	return `🧠 *Alpha ${AI_FEATURE_COMMANDS.length} AI Workflow Pack*\n\n${lines.join("\n")}\n\nExamples:\n${prefix}aisummarize <text>\n${prefix}aibugtriage <error>\n${prefix}aimvpplan <idea>\n${prefix}aistudysession <topic + time>\n${prefix}aivideooutline <topic>\n${prefix}aifeedbackanalysis <feedback>\n\nYou can also reply to a message with a command such as ${prefix}aisummarize.`;
};

const handler = async (sock, msg, from, args, info) => {
	const {
		command, prefix = "$", senderJid, isGroup, isOwner, groupMetadata,
		extendedMessageOriginal, sendMessageWTyping,
	} = info;
	const reply = (text) => sendMessageWTyping(from, { text: String(text).slice(0, 6500) }, { quoted: msg });

	if (["aifeatures", "aitools", "aiworkflows"].includes(command)) {
		const category = String(args[0] || "").toLowerCase();
		return reply(categoryHelp(prefix, category) || generalHelp(prefix));
	}

	const feature = getAiFeature(command);
	if (!feature) return reply(generalHelp(prefix));

	const typed = args.join(" ").trim();
	const input = (typed || quotedText(extendedMessageOriginal)).slice(0, 6500);
	if (!input) {
		return reply(`❌ Add the content after *${prefix}${command}* or reply to a text message with *${prefix}${command}*.`);
	}

	let quotaClaim = null;
	if (isGroup) {
		quotaClaim = await claimAlphaGroupAiUsage({
			groupJid: from,
			senderJid,
			memberName: msg?.pushName || "",
			groupMetadata,
			isOwner,
			candidates: [msg?.key?.participantPn, msg?.key?.participantAlt],
		});
		if (!quotaClaim.allowed) {
			return reply(`⏳ Your Alpha AI limit for today has been reached (*${quotaClaim.used}/${quotaClaim.limit}*).`);
		}
	} else if (!claimDirectBudget(senderJid)) {
		return reply("⏳ Your Alpha AI workflow limit for today has been reached. Try again later.");
	}

	const prefs = await getMemberPreferences(senderJid).catch(() => ({
		textStyle: "normal",
		tone: "auto",
		replyLength: "auto",
		replyFormat: "auto",
		emojiLevel: "normal",
		expertise: "auto",
		answerMode: "auto",
	}));
	const adaptiveInstruction = buildAdaptiveResponseInstruction(input, prefs);
	const systemPrompt = `You are Alpha's focused workflow engine.\nTask: ${feature.instruction}\nCategory: ${feature.category}.\n${adaptiveInstruction}\nReturn only a useful answer for the user's supplied material. Be accurate, practical and concise enough for WhatsApp. Do not invent facts, citations, prices, standards, people, dates or credentials. Clearly mark assumptions. Do not use markdown headings with #; use short labels, bullets and *single-asterisk* emphasis when useful. Respect privacy. For security-related material, stay defensive and authorized: do not provide phishing, credential theft, malware, evasion, destructive actions, or instructions to intrude into systems.`;

	let providerSucceeded = false;
	try {
		const { text } = await askSafeAi({
			groupJid: isGroup ? from : "direct",
			systemPrompt,
			messages: [{ role: "user", content: input }],
			maxTokens: alphaResponseTokenBudget({ prompt: input, preferences: prefs }),
		});
		providerSucceeded = true;
		const response = text || "Alpha returned no text for that workflow.";
		return reply(applyAlphaTextStyle(response, prefs.textStyle));
	} catch (error) {
		if (quotaClaim?.charged && !providerSucceeded) {
			await refundAlphaGroupAiUsage(quotaClaim).catch(() => {});
		}
		console.error(`[AI_FEATURE:${command}]`, error.message);
		notifyAlphaOwnerFailure({
			sock,
			scope: `workflow-${command}`,
			error,
			groupName: isGroup ? (groupMetadata?.subject || "") : "",
			senderName: msg?.pushName || "",
		});
		return reply(`❌ Alpha AI could not complete *${command}*. ${alphaPublicFailureMessage().replace(/^⚡\s*/, "")}`);
	}
};

export default () => ({
	cmd: ["aifeatures", "aitools", "aiworkflows", ...AI_FEATURE_COMMANDS],
	desc: `${AI_FEATURE_COMMANDS.length} practical Alpha AI workflows across writing, work, study, creator tools, software, community and thinking`,
	usage: "aifeatures | aifeatures publishing | aisummarize <text> | reply + aisummarize",
	handler,
});
