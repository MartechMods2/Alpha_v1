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
import { finishInteractivePoll, readInteractivePoll, registerInteractivePoll } from "../../../utils/pollManager.js";
import messageQueue from "../../../queue/messageQueue.js";

const activeRounds = new Map();
const turnSessions = new Map();
const roundTimers = new Map();
const startCooldowns = new Map();
const infoCooldowns = new Map();
const rpsCooldowns = new Map();
const recentPrompts = new Map();
const ROUND_TTL_MS = 60_000;
const START_COOLDOWN_MS = 20_000;
const LOBBY_TTL_MS = 60_000;
const JOIN_OPTION = "✅ Join game";
const SKIP_OPTION = "⏭️ Sit this one out";
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

const finishTurnSession = async (sock, groupJid) => {
	const session = turnSessions.get(groupJid);
	if (!session) return;
	turnSessions.delete(groupJid);
	activeRounds.delete(groupJid);
	clearRoundTimer(groupJid);
	const rows = session.participants.map((jid) => ({ jid, points: session.scores.get(jid) || 0 }));
	rows.sort((a, b) => b.points - a.points);
	const winner = rows[0];
	const scoreRows = rows.map((row, index) => `${index + 1}. @${String(row.jid).split("@")[0]} — *${row.points} pts*`);
	await sendQueued(sock, groupJid, {
		text: alphaPanel({
			icon: "🏁",
			title: "Game Session Complete",
			lines: [
				...(winner ? [`Winner: 🏆 @${String(winner.jid).split("@")[0]} with *${winner.points} points*`] : []),
				"",
				...scoreRows,
			],
			footer: "Permanent scores were added to the Alpha leaderboard.",
		}),
		mentions: rows.map((row) => row.jid),
	});
};

const scheduleRoundTimeout = (sock, groupJid, roundId) => {
	clearRoundTimer(groupJid);
	const timer = setTimeout(async () => {
		const round = activeRounds.get(groupJid);
		if (!round || round.id !== roundId) return;
		activeRounds.delete(groupJid);
		roundTimers.delete(groupJid);

		if (round.mode === "turn" && round.currentPlayer) {
			await recordGameResult({
				groupJid,
				memberJid: round.currentPlayer,
				name: jidName(round.currentPlayer),
				game: round.game,
				points: 0,
				won: false,
				correct: false,
			}).catch(() => {});
			await sendQueued(sock, groupJid, {
				text: `⌛ @${String(round.currentPlayer).split("@")[0]}'s 60 seconds are up. No points.\nAnswer: *${round.answers[0]}*`,
				mentions: [round.currentPlayer],
			});
			const session = turnSessions.get(groupJid);
			if (session) {
				session.index += 1;
				await startNextTurn(sock, groupJid);
			}
			return;
		}

		await sendQueued(sock, groupJid, {
			text: `⌛ *Time!* Nobody got it in 60 seconds.\nAnswer: *${round.answers[0]}*`,
		});
	}, ROUND_TTL_MS);
	timer.unref?.();
	roundTimers.set(groupJid, timer);
};

async function startNextTurn(sock, groupJid) {
	const session = turnSessions.get(groupJid);
	if (!session) return;
	if (session.index >= session.participants.length) return finishTurnSession(sock, groupJid);
	const currentPlayer = session.participants[session.index];
	let roundData;
	try {
		roundData = createFreshRound(groupJid, session.game, session.option);
	} catch {
		turnSessions.delete(groupJid);
		return sendQueued(sock, groupJid, { text: "❌ That game type is not available for random turns." });
	}
	const now = Date.now();
	const round = {
		...roundData,
		id: `${now}:${Math.random()}`,
		mode: "turn",
		currentPlayer,
		startedBy: session.startedBy,
		startedAt: now,
		expires: now + ROUND_TTL_MS,
		attempts: new Set(),
	};
	activeRounds.set(groupJid, round);
	await sendQueued(sock, groupJid, {
		text: alphaPanel({
			icon: "🎯",
			title: `${round.title} · Turn ${session.index + 1}/${session.participants.length}`,
			lines: [
				`Player: @${String(currentPlayer).split("@")[0]}`,
				`Question: *${round.prompt}*`,
				`Points: *${round.points}*`,
				"Answer with *#your answer*.",
			],
			footer: "60 seconds. Answers are case-insensitive.",
		}),
		mentions: [currentPlayer],
	});
	scheduleRoundTimeout(sock, groupJid, round.id);
}

const startParticipationLobby = async ({ sock, from, msg, args, senderJid, sendMessageWTyping }) => {
	if (activeRounds.has(from) || turnSessions.has(from)) {
		return sendMessageWTyping(from, { text: "🎮 A game is already active in this group." }, { quoted: msg });
	}
	const requested = String(args[0] || "trivia").toLowerCase();
	const game = RACE_GAMES.includes(requested) ? requested : "trivia";
	const option = game === "trivia" ? String(args[1] || "general").toLowerCase() : "";
	const poll = await sock.sendMessage(from, {
		poll: {
			name: `🎮 Alpha Game Lobby · ${game}\nVote to join. Only voters who choose JOIN can be selected. Closes in 60 seconds.`,
			values: [JOIN_OPTION, SKIP_OPTION],
			selectableCount: 1,
		},
	}, { quoted: msg });
	await registerInteractivePoll({
		sentMessage: poll,
		groupJid: from,
		type: "game-lobby",
		ownerJid: senderJid,
		options: [JOIN_OPTION, SKIP_OPTION],
		payload: { game, option },
		ttlMs: LOBBY_TTL_MS + 15_000,
	});
	await sendMessageWTyping(from, {
		text: "🗳️ *Lobby open for 60 seconds.* Alpha will build the turn list only from members who vote *Join game*. Non-voters cannot be randomly appointed.",
	}, { quoted: msg });

	const timer = setTimeout(async () => {
		try {
			const session = await readInteractivePoll(poll.key.id);
			await finishInteractivePoll(poll.key.id, { result: "lobby-closed" });
			const voters = [...new Set((session?.votes || []).filter((vote) => vote.option === JOIN_OPTION).map((vote) => vote.voterJid).filter(Boolean))];
			if (!voters.length) {
				return sendQueued(sock, from, { text: "🗳️ Lobby closed. Nobody joined, so no member was appointed." });
			}
			for (let i = voters.length - 1; i > 0; i -= 1) {
				const j = Math.floor(Math.random() * (i + 1));
				[voters[i], voters[j]] = [voters[j], voters[i]];
			}
			turnSessions.set(from, {
				participants: voters,
				index: 0,
				scores: new Map(voters.map((jid) => [jid, 0])),
				game,
				option,
				startedBy: senderJid,
			});
			await sendQueued(sock, from, {
				text: `🎮 *Lobby closed:* ${voters.length} player${voters.length === 1 ? "" : "s"} joined. Alpha shuffled only those voters and will give each one a 60-second turn.`,
			});
			await startNextTurn(sock, from);
		} catch (error) {
			console.error("Game lobby close failed:", error.message);
			await sendQueued(sock, from, { text: "❌ The game lobby could not be completed." });
		}
	}, LOBBY_TTL_MS);
	timer.unref?.();
};

const startRound = async ({ sock, from, msg, command, args, senderJid, sendMessageWTyping }) => {
	const now = Date.now();
	purgeCooldowns(now);
	if (activeRounds.has(from) || turnSessions.has(from)) {
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
	if (round.mode === "turn" && round.currentPlayer !== senderJid) return passive;
	if (round.attempts.has(senderJid)) return passive;
	round.attempts.add(senderJid);
	const correct = isCorrectGameAnswer(answer, round.answers);

	if (!correct) {
		if (round.mode !== "turn") return true;
		clearRoundTimer(from);
		activeRounds.delete(from);
		await recordGameResult({
			groupJid: from,
			memberJid: senderJid,
			name: safeName(updateName, senderJid),
			game: round.game,
			points: 0,
			won: false,
			correct: false,
		});
		await sendMessageWTyping(from, {
			text: `❌ @${String(senderJid).split("@")[0]} — not this time. *0 points.*\nAnswer: *${round.answers[0]}*`,
			mentions: [senderJid],
		}, { quoted: msg });
		const session = turnSessions.get(from);
		if (session) {
			session.index += 1;
			await startNextTurn(sock, from);
		}
		return true;
	}

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

	if (round.mode === "turn") {
		const session = turnSessions.get(from);
		if (session) {
			session.scores.set(senderJid, (session.scores.get(senderJid) || 0) + round.points);
			session.index += 1;
			await startNextTurn(sock, from);
		}
	}
	return true;
};

export const handlePassiveScoredGameAnswer = async ({ sock, msg, from, answer, senderJid, updateName }) => {
	if (!activeRounds.has(from)) return false;
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
		"*RANDOM-TURN LOBBY*",
		"• `$game random trivia [category]` — Alpha posts a 60-second poll.",
		"• Only members who vote *Join game* enter the draw. Non-voters are never appointed.",
		"• Alpha shuffles voters, gives each a 60-second turn, records 0 on timeout/wrong answer, and awards correct points automatically.",
		"",
		"*SOCIAL GAMES*",
		"• `$truth` · `$dare` · `$wyr` · `$icebreaker` — fresh AI-assisted prompts with safe local fallback.",
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
	const session = turnSessions.get(from);
	if (!round && !session) return sendMessageWTyping(from, { text: "🎮 No scored game is active right now." }, { quoted: msg });
	if (session) return sendMessageWTyping(from, { text: `🎮 Random-turn session: *${session.game}* · turn ${Math.min(session.index + 1, session.participants.length)}/${session.participants.length}.` }, { quoted: msg });
	return sendMessageWTyping(from, { text: `🎮 Active: *${round.title}* · ${Math.max(0, Math.ceil((round.expires - Date.now()) / 1000))}s left.` }, { quoted: msg });
};

const stopGame = async ({ from, msg, senderJid, isGroupAdmin, isOwner, sendMessageWTyping }) => {
	const round = activeRounds.get(from);
	const session = turnSessions.get(from);
	const startedBy = session?.startedBy || round?.startedBy;
	if (!round && !session) return sendMessageWTyping(from, { text: "🎮 No scored game is active." }, { quoted: msg });
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
			if (["random", "lobby", "joinpoll"].includes(action)) return startParticipationLobby({ sock, from, msg, args: args.slice(1), senderJid, sendMessageWTyping });
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
	turnSessions.delete(groupJid);
	return true;
};

export default () => ({
	cmd: [
		"trivia", "mathgame", "scramble", "emojiguess", "riddle", "fasttype", "answer", "rps", "oddoneout",
		"flagguess", "truefalse", "numberguess", "dailychallenge", "dailygame", "gamescore", "myscore", "gameboard",
		"gameleaderboard", "glb", "badges", "achievements", "trophies", "seasonstats", "arenastats", "gamehelp", "game",
	],
	desc: "Scored Alpha game arena with 60-second #answers, automatic scoring and voter-only random turns",
	usage: "game help | game random trivia [category] | trivia [category] | #answer | gamescore | gameboard",
	handler,
});
