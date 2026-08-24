import {
	getGameLeaderboard,
	getGameProfile,
	recordGameResult,
} from "../../../db/gameData.js";
import {
	createGameRound,
	gameCategories,
	isCorrectGameAnswer,
} from "../../../utils/gameEngine.js";
import { formatGameRank, getGameRank } from "../../../utils/gameRanks.js";

const activeRounds = new Map();
const startCooldowns = new Map();
const infoCooldowns = new Map();
const rpsCooldowns = new Map();
const ROUND_TTL_MS = 2 * 60_000;
const START_COOLDOWN_MS = 30_000;

const safeName = (value, senderJid) =>
	String(value || senderJid?.split("@")[0] || "Player")
		.replace(/[\r\n\t*_~`]/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 60);

const purgeExpired = (now = Date.now()) => {
	for (const [groupJid, round] of activeRounds) {
		if (round.expires <= now) activeRounds.delete(groupJid);
	}
	for (const cooldownMap of [startCooldowns, infoCooldowns, rpsCooldowns]) {
		for (const [key, expires] of cooldownMap) {
			if (expires <= now) cooldownMap.delete(key);
		}
	}
};

const startRound = async ({ from, msg, command, args, senderJid, sendMessageWTyping }) => {
	const now = Date.now();
	purgeExpired(now);
	const current = activeRounds.get(from);
	if (current) {
		return sendMessageWTyping(
			from,
			{ text: `🎮 A *${current.title}* round is already live. Use \`answer <your answer>\`.` },
			{ quoted: msg },
		);
	}
	if ((startCooldowns.get(from) || 0) > now) return;
	startCooldowns.set(from, now + START_COOLDOWN_MS);

	const option = String(args[0] || "").toLowerCase();
	const round = {
		...createGameRound(command, option),
		startedBy: senderJid,
		startedAt: now,
		expires: now + ROUND_TTL_MS,
		attempts: new Set(),
	};
	activeRounds.set(from, round);
	const categoryHelp = command === "trivia" ? `\nCategories: ${gameCategories.join(", ")}` : "";
	return sendMessageWTyping(
		from,
		{
			text:
				`🎮 *${round.title}* · ${round.points} points\n\n${round.prompt}\n\n` +
				`First correct \`answer <your answer>\` wins. You get one try; round closes in 2 minutes.${categoryHelp}`,
		},
		{ quoted: msg },
	);
};

const answerRound = async ({ from, msg, args, senderJid, updateName, sendMessageWTyping }) => {
	const now = Date.now();
	const round = activeRounds.get(from);
	if (!round) {
		return sendMessageWTyping(from, { text: "🎮 No scored game is active. Use `gamehelp`." }, { quoted: msg });
	}
	if (round.expires <= now) {
		activeRounds.delete(from);
		return sendMessageWTyping(
			from,
			{ text: `⌛ Round ended. The answer was *${round.answers[0]}*.` },
			{ quoted: msg },
		);
	}
	const answer = args.join(" ").trim();
	if (!answer) {
		return sendMessageWTyping(from, { text: "❌ Usage: `answer <your answer>`" }, { quoted: msg });
	}
	if (round.attempts.has(senderJid)) return;
	round.attempts.add(senderJid);
	if (!isCorrectGameAnswer(answer, round.answers)) return;

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
	return sendMessageWTyping(
		from,
		{
			text:
				`✅ *${safeName(updateName, senderJid)}* wins! The answer is *${round.answers[0]}*.\n` +
				`+${round.points} points · 🔥 ${profile.streak} streak · ${formatGameRank(profile.points)}`,
		},
		{ quoted: msg },
	);
};

const playRps = async ({ from, msg, args, senderJid, updateName, sendMessageWTyping }) => {
	const now = Date.now();
	const cooldownKey = `${from}:${senderJid}`;
	if ((rpsCooldowns.get(cooldownKey) || 0) > now) return;
	const choice = String(args[0] || "").toLowerCase();
	const choices = ["rock", "paper", "scissors"];
	if (!choices.includes(choice)) {
		return sendMessageWTyping(from, { text: "✊ Usage: `rps rock|paper|scissors`" }, { quoted: msg });
	}
	rpsCooldowns.set(cooldownKey, now + 15_000);
	const botChoice = choices[Math.floor(Math.random() * choices.length)];
	const isDraw = choice === botChoice;
	const won =
		(choice === "rock" && botChoice === "scissors") ||
		(choice === "paper" && botChoice === "rock") ||
		(choice === "scissors" && botChoice === "paper");
	const points = won ? 5 : isDraw ? 2 : 0;
	const profile = await recordGameResult({
		groupJid: from,
		memberJid: senderJid,
		name: safeName(updateName, senderJid),
		game: "rps",
		points,
		won,
		correct: won,
	});
	const outcome = won ? "You win!" : isDraw ? "Draw!" : "I win this one!";
	return sendMessageWTyping(
		from,
		{
			text:
				`✊ You: *${choice}* · Alpha: *${botChoice}*\n${outcome} ${points ? `+${points} points` : ""}\n` +
				`${formatGameRank(profile.points)} · ${profile.points} total points`,
		},
		{ quoted: msg },
	);
};

const showScore = async ({ from, msg, senderJid, updateName, sendMessageWTyping }) => {
	const profile = (await getGameProfile(from, senderJid)) || {
		name: safeName(updateName, senderJid), points: 0, plays: 0, wins: 0, correct: 0, streak: 0, bestStreak: 0,
	};
	const rank = getGameRank(profile.points);
	const progress = rank.next ? `${rank.pointsToNext} points to ${rank.next.emoji} ${rank.next.name}` : "Maximum rank reached";
	return sendMessageWTyping(
		from,
		{
			text:
				`🎮 *${safeName(profile.name, senderJid)}'s Game Card*\n\n` +
				`Rank: *${rank.emoji} ${rank.name}*\nPoints: *${profile.points || 0}*\nWins: *${profile.wins || 0}*\n` +
				`Games: *${profile.plays || 0}*\nCurrent streak: *${profile.streak || 0}*\nBest streak: *${profile.bestStreak || 0}*\n${progress}`,
		},
		{ quoted: msg },
	);
};

const showLeaderboard = async ({ from, msg, sendMessageWTyping }) => {
	const leaders = await getGameLeaderboard(from, 10);
	if (!leaders.length) {
		return sendMessageWTyping(from, { text: "🏆 No scores yet. Start with `trivia`." }, { quoted: msg });
	}
	const medals = ["🥇", "🥈", "🥉"];
	const rows = leaders.map((entry, index) =>
		`${medals[index] || `${index + 1}.`} *${safeName(entry.name, entry.memberJid)}* — ${entry.points} pts · ${formatGameRank(entry.points)}`,
	);
	return sendMessageWTyping(
		from,
		{ text: `🏆 *Group Game Leaderboard*\n\n${rows.join("\n")}` },
		{ quoted: msg },
	);
};

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { command, senderJid, updateName, sendMessageWTyping } = msgInfoObj;
	try {
		if (["trivia", "mathgame", "scramble", "emojiguess", "riddle", "fasttype"].includes(command)) {
			return startRound({ from, msg, command, args, senderJid, sendMessageWTyping });
		}
		if (command === "answer") return answerRound({ from, msg, args, senderJid, updateName, sendMessageWTyping });
		if (command === "rps") return playRps({ from, msg, args, senderJid, updateName, sendMessageWTyping });

		const cooldownKey = `${from}:${senderJid}:${command}`;
		const now = Date.now();
		if ((infoCooldowns.get(cooldownKey) || 0) > now) return;
		infoCooldowns.set(cooldownKey, now + 15_000);
		if (["gamescore", "myscore"].includes(command)) {
			return showScore({ from, msg, senderJid, updateName, sendMessageWTyping });
		}
		if (["gameboard", "gameleaderboard", "glb"].includes(command)) {
			return showLeaderboard({ from, msg, sendMessageWTyping });
		}
		return sendMessageWTyping(
			from,
			{
				text:
					"🎮 *Alpha Game Arena*\n\n" +
					"Scored: `trivia [general|science|tech|africa]`, `mathgame`, `scramble`, `emojiguess`, `riddle`, `fasttype`, `rps <choice>`\n" +
					"Play: `answer <answer>`\nStats: `gamescore`, `gameboard`\n\n" +
					"One active quiz per group, one attempt per player, and no replies to wrong answers—fun without flooding the chat.",
			},
			{ quoted: msg },
		);
	} catch (error) {
		console.error("Game command failed:", error.message);
		return sendMessageWTyping(from, { text: "❌ The game service is temporarily unavailable." }, { quoted: msg });
	}
};

export const clearActiveGame = (groupJid) => activeRounds.delete(groupJid);

export default () => ({
	cmd: [
		"trivia", "mathgame", "scramble", "emojiguess", "riddle", "fasttype", "answer", "rps",
		"gamescore", "myscore", "gameboard", "gameleaderboard", "glb", "gamehelp",
	],
	desc: "Persistent scored group games, streaks, ranks and leaderboard",
	usage: "gamehelp | trivia [category] | answer <answer> | gamescore | gameboard",
	handler,
});
