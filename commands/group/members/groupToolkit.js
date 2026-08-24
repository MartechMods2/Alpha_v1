import { randomUUID } from "node:crypto";
import {
	addGroupNote,
	addGroupTodo,
	getGroupTools,
	removeGroupBirthday,
	removeGroupNote,
	removeGroupTodo,
	setGroupBirthday,
	setGroupTodoDone,
} from "../../../db/groupTools.js";
import {
	cleanGroupToolText,
	daysUntilBirthday,
	parseBirthday,
	parseCountdownDate,
} from "../../../utils/groupToolHelpers.js";

const writeCooldowns = new Map();
const WRITE_COOLDOWN_MS = 20_000;
const safeName = (value, jid) => cleanGroupToolText(value || jid?.split("@")[0] || "Member", 60).replace(/[*_~`]/g, " ");

const canWrite = (senderJid) => {
	const now = Date.now();
	if ((writeCooldowns.get(senderJid) || 0) > now) return false;
	writeCooldowns.set(senderJid, now + WRITE_COOLDOWN_MS);
	if (writeCooldowns.size > 2000) {
		for (const [key, expires] of writeCooldowns) if (expires <= now) writeCooldowns.delete(key);
	}
	return true;
};

const resolveNumbered = (items, rawIndex) => {
	const index = Number.parseInt(rawIndex, 10) - 1;
	return Number.isInteger(index) && index >= 0 ? items[index] : null;
};

const handleNotes = async ({ msg, from, args, senderJid, updateName, isGroupAdmin, isOwner, sendMessageWTyping }) => {
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const action = String(args[0] || "list").toLowerCase();
	const data = await getGroupTools(from);
	const notes = data.notes || [];

	if (action === "list") {
		if (!notes.length) return reply("🗒️ No shared notes yet. Use `gnote save Title | text`.");
		const rows = notes.map((note, index) => `${index + 1}. *${note.title}* — ${safeName(note.authorName, note.authorJid)}`);
		return reply(`🗒️ *Shared Group Notes*\n\n${rows.join("\n")}\n\nRead one with \`gnote read <number>\`.`);
	}
	if (action === "read") {
		const note = resolveNumbered(notes, args[1]);
		return note
			? reply(`🗒️ *${note.title}*\n\n${note.text}\n\n_Saved by ${safeName(note.authorName, note.authorJid)}_`)
			: reply("❌ Note not found. Check `gnote list`.");
	}
	if (action === "save") {
		if (!canWrite(senderJid)) return;
		const ownCount = notes.filter((note) => note.authorJid === senderJid).length;
		if (ownCount >= 3 && !isGroupAdmin && !isOwner) return reply("❌ You already have three shared notes. Delete one first.");
		const [titlePart, ...textParts] = args.slice(1).join(" ").split("|");
		const title = cleanGroupToolText(titlePart, 60);
		const text = cleanGroupToolText(textParts.join("|"), 800);
		if (!title || !text) return reply("❌ Usage: `gnote save Title | note text`.");
		await addGroupNote(from, {
			id: randomUUID(), title, text, authorJid: senderJid,
			authorName: safeName(updateName, senderJid), createdAt: new Date(),
		});
		return reply("✅ Shared note saved.");
	}
	if (action === "delete") {
		if (!canWrite(senderJid)) return;
		const note = resolveNumbered(notes, args[1]);
		if (!note) return reply("❌ Note not found. Check `gnote list`.");
		if (note.authorJid !== senderJid && !isGroupAdmin && !isOwner) return reply("❌ Only its author or an admin can delete that note.");
		await removeGroupNote(from, note.id);
		return reply("✅ Shared note deleted.");
	}
	return reply("🗒️ Use: `gnote list`, `gnote save Title | text`, `gnote read 1`, or `gnote delete 1`.");
};

const handleTodos = async ({ msg, from, args, senderJid, updateName, isGroupAdmin, isOwner, sendMessageWTyping }) => {
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const action = String(args[0] || "list").toLowerCase();
	const data = await getGroupTools(from);
	const todos = data.todos || [];
	if (action === "list") {
		if (!todos.length) return reply("✅ The group task board is empty. Use `todo add <task>`. ");
		const rows = todos.map((todo, index) =>
			`${todo.done ? "☑️" : "⬜"} ${index + 1}. ${todo.text}${todo.done && todo.completedBy ? ` — _${safeName(todo.completedBy)}_` : ""}`,
		);
		return reply(`📋 *Group Task Board*\n\n${rows.join("\n")}`);
	}
	if (action === "add") {
		if (!canWrite(senderJid)) return;
		const text = cleanGroupToolText(args.slice(1).join(" "), 240);
		if (!text) return reply("❌ Usage: `todo add <task>`.");
		await addGroupTodo(from, {
			id: randomUUID(), text, done: false, authorJid: senderJid,
			authorName: safeName(updateName, senderJid), createdAt: new Date(),
		});
		return reply("✅ Task added to the group board.");
	}
	if (["done", "undo"].includes(action)) {
		if (!canWrite(senderJid)) return;
		const todo = resolveNumbered(todos, args[1]);
		if (!todo) return reply("❌ Task not found. Check `todo list`.");
		await setGroupTodoDone(from, todo.id, action === "done", safeName(updateName, senderJid));
		return reply(action === "done" ? "✅ Task completed." : "↩️ Task reopened.");
	}
	if (["remove", "delete"].includes(action)) {
		if (!canWrite(senderJid)) return;
		const todo = resolveNumbered(todos, args[1]);
		if (!todo) return reply("❌ Task not found. Check `todo list`.");
		if (todo.authorJid !== senderJid && !isGroupAdmin && !isOwner) return reply("❌ Only its author or an admin can remove that task.");
		await removeGroupTodo(from, todo.id);
		return reply("✅ Task removed.");
	}
	return reply("📋 Use: `todo list`, `todo add <task>`, `todo done 1`, `todo undo 1`, or `todo remove 1`.");
};

const handleBirthdays = async ({ msg, from, args, senderJid, updateName, sendMessageWTyping }) => {
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const action = String(args[0] || "list").toLowerCase();
	if (action === "set") {
		if (!canWrite(senderJid)) return;
		const birthday = parseBirthday(args[1]);
		if (!birthday) return reply("🎂 Usage: `birthday set DD-MM` (year is not stored).");
		await setGroupBirthday(from, {
			memberJid: senderJid,
			name: safeName(updateName, senderJid),
			...birthday,
			updatedAt: new Date(),
		});
		return reply(`🎂 Birthday saved as *${String(birthday.day).padStart(2, "0")}-${String(birthday.month).padStart(2, "0")}*.`);
	}
	if (["remove", "delete"].includes(action)) {
		if (!canWrite(senderJid)) return;
		await removeGroupBirthday(from, senderJid);
		return reply("✅ Your birthday was removed.");
	}
	const data = await getGroupTools(from);
	const allBirthdays = [...(data.birthdays || [])].sort((left, right) =>
		daysUntilBirthday(left) - daysUntilBirthday(right),
	);
	if (!allBirthdays.length) return reply("🎂 No birthdays saved. Use `birthday set DD-MM`.");
	const birthdays = allBirthdays.slice(0, 50);
	const rows = birthdays.map((birthday) => {
		const days = daysUntilBirthday(birthday);
		const when = days === 0 ? "today!" : `in ${days} day${days === 1 ? "" : "s"}`;
		return `🎈 *${safeName(birthday.name, birthday.memberJid)}* — ${String(birthday.day).padStart(2, "0")}-${String(birthday.month).padStart(2, "0")} (${when})`;
	});
	const more = allBirthdays.length > birthdays.length ? `\n\n_And ${allBirthdays.length - birthdays.length} more._` : "";
	return reply(`🎂 *Group Birthdays*\n\n${rows.join("\n")}${more}`);
};

const handleCountdown = async ({ msg, from, args, sendMessageWTyping }) => {
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const target = parseCountdownDate(args[0]);
	if (!target) return reply("⏳ Usage: `countdown YYYY-MM-DD | event name`.");
	const today = new Date();
	const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
	const days = Math.ceil((target.getTime() - start) / 86_400_000);
	const label = cleanGroupToolText(args.slice(1).join(" ").replace(/^\|\s*/, ""), 100) || "Event";
	if (days < 0) return reply(`⏳ *${label}* was ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago.`);
	if (days === 0) return reply(`🎉 *${label}* is today!`);
	return reply(`⏳ *${days} day${days === 1 ? "" : "s"}* until *${label}* (${args[0]}).`);
};

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const context = { msg, from, args, ...msgInfoObj };
	try {
		if (["gnote", "groupnote"].includes(msgInfoObj.command)) return handleNotes(context);
		if (["todo", "tasks"].includes(msgInfoObj.command)) return handleTodos(context);
		if (["birthday", "birthdays"].includes(msgInfoObj.command)) return handleBirthdays(context);
		if (msgInfoObj.command === "countdown") return handleCountdown(context);
		return msgInfoObj.sendMessageWTyping(
			from,
			{ text: "🧰 *Group Toolkit*\n\n`gnote` shared notes\n`todo` task board\n`birthday` birthday list\n`countdown` event countdown" },
			{ quoted: msg },
		);
	} catch (error) {
		console.error("Group toolkit failed:", error.message);
		return msgInfoObj.sendMessageWTyping(from, { text: "❌ The group toolkit is temporarily unavailable." }, { quoted: msg });
	}
};

export default () => ({
	cmd: ["groupkit", "gnote", "groupnote", "todo", "tasks", "birthday", "birthdays", "countdown"],
	desc: "Persistent shared notes, task board, birthdays and event countdowns",
	usage: "groupkit | gnote | todo | birthday | countdown",
	handler,
});
