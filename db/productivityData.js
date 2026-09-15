import mdClient from "./client.js";

const productivityGroups = mdClient.db("MyBotDataDB").collection("ProductivityGroups");
const afkStatuses = mdClient.db("MyBotDataDB").collection("AfkStatuses");
const memberBookmarks = mdClient.db("MyBotDataDB").collection("MemberBookmarks");

const groupDefaults = (data = {}) => ({
	_id: data._id,
	tasks: Array.isArray(data.tasks) ? data.tasks : [],
	faqs: Array.isArray(data.faqs) ? data.faqs : [],
});

export const getProductivityGroup = async (groupJid) => groupDefaults(await productivityGroups.findOne({ _id: groupJid }) || { _id: groupJid });

export const addGroupTask = async (groupJid, task) => {
	await productivityGroups.updateOne(
		{ _id: groupJid },
		{ $push: { tasks: { $each: [task], $slice: -120 } }, $set: { updatedAt: new Date() }, $setOnInsert: { createdAt: new Date(), faqs: [] } },
		{ upsert: true },
	);
	return task;
};

export const setGroupTaskState = async (groupJid, taskId, { done, actorJid }) => {
	const now = new Date();
	return productivityGroups.updateOne(
		{ _id: groupJid, "tasks.id": taskId },
		{ $set: { "tasks.$.done": Boolean(done), "tasks.$.doneBy": done ? actorJid : "", "tasks.$.doneAt": done ? now : null, updatedAt: now } },
	);
};

export const assignGroupTask = async (groupJid, taskId, assigneeJid) => productivityGroups.updateOne(
	{ _id: groupJid, "tasks.id": taskId },
	{ $set: { "tasks.$.assigneeJid": assigneeJid || "", updatedAt: new Date() } },
);

export const removeGroupTask = async (groupJid, taskId) => productivityGroups.updateOne(
	{ _id: groupJid },
	{ $pull: { tasks: { id: taskId } }, $set: { updatedAt: new Date() } },
);

export const addFaqEntry = async (groupJid, entry) => {
	await productivityGroups.updateOne(
		{ _id: groupJid },
		{ $push: { faqs: { $each: [entry], $slice: -80 } }, $set: { updatedAt: new Date() }, $setOnInsert: { createdAt: new Date(), tasks: [] } },
		{ upsert: true },
	);
	return entry;
};

export const removeFaqEntry = async (groupJid, faqId) => productivityGroups.updateOne(
	{ _id: groupJid },
	{ $pull: { faqs: { id: faqId } }, $set: { updatedAt: new Date() } },
);

export const setAfkStatus = async ({ groupJid, memberJid, reason, name }) => {
	const now = new Date();
	const doc = { groupJid, memberJid, reason, name, since: now };
	await afkStatuses.updateOne({ _id: `${groupJid}:${memberJid}` }, { $set: doc, $setOnInsert: { createdAt: now } }, { upsert: true });
	return doc;
};

export const clearAfkStatus = (groupJid, memberJid) => afkStatuses.findOneAndDelete({ _id: `${groupJid}:${memberJid}` });
export const getGroupAfkStatuses = (groupJid) => afkStatuses.find({ groupJid }).limit(100).toArray();

export const addMemberBookmark = async ({ groupJid, memberJid, bookmark }) => {
	const key = `${groupJid}:${memberJid}`;
	await memberBookmarks.updateOne(
		{ _id: key },
		{ $push: { items: { $each: [bookmark], $slice: -60 } }, $set: { groupJid, memberJid, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
		{ upsert: true },
	);
	return bookmark;
};

export const getMemberBookmarks = async (groupJid, memberJid) => {
	const data = await memberBookmarks.findOne({ _id: `${groupJid}:${memberJid}` });
	return Array.isArray(data?.items) ? data.items : [];
};

export const removeMemberBookmark = (groupJid, memberJid, bookmarkId) => memberBookmarks.updateOne(
	{ _id: `${groupJid}:${memberJid}` },
	{ $pull: { items: { id: bookmarkId } }, $set: { updatedAt: new Date() } },
);

export { productivityGroups, afkStatuses, memberBookmarks };
