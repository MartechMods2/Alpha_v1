import { randomUUID } from "node:crypto";
import mdClient from "./client.js";

const gameTeams = mdClient.db("MyBotDataDB").collection("GameTeams");
const groupTrophies = mdClient.db("MyBotDataDB").collection("GroupTrophies");
const weeklyMissions = mdClient.db("MyBotDataDB").collection("WeeklyMissions");

const safe = (value, max = 60) => String(value || "").replace(/[^a-z0-9 _-]/gi, "").replace(/\s+/g, " ").trim().slice(0, max);
const weekKey = (date = new Date()) => {
	const first = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
	const day = Math.floor((date - first) / 86_400_000);
	return `${date.getUTCFullYear()}-W${String(Math.ceil((day + first.getUTCDay() + 1) / 7)).padStart(2, "0")}`;
};

export const createTeam = async ({ groupJid, name, creatorJid, creatorName }) => {
	const teamName = safe(name, 32);
	if (!teamName) throw new Error("Team name is required");
	if (await gameTeams.findOne({ groupJid, nameKey: teamName.toLowerCase() })) throw new Error("That team already exists");
	if (await gameTeams.findOne({ groupJid, "members.jid": creatorJid })) throw new Error("Leave your current team first");
	const team = {
		_id: randomUUID(), groupJid, name: teamName, nameKey: teamName.toLowerCase(),
		members: [{ jid: creatorJid, name: safe(creatorName, 60), joinedAt: new Date() }],
		points: 0, wins: 0, createdAt: new Date(),
	};
	await gameTeams.insertOne(team);
	return team;
};

export const joinTeam = async ({ groupJid, teamName, memberJid, memberName }) => {
	if (await gameTeams.findOne({ groupJid, "members.jid": memberJid })) throw new Error("Leave your current team first");
	const team = await gameTeams.findOne({ groupJid, nameKey: safe(teamName, 32).toLowerCase() });
	if (!team) throw new Error("Team not found");
	if ((team.members || []).length >= 20) throw new Error("That team is full");
	await gameTeams.updateOne({ _id: team._id }, { $push: { members: { jid: memberJid, name: safe(memberName, 60), joinedAt: new Date() } } });
	return team;
};

export const leaveTeam = (groupJid, memberJid) => gameTeams.updateOne({ groupJid, "members.jid": memberJid }, { $pull: { members: { jid: memberJid } } });
export const getMemberTeam = (groupJid, memberJid) => gameTeams.findOne({ groupJid, "members.jid": memberJid });
export const getGroupTeams = (groupJid) => gameTeams.find({ groupJid }).sort({ points: -1, wins: -1, createdAt: 1 }).limit(20).toArray();
export const addTeamResult = (teamId, points, won = false) => gameTeams.updateOne({ _id: teamId }, { $inc: { points: Math.max(0, Math.min(100, Number(points) || 0)), wins: won ? 1 : 0 }, $set: { updatedAt: new Date() } });

export const awardGroupTrophy = async ({ groupJid, title, winnerName, winnerJid, type }) => {
	const trophy = { _id: randomUUID(), groupJid, title: safe(title, 100), winnerName: safe(winnerName, 60), winnerJid, type: safe(type, 30), awardedAt: new Date() };
	await groupTrophies.insertOne(trophy);
	return trophy;
};
export const getGroupTrophies = (groupJid, limit = 20) => groupTrophies.find({ groupJid }).sort({ awardedAt: -1 }).limit(limit).toArray();

export const getOrCreateWeeklyMission = async ({ groupJid, memberJid, currentPlays = 0, currentPoints = 0 }) => {
	const week = weekKey();
	const id = `${groupJid}:${memberJid}:${week}`;
	let mission = await weeklyMissions.findOne({ _id: id });
	if (mission) return mission;
	const seed = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
	const variants = [
		{ metric: "plays", target: 5, label: "Play five scored games" },
		{ metric: "points", target: 40, label: "Earn 40 game points" },
		{ metric: "plays", target: 8, label: "Play eight scored games" },
	];
	const selected = variants[seed % variants.length];
	mission = {
		_id: id, groupJid, memberJid, week, ...selected,
		baselinePlays: currentPlays, baselinePoints: currentPoints,
		reward: 30, claimed: false, createdAt: new Date(),
	};
	await weeklyMissions.insertOne(mission);
	return mission;
};

export const claimWeeklyMission = async (missionId) => {
	const result = await weeklyMissions.updateOne({ _id: missionId, claimed: false }, { $set: { claimed: true, claimedAt: new Date() } });
	return result.modifiedCount === 1;
};

export { gameTeams, groupTrophies, weeklyMissions };
