const truthQuestions = [
	"What is a harmless secret talent most people here do not know about?",
	"What is the funniest mistake you have made recently?",
	"Which habit would you most like to improve?",
	"What is the nicest thing someone in this group has done for you?",
	"What song do you secretly know every word to?",
	"What is one goal you want to finish this year?",
];

const safeDares = [
	"Send a voice note saying a tongue twister three times fast.",
	"Describe your day using only three emojis.",
	"Give a sincere compliment to the last person who messaged before you.",
	"Change your group nickname to a snack for ten minutes.",
	"Write a four-line poem about this group.",
	"Share your best clean joke.",
];

const wouldYouRather = [
	"Would you rather always be ten minutes early or twenty minutes late?",
	"Would you rather explore space or the deepest ocean?",
	"Would you rather give up music for a month or social media for a year?",
	"Would you rather have unlimited books or unlimited movies?",
	"Would you rather be able to speak every language or play every instrument?",
	"Would you rather relive one great day or skip one difficult day?",
];

const icebreakers = [
	"What small thing instantly improves your mood?",
	"If you could master one skill overnight, what would it be?",
	"Which food could you happily eat every week?",
	"What is the best advice you have ever received?",
	"If this group had a theme song, what should it be?",
	"What fictional world would you visit for one day?",
];

const compliments = [
	"You make conversations better just by showing up.",
	"Your energy is genuinely appreciated here.",
	"You have excellent taste in group chats.",
	"You are doing better than you probably give yourself credit for.",
	"Your presence adds something good to this group.",
];

const riddles = [
	{ question: "What has keys but cannot open locks?", answer: "A piano." },
	{ question: "What gets wetter as it dries?", answer: "A towel." },
	{ question: "What has a face and two hands but no arms or legs?", answer: "A clock." },
	{ question: "What can travel around the world while staying in one corner?", answer: "A stamp." },
	{ question: "What has many teeth but cannot bite?", answer: "A comb." },
];

const eightBall = [
	"Yes — go for it.",
	"Very likely.",
	"The signs point to yes.",
	"Ask again after a snack.",
	"Hard to tell right now.",
	"Probably not this time.",
	"No — choose another route.",
];

const cooldowns = new Map();
const pendingRiddles = new Map();
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
	if (pendingRiddles.size > 2000) {
		for (const [entry, riddle] of pendingRiddles) {
			if (riddle.expires <= now) pendingRiddles.delete(entry);
		}
	}

	let text;
	switch (command) {
		case "truth":
			text = `🎯 *Truth*\n${randomItem(truthQuestions)}`;
			break;
		case "dare":
			text = `🔥 *Safe Dare*\n${randomItem(safeDares)}`;
			break;
		case "wyr":
		case "wouldyourather":
			text = `🤔 *Would You Rather?*\n${randomItem(wouldYouRather)}`;
			break;
		case "icebreaker":
			text = `🧊 *Icebreaker*\n${randomItem(icebreakers)}`;
			break;
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
		case "riddle": {
			const riddle = randomItem(riddles);
			pendingRiddles.set(`${from}:${senderJid}`, { ...riddle, expires: now + 5 * 60_000 });
			text = `🧩 *Riddle*\n${riddle.question}\n\nUse the answer command within 5 minutes.`;
			break;
		}
		case "answer": {
			const riddle = pendingRiddles.get(`${from}:${senderJid}`);
			if (!riddle || riddle.expires < now) text = "🧩 Start a new riddle first.";
			else {
				text = `🧩 *Answer:* ${riddle.answer}`;
				pendingRiddles.delete(`${from}:${senderJid}`);
			}
			break;
		}
		default:
			return;
	}
	return sendMessageWTyping(from, { text }, { quoted: msg });
};

export default () => ({
	cmd: [
		"truth",
		"dare",
		"wyr",
		"wouldyourather",
		"icebreaker",
		"compliment",
		"coinflip",
		"coin",
		"dice",
		"8ball",
		"choose",
		"riddle",
		"answer",
	],
	desc: "Low-volume group games and icebreakers",
	usage: "truth | dare | wyr | icebreaker | riddle | answer | dice [sides] | choose a | b",
	handler,
});
