import { createEnhancementItem, clearEnhancementItems, listEnhancementItems } from "../../../db/enhancementData.js";
import { recordGameResult } from "../../../db/gameData.js";
import { cleanFeatureText, safeMemberName } from "../../../utils/featureSuite.js";
import { ARCADE_COMMANDS } from "../../../utils/ultimateFeatureCatalog.js";

const games = new Map();
const cooldowns = new Map();
const TTL = 5 * 60_000;
const WORDS = ["javascript", "elephant", "festival", "mountain", "keyboard", "diamond", "library", "whatsapp", "adventure", "chocolate", "computer", "football"];
const WORD_CLUES = [
	{ prompt: "A place where books are borrowed", answer: "library" },
	{ prompt: "A device used to type into a computer", answer: "keyboard" },
	{ prompt: "A precious stone made of carbon", answer: "diamond" },
	{ prompt: "A journey filled with excitement", answer: "adventure" },
	{ prompt: "A large natural elevation of land", answer: "mountain" },
];
const CAPITALS = [
	{ country: "Nigeria", answer: "abuja" }, { country: "Ghana", answer: "accra" },
	{ country: "Kenya", answer: "nairobi" }, { country: "South Africa", answer: "pretoria" },
	{ country: "Egypt", answer: "cairo" }, { country: "Canada", answer: "ottawa" },
	{ country: "Japan", answer: "tokyo" }, { country: "Brazil", answer: "brasilia" },
];

const random = (items) => items[Math.floor(Math.random() * items.length)];
const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const shuffle = (value) => {
	const output = Array.from(value);
	for (let index = output.length - 1; index > 0; index -= 1) {
		const target = Math.floor(Math.random() * (index + 1));
		[output[index], output[target]] = [output[target], output[index]];
	}
	return output.join("");
};
const allow = (key, ms = 5_000) => {
	const now = Date.now();
	if ((cooldowns.get(key) || 0) > now) return false;
	cooldowns.set(key, now + ms);
	return true;
};
const getGame = (from, type) => {
	const game = games.get(from);
	if (!game || game.type !== type || game.expires <= Date.now()) {
		if (game?.expires <= Date.now()) games.delete(from);
		return null;
	}
	return game;
};
const award = ({ from, senderJid, updateName, game, points, won = true }) => recordGameResult({
	groupJid: from,
	memberJid: senderJid,
	name: safeMemberName(updateName, senderJid),
	game,
	points,
	won,
	correct: true,
});

const startHangman = ({ msg, from, sendMessageWTyping }) => {
	const word = random(WORDS);
	games.set(from, { type: "hangman", word, guessed: new Set(), wrong: 0, expires: Date.now() + TTL });
	return sendMessageWTyping(from, { text: `🪢 *Hangman*\n\n${Array(word.length).fill("_").join(" ")}\nLives: ❤️❤️❤️❤️❤️❤️\n\nGuess with \`guess <letter or word>\`.` }, { quoted: msg });
};

const answerHangman = async (context) => {
	const { msg, from, args, senderJid, updateName, sendMessageWTyping } = context;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const game = getGame(from, "hangman");
	if (!game) return reply("❌ No Hangman round is active.");
	const guess = normalize(args[0]);
	if (!guess) return reply("❌ Usage: `guess <letter or word>`. ");
	if (guess === game.word || (guess.length === 1 && game.word.includes(guess))) game.guessed.add(guess);
	else game.wrong += 1;
	const visible = Array.from(game.word, (letter) => game.guessed.has(letter) || game.guessed.has(game.word) ? letter : "_");
	if (!visible.includes("_")) {
		games.delete(from);
		await award({ ...context, game: "hangman", points: 12 });
		return reply(`🏆 *${safeMemberName(updateName, senderJid)}* solved it: *${game.word}*! +12 points.`);
	}
	if (game.wrong >= 6) {
		games.delete(from);
		return reply(`💀 Game over. The word was *${game.word}*.`);
	}
	return reply(`${visible.join(" ")}\nLives: ${"❤️".repeat(6 - game.wrong)}${"🖤".repeat(game.wrong)}`);
};

const handleWordChain = async (context) => {
	const { msg, from, args, senderJid, updateName, sendMessageWTyping, command } = context;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	if (command === "wordchain") {
		const start = random(["apple", "tiger", "river", "dance", "eagle"]);
		games.set(from, { type: "wordchain", last: start, used: new Set([start]), scores: new Map(), expires: Date.now() + TTL });
		return reply(`🔗 *Word Chain*\nStart: *${start}*\n\nNext word must begin with *${start.at(-1).toUpperCase()}*. Use \`word <word>\`.`);
	}
	const game = getGame(from, "wordchain");
	if (!game) return reply("❌ No word-chain round is active.");
	const word = String(args[0] || "").toLowerCase();
	if (!/^[a-z]{3,20}$/.test(word)) return reply("❌ Enter one English word containing 3–20 letters.");
	if (game.used.has(word)) return reply("❌ That word was already used.");
	if (word[0] !== game.last.at(-1)) return reply(`❌ The word must begin with *${game.last.at(-1).toUpperCase()}*.`);
	game.last = word;
	game.used.add(word);
	game.scores.set(senderJid, (game.scores.get(senderJid) || 0) + 1);
	game.expires = Date.now() + TTL;
	if (game.used.size >= 16) {
		games.delete(from);
		const [winnerJid, score] = [...game.scores.entries()].sort((a, b) => b[1] - a[1])[0];
		if (winnerJid) await award({ ...context, senderJid: winnerJid, game: "wordchain", points: 10 });
		return reply(`🏆 Chain complete with *${game.used.size} words*! Winner: @${winnerJid.split("@")[0]} (${score} words).`, { mentions: [winnerJid] });
	}
	return reply(`✅ *${word}* accepted. Next letter: *${word.at(-1).toUpperCase()}* · ${game.used.size}/16`);
};

const startAnswerGame = ({ msg, from, sendMessageWTyping, type }) => {
	let prompt;
	let answer;
	let command;
	let points = 10;
	if (type === "anagram") {
		answer = random(WORDS);
		prompt = `Unscramble: *${shuffle(answer).toUpperCase()}*`;
		command = "unscramble";
	} else if (type === "mathrace") {
		const left = 5 + Math.floor(Math.random() * 40);
		const right = 2 + Math.floor(Math.random() * 20);
		const operator = random(["+", "-", "×"]);
		answer = String(operator === "+" ? left + right : operator === "-" ? left - right : left * right);
		prompt = `Solve: *${left} ${operator} ${right}*`;
		command = "mathanswer";
		points = 8;
	} else if (type === "cryptogram") {
		answer = random(WORDS);
		prompt = `Decode this Caesar-shifted word: *${Array.from(answer, (letter) => String.fromCharCode(97 + (letter.charCodeAt(0) - 97 + 3) % 26)).join("").toUpperCase()}*`;
		command = "cryptoanswer";
		points = 12;
	} else if (type === "sequencequiz") {
		const start = 1 + Math.floor(Math.random() * 10);
		const step = 2 + Math.floor(Math.random() * 8);
		const values = Array.from({ length: 4 }, (_, index) => start + index * step);
		answer = String(start + 4 * step);
		prompt = `Complete the sequence: *${values.join(", ")}, ?*`;
		command = "sequenceanswer";
		points = 9;
	} else if (type === "wordclue") {
		const item = random(WORD_CLUES); answer = item.answer; prompt = item.prompt; command = "clueanswer"; points = 10;
	} else if (type === "cardguess") {
		const first = 1 + Math.floor(Math.random() * 13);
		const second = 1 + Math.floor(Math.random() * 13);
		answer = second > first ? "higher" : second < first ? "lower" : "same";
		prompt = `The visible card is *${first}*. Will the hidden card be *higher*, *lower*, or the *same*?`;
		command = "cardanswer";
		points = 6;
	} else {
		const item = random(CAPITALS); answer = item.answer; prompt = `What is the capital of *${item.country}*?`; command = "capitalanswer"; points = 10;
	}
	games.set(from, { type, answer, points, attempts: new Set(), expires: Date.now() + TTL });
	return sendMessageWTyping(from, { text: `🎮 *${type.toUpperCase()}*\n\n${prompt}\n\nAnswer with \`${command} <answer>\`.` }, { quoted: msg });
};

const answerGame = async (context, type) => {
	const { msg, from, args, senderJid, updateName, sendMessageWTyping } = context;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const game = getGame(from, type);
	if (!game) return reply("❌ That game is not active.");
	if (game.attempts.has(senderJid)) return;
	game.attempts.add(senderJid);
	const answer = normalize(args.join(" "));
	if (answer !== normalize(game.answer)) return;
	games.delete(from);
	await award({ ...context, game: type, points: game.points });
	return reply(`🏆 *${safeMemberName(updateName, senderJid)}* wins! Answer: *${game.answer}*. +${game.points} points.`);
};

const handleStory = async (context) => {
	const { msg, from, args, senderJid, updateName, isGroupAdmin, isOwner, sendMessageWTyping } = context;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const action = String(args[0] || "show").toLowerCase();
	if (action === "add") {
		const text = cleanFeatureText(args.slice(1).join(" "), 220);
		if (!text) return reply("❌ Usage: `storychain add <one sentence>`. ");
		const recent = await listEnhancementItems(from, "story", {}, 1);
		if (recent[0]?.memberJid === senderJid) return reply("⏳ Let another member add the next sentence.");
		const count = (await listEnhancementItems(from, "story", {}, 30)).length;
		if (count >= 30) return reply("📖 This story reached 30 sentences. An admin can reset it.");
		await createEnhancementItem({ groupJid: from, type: "story", memberJid: senderJid, memberName: safeMemberName(updateName, senderJid), text, status: "active" });
		return reply("✅ Sentence added to the group story.");
	}
	if (action === "reset") {
		if (!isGroupAdmin && !isOwner) return reply("❌ Only an admin can reset the story.");
		await clearEnhancementItems(from, "story");
		return reply("✅ Story chain reset.");
	}
	const entries = (await listEnhancementItems(from, "story", {}, 30)).reverse();
	return reply(entries.length ? `📖 *Group Story Chain*\n\n${entries.map((entry) => entry.text).join(" ")}` : "📖 No story yet. Use `storychain add <sentence>`. ");
};

const handleBingo = async (context) => {
	const { msg, from, senderJid, updateName, sendMessageWTyping, command } = context;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	if (command === "bingostart") {
		games.set(from, { type: "bingo", pool: Array.from({ length: 50 }, (_, index) => index + 1).sort(() => Math.random() - 0.5), called: [], cards: new Map(), expires: Date.now() + 15 * 60_000 });
		return reply("🎱 *Bingo started!* Get a card with `bingocard`, then call numbers with `bingocall`. Claim with `bingo`. ");
	}
	const game = getGame(from, "bingo");
	if (!game) return reply("❌ No Bingo game is active.");
	if (command === "bingocard") {
		if (!game.cards.has(senderJid)) game.cards.set(senderJid, Array.from({ length: 50 }, (_, index) => index + 1).sort(() => Math.random() - 0.5).slice(0, 5).sort((a, b) => a - b));
		return reply(`🎟️ Your Bingo card: *${game.cards.get(senderJid).join(" · ")}*`);
	}
	if (command === "bingocall") {
		if (!game.pool.length) return reply("❌ All numbers have been called.");
		const number = game.pool.shift(); game.called.push(number);
		return reply(`🎱 Number: *${number}*\nCalled: ${game.called.join(", ")}`);
	}
	const card = game.cards.get(senderJid);
	if (!card) return reply("❌ Get a card first with `bingocard`. ");
	if (!card.every((number) => game.called.includes(number))) return reply("❌ Not Bingo yet—some card numbers have not been called.");
	games.delete(from);
	await award({ ...context, game: "bingo", points: 20 });
	return reply(`🏆 *BINGO!* ${safeMemberName(updateName, senderJid)} wins +20 points.`);
};

const handleQuickDraw = async (context) => {
	const { sock, msg, from, senderJid, updateName, sendMessageWTyping, command } = context;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	if (command === "quickdraw") {
		games.set(from, { type: "quickdraw", ready: false, expires: Date.now() + 30_000 });
		const delay = 2_000 + Math.floor(Math.random() * 4_000);
		setTimeout(async () => {
			const game = getGame(from, "quickdraw");
			if (!game) return;
			game.ready = true;
			await sock.sendMessage(from, { text: "🟢 *GO!* First member to send `quicktap` wins!" }).catch(() => {});
		}, delay).unref?.();
		return reply("🔴 Get ready… do not tap early!");
	}
	const game = getGame(from, "quickdraw");
	if (!game) return reply("❌ No quick-draw round is active.");
	if (!game.ready) return reply("❌ Too early! Wait for GO.");
	games.delete(from);
	await award({ ...context, game: "quickdraw", points: 7 });
	return reply(`⚡ *${safeMemberName(updateName, senderJid)}* had the fastest reaction! +7 points.`);
};

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const context = { sock, msg, from, args, ...msgInfoObj };
	if (!allow(`${from}:${msgInfoObj.senderJid}:${msgInfoObj.command}`, ["word", "guess", "quicktap"].includes(msgInfoObj.command) ? 1_500 : 4_000)) return;
	try {
		switch (msgInfoObj.command) {
			case "hangman": return startHangman(context);
			case "guess": return answerHangman(context);
			case "wordchain": case "word": return handleWordChain(context);
			case "anagram": case "mathrace": case "cryptogram": case "sequencequiz": case "wordclue": case "cardguess": case "capitalquiz": return startAnswerGame({ ...context, type: msgInfoObj.command });
			case "unscramble": return answerGame(context, "anagram");
			case "mathanswer": return answerGame(context, "mathrace");
			case "cryptoanswer": return answerGame(context, "cryptogram");
			case "sequenceanswer": return answerGame(context, "sequencequiz");
			case "clueanswer": return answerGame(context, "wordclue");
			case "cardanswer": return answerGame(context, "cardguess");
			case "capitalanswer": return answerGame(context, "capitalquiz");
			case "storychain": return handleStory(context);
			case "bingostart": case "bingocard": case "bingocall": case "bingo": return handleBingo(context);
			case "quickdraw": case "quicktap": return handleQuickDraw(context);
			case "arcadehelp": return msgInfoObj.sendMessageWTyping(from, { text: "🕹️ *Arcade Plus*\n\n`hangman` · `wordchain` · `anagram` · `mathrace`\n`cryptogram` · `sequencequiz` · `wordclue` · `cardguess`\n`capitalquiz` · `storychain` · `bingostart` · `quickdraw`" }, { quoted: msg });
		}
	} catch (error) {
		console.error("Arcade Plus failed:", error.message);
		return msgInfoObj.sendMessageWTyping(from, { text: "❌ The game is temporarily unavailable." }, { quoted: msg });
	}
};

export default () => ({
	cmd: ARCADE_COMMANDS,
	desc: "Twelve lightweight group games with recorded points and safe per-member cooldowns",
	usage: "arcadehelp | hangman | wordchain | anagram | bingo | quickdraw",
	handler,
});
