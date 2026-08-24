import { getBattleLeaderboard, recordGameResult } from "../../../db/gameData.js";
import { createGameRound, isCorrectGameAnswer } from "../../../utils/gameEngine.js";
import { formatGameRank } from "../../../utils/gameRanks.js";
import { isSameGroupUser } from "../../../utils/groupParticipants.js";

const battles = new Map();
const cooldowns = new Map();
const PENDING_MS = 2 * 60_000;
const ACTIVE_MS = 2 * 60_000;

const safeName = (value, jid) =>
	String(value || jid?.split("@")[0] || "Player")
		.replace(/[\r\n\t*_~`]/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 60);

const purge = (now = Date.now()) => {
	for (const [groupJid, battle] of battles) if (battle.expires <= now) battles.delete(groupJid);
	for (const [groupJid, expires] of cooldowns) if (expires <= now) cooldowns.delete(groupJid);
};

const sameUser = (metadata, left, right) => isSameGroupUser(metadata, left, [right]);

const startBattle = async ({ msg, from, senderJid, updateName, extendedMessageOriginal, groupMetadata, botJids, sendMessageWTyping }) => {
	const now = Date.now();
	purge(now);
	if (battles.has(from)) {
		return sendMessageWTyping(from, { text: "⚔️ A quiz battle is already pending or active." }, { quoted: msg });
	}
	if ((cooldowns.get(from) || 0) > now) return;
	const target = extendedMessageOriginal?.mentionedJid?.[0] || extendedMessageOriginal?.participant;
	if (!target) {
		return sendMessageWTyping(from, { text: "⚔️ Tag or reply to someone: `battle @member`." }, { quoted: msg });
	}
	if (sameUser(groupMetadata, senderJid, target)) {
		return sendMessageWTyping(from, { text: "⚔️ You cannot battle yourself." }, { quoted: msg });
	}
	if (isSameGroupUser(groupMetadata, target, botJids || [])) {
		return sendMessageWTyping(from, { text: "⚔️ Challenge another member—the bot hosts the duel." }, { quoted: msg });
	}
	battles.set(from, {
		state: "pending",
		challengerJid: senderJid,
		challengerName: safeName(updateName, senderJid),
		targetMention: target,
		expires: now + PENDING_MS,
	});
	cooldowns.set(from, now + 45_000);
	return sendMessageWTyping(
		from,
		{
			text: `⚔️ @${target.split("@")[0]}, *${safeName(updateName, senderJid)}* challenges you to a 20-point quiz duel!\nUse \`acceptbattle\` or \`declinebattle\` within 2 minutes.`,
			mentions: [target],
		},
		{ quoted: msg },
	);
};

const acceptBattle = async ({ msg, from, senderJid, updateName, groupMetadata, sendMessageWTyping }) => {
	const battle = battles.get(from);
	if (!battle || battle.expires <= Date.now()) {
		battles.delete(from);
		return sendMessageWTyping(from, { text: "⚔️ No live battle invitation." }, { quoted: msg });
	}
	if (battle.state !== "pending" || !sameUser(groupMetadata, senderJid, battle.targetMention)) return;
	const modes = ["trivia", "mathgame", "oddoneout", "flagguess", "truefalse"];
	const mode = modes[Math.floor(Math.random() * modes.length)];
	const round = createGameRound(mode);
	Object.assign(battle, {
		state: "active",
		targetJid: senderJid,
		targetName: safeName(updateName, senderJid),
		round,
		attempts: new Set(),
		expires: Date.now() + ACTIVE_MS,
	});
	return sendMessageWTyping(
		from,
		{
			text:
				`⚔️ *BATTLE ON:* ${battle.challengerName} vs ${battle.targetName}\n\n` +
				`*${round.title}*\n${round.prompt}\n\nOnly the two players may use \`battleanswer <answer>\`. First correct answer wins 20 points.`,
			mentions: [battle.challengerJid, battle.targetJid],
		},
		{ quoted: msg },
	);
};

const declineBattle = async ({ msg, from, senderJid, groupMetadata, sendMessageWTyping }) => {
	const battle = battles.get(from);
	if (!battle || battle.state !== "pending" || !sameUser(groupMetadata, senderJid, battle.targetMention)) return;
	battles.delete(from);
	return sendMessageWTyping(from, { text: "⚔️ Battle declined." }, { quoted: msg });
};

const answerBattle = async ({ msg, from, args, senderJid, updateName, groupMetadata, sendMessageWTyping }) => {
	const battle = battles.get(from);
	if (!battle || battle.state !== "active" || battle.expires <= Date.now()) {
		battles.delete(from);
		return sendMessageWTyping(from, { text: "⚔️ No active quiz battle." }, { quoted: msg });
	}
	const isChallenger = sameUser(groupMetadata, senderJid, battle.challengerJid);
	const isTarget = sameUser(groupMetadata, senderJid, battle.targetJid);
	if (!isChallenger && !isTarget) return;
	if (battle.attempts.has(senderJid)) return;
	const answer = args.join(" ").trim();
	if (!answer) {
		return sendMessageWTyping(from, { text: "⚔️ Usage: `battleanswer <answer>`." }, { quoted: msg });
	}
	battle.attempts.add(senderJid);
	if (!isCorrectGameAnswer(answer, battle.round.answers)) return;

	battles.delete(from);
	const winner = {
		jid: senderJid,
		name: safeName(updateName, senderJid),
	};
	const loser = isChallenger
		? { jid: battle.targetJid, name: battle.targetName }
		: { jid: battle.challengerJid, name: battle.challengerName };
	const [winnerProfile] = await Promise.all([
		recordGameResult({ groupJid: from, memberJid: winner.jid, name: winner.name, game: "battle", points: 20, won: true, correct: true }),
		recordGameResult({ groupJid: from, memberJid: loser.jid, name: loser.name, game: "battle", points: 0, won: false, correct: false }),
	]);
	return sendMessageWTyping(
		from,
		{
			text:
				`⚔️ *${winner.name} wins the duel!*\nAnswer: *${battle.round.answers[0]}*\n` +
				`+20 points · ${formatGameRank(winnerProfile.points)} · ${winnerProfile.gameWins?.battle || 1} battle wins`,
			mentions: [winner.jid, loser.jid],
		},
		{ quoted: msg },
	);
};

const cancelBattle = async ({ msg, from, senderJid, groupMetadata, isGroupAdmin, isOwner, sendMessageWTyping }) => {
	const battle = battles.get(from);
	if (!battle) return;
	const involved =
		sameUser(groupMetadata, senderJid, battle.challengerJid) ||
		sameUser(groupMetadata, senderJid, battle.targetJid || battle.targetMention);
	if (!involved && !isGroupAdmin && !isOwner) return;
	battles.delete(from);
	return sendMessageWTyping(from, { text: "⚔️ Battle cancelled." }, { quoted: msg });
};

const battleBoard = async ({ msg, from, sendMessageWTyping }) => {
	const leaders = await getBattleLeaderboard(from, 10);
	if (!leaders.length) {
		return sendMessageWTyping(from, { text: "⚔️ No duel wins yet. Start with `battle @member`." }, { quoted: msg });
	}
	const medals = ["🥇", "🥈", "🥉"];
	const rows = leaders.map((entry, index) =>
		`${medals[index] || `${index + 1}.`} *${safeName(entry.name, entry.memberJid)}* — ${entry.gameWins?.battle || 0} wins`,
	);
	return sendMessageWTyping(from, { text: `⚔️ *Quiz Duel Rankings*\n\n${rows.join("\n")}` }, { quoted: msg });
};

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const context = { msg, from, args, ...msgInfoObj };
	try {
		switch (msgInfoObj.command) {
			case "battle": return startBattle(context);
			case "acceptbattle": return acceptBattle(context);
			case "declinebattle": return declineBattle(context);
			case "battleanswer": return answerBattle(context);
			case "battlecancel": return cancelBattle(context);
			case "battleboard": return battleBoard(context);
			default: return;
		}
	} catch (error) {
		console.error("Quiz battle failed:", error.message);
		return msgInfoObj.sendMessageWTyping(from, { text: "❌ The battle arena is temporarily unavailable." }, { quoted: msg });
	}
};

export const clearGroupBattle = (groupJid) => battles.delete(groupJid);

export default () => ({
	cmd: ["battle", "acceptbattle", "declinebattle", "battleanswer", "battlecancel", "battleboard"],
	desc: "Challenge a group member to a scored 20-point quiz duel",
	usage: "battle @member | acceptbattle | battleanswer <answer> | battleboard",
	handler,
});
