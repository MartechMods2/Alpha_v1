import mdClient from "./client.js";

const groupTools = mdClient.db("MyBotDataDB").collection("GroupTools");

const blankData = (groupJid) => ({ _id: groupJid, notes: [], todos: [], birthdays: [] });

export const getGroupTools = async (groupJid) => (await groupTools.findOne({ _id: groupJid })) || blankData(groupJid);

export const addGroupNote = (groupJid, note) =>
	groupTools.updateOne(
		{ _id: groupJid },
		{
			$push: { notes: { $each: [note], $slice: -30 } },
			$set: { updatedAt: new Date() },
			$setOnInsert: { todos: [], birthdays: [], createdAt: new Date() },
		},
		{ upsert: true },
	);

export const removeGroupNote = (groupJid, noteId) =>
	groupTools.updateOne({ _id: groupJid }, { $pull: { notes: { id: noteId } }, $set: { updatedAt: new Date() } });

export const addGroupTodo = (groupJid, todo) =>
	groupTools.updateOne(
		{ _id: groupJid },
		{
			$push: { todos: { $each: [todo], $slice: -30 } },
			$set: { updatedAt: new Date() },
			$setOnInsert: { notes: [], birthdays: [], createdAt: new Date() },
		},
		{ upsert: true },
	);

export const setGroupTodoDone = (groupJid, todoId, done, actorName) =>
	groupTools.updateOne(
		{ _id: groupJid, "todos.id": todoId },
		{
			$set: {
				"todos.$.done": Boolean(done),
				"todos.$.completedBy": done ? actorName : null,
				"todos.$.completedAt": done ? new Date() : null,
				updatedAt: new Date(),
			},
		},
	);

export const removeGroupTodo = (groupJid, todoId) =>
	groupTools.updateOne({ _id: groupJid }, { $pull: { todos: { id: todoId } }, $set: { updatedAt: new Date() } });

export const setGroupBirthday = async (groupJid, birthday) => {
	await groupTools.updateOne(
		{ _id: groupJid },
		{
			$pull: { birthdays: { memberJid: birthday.memberJid } },
			$set: { updatedAt: new Date() },
			$setOnInsert: { notes: [], todos: [], createdAt: new Date() },
		},
		{ upsert: true },
	);
	return groupTools.updateOne(
		{ _id: groupJid },
		{ $push: { birthdays: birthday }, $set: { updatedAt: new Date() } },
	);
};

export const removeGroupBirthday = (groupJid, memberJid) =>
	groupTools.updateOne(
		{ _id: groupJid },
		{ $pull: { birthdays: { memberJid } }, $set: { updatedAt: new Date() } },
	);

export const resetGroupTools = (groupJid) =>
	groupTools.updateOne(
		{ _id: groupJid },
		{ $set: { notes: [], todos: [], birthdays: [], updatedAt: new Date() } },
		{ upsert: true },
	);

export { groupTools };
