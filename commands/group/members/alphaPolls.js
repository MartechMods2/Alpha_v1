import { askSafeAi, useSafeAiBudget } from "../../../utils/safeAi.js";
import {
	cleanAiPollJson,
	getQuizPollAnswer,
	normalizeNativePoll,
	parsePipePoll,
	rememberQuizPoll,
} from "../../../utils/alphaPolls.js";

const cooldowns = new Map();
const COOLDOWN_MS = 8_000;

const claimCooldown = (groupJid, senderJid, command) => {
	const key = `${groupJid}:${senderJid}:${command}`;
	const now = Date.now();
	if ((cooldowns.get(key) || 0) > now) return false;
	cooldowns.set(key, now + COOLDOWN_MS);
	if (cooldowns.size > 1500) for (const [entry, expires] of cooldowns) if (expires <= now) cooldowns.delete(entry);
	return true;
};

const aiPoll = async ({ groupJid, senderJid, request, quiz = false }) => {
	if (!await useSafeAiBudget(groupJid, senderJid).catch(() => true)) throw new Error("Alpha's AI budget is cooling down. Try again later.");
	const { text } = await askSafeAi({
		groupJid,
		systemPrompt: quiz
			? "Create one safe WhatsApp quiz poll. Return ONLY valid JSON with keys question, options, selectableCount, correctIndex. Use exactly 4 short options. selectableCount must be 1. correctIndex must be a zero-based integer. Avoid unsafe, sexual, humiliating, discriminatory, political-persuasion, medical-diagnosis or private-data questions."
			: "Create one useful WhatsApp poll from the user's request. Return ONLY valid JSON with keys question, options, selectableCount. Use 2 to 6 concise options, selectableCount 1 unless the request clearly needs multiple selections. Do not invent personal facts. Keep it safe and suitable for a mixed group.",
		messages: [{ role: "user", content: String(request || "").slice(0, 1200) }],
	});
	return cleanAiPollJson(text);
};

const handler = async (_sock, msg, from, args, info) => {
	const { command, prefix = "$", senderJid, sendMessageWTyping } = info;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const sendPoll = (poll) => sendMessageWTyping(from, { poll }, { quoted: msg });

	if (!claimCooldown(from, senderJid, command)) return reply("⏳ Give the poll a few seconds before starting another one.");

	if (["pollhelp", "polls"].includes(command)) {
		return reply(
			`📊 *Alpha Polls*\n\n` +
			`${prefix}poll Question | Option A | Option B\n` +
			`${prefix}multipoll Question | A | B | C\n` +
			`${prefix}aipoll best day for our hangout\n` +
			`${prefix}quizpoll Nigerian history\n` +
			`${prefix}pollanswer\n` +
			`${prefix}agreepoll We should start by 8pm\n` +
			`${prefix}ratingpoll rate tonight's vibe\n` +
			`${prefix}attendancepoll Friday game night\n` +
			`${prefix}thisorthat Beach | Cinema`,
		);
	}

	if (command === "multipoll") {
		const poll = parsePipePoll(args.join(" "), { multi: true });
		if (!poll) return reply(`❌ Use: ${prefix}multipoll Question | Option A | Option B`);
		return sendPoll(poll);
	}

	if (command === "thisorthat") {
		const values = args.join(" ").split("|").map((value) => value.trim()).filter(Boolean);
		if (values.length !== 2) return reply(`❌ Use: ${prefix}thisorthat Beach | Cinema`);
		return sendPoll(normalizeNativePoll({ name: "⚡ This or That?", values, selectableCount: 1 }));
	}

	if (command === "agreepoll") {
		const statement = args.join(" ").trim();
		if (!statement) return reply(`❌ Use: ${prefix}agreepoll <statement>`);
		return sendPoll(normalizeNativePoll({ name: statement, values: ["✅ Agree", "🤔 Not sure", "❌ Disagree"] }));
	}

	if (command === "ratingpoll") {
		const topic = args.join(" ").trim() || "Rate this";
		return sendPoll(normalizeNativePoll({ name: `⭐ ${topic}`, values: ["1/5", "2/5", "3/5", "4/5", "5/5"] }));
	}

	if (command === "attendancepoll") {
		const event = args.join(" ").trim() || "Who's joining?";
		return sendPoll(normalizeNativePoll({ name: `📅 ${event}`, values: ["✅ I'm in", "🕒 Maybe / joining later", "❌ Can't make it"] }));
	}

	if (["aipoll", "decisionpoll"].includes(command)) {
		const request = args.join(" ").trim();
		if (!request) return reply(`❌ Use: ${prefix}${command} <what the group should vote on>`);
		try {
			return sendPoll(await aiPoll({ groupJid: from, senderJid, request }));
		} catch (error) {
			console.warn("[ALPHA_POLL]", error.message);
			return reply(`❌ Alpha couldn't build that poll: ${error.message}`);
		}
	}

	if (command === "quizpoll") {
		const request = args.join(" ").trim() || "general knowledge";
		try {
			const poll = await aiPoll({ groupJid: from, senderJid, request, quiz: true });
			rememberQuizPoll(from, poll, poll.correctIndex);
			return sendPoll({ name: poll.name, values: poll.values, selectableCount: 1 });
		} catch (error) {
			console.warn("[ALPHA_QUIZ_POLL]", error.message);
			return reply(`❌ Alpha couldn't build that quiz poll: ${error.message}`);
		}
	}

	if (command === "pollanswer") {
		const answer = getQuizPollAnswer(from);
		return reply(answer
			? `🧠 *Quiz answer:* ${answer.answer}\n_${answer.question}_`
			: "ℹ️ There isn't an active quiz answer to reveal right now.");
	}
};

export default () => ({
	cmd: ["pollhelp", "polls", "multipoll", "aipoll", "decisionpoll", "quizpoll", "pollanswer", "agreepoll", "ratingpoll", "attendancepoll", "thisorthat"],
	desc: "Native WhatsApp AI decision polls, multi-select polls and quiz polls",
	usage: "poll Question | A | B | aipoll <topic> | quizpoll <topic> | thisorthat A | B",
	handler,
});
