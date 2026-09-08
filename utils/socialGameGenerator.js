import { askSafeAi } from "./safeAi.js";

const FALLBACKS = {
	truth: [
		"What opinion have you changed your mind about in the last year?",
		"What small habit are you secretly proud of building?",
		"What is something you once feared that now feels easy?",
		"What is the kindest thing somebody has done for you unexpectedly?",
		"Which skill do you wish you had started learning earlier?",
		"What harmless thing makes you irrationally competitive?",
		"What is one compliment you still remember clearly?",
		"Which personal goal matters most to you right now?",
		"What is the funniest misunderstanding you have ever had?",
		"What everyday task do you postpone more than you should?",
		"What is a lesson you learned the hard way but value now?",
		"What is something about your personality people usually misunderstand?",
		"Which memory can make you smile almost immediately?",
		"What is one thing you would like to become much better at this year?",
		"What is the most spontaneous harmless thing you have ever done?",
		"Which achievement are you proud of even if it looked small to other people?",
	],
	dare: [
		"Describe your current mood as a movie title.",
		"Send a seven-word motivational speech to the group.",
		"Give the next person who chats a sincere compliment.",
		"Make up a clean two-line advert for this group.",
		"Explain your favourite food as if you were a sports commentator.",
		"Send a voice note saying a tongue twister twice without slowing down.",
		"Write a four-line poem using the words group, energy and weekend.",
		"Describe your day using exactly four emojis and let the group guess it.",
		"Invent a harmless superhero name for yourself and explain the power.",
		"Share the cleanest joke you can think of in one message.",
		"Write a one-sentence acceptance speech for winning Member of the Day.",
		"Pretend you are a weather reporter and describe the group's current mood.",
		"Create a funny but respectful slogan for the group in under ten words.",
		"Type one positive thing about the person who last messaged before you.",
		"Describe your favourite snack without naming it and let people guess.",
		"Use three song titles to describe how your week is going.",
	],
	wyr: [
		"Would you rather master every language or every musical instrument?",
		"Would you rather have one extra free hour every day or one extra free day every month?",
		"Would you rather always know the fastest route or always find the best food nearby?",
		"Would you rather explore the deep ocean or outer space?",
		"Would you rather be excellent at teaching any subject or learning any subject?",
		"Would you rather remember everything you read or never forget a person's name?",
		"Would you rather travel ten years into the past or ten years into the future once?",
		"Would you rather have unlimited books or unlimited films for a year?",
		"Would you rather always arrive ten minutes early or exactly on time?",
		"Would you rather be able to pause time for ten minutes or rewind it for one minute?",
		"Would you rather have a brilliant idea every morning or perfect focus every afternoon?",
		"Would you rather give up social media for six months or snacks for three months?",
		"Would you rather plan the perfect trip or be surprised by a great one?",
		"Would you rather be known for creativity or reliability?",
		"Would you rather have a personal chef or a personal driver for a year?",
		"Would you rather win every board game or always know the answer to trivia questions?",
	],
	icebreaker: [
		"What small thing can improve your mood almost immediately?",
		"If you could master one useful skill overnight, which would you choose?",
		"Which Nigerian meal could you happily eat every week?",
		"What is the best practical advice you have received?",
		"If this group had a theme song, what kind of song should it be?",
		"What hobby would you try if equipment and lessons were free?",
		"What is one app you use more often than you expected?",
		"Which place in Nigeria would you recommend everyone visit once?",
		"What is the best way for you to spend a completely free Saturday?",
		"What was your favourite subject when you were younger?",
		"Which simple invention makes your daily life much easier?",
		"What food combination do you enjoy that other people might question?",
		"What is one thing you are looking forward to this month?",
		"Which fictional character would make a surprisingly good group admin?",
		"What is the first thing you normally notice when you enter a new place?",
		"If everybody here had to learn one new skill together, what should it be?",
	],
};

const recent = new Map();
const keyFor = (groupJid, type) => `${groupJid}:${type}`;
const normalized = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const remember = (groupJid, type, prompt) => {
	const key = keyFor(groupJid, type);
	const rows = recent.get(key) || [];
	rows.push(prompt);
	while (rows.length > 40) rows.shift();
	recent.set(key, rows);
};

const cleanGenerated = (text, type) => {
	let value = String(text || "").replace(/^[\s"'`]+|[\s"'`]+$/g, "").trim();
	value = value.replace(new RegExp(`^(?:${type}|safe dare|would you rather|icebreaker)\\s*[:\-–—]\\s*`, "i"), "");
	value = value.split(/\n+/).map((line) => line.trim()).filter(Boolean)[0] || "";
	return value.slice(0, 220);
};

const fallbackPrompt = (groupJid, type) => {
	const pool = FALLBACKS[type] || FALLBACKS.icebreaker;
	const used = new Set((recent.get(keyFor(groupJid, type)) || []).map(normalized));
	const available = pool.filter((prompt) => !used.has(normalized(prompt)));
	return (available.length ? available : pool)[Math.floor(Math.random() * (available.length ? available.length : pool.length))];
};

export const generateSocialGamePrompt = async ({ groupJid, type }) => {
	const safeType = ["truth", "dare", "wyr", "icebreaker"].includes(type) ? type : "icebreaker";
	const previous = recent.get(keyFor(groupJid, safeType)) || [];
	let prompt = "";
	try {
		const label = safeType === "wyr" ? "Would You Rather" : safeType;
		const result = await askSafeAi({
			groupJid,
			systemPrompt:
				`Create exactly ONE fresh ${label} prompt for a friendly WhatsApp group game. ` +
				"Keep it safe, respectful, fun and answerable in a group. Avoid sexual content, dangerous dares, humiliation, illegal activity, private-data requests and targeted insults. " +
				"Do not number it, do not add a heading, do not explain it, and keep it under 180 characters.",
			messages: [{
				role: "user",
				content: previous.length
					? `Generate a different prompt. Do not repeat or closely paraphrase these recent prompts:\n${previous.slice(-12).join("\n")}`
					: "Generate a fresh prompt now.",
			}],
		});
		prompt = cleanGenerated(result?.text, safeType);
		const used = new Set(previous.map(normalized));
		if (prompt.length < 8 || used.has(normalized(prompt))) prompt = "";
	} catch {}
	if (!prompt) prompt = fallbackPrompt(groupJid, safeType);
	remember(groupJid, safeType, prompt);
	return prompt;
};
