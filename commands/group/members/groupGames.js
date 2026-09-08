import { generateSocialGamePrompt } from "../../../utils/socialGameGenerator.js";
import { alphaPanel } from "../../../utils/alphaStyle.js";

const compliments = [
	"You make conversations better just by showing up.",
	"Your energy is genuinely appreciated here.",
	"You have excellent taste in group chats.",
	"You are doing better than you probably give yourself credit for.",
	"Your presence adds something good to this group.",
	"You bring a useful perspective to the room.",
	"Your consistency deserves more credit than it gets.",
	"Someone in this group probably learns from the way you handle things.",
];

const eightBall = [
	"Yes — go for it.", "Very likely.", "The signs point to yes.", "Ask again after a snack.",
	"Hard to tell right now.", "Probably not this time.", "No — choose another route.",
];

const cooldowns = new Map();
const COOLDOWN_MS = 10_000;
const randomItem = (items) => items[Math.floor(Math.random() * items.length)];

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { command, senderJid, sendMessageWTyping } = msgInfoObj;
	const key = `${from}:${senderJid}:${command}`;
	const now = Date.now();
	if ((cooldowns.get(key) || 0) > now) return;
	cooldowns.set(key, now + COOLDOWN_MS);
	if (cooldowns.size > 2000) {
		for (const [entry, expires] of cooldowns) if (expires <= now) cooldowns.delete(entry);
	}

	let text;
	switch (command) {
		case "truth": {
			const prompt = await generateSocialGamePrompt({ groupJid: from, type: "truth" });
			text = alphaPanel({ icon: "🎯", title: "Truth", lines: [prompt], footer: "Answer honestly, but only share what you are comfortable sharing." });
			break;
		}
		case "dare": {
			const prompt = await generateSocialGamePrompt({ groupJid: from, type: "dare" });
			text = alphaPanel({ icon: "🔥", title: "Safe Dare", lines: [prompt], footer: "Keep it fun, respectful and voluntary." });
			break;
		}
		case "wyr":
		case "wouldyourather": {
			const prompt = await generateSocialGamePrompt({ groupJid: from, type: "wyr" });
			text = alphaPanel({ icon: "🤔", title: "Would You Rather?", lines: [prompt], footer: "Pick one and tell the group why." });
			break;
		}
		case "icebreaker": {
			const prompt = await generateSocialGamePrompt({ groupJid: from, type: "icebreaker" });
			text = alphaPanel({ icon: "🧊", title: "Icebreaker", lines: [prompt], footer: "Everyone can answer." });
			break;
		}
		case "compliment":
			text = `💛 ${randomItem(compliments)}`;
			break;
		case "coinflip":
		case "coin":
			text = `🪙 *${Math.random() < 0.5 ? "Heads" : "Tails"}*`;
			break;
		case "dice": {
			const sides = Math.min(100, Math.max(2, Number.parseInt(args[0], 10) || 6));
			text = `🎲 Rolled a *${Math.floor(Math.random() * sides) + 1}* (d${sides})`;
			break;
		}
		case "8ball":
			text = args.length ? `🎱 ${randomItem(eightBall)}` : "🎱 Ask a question after `8ball`.";
			break;
		case "choose": {
			const choices = args.join(" ").split("|").map((choice) => choice.trim()).filter(Boolean).slice(0, 10);
			text = choices.length >= 2
				? `✨ I choose: *${randomItem(choices).slice(0, 100)}*`
				: "✨ Give me at least two choices separated by `|`.";
			break;
		}
		default:
			return;
	}
	return sendMessageWTyping(from, { text }, { quoted: msg });
};

export default () => ({
	cmd: ["truth", "dare", "wyr", "wouldyourather", "icebreaker", "compliment", "coinflip", "coin", "dice", "8ball", "choose"],
	desc: "AI-assisted, non-repeating social games and lightweight group fun",
	usage: "truth | dare | wyr | icebreaker | dice [sides] | choose a | b",
	handler,
});
