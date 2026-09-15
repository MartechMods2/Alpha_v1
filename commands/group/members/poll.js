import { parsePipePoll } from "../../../utils/alphaPolls.js";

const cooldowns = new Map();
const COOLDOWN_MS = 15_000;

const handler = async (_sock, msg, from, args, msgInfoObj) => {
	const { senderJid, sendMessageWTyping, prefix = "$" } = msgInfoObj;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const now = Date.now();
	const key = `${from}:${senderJid}`;
	if ((cooldowns.get(key) || 0) > now) return reply("⏳ Give the current poll a few seconds before starting another one.");

	const poll = parsePipePoll(args.join(" "));
	if (!poll) return reply(`📊 Usage: *${prefix}poll Question | Option 1 | Option 2* (2–12 choices)`);

	cooldowns.set(key, now + COOLDOWN_MS);
	if (cooldowns.size > 2000) {
		for (const [entry, expires] of cooldowns) if (expires <= now) cooldowns.delete(entry);
	}
	return sendMessageWTyping(from, { poll }, { quoted: msg });
};

export default () => ({
	cmd: ["poll", "vote"],
	desc: "Create a validated native WhatsApp group poll",
	usage: "poll Question | Option 1 | Option 2",
	handler,
});
