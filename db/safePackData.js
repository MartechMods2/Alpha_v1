import { randomUUID } from "node:crypto";
import mdClient from "./client.js";

const database = mdClient.db("MyBotDataDB");
export const safePackSettings = database.collection("SafePackSettings");
export const safePackItems = database.collection("SafePackItems");
export const safePackWallets = database.collection("SafePackWallets");
export const safePackAudit = database.collection("SafePackAudit");
export const safePackDeliveries = database.collection("SafePackDeliveries");
export const safeQueueFailures = database.collection("SafeQueueFailures");
const settingsCache = new Map();

export const DEFAULT_SAFE_SETTINGS = Object.freeze({
	antiRaidEnabled: false,
	antiRaidLimit: 8,
	antiRaidWindowSeconds: 60,
	slowModeSeconds: 0,
	lockdownUntil: null,
	quietHours: null,
	warningExpiryDays: 0,
	wordFilterEnabled: false,
	blockedPhrases: [],
	mentionLimit: 0,
	mediaLimit: 0,
	probationHours: 0,
	botLanguage: "en",
	semanticFaqEnabled: false,
	aiPiiRedaction: true,
	aiWebEnabled: false,
	aiModerationEnabled: false,
	actionStyle: "anime",
	gameNightEnabled: false,
	gameNightDay: "Friday",
	gameNightTime: "20:00",
	scheduledPostLimit: 1,
	automationDailyLimit: 3,
});

export const getSafeSettings = async (groupJid) => {
	const cached = settingsCache.get(groupJid);
	if (cached?.expires > Date.now()) return cached.value;
	const value = { ...DEFAULT_SAFE_SETTINGS, ...((await safePackSettings.findOne({ _id: groupJid })) || {}) };
	settingsCache.set(groupJid, { value, expires: Date.now() + 30_000 });
	return value;
};

export const updateSafeSettings = async (groupJid, fields) => {
	const safe = Object.fromEntries(Object.entries(fields || {}).filter(([key]) => key !== "_id" && !key.startsWith("$")));
	await safePackSettings.updateOne(
		{ _id: groupJid },
		{ $set: { ...safe, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
		{ upsert: true },
	);
	settingsCache.delete(groupJid);
	return getSafeSettings(groupJid);
};

export const createSafeItem = async ({ groupJid, type, memberJid = "", memberName = "", text = "", payload = {}, status = "active" }) => {
	const item = { _id: randomUUID(), groupJid, type, memberJid, memberName, text, payload, status, createdAt: new Date(), updatedAt: new Date() };
	await safePackItems.insertOne(item);
	return item;
};

export const listSafeItems = (groupJid, type, filter = {}, limit = 50) => safePackItems
	.find({ groupJid, type, ...filter })
	.sort({ createdAt: -1 })
	.limit(Math.min(100, Math.max(1, Number(limit) || 50)))
	.toArray();

export const updateSafeItem = async (groupJid, type, id, fields) => {
	const safe = Object.fromEntries(Object.entries(fields || {}).filter(([key]) => !["_id", "groupJid", "type"].includes(key) && !key.startsWith("$")));
	await safePackItems.updateOne({ _id: id, groupJid, type }, { $set: { ...safe, updatedAt: new Date() } });
	return safePackItems.findOne({ _id: id, groupJid, type });
};

export const removeSafeItem = (groupJid, type, id) => safePackItems.deleteOne({ _id: id, groupJid, type });
export const clearSafeItems = (groupJid, type, filter = {}) => safePackItems.deleteMany({ groupJid, type, ...filter });

export const recordSafeAudit = async ({ groupJid, action, actorJid = "system", targetJid = "", reason = "", payload = {} }) => {
	const event = { _id: randomUUID(), groupJid, action, actorJid, targetJid, reason, payload, createdAt: new Date() };
	await safePackAudit.insertOne(event);
	import("../utils/signedWebhooks.js").then(({ emitSignedWebhook }) => emitSignedWebhook("moderation.audit", event)).catch(() => {});
	return event;
};

export const listSafeAudit = (groupJid, limit = 30) => safePackAudit.find({ groupJid }).sort({ createdAt: -1 }).limit(Math.min(100, limit)).toArray();

export const claimSafeDelivery = async (key, ttlDays = 30) => {
	try { await safePackDeliveries.insertOne({ _id: key, createdAt: new Date(), expiresAt: new Date(Date.now() + ttlDays * 86_400_000) }); return true; }
	catch (error) { if (error?.code === 11000) return false; throw error; }
};

export const releaseSafeDelivery = (key) => safePackDeliveries.deleteOne({ _id: key });
export const recordQueueFailure = (chatId, error) => safeQueueFailures.insertOne({ _id: randomUUID(), chatId, error: String(error?.message || error).slice(0, 500), createdAt: new Date(), status: "failed" }).catch(() => {});
export const listQueueFailures = (limit = 30) => safeQueueFailures.find({}).sort({ createdAt: -1 }).limit(limit).toArray();

const walletId = (groupJid, memberJid) => `${groupJid}:${memberJid}`;
export const getWallet = async (groupJid, memberJid) => (await safePackWallets.findOne({ _id: walletId(groupJid, memberJid) })) || {
	_id: walletId(groupJid, memberJid), groupJid, memberJid, coins: 0, inventory: [], lastDailyKey: "",
};

export const changeWalletCoins = async ({ groupJid, memberJid, memberName = "", amount, requireBalance = false }) => {
	const delta = Math.trunc(Number(amount) || 0);
	if (!delta) return getWallet(groupJid, memberJid);
	const filter = { _id: walletId(groupJid, memberJid), ...(requireBalance && delta < 0 ? { coins: { $gte: Math.abs(delta) } } : {}) };
	const result = await safePackWallets.findOneAndUpdate(filter, {
		$inc: { coins: delta },
		$set: { groupJid, memberJid, memberName, updatedAt: new Date() },
		$setOnInsert: { inventory: [], lastDailyKey: "", createdAt: new Date() },
	}, { upsert: !requireBalance || delta > 0, returnDocument: "after" });
	return result;
};

export const claimDailyCoins = async ({ groupJid, memberJid, memberName, dateKey, amount = 50 }) => safePackWallets.findOneAndUpdate(
	{ _id: walletId(groupJid, memberJid), lastDailyKey: { $ne: dateKey } },
	{ $inc: { coins: amount }, $set: { groupJid, memberJid, memberName, lastDailyKey: dateKey, updatedAt: new Date() }, $setOnInsert: { inventory: [], createdAt: new Date() } },
	{ upsert: true, returnDocument: "after" },
).catch((error) => error?.code === 11000 ? null : Promise.reject(error));

export const addInventoryItem = (groupJid, memberJid, item) => safePackWallets.updateOne(
	{ _id: walletId(groupJid, memberJid) },
	{ $addToSet: { inventory: item }, $set: { updatedAt: new Date() } },
);

export const getRichList = (groupJid, limit = 10) => safePackWallets.find({ groupJid }).sort({ coins: -1 }).limit(limit).toArray();
