import googleTTS from "google-tts-api";
import axios from "axios";
import {
	addTeamResult,
	awardGroupTrophy,
	claimWeeklyMission,
	createTeam,
	getGroupTeams,
	getGroupTrophies,
	getMemberTeam,
	getOrCreateWeeklyMission,
	joinTeam,
	leaveTeam,
} from "../../../db/competitionData.js";
import { getGameProfile, recordGameResult } from "../../../db/gameData.js";

const activeGames = new Map();
const cooldowns = new Map();
const TTL = 3 * 60_000;

const questions = [
	{ prompt: "What planet is known as the Red Planet?", answer: "mars" },
	{ prompt: "What is 12 × 8?", answer: "96" },
	{ prompt: "Which ocean is the largest?", answer: "pacific" },
	{ prompt: "What is the capital of Nigeria?", answer: "abuja" },
	{ prompt: "How many sides does a hexagon have?", answer: "6" },
];

const songClues = [
	{ prompt: "Afrobeats hit by Rema whose title is also a request to relax.", answers: ["calm down"] },
	{ prompt: "Burna Boy song whose title means being the final and best option.", answers: ["last last"] },
	{ prompt: "Davido song named after an assurance or promise.", answers: ["assurance"] },
	{ prompt: "Tems song with a title about being free from harm.", answers: ["free mind"] },
	{ prompt: "Wizkid song featuring Tems with a title about a vital life substance.", answers: ["essence"] },
];

const spellingWords = [
	{ word: "necessary", clue: "needed or required" },
	{ word: "rhythm", clue: "a repeated pattern of sound" },
	{ word: "beautiful", clue: "pleasing to the senses" },
	{ word: "accommodation", clue: "a place to stay" },
	{ word: "privilege", clue: "a special right or advantage" },
];

const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const random = (items) => items[Math.floor(Math.random() * items.length)];
const safeName = (value, jid) => String(value || jid?.split("@")[0] || "Player").replace(/[\r\n*_~`]/g, " ").trim().slice(0, 60);

const allow = (key, ms = 10_000) => {
	const now = Date.now();
	if ((cooldowns.get(key) || 0) > now) return false;
	cooldowns.set(key, now + ms);
	return true;
};

const startSongGuess = async ({ msg, from, senderJid, sendMessageWTyping }) => {
	const game = random(songClues);
	activeGames.set(from, { type: "songguess", ...game, expires: Date.now() + TTL, attempts: new Set() });
	return sendMessageWTyping(from, { text: `🎵 *Song Guess* · 15 points\n\n${game.prompt}\n\nAnswer with \`songanswer <title>\`.` }, { quoted: msg });
};

const startSpellingBee = async ({ msg, from, sendMessageWTyping }) => {
	const item = random(spellingWords);
	activeGames.set(from, { type: "spellingbee", answer: item.word, expires: Date.now() + TTL, attempts: new Set() });
	try {
		const url = await googleTTS(item.word, "en", 1);
		const response = await axios.get(url, { responseType: "arraybuffer", timeout: 10_000, maxContentLength: 2 * 1024 * 1024 });
		await sendMessageWTyping(from, { audio: Buffer.from(response.data), mimetype: "audio/mpeg", ptt: true }, { quoted: msg });
	} catch {}
	return sendMessageWTyping(from, { text: `🐝 *Spelling Bee* · 15 points\nMeaning: *${item.clue}*\n\nListen carefully and answer with \`spellanswer <word>\`.` }, { quoted: msg });
};

const answerSolo = async ({ msg, from, args, command, senderJid, updateName, sendMessageWTyping }) => {
	const game = activeGames.get(from);
	const expectedType = command === "songanswer" ? "songguess" : "spellingbee";
	if (!game || game.type !== expectedType || game.expires <= Date.now()) {
		activeGames.delete(from);
		return sendMessageWTyping(from, { text: "❌ That round is no longer active." }, { quoted: msg });
	}
	if (game.attempts.has(senderJid)) return;
	game.attempts.add(senderJid);
	const answers = game.answers || [game.answer];
	if (!answers.some((answer) => normalize(answer) === normalize(args.join(" ")))) return;
	activeGames.delete(from);
	await recordGameResult({ groupJid: from, memberJid: senderJid, name: safeName(updateName, senderJid), game: game.type, points: 15, won: true, correct: true });
	return sendMessageWTyping(from, { text: `✅ *${safeName(updateName, senderJid)}* wins! The answer was *${answers[0]}*. +15 points.` }, { quoted: msg });
};

const handleTeam = async ({ msg, from, args, senderJid, updateName, sendMessageWTyping }) => {
	const action = String(args[0] || "list").toLowerCase();
	if (action === "create") {
		const team = await createTeam({ groupJid: from, name: args.slice(1).join(" "), creatorJid: senderJid, creatorName: updateName });
		return sendMessageWTyping(from, { text: `✅ Team *${team.name}* created.` }, { quoted: msg });
	}
	if (action === "join") {
		const team = await joinTeam({ groupJid: from, teamName: args.slice(1).join(" "), memberJid: senderJid, memberName: updateName });
		return sendMessageWTyping(from, { text: `✅ You joined *${team.name}*.` }, { quoted: msg });
	}
	if (action === "leave") {
		await leaveTeam(from, senderJid);
		return sendMessageWTyping(from, { text: "✅ You left your game team." }, { quoted: msg });
	}
	const teams = await getGroupTeams(from);
	return sendMessageWTyping(from, { text: teams.length ? `🛡️ *Group Teams*\n\n${teams.map((team, index) => `${index + 1}. *${team.name}* — ${team.members.length} members · ${team.points} pts`).join("\n")}` : "🛡️ No teams yet. Use `team create <name>`." }, { quoted: msg });
};

const startTeamBattle = async ({ msg, from, senderJid, sendMessageWTyping }) => {
	const team = await getMemberTeam(from, senderJid);
	if (!team) return sendMessageWTyping(from, { text: "❌ Join a team first with `team join <name>`." }, { quoted: msg });
	const question = random(questions);
	activeGames.set(from, { type: "teambattle", ...question, expires: Date.now() + TTL, attempts: new Set() });
	return sendMessageWTyping(from, { text: `⚔️ *Team Battle* · 25 team points\n\n${question.prompt}\n\nTeam members answer with \`teamanswer <answer>\`.` }, { quoted: msg });
};

const answerTeamBattle = async ({ msg, from, args, senderJid, updateName, sendMessageWTyping }) => {
	const game = activeGames.get(from);
	if (!game || game.type !== "teambattle" || game.expires <= Date.now()) return sendMessageWTyping(from, { text: "❌ No team battle is active." }, { quoted: msg });
	const team = await getMemberTeam(from, senderJid);
	if (!team || game.attempts.has(senderJid)) return;
	game.attempts.add(senderJid);
	if (normalize(args.join(" ")) !== normalize(game.answer)) return;
	activeGames.delete(from);
	await Promise.all([
		addTeamResult(team._id, 25, true),
		recordGameResult({ groupJid: from, memberJid: senderJid, name: updateName, game: "teambattle", points: 15, won: true, correct: true }),
		awardGroupTrophy({ groupJid: from, title: "Team Battle Winner", winnerName: team.name, winnerJid: team._id, type: "teambattle" }),
	]);
	return sendMessageWTyping(from, { text: `🏆 *${team.name}* wins! ${safeName(updateName, senderJid)} answered *${game.answer}*. +25 team points.` }, { quoted: msg });
};

const startBoss = async ({ msg, from, sendMessageWTyping }) => {
	const question = random(questions);
	activeGames.set(from, { type: "bossbattle", health: 3, question, used: new Set(), expires: Date.now() + 10 * 60_000 });
	return sendMessageWTyping(from, { text: `👾 *ALPHA BOSS BATTLE*\nBoss health: ❤️❤️❤️\n\n${question.prompt}\n\nAnswer with \`bossanswer <answer>\`. Each member can land one hit per question.` }, { quoted: msg });
};

const answerBoss = async ({ msg, from, args, senderJid, updateName, sendMessageWTyping }) => {
	const game = activeGames.get(from);
	if (!game || game.type !== "bossbattle" || game.expires <= Date.now()) return sendMessageWTyping(from, { text: "❌ No boss battle is active." }, { quoted: msg });
	if (game.used.has(senderJid)) return;
	game.used.add(senderJid);
	if (normalize(args.join(" ")) !== normalize(game.question.answer)) return;
	game.health -= 1;
	await recordGameResult({ groupJid: from, memberJid: senderJid, name: updateName, game: "bossbattle", points: 10, won: game.health === 0, correct: true });
	if (game.health <= 0) {
		activeGames.delete(from);
		await awardGroupTrophy({ groupJid: from, title: "Boss Defeated", winnerName: "The Group", winnerJid: from, type: "bossbattle" });
		return sendMessageWTyping(from, { text: `💥 *BOSS DEFEATED!* ${safeName(updateName, senderJid)} landed the final hit. The group earned a trophy.` }, { quoted: msg });
	}
	game.question = random(questions.filter((question) => question.answer !== game.question.answer));
	game.used = new Set();
	return sendMessageWTyping(from, { text: `⚔️ Direct hit by *${safeName(updateName, senderJid)}*!\nBoss health: ${"❤️".repeat(game.health)}\n\n${game.question.prompt}` }, { quoted: msg });
};

const showWeeklyMission = async ({ msg, from, senderJid, updateName, sendMessageWTyping }) => {
	const profile = await getGameProfile(from, senderJid) || { plays: 0, points: 0 };
	const mission = await getOrCreateWeeklyMission({ groupJid: from, memberJid: senderJid, currentPlays: profile.plays || 0, currentPoints: profile.points || 0 });
	const progress = mission.metric === "plays" ? (profile.plays || 0) - mission.baselinePlays : (profile.points || 0) - mission.baselinePoints;
	if (!mission.claimed && progress >= mission.target && await claimWeeklyMission(mission._id)) {
		await recordGameResult({ groupJid: from, memberJid: senderJid, name: updateName, game: "weeklymission", points: mission.reward, won: true, correct: true });
		return sendMessageWTyping(from, { text: `🎯 Weekly mission complete! *${mission.reward} points* awarded.` }, { quoted: msg });
	}
	return sendMessageWTyping(from, { text: `🎯 *Weekly Mission*\n${mission.label}\nProgress: *${Math.max(0, progress)}/${mission.target}*\nReward: *${mission.reward} points*${mission.claimed ? "\n✅ Claimed" : ""}` }, { quoted: msg });
};

const showTrophies = async ({ msg, from, sendMessageWTyping }) => {
	const trophies = await getGroupTrophies(from);
	return sendMessageWTyping(from, { text: trophies.length ? `🏛️ *Group Trophy Room*\n\n${trophies.map((trophy) => `🏆 *${trophy.title}* — ${trophy.winnerName}`).join("\n")}` : "🏛️ The trophy room is empty. Win a team or boss battle." }, { quoted: msg });
};

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const context = { sock, msg, from, args, ...msgInfoObj };
	const key = `${from}:${msgInfoObj.senderJid}:${msgInfoObj.command}`;
	if (!allow(key)) return;
	try {
		if (["songguess", "spellingbee", "teambattle", "bossbattle"].includes(msgInfoObj.command)) {
			const active = activeGames.get(from);
			if (active?.expires > Date.now()) {
				return msgInfoObj.sendMessageWTyping(
					from,
					{ text: `🎮 A *${active.type}* round is already active. Finish it before starting another.` },
					{ quoted: msg },
				);
			}
			if (active) activeGames.delete(from);
		}
		switch (msgInfoObj.command) {
			case "songguess": return startSongGuess(context);
			case "songanswer": return answerSolo(context);
			case "spellingbee": return startSpellingBee(context);
			case "spellanswer": return answerSolo(context);
			case "team": return handleTeam(context);
			case "teambattle": return startTeamBattle(context);
			case "teamanswer": return answerTeamBattle(context);
			case "bossbattle": return startBoss(context);
			case "bossanswer": return answerBoss(context);
			case "weeklymission": return showWeeklyMission(context);
			case "teamboard": return handleTeam({ ...context, args: ["list"] });
			case "trophyroom": return showTrophies(context);
		}
	} catch (error) {
		console.error("Competitive Plus failed:", error.message);
		return msgInfoObj.sendMessageWTyping(from, { text: `❌ ${error.message}` }, { quoted: msg });
	}
};

export default () => ({
	cmd: [
		"songguess", "songanswer", "spellingbee", "spellanswer", "team", "teambattle", "teamanswer",
		"bossbattle", "bossanswer", "weeklymission", "teamboard", "trophyroom",
	],
	desc: "Competitive songs, spelling, team leagues, cooperative bosses and weekly missions",
	usage: "team create|join|leave | teambattle | bossbattle | weeklymission",
	handler,
});
