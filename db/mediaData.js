import { randomUUID } from "node:crypto";
import mdClient from "./client.js";

const stickerVault = mdClient.db("MyBotDataDB").collection("StickerVault");
const mediaContests = mdClient.db("MyBotDataDB").collection("MediaContests");
const memeTemplates = mdClient.db("MyBotDataDB").collection("MemeTemplates");

const safeText = (value, max = 80) => String(value || "").replace(/[\r\n\t*_~`]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const regexText = (value) => safeText(value, 40).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const saveGroupSticker = async ({ groupJid, name, tags = [], data, authorJid, authorName }) => {
	if (!Buffer.isBuffer(data) || !data.length) throw new Error("Sticker data is empty");
	if (data.length > 1024 * 1024) throw new Error("Sticker is larger than 1MB");
	const count = await stickerVault.countDocuments({ groupJid });
	if (count >= 40) throw new Error("This group's sticker vault is full (40 stickers)");
	const sticker = {
		_id: randomUUID(),
		groupJid,
		name: safeText(name, 50) || `sticker-${count + 1}`,
		tags: [...new Set(tags.map((tag) => safeText(tag, 24).toLowerCase()).filter(Boolean))].slice(0, 8),
		data,
		authorJid,
		authorName: safeText(authorName, 60),
		createdAt: new Date(),
	};
	await stickerVault.insertOne(sticker);
	return sticker;
};

export const findGroupStickers = (groupJid, search = "", limit = 10) => {
	const query = { groupJid };
	const term = regexText(search);
	if (term) query.$or = [{ name: { $regex: term, $options: "i" } }, { tags: term.toLowerCase() }];
	return stickerVault.find(query, { projection: { data: 0 } }).sort({ createdAt: -1 }).limit(Math.min(20, Math.max(1, limit))).toArray();
};

export const getGroupSticker = (groupJid, stickerId) => stickerVault.findOne({ _id: stickerId, groupJid });

export const getRandomGroupSticker = async (groupJid, search = "") => {
	const query = { groupJid };
	const term = regexText(search);
	if (term) query.$or = [{ name: { $regex: term, $options: "i" } }, { tags: term.toLowerCase() }];
	const [entry] = await stickerVault.aggregate([{ $match: query }, { $sample: { size: 1 } }]).toArray();
	return entry || null;
};

export const deleteGroupSticker = (groupJid, stickerId, actorJid, isAdmin = false) =>
	stickerVault.deleteOne({ _id: stickerId, groupJid, ...(isAdmin ? {} : { authorJid: actorJid }) });

export const startMediaContest = async ({ groupJid, type, topic, createdBy }) => {
	const active = await mediaContests.findOne({ groupJid, status: "active" });
	if (active) throw new Error(`A ${active.type} contest is already active`);
	const contest = {
		_id: randomUUID(),
		groupJid,
		type: safeText(type, 30),
		topic: safeText(topic, 140) || "Open challenge",
		createdBy,
		status: "active",
		submissions: [],
		votes: [],
		createdAt: new Date(),
		expiresAt: new Date(Date.now() + 60 * 60_000),
	};
	await mediaContests.insertOne(contest);
	return contest;
};

export const getActiveMediaContest = (groupJid, type = null) =>
	mediaContests.findOne({ groupJid, status: "active", ...(type ? { type } : {}) });

export const addMediaContestSubmission = async ({ contestId, memberJid, memberName, text }) => {
	const contest = await mediaContests.findOne({ _id: contestId, status: "active" });
	if (!contest) throw new Error("The contest is no longer active");
	if ((contest.submissions || []).some((entry) => entry.memberJid === memberJid)) throw new Error("You already submitted an entry");
	if ((contest.submissions || []).length >= 12) throw new Error("The contest already has 12 entries");
	const entry = { id: randomUUID(), memberJid, memberName: safeText(memberName, 60), text: safeText(text, 180), createdAt: new Date() };
	await mediaContests.updateOne({ _id: contestId }, { $push: { submissions: entry } });
	return { ...entry, number: contest.submissions.length + 1 };
};

export const voteMediaContest = async ({ contestId, memberJid, submissionId }) => {
	const contest = await mediaContests.findOne({ _id: contestId, status: "active" });
	if (!contest?.submissions?.some((entry) => entry.id === submissionId)) throw new Error("Contest entry not found");
	await mediaContests.updateOne({ _id: contestId }, { $pull: { votes: { memberJid } } });
	await mediaContests.updateOne({ _id: contestId }, { $push: { votes: { memberJid, submissionId, createdAt: new Date() } } });
};

export const closeMediaContest = async (contestId) => {
	const contest = await mediaContests.findOne({ _id: contestId });
	if (!contest) throw new Error("Contest not found");
	const totals = new Map();
	for (const vote of contest.votes || []) totals.set(vote.submissionId, (totals.get(vote.submissionId) || 0) + 1);
	const standings = (contest.submissions || [])
		.map((entry) => ({ ...entry, votes: totals.get(entry.id) || 0 }))
		.sort((left, right) => right.votes - left.votes || left.createdAt - right.createdAt);
	await mediaContests.updateOne({ _id: contestId }, { $set: { status: "closed", standings, closedAt: new Date() } });
	return { ...contest, standings };
};

export const getMediaCollectionStats = async () => {
	const [stickers, activeContests, templates] = await Promise.all([
		stickerVault.countDocuments(),
		mediaContests.countDocuments({ status: "active" }),
		memeTemplates.countDocuments(),
	]);
	return { stickers, activeContests, templates };
};

export const addMemeTemplate = async ({ name, templateId }) => {
	const cleanName = safeText(name, 50);
	const cleanId = String(templateId || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60);
	if (!cleanName || !cleanId) throw new Error("Template name and Memegen template ID are required");
	await memeTemplates.updateOne(
		{ nameKey: cleanName.toLowerCase() },
		{ $set: { name: cleanName, nameKey: cleanName.toLowerCase(), templateId: cleanId, updatedAt: new Date() }, $setOnInsert: { _id: randomUUID(), createdAt: new Date() } },
		{ upsert: true },
	);
	return memeTemplates.findOne({ nameKey: cleanName.toLowerCase() });
};
export const listMemeTemplates = () => memeTemplates.find({}).sort({ name: 1 }).limit(100).toArray();
export const deleteMemeTemplate = (id) => memeTemplates.deleteOne({ _id: id });

export { mediaContests, memeTemplates, stickerVault };
