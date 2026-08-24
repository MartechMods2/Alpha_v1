const triviaBanks = Object.freeze({
	general: [
		["How many sides does a hexagon have?", ["6", "six"]],
		["Which planet is known as the Red Planet?", ["mars"]],
		["What is the largest ocean on Earth?", ["pacific", "pacific ocean"]],
		["How many minutes are in two hours?", ["120", "one hundred twenty"]],
		["What is the freezing point of water in Celsius?", ["0", "zero", "0c"]],
	],
	science: [
		["What gas do plants absorb from the atmosphere?", ["carbon dioxide", "co2"]],
		["What is H2O commonly called?", ["water"]],
		["Which organ pumps blood around the human body?", ["heart", "the heart"]],
		["What force keeps us on the ground?", ["gravity"]],
		["What is the centre of an atom called?", ["nucleus", "the nucleus"]],
	],
	tech: [
		["What does CPU stand for?", ["central processing unit"]],
		["Which language runs natively in a web browser?", ["javascript", "js"]],
		["What does URL stand for?", ["uniform resource locator"]],
		["What number system uses only zero and one?", ["binary"]],
		["What does RAM stand for?", ["random access memory"]],
	],
	africa: [
		["Which is Africa's most populous country?", ["nigeria"]],
		["What is the capital of Ghana?", ["accra"]],
		["Which river is commonly described as Africa's longest?", ["nile", "river nile", "the nile"]],
		["What is the capital of Kenya?", ["nairobi"]],
		["Which country is home to the pyramids of Giza?", ["egypt"]],
	],
});

const riddles = Object.freeze([
	["What has keys but cannot open locks?", ["piano", "a piano"]],
	["What gets wetter as it dries?", ["towel", "a towel"]],
	["What can travel around the world while staying in one corner?", ["stamp", "a stamp"]],
	["What has many teeth but cannot bite?", ["comb", "a comb"]],
	["What has one eye but cannot see?", ["needle", "a needle"]],
	["What belongs to you but other people use it more than you do?", ["name", "your name", "my name"]],
]);

const emojiPuzzles = Object.freeze([
	["🌧️ + 🏹", ["rainbow"]],
	["⭐ + 🐟", ["starfish"]],
	["🔥 + 🪰", ["firefly"]],
	["🐝 + 🍃", ["belief", "believe"]],
	["📚 + 🪱", ["bookworm"]],
	["🌙 + 🚶", ["moonwalk", "moonwalking"]],
]);

const scrambleWords = Object.freeze([
	"whatsapp", "javascript", "adventure", "football", "community", "creative",
	"champion", "festival", "internet", "keyboard", "playlist", "sticker",
]);

const fastTypePhrases = Object.freeze([
	"alpha squad stays sharp",
	"quick minds win games",
	"good vibes only",
	"practice makes progress",
	"teamwork makes it happen",
]);

export const normalizeGameAnswer = (value) =>
	String(value || "")
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[^a-z0-9\s]/g, " ")
		.replace(/\s+/g, " ")
		.trim();

export const isCorrectGameAnswer = (input, answers) => {
	const normalized = normalizeGameAnswer(input);
	return Boolean(normalized) && answers.some((answer) => normalizeGameAnswer(answer) === normalized);
};

const pick = (items, random) => items[Math.floor(random() * items.length)];

const scramble = (word, random) => {
	const letters = [...word];
	for (let index = letters.length - 1; index > 0; index -= 1) {
		const swapIndex = Math.floor(random() * (index + 1));
		[letters[index], letters[swapIndex]] = [letters[swapIndex], letters[index]];
	}
	const result = letters.join("");
	return result === word ? `${word.slice(1)}${word[0]}` : result;
};

export const createGameRound = (game, option = "", random = Math.random) => {
	if (game === "trivia") {
		const category = Object.hasOwn(triviaBanks, option) ? option : "general";
		const [question, answers] = pick(triviaBanks[category], random);
		return { game, category, title: `Trivia · ${category}`, prompt: question, answers, points: 10 };
	}
	if (game === "mathgame") {
		const left = 3 + Math.floor(random() * 28);
		const right = 2 + Math.floor(random() * 18);
		const multiply = random() < 0.35;
		return {
			game,
			title: "Math Sprint",
			prompt: multiply ? `${left} × ${right} = ?` : `${left} + ${right} = ?`,
			answers: [String(multiply ? left * right : left + right)],
			points: multiply ? 12 : 8,
		};
	}
	if (game === "scramble") {
		const answer = pick(scrambleWords, random);
		return { game, title: "Word Scramble", prompt: scramble(answer, random), answers: [answer], points: 12 };
	}
	if (game === "emojiguess") {
		const [prompt, answers] = pick(emojiPuzzles, random);
		return { game, title: "Emoji Guess", prompt, answers, points: 10 };
	}
	if (game === "riddle") {
		const [prompt, answers] = pick(riddles, random);
		return { game, title: "Riddle Rush", prompt, answers, points: 10 };
	}
	if (game === "fasttype") {
		const phrase = pick(fastTypePhrases, random);
		return { game, title: "Fast Type", prompt: phrase, answers: [phrase], points: 8 };
	}
	throw new Error("Unknown game type");
};

export const gameCategories = Object.freeze(Object.keys(triviaBanks));
