import {
	claimDailyChallenge,
	getGameLeaderboard,
	getGameProfile,
	getGroupGameStats,
	getDailyChallengeClaim,
	recordGameResult,
} from "../../../db/gameData.js";
import {
	createDailyGameRound,
	createGameRound,
	gameCategories,
	isCorrectGameAnswer,
} from "../../../utils/gameEngine.js";
import { getGameAchievements, getNextGameAchievement } from "../../../utils/gameAchievements.js";
import { formatGameRank, getGameRank } from "../../../utils/gameRanks.js";
import { alphaPanel, safeDisplayName } from "../../../utils/alphaStyle.js";
import messageQueue from "../../../queue/messageQueue.js";
import { answerAutoGame, startAutoGame, controlAutoGame, getAutoGameSession, restoreAutoGame } from "../../../utils/autoGameHost.js";
import { restoreTruthDareSession } from "../../../utils/truthDareHost.js";

const activeRounds = new Map();
const roundTimers = new Map();
const startCooldowns = new Map();
const infoCooldowns = new Map();
const rpsCooldowns = new Map();
const recentPrompts = new Map();
const ROUND_TTL_MS = 60_000;
const START_COOLDOWN_MS = 20_000;
const RACE_GAMES = ["trivia", "mathgame", "scramble", "emojiguess", "riddle", "fasttype", "oddoneout", "flagguess", "truefalse", "numberguess"];

const localDateKey = (date = new Date()) => {
	try {
		return date.toLocaleDateString("en-CA", { timeZone: process.env.BOT_TIMEZONE || "Africa/Lagos" });
	} catch {
		return date.toISOString().slice(0, 10);
	}
};

const safeName = (value, senderJid) => safeDisplayName(value, senderJid);
const jidName = (jid) => safeName(String(jid || "").split("@")[0], jid);
const sendQueued = (sock, jid, content, options = {}) =>
	messageQueue.enqueue(jid, () => sock.sendMessage(jid, content, options), 1);

const clearRoundTimer = (groupJid) => {
	const timer = roundTimers.get(groupJid);
	if (timer) clearTimeout(timer);
	roundTimers.delete(groupJid);
};

const rememberPrompt = (groupJid, game, prompt) => {
	const key = `${groupJid}:${game}`;
	const rows = recentPrompts.get(key) || [];
	rows.push(String(prompt));
	while (rows.length > 12) rows.shift();
	recentPrompts.set(key, rows);
};

const createFreshRound = (groupJid, game, option = "") => {
	const key = `${groupJid}:${game}`;
	const used = new Set((recentPrompts.get(key) || []).map((value) => String(value).toLowerCase()));
	let round;
	for (let attempt = 0; attempt < 10; attempt += 1) {
		round = createGameRound(game, option);
		if (!used.has(String(round.prompt).toLowerCase())) break;
	}
	rememberPrompt(groupJid, game, round.prompt);
	return round;
};

const purgeCooldowns = (now = Date.now()) => {
	for (const map of [startCooldowns, infoCooldowns, rpsCooldowns]) {
		for (const [key, expires] of map) if (expires <= now) map.delete(key);
	}
};

const scheduleRoundTimeout = (sock, groupJid, roundId) => {
	clearRoundTimer(groupJid);
	const timer = setTimeout(async () => {
		const round = activeRounds.get(groupJid);
		if (!round || round.id !== roundId) return;
		activeRounds.delete(groupJid);
		roundTimers.delete(groupJid);
		await sendQueued(sock, groupJid, {
			text: `⌛ *Time!* Nobody got it in 60 seconds.\nAnswer: *${round.answers[0]}*`,
		}).catch(error => console.warn("Game timeout send failed:", error.message));
	}, ROUND_TTL_MS);
	timer.unref?.();
	roundTimers.set(groupJid, timer);
};

const startRound = async ({ sock, from, msg, command, args, senderJid, sendMessageWTyping }) => {
	if (await restoreAutoGame({ sock, groupJid: from })) return sendMessageWTyping(from, { text: "🎮 An automatic game is running. Use `$game status` or `$game stop`." }, { quoted: msg });
	const now = Date.now();
	purgeCooldowns(now);
	if (activeRounds.has(from)) {
		const current = activeRounds.get(from);
		return sendMessageWTyping(from, {
			text: `🎮 A ${current ? `*${current.title}* round` : "turn session"} is already live. Answer with *#your answer* or use \`answer <answer>\`.`,
		}, { quoted: msg });
	}
	if ((startCooldowns.get(from) || 0) > now) return;
	startCooldowns.set(from, now + START_COOLDOWN_MS);

	let roundData;
	if (command === "dailychallenge" || command === "dailygame") {
		const dateKey = localDateKey();
		const claim = await getDailyChallengeClaim(from, dateKey);
		if (claim) {
			return sendMessageWTyping(from, { text: `🌞 Today's challenge was won by *${safeName(claim.name, claim.memberJid)}*. A new one unlocks tomorrow.` }, { quoted: msg });
		}
		roundData = createDailyGameRound(from, dateKey);
	} else {
		const option = String(args[0] || "").toLowerCase();
		roundData = createFreshRound(from, command, option);
	}
	const round = {
		...roundData,
		id: `${now}:${Math.random()}`,
		mode: "race",
		startedBy: senderJid,
		startedAt: now,
		expires: now + ROUND_TTL_MS,
		attempts: new Set(),
	};
	activeRounds.set(from, round);
	const categoryHelp = command === "trivia" ? ` Categories: ${gameCategories.join(", ")}.` : "";
	await sendMessageWTyping(from, {
		text: alphaPanel({
			icon: "🎮",
			title: `${round.title} · ${round.points} points`,
			lines: [
				`Question: *${round.prompt}*`,
				"First correct answer wins.",
				"Reply with *#your answer* or `answer <your answer>`.",
			],
			footer: `60 seconds · case-insensitive.${categoryHelp}`,
		}),
	}, { quoted: msg });
	scheduleRoundTimeout(sock, from, round.id);
};

const answerRound = async ({ sock, from, msg, answer, senderJid, updateName, sendMessageWTyping, passive = false }) => {
	if (await answerAutoGame({ sock, groupJid: from, senderJid, answer })) return true;
	const round = activeRounds.get(from);
	if (!round) {
		if (passive) return false;
		await sendMessageWTyping(from, { text: "🎮 No scored round is active. Use `game help`." }, { quoted: msg });
		return true;
	}
	if (!answer) {
		if (passive) return false;
		await sendMessageWTyping(from, { text: "❌ Usage: `answer <your answer>` or `#your answer`." }, { quoted: msg });
		return true;
	}
	if (round.attempts.has(senderJid)) return passive;
	round.attempts.add(senderJid);
	const correct = isCorrectGameAnswer(answer, round.answers);

	if (!correct) return true;

	if (round.dailyKey) {
		const claimed = await claimDailyChallenge({
			groupJid: from,
			dateKey: round.dailyKey,
			memberJid: senderJid,
			name: safeName(updateName, senderJid),
		});
		if (!claimed) {
			clearRoundTimer(from);
			activeRounds.delete(from);
			const winner = await getDailyChallengeClaim(from, round.dailyKey);
			await sendMessageWTyping(from, { text: `🌞 Too late—*${safeName(winner?.name, winner?.memberJid)}* claimed today's challenge first.` }, { quoted: msg });
			return true;
		}
	}

	clearRoundTimer(from);
	activeRounds.delete(from);
	const profile = await recordGameResult({
		groupJid: from,
		memberJid: senderJid,
		name: safeName(updateName, senderJid),
		game: round.game,
		points: round.points,
		won: true,
		correct: true,
	});
	const badges = getGameAchievements(profile);
	await sendMessageWTyping(from, {
		text: `✅ *${safeName(updateName, senderJid)}* got it! *${round.answers[0]}*\n+${round.points} points · 🔥 ${profile.streak} streak · ${formatGameRank(profile.points)} · 🎖️ ${badges.length} badges`,
	}, { quoted: msg });

	return true;
};

export const handlePassiveScoredGameAnswer = async ({ sock, msg, from, answer, senderJid, updateName }) => {
	const sendMessageWTyping = (jid, content, options = {}) => sendQueued(sock, jid, content, options);
	return answerRound({ sock, from, msg, answer, senderJid, updateName, sendMessageWTyping, passive: true });
};

const playRps = async ({ from, msg, args, senderJid, updateName, sendMessageWTyping }) => {
	const now = Date.now();
	const key = `${from}:${senderJid}`;
	if ((rpsCooldowns.get(key) || 0) > now) return;
	const choice = String(args[0] || "").toLowerCase();
	const choices = ["rock", "paper", "scissors"];
	if (!choices.includes(choice)) return sendMessageWTyping(from, { text: "✊ Usage: `rps rock|paper|scissors`" }, { quoted: msg });
	rpsCooldowns.set(key, now + 15_000);
	const botChoice = choices[Math.floor(Math.random() * choices.length)];
	const draw = choice === botChoice;
	const won = (choice === "rock" && botChoice === "scissors") || (choice === "paper" && botChoice === "rock") || (choice === "scissors" && botChoice === "paper");
	const points = won ? 5 : draw ? 2 : 0;
	const profile = await recordGameResult({ groupJid: from, memberJid: senderJid, name: safeName(updateName, senderJid), game: "rps", points, won, correct: won });
	return sendMessageWTyping(from, {
		text: `✊ You: *${choice}* · Alpha: *${botChoice}*\n${won ? "You win!" : draw ? "Draw!" : "Alpha wins this one!"} ${points ? `+${points} points` : ""}\n${formatGameRank(profile.points)} · ${profile.points} total points`,
	}, { quoted: msg });
};

const showScore = async ({ from, msg, senderJid, updateName, sendMessageWTyping }) => {
	const profile = (await getGameProfile(from, senderJid)) || { name: safeName(updateName, senderJid), points: 0, plays: 0, wins: 0, correct: 0, streak: 0, bestStreak: 0 };
	const rank = getGameRank(profile.points);
	const achievements = getGameAchievements(profile);
	const progress = rank.next ? `${rank.pointsToNext} points to ${rank.next.emoji} ${rank.next.name}` : "Maximum rank reached";
	return sendMessageWTyping(from, {
		text: alphaPanel({ icon: "🎮", title: `${safeName(profile.name, senderJid)}'s Game Card`, lines: [
			`Rank: *${rank.emoji} ${rank.name}*`, `Points: *${profile.points || 0}*`, `Wins: *${profile.wins || 0}* · Games: *${profile.plays || 0}*`,
			`Current streak: *${profile.streak || 0}* · Best: *${profile.bestStreak || 0}*`, `Badges: *${achievements.length}*`, progress,
		] }),
	}, { quoted: msg });
};

const showAchievements = async ({ from, msg, senderJid, updateName, sendMessageWTyping }) => {
	const profile = (await getGameProfile(from, senderJid)) || { name: safeName(updateName, senderJid) };
	const earned = getGameAchievements(profile);
	const next = getNextGameAchievement(profile);
	const rows = earned.length ? earned.map((badge) => `${badge.emoji} *${badge.name}*`) : ["No badges yet—win your first game to unlock one."];
	return sendMessageWTyping(from, { text: alphaPanel({ icon: "🎖️", title: `${safeName(profile.name, senderJid)}'s Trophy Cabinet`, lines: [...rows, ...(next ? [`Next target: ${next.emoji} *${next.name}*`] : ["Every achievement unlocked!"])] }) }, { quoted: msg });
};

const showSeasonStats = async ({ from, msg, sendMessageWTyping }) => {
	const stats = await getGroupGameStats(from);
	return sendMessageWTyping(from, { text: alphaPanel({ icon: "📈", title: "Arena Season Statistics", lines: [
		`Players: *${stats.players || 0}*`, `Games recorded: *${stats.plays || 0}*`, `Wins: *${stats.wins || 0}*`, `Points awarded: *${stats.points || 0}*`, `Best streak: *${stats.bestStreak || 0}*`,
	] }) }, { quoted: msg });
};

const showLeaderboard = async ({ from, msg, sendMessageWTyping }) => {
	const leaders = await getGameLeaderboard(from, 10);
	if (!leaders.length) return sendMessageWTyping(from, { text: "🏆 No scores yet. Start with `trivia`." }, { quoted: msg });
	const medals = ["🥇", "🥈", "🥉"];
	const rows = leaders.map((entry, index) => `${medals[index] || `${index + 1}.`} *${safeName(entry.name, entry.memberJid)}* — ${entry.points} pts · ${formatGameRank(entry.points)}`);
	return sendMessageWTyping(from, { text: alphaPanel({ icon: "🏆", title: "Group Game Leaderboard", lines: rows }) }, { quoted: msg });
};

const gameHelp = () => alphaPanel({
	icon: "🎮",
	title: "Alpha Game Guide",
	lines: [
		"*QUICK PLAY — first correct answer wins*",
		"• `$trivia [general|science|tech|africa|sports|naija]`",
		"• `$mathgame` · `$scramble` · `$emojiguess` · `$riddle`",
		"• `$fasttype` · `$oddoneout` · `$flagguess` · `$truefalse` · `$numberguess`",
		"• Answer with `#your answer` or `$answer your answer`. You have 60 seconds.",
		"",
		"*AUTOMATIC GAME HOSTING*",
		"• `$game start trivia tech rounds=10 lobby=2m` — choose 1–100 rounds and a 30s–10m lobby.",
		"• `$game start mathgame 5 lobby=90s` — five rounds of Maths; the starter auto-joins.",
		`• Supported: ${RACE_GAMES.join(", ")}.`,
		"• Vote Join game or use `$game join` / `$game leave`. `$game status` shows counted players.",
		"• Alpha starts when the lobby ends; starter/admin can use `$game close` to start early.",
		"• Every player gets a timed turn each round. Wrong answers, skips and timeouts earn 0. Alpha scores and announces the winners.",
		"• `$game liveboard` · `$game resume` · `$game next` · `$game stop`.",
		"• `$game random` and `$game lobby` are aliases for automatic hosting.",
		"",
		"*SOCIAL GAMES*",
		"• `$td start [1-100] [theme] [lobby=2m]` — automatically hosted Truth or Dare.",
		"• `$truth` · `$dare` · `$wyr` · `$icebreaker` — one-shot social prompts with safe local fallback.",
		"• `$compliment` · `$coin` · `$dice [sides]` · `$8ball question` · `$choose A | B | C`",
		"",
		"*DUELS & STRATEGY*",
		"• `$battle @member` → opponent uses `$acceptbattle`, then `$battleanswer ...`",
		"• `$ttt @member` + `$tttmove 1-9`",
		"• `$connect4 @member` + `$drop 1-7`",
		"• `$familyfeud` + `$feudanswer ...` · `$tournament create <name>` / `join` / `start`",
		"",
		"*ARCADE*",
		"• `$hangman` + `$guess` · `$wordchain` + `$word` · `$anagram` + `$unscramble`",
		"• `$mathrace` + `$mathanswer` · `$cryptogram` + `$cryptoanswer` · `$sequencequiz` + `$sequenceanswer`",
		"• `$wordclue` + `$clueanswer` · `$cardguess` + `$cardanswer` · `$capitalquiz` + `$capitalanswer`",
		"• `$storychain` · `$bingostart` / `$bingocard` / `$bingocall` / `$bingo` · `$quickdraw` + `$quicktap`",
		"",
		"*COMPETITIVE*",
		"• `$songguess` + `$songanswer` · `$spellingbee` + `$spellanswer`",
		"• `$team create|join|leave` · `$teambattle` + `$teamanswer` · `$bossbattle` + `$bossanswer`",
		"• `$weeklymission` · `$teamboard` · `$trophyroom`",
		"",
		"*SCORES*",
		"• `$gamescore` · `$gameboard` · `$badges` · `$seasonstats` · `$battleboard`",
		"• `$dailychallenge` gives one higher-value daily trivia challenge.",
	],
	footer: "Use `$game help` anytime. `$game stop` ends the current scored round/session if you started it or you are an admin.",
});

const showGameStatus = async ({ from, msg, sendMessageWTyping }) => {
	const round = activeRounds.get(from);
	if (!round) return sendMessageWTyping(from, { text: "🎮 No scored game is active right now." }, { quoted: msg });
	return sendMessageWTyping(from, { text: `🎮 Active: *${round.title}* · ${Math.max(0, Math.ceil((round.expires - Date.now()) / 1000))}s left.` }, { quoted: msg });
};

const stopGame = async ({ from, msg, senderJid, isGroupAdmin, isOwner, sendMessageWTyping }) => {
	const round = activeRounds.get(from);
	const startedBy = round?.startedBy;
	if (!round) return sendMessageWTyping(from, { text: "🎮 No scored game is active." }, { quoted: msg });
	if (!isGroupAdmin && !isOwner && startedBy !== senderJid) return sendMessageWTyping(from, { text: "❌ Only the game starter, a group admin or the bot owner can stop this session." }, { quoted: msg });
	clearActiveGame(from);
	return sendMessageWTyping(from, { text: "🛑 Alpha ended the active scored game session." }, { quoted: msg });
};

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { command, senderJid, updateName, sendMessageWTyping } = msgInfoObj;
	try {
		if (RACE_GAMES.includes(command) || ["dailychallenge", "dailygame"].includes(command)) {
			return startRound({ sock, from, msg, command, args, senderJid, sendMessageWTyping });
		}
		if (command === "answer") return answerRound({ sock, from, msg, answer: args.join(" ").trim(), senderJid, updateName, sendMessageWTyping });
		if (command === "rps") return playRps({ from, msg, args, senderJid, updateName, sendMessageWTyping });

		if (command === "game") {
			const action = String(args[0] || "help").toLowerCase();
			if (["help", "guide", "commands"].includes(action)) return sendMessageWTyping(from, { text: gameHelp() }, { quoted: msg });
			if (["start", "host", "random", "lobby", "joinpoll"].includes(action)) {
				if (activeRounds.has(from)) return sendMessageWTyping(from, { text: "🎮 Finish or stop the live quick-play round first." }, { quoted: msg });
				if (await restoreTruthDareSession({ sock, groupJid: from })) return sendMessageWTyping(from, { text: "🎭 Truth or Dare is active. Use `$td stop` first." }, { quoted: msg });
				const text = await startAutoGame({ sock, groupJid: from, senderJid, name: updateName, args: args.slice(1), metadata: msgInfoObj.groupMetadata });
				return sendMessageWTyping(from, { text }, { quoted: msg });
			}
			if (action === "answer") return answerRound({ sock, from, msg, answer: args.slice(1).join(" ").trim(), senderJid, updateName, sendMessageWTyping });
			if (["join", "leave", "close", "next", "resume", "liveboard"].includes(action) ||
				(["status", "stop"].includes(action) && (getAutoGameSession(from) || await restoreAutoGame({ sock, groupJid: from })))) {
				const text = await controlAutoGame({ sock, groupJid: from, senderJid, name: updateName, action, isAdmin: msgInfoObj.isGroupAdmin, isOwner: msgInfoObj.isOwner });
				if (text) return sendMessageWTyping(from, { text }, { quoted: msg });
				return;
			}
			if (["score", "myscore"].includes(action)) return showScore({ from, msg, senderJid, updateName, sendMessageWTyping });
			if (["board", "leaderboard"].includes(action)) return showLeaderboard({ from, msg, sendMessageWTyping });
			if (action === "status") return showGameStatus({ from, msg, sendMessageWTyping });
			if (action === "stop") return stopGame({ from, msg, senderJid, isGroupAdmin: msgInfoObj.isGroupAdmin, isOwner: msgInfoObj.isOwner, sendMessageWTyping });
			return sendMessageWTyping(from, { text: "🎮 Use `$game help` for the complete guide." }, { quoted: msg });
		}

		const cooldownKey = `${from}:${senderJid}:${command}`;
		const now = Date.now();
		if ((infoCooldowns.get(cooldownKey) || 0) > now) return;
		infoCooldowns.set(cooldownKey, now + 15_000);
		if (["gamescore", "myscore"].includes(command)) return showScore({ from, msg, senderJid, updateName, sendMessageWTyping });
		if (["gameboard", "gameleaderboard", "glb"].includes(command)) return showLeaderboard({ from, msg, sendMessageWTyping });
		if (["badges", "achievements", "trophies"].includes(command)) return showAchievements({ from, msg, senderJid, updateName, sendMessageWTyping });
		if (["seasonstats", "arenastats"].includes(command)) return showSeasonStats({ from, msg, sendMessageWTyping });
		return sendMessageWTyping(from, { text: gameHelp() }, { quoted: msg });
	} catch (error) {
		console.error("Game command failed:", error.message);
		return sendMessageWTyping(from, { text: "❌ The game service is temporarily unavailable." }, { quoted: msg });
	}
};

export const clearActiveGame = (groupJid) => {
	clearRoundTimer(groupJid);
	activeRounds.delete(groupJid);
	return true;
};

export default () => ({
	cmd: [
		"trivia", "mathgame", "scramble", "emojiguess", "riddle", "fasttype", "answer", "rps", "oddoneout",
		"flagguess", "truefalse", "numberguess", "dailychallenge", "dailygame", "gamescore", "myscore", "gameboard",
		"gameleaderboard", "glb", "badges", "achievements", "trophies", "seasonstats", "arenastats", "gamehelp", "game",
	],
	desc: "Automatic game hosting with poll lobby, configurable rounds, timed turns, saved scores and winners",
	usage: "game start trivia [category] [rounds=10] [lobby=2m] | game join | game close | game liveboard | game resume | game stop",
	handler,
});
