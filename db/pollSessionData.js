import mdClient from "./client.js";

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

export const replacePollVote = async (id, voterJid, option = "") => {
	const filter = { _id: String(id), status: "open" };
	await pollSessions.updateOne(filter, {
		$pull: { votes: { voterJid } },
		$set: { updatedAt: new Date() },
	});
	if (!option) return getPollSession(id);
	await pollSessions.updateOne(filter, {
		$push: { votes: { voterJid, option, votedAt: new Date() } },
		$set: { updatedAt: new Date() },
	});
	return getPollSession(id);
};

export const closePollSession = (id, extra = {}) => pollSessions.updateOne(
	{ _id: String(id) },
	{ $set: { status: "closed", closedAt: new Date(), updatedAt: new Date(), ...extra } },
);

export const deleteExpiredPollSessions = () => pollSessions.deleteMany({
	expiresAt: { $lt: new Date(Date.now() - 24 * 60 * 60_000) },
});

export { pollSessions };
