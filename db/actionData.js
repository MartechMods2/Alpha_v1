import mdClient from "./client.js";

const actionGroups = mdClient.db("MyBotDataDB").collection("ActionGroups");
const actionStats = mdClient.db("MyBotDataDB").collection("ActionStats");

export const DEFAULT_ACTION_SETTINGS = Object.freeze({
	mode: "all",
	cooldownSeconds: 15,
	optedOutMembers: [],
});

const cleanAction = (value) => String(value || "action").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30) || "action";

export const getActionSettings = async (groupJid) => {
	const data = await actionGroups.findOne({ _id: groupJid });
	return {
		...DEFAULT_ACTION_SETTINGS,
		...(data || {}),
		optedOutMembers: Array.isArray(data?.optedOutMembers) ? data.optedOutMembers : [],
	};
};

export const setActionMode = async (groupJid, mode) => {
	const normalized = ["all", "friendly", "off"].includes(mode) ? mode : "all";
	await actionGroups.updateOne(
		{ _id: groupJid },
		{ $set: { mode: normalized, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date(), cooldownSeconds: 15, optedOutMembers: [] } },
		{ upsert: true },
	);
	return normalized;
};

export const setActionCooldown = async (groupJid, seconds) => {
	const normalized = Math.min(120, Math.max(5, Number.parseInt(seconds, 10) || 15));
	await actionGroups.updateOne(
		{ _id: groupJid },
		{ $set: { cooldownSeconds: normalized, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date(), mode: "all", optedOutMembers: [] } },
		{ upsert: true },
	);
	return normalized;
};

export const setActionOptOut = async (groupJid, memberJid, optedOut) =>
	actionGroups.updateOne(
		{ _id: groupJid },
		{
			[optedOut ? "$addToSet" : "$pull"]: { optedOutMembers: memberJid },
			$set: { updatedAt: new Date() },
			$setOnInsert: { createdAt: new Date(), mode: "all", cooldownSeconds: 15 },
		},
		{ upsert: true },
	);

export const recordAction = async ({ groupJid, actorJid, actorName, targetJid, targetName, action }) => {
	const actionName = cleanAction(action);
	const now = new Date();
	await Promise.all([
		actionStats.updateOne(
			{ groupJid, memberJid: actorJid },
			{
				$inc: { sent: 1, [`sentActions.${actionName}`]: 1 },
				$set: { memberName: actorName, lastActionAt: now },
				$setOnInsert: { createdAt: now },
			},
			{ upsert: true },
		),
		actionStats.updateOne(
			{ groupJid, memberJid: targetJid },
			{
				$inc: { received: 1, [`receivedActions.${actionName}`]: 1 },
				$set: { memberName: targetName, lastActionAt: now },
				$setOnInsert: { createdAt: now },
			},
			{ upsert: true },
		),
	]);
};

export const getActionStats = (groupJid, memberJid) =>
	actionStats.findOne({ groupJid, memberJid });

export const getActionLeaderboard = (groupJid, limit = 10) =>
	actionStats.find({ groupJid }).sort({ sent: -1, received: -1 }).limit(Math.min(20, Math.max(1, limit))).toArray();

export const resetActionStats = (groupJid, memberJid = null) =>
	memberJid
		? actionStats.deleteOne({ groupJid, memberJid })
		: actionStats.deleteMany({ groupJid });

export { actionGroups, actionStats };
