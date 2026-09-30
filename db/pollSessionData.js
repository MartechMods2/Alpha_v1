import mdClient from "./client.js";
import { decodePollMessage } from "../utils/pollMessageStore.js";

const pollSessions = mdClient.db("MyBotDataDB").collection("InteractivePollSessions");

export const createPollSession = async (session) => {
	const now = new Date();
	const id = String(session._id);
	const fields = {
		...session,
		votes: [],
		status: "open",
		createdAt: now,
		updatedAt: now,
	};
	delete fields._id;
	await pollSessions.updateOne(
		{ _id: id },
		{ $set: fields, $setOnInsert: { _id: id } },
		{ upsert: true },
	);
	return { _id: id, ...fields };
};

export const getPollSession = (id) => pollSessions.findOne({ _id: String(id) });

export const getPollCreationMessage = async (key) => {
	if (!key?.id || !key?.remoteJid) return undefined;
	const session = await getPollSession(key.id);
	if (!session?.creationMessage || session.groupJid !== key.remoteJid ||
		new Date(session.expiresAt).getTime() <= Date.now()) return undefined;
	return decodePollMessage(session.creationMessage);
};

export const replacePollVote = async (id, voterJid, option = "") => {
	const filter = { _id: String(id), status: "open" };
	const now = new Date();
	return pollSessions.findOneAndUpdate(filter, [{ $set: {
		votes: { $concatArrays: [
			{ $filter: { input: { $ifNull: ["$votes", []] }, as: "vote", cond: { $ne: ["$$vote.voterJid", { $literal: voterJid }] } } },
			{ $literal: option ? [{ voterJid, option, votedAt: now }] : [] },
		] },
		updatedAt: now,
	} }], { returnDocument: "after" });
};

export const closePollSession = (id, extra = {}) => pollSessions.findOneAndUpdate(
	{ _id: String(id) },
	{ $set: { status: "closed", closedAt: new Date(), updatedAt: new Date(), ...extra } },
	{ returnDocument: "after" },
);

export const deleteExpiredPollSessions = () => pollSessions.deleteMany({
	expiresAt: { $lt: new Date(Date.now() - 24 * 60 * 60_000) },
});

export { pollSessions };
