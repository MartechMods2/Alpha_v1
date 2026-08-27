import { randomUUID } from "node:crypto";
import mdClient from "./client.js";

const database = mdClient.db("MyBotDataDB");
export const enhancementItems = database.collection("EnhancementItems");
export const enhancementProfiles = database.collection("EnhancementProfiles");
export const enhancementSettings = database.collection("EnhancementSettings");

export const createEnhancementItem = async ({
	groupJid,
	type,
	memberJid,
	memberName,
	text = "",
	payload = {},
	status = "active",
}) => {
	const item = {
		_id: randomUUID(),
		groupJid,
		type,
		memberJid,
		memberName,
		text,
		payload,
		status,
		createdAt: new Date(),
		updatedAt: new Date(),
	};
	await enhancementItems.insertOne(item);
	return item;
};

export const listEnhancementItems = (groupJid, type, filter = {}, limit = 50) =>
	enhancementItems
		.find({ groupJid, type, ...filter })
		.sort({ createdAt: -1 })
		.limit(Math.min(Math.max(Number(limit) || 50, 1), 100))
		.toArray();

export const getEnhancementItem = (groupJid, type, id) =>
	enhancementItems.findOne({ groupJid, type, _id: id });

export const updateEnhancementItem = async (groupJid, type, id, fields) => {
	const safeFields = Object.fromEntries(
		Object.entries(fields || {}).filter(([key]) => !key.startsWith("$") && !["_id", "groupJid", "type"].includes(key)),
	);
	await enhancementItems.updateOne(
		{ groupJid, type, _id: id },
		{ $set: { ...safeFields, updatedAt: new Date() } },
	);
	return getEnhancementItem(groupJid, type, id);
};

export const removeEnhancementItem = (groupJid, type, id, memberJid = null) =>
	enhancementItems.deleteOne({ groupJid, type, _id: id, ...(memberJid ? { memberJid } : {}) });

export const clearEnhancementItems = (groupJid, type, filter = {}) =>
	enhancementItems.deleteMany({ groupJid, type, ...filter });

export const countEnhancementItems = (groupJid, filter = {}) =>
	enhancementItems.countDocuments({ groupJid, ...filter });

export const getEnhancementProfile = async (groupJid, memberJid) =>
	(await enhancementProfiles.findOne({ groupJid, memberJid })) || {
		groupJid,
		memberJid,
		nickname: "",
		bio: "",
		reputation: 0,
	};

export const updateEnhancementProfile = async (groupJid, memberJid, fields) => {
	const allowed = ["nickname", "bio", "memberName", "lastCheckin", "updatedAt"];
	const safeFields = Object.fromEntries(Object.entries(fields || {}).filter(([key]) => allowed.includes(key)));
	await enhancementProfiles.updateOne(
		{ groupJid, memberJid },
		{
			$set: { ...safeFields, updatedAt: new Date() },
			$setOnInsert: { reputation: 0, createdAt: new Date() },
		},
		{ upsert: true },
	);
	return getEnhancementProfile(groupJid, memberJid);
};

export const addReputation = async (groupJid, memberJid, memberName, amount = 1) => {
	await enhancementProfiles.updateOne(
		{ groupJid, memberJid },
		{
			$inc: { reputation: Math.max(-5, Math.min(5, Number(amount) || 1)) },
			$set: { memberName, updatedAt: new Date() },
			$setOnInsert: { nickname: "", bio: "", createdAt: new Date() },
		},
		{ upsert: true },
	);
	return getEnhancementProfile(groupJid, memberJid);
};

export const getReputationBoard = (groupJid, limit = 10) =>
	enhancementProfiles.find({ groupJid, reputation: { $gt: 0 } }).sort({ reputation: -1 }).limit(limit).toArray();

export const listEnhancementProfiles = (groupJid, filter = {}, limit = 50) =>
	enhancementProfiles.find({ groupJid, ...filter }).sort({ updatedAt: -1 }).limit(Math.min(limit, 100)).toArray();

export const getEnhancementSettings = async (groupJid) =>
	(await enhancementSettings.findOne({ _id: groupJid })) || { _id: groupJid };

export const updateEnhancementSettings = async (groupJid, fields) => {
	const safeFields = Object.fromEntries(Object.entries(fields || {}).filter(([key]) => !key.startsWith("$") && key !== "_id"));
	await enhancementSettings.updateOne(
		{ _id: groupJid },
		{ $set: { ...safeFields, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
		{ upsert: true },
	);
	return getEnhancementSettings(groupJid);
};
