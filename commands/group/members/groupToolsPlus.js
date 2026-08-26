import { randomUUID } from "node:crypto";
import {
	addGroupBookmark,
	addGroupDecision,
	addGroupEvent,
	addMeetingEntry,
	finishGroupMeeting,
	getGroupTools,
	removeGroupBookmark,
	removeGroupDecision,
	removeGroupEvent,
	startGroupMeeting,
} from "../../../db/groupTools.js";
import { cleanGroupToolText, parseCountdownDate } from "../../../utils/groupToolHelpers.js";
import { quotedText } from "../../../utils/mediaInput.js";

const cooldowns = new Map();
const safeName = (value, jid) => cleanGroupToolText(value || jid?.split("@")[0] || "Member", 60).replace(/[*_~`]/g, " ");
const resolveNumber = (items, value) => items[Number.parseInt(value, 10) - 1] || null;

const allowWrite = (key) => {
	const now = Date.now();
	if ((cooldowns.get(key) || 0) > now) return false;
	cooldowns.set(key, now + 10_000);
	return true;
};

const handleEvents = async ({ msg, from, args, senderJid, updateName, isGroupAdmin, isOwner, sendMessageWTyping }) => {
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const action = String(args[0] || "list").toLowerCase();
	const data = await getGroupTools(from);
	const events = [...(data.events || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
	if (action === "add") {
		if (!isGroupAdmin && !isOwner) return reply("❌ Only an admin can add group events.");
		const date = parseCountdownDate(args[1]);
		const title = cleanGroupToolText(args.slice(2).join(" ").replace(/^\|\s*/, ""), 120);
		if (!date || !title) return reply("❌ Usage: `event add YYYY-MM-DD | event title`.");
		await addGroupEvent(from, { id: randomUUID(), date, title, createdBy: senderJid, createdByName: safeName(updateName, senderJid), createdAt: new Date() });
		return reply(`✅ Event saved for *${args[1]}*: ${title}`);
	}
	if (["delete", "remove"].includes(action)) {
		if (!isGroupAdmin && !isOwner) return reply("❌ Only an admin can remove events.");
		const event = resolveNumber(events, args[1]);
		if (!event) return reply("❌ Event not found.");
		await removeGroupEvent(from, event.id);
		return reply("✅ Event removed.");
	}
	const upcoming = events.filter((event) => new Date(event.date) >= new Date(new Date().toISOString().slice(0, 10))).slice(0, 20);
	return reply(upcoming.length ? `📅 *Group Calendar*\n\n${upcoming.map((event, index) => `${index + 1}. *${new Date(event.date).toISOString().slice(0, 10)}* — ${event.title}`).join("\n")}` : "📅 No upcoming events. Admins can use `event add YYYY-MM-DD | title`.");
};

const handleDecisions = async ({ msg, from, args, senderJid, updateName, isGroupAdmin, isOwner, sendMessageWTyping }) => {
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const action = String(args[0] || "list").toLowerCase();
	const data = await getGroupTools(from);
	const decisions = data.decisions || [];
	if (action === "add") {
		if (!isGroupAdmin && !isOwner) return reply("❌ Only an admin can record a decision.");
		const text = cleanGroupToolText(args.slice(1).join(" "), 500);
		if (!text) return reply("❌ Usage: `decision add <decision>`.");
		await addGroupDecision(from, { id: randomUUID(), text, recordedBy: senderJid, recordedByName: safeName(updateName, senderJid), createdAt: new Date() });
		return reply("✅ Group decision recorded.");
	}
	if (["delete", "remove"].includes(action)) {
		if (!isGroupAdmin && !isOwner) return reply("❌ Only an admin can remove decisions.");
		const entry = resolveNumber(decisions, args[1]);
		if (!entry) return reply("❌ Decision not found.");
		await removeGroupDecision(from, entry.id);
		return reply("✅ Decision removed.");
	}
	return reply(decisions.length ? `📌 *Recorded Decisions*\n\n${decisions.slice(-20).map((entry, index) => `${index + 1}. ${entry.text} — _${safeName(entry.recordedByName, entry.recordedBy)}_`).join("\n")}` : "📌 No decisions have been recorded.");
};

const handleBookmarks = async ({ msg, from, args, senderJid, updateName, isGroupAdmin, isOwner, sendMessageWTyping }) => {
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const data = await getGroupTools(from);
	const bookmarks = data.bookmarks || [];
	if (msgInfoCommand(args) === "save") {
		const text = cleanGroupToolText(quotedText(msg), 1000);
		if (!text) return reply("❌ Reply to a text message with `bookmark`.");
		const context = msg.message?.extendedTextMessage?.contextInfo;
		await addGroupBookmark(from, {
			id: randomUUID(), text, messageId: context?.stanzaId || "", participant: context?.participant || "",
			savedBy: senderJid, savedByName: safeName(updateName, senderJid), createdAt: new Date(),
		});
		return reply("🔖 Message bookmarked.");
	}
	if (["delete", "remove"].includes(String(args[0] || "").toLowerCase())) {
		const entry = resolveNumber(bookmarks, args[1]);
		if (!entry) return reply("❌ Bookmark not found.");
		if (entry.savedBy !== senderJid && !isGroupAdmin && !isOwner) return reply("❌ Only its saver or an admin can remove it.");
		await removeGroupBookmark(from, entry.id);
		return reply("✅ Bookmark removed.");
	}
	return reply(bookmarks.length ? `🔖 *Group Bookmarks*\n\n${bookmarks.slice(-20).map((entry, index) => `${index + 1}. ${entry.text.slice(0, 180)}${entry.text.length > 180 ? "…" : ""}`).join("\n")}` : "🔖 No bookmarks yet. Reply to a message with `bookmark`.");
};

const msgInfoCommand = (args) => String(args[0] || "save").toLowerCase();

const handleMeeting = async ({ msg, from, args, senderJid, updateName, isGroupAdmin, isOwner, sendMessageWTyping }) => {
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const action = String(args[0] || "status").toLowerCase();
	const data = await getGroupTools(from);
	if (action === "start") {
		if (!isGroupAdmin && !isOwner) return reply("❌ Only an admin can start meeting notes.");
		if (data.activeMeeting) return reply("❌ A meeting is already active.");
		const title = cleanGroupToolText(args.slice(1).join(" "), 120) || "Group Meeting";
		await startGroupMeeting(from, { id: randomUUID(), title, startedBy: senderJid, startedByName: safeName(updateName, senderJid), startedAt: new Date(), entries: [] });
		return reply(`📝 Meeting notes started: *${title}*. Add points with \`meeting add <note>\`.`);
	}
	if (action === "add") {
		if (!data.activeMeeting) return reply("❌ No meeting is active.");
		const text = cleanGroupToolText(args.slice(1).join(" "), 500);
		if (!text) return reply("❌ Usage: `meeting add <note>`.");
		await addMeetingEntry(from, { id: randomUUID(), text, authorJid: senderJid, authorName: safeName(updateName, senderJid), createdAt: new Date() });
		return reply("✅ Meeting point added.");
	}
	if (action === "end") {
		if (!isGroupAdmin && !isOwner) return reply("❌ Only an admin can end the meeting.");
		if (!data.activeMeeting) return reply("❌ No meeting is active.");
		const minutes = { ...data.activeMeeting, endedAt: new Date(), endedBy: senderJid };
		await finishGroupMeeting(from, minutes);
		return reply(`✅ Meeting closed with *${minutes.entries?.length || 0}* recorded points. Read it with \`minutes read 1\`.`);
	}
	return reply(data.activeMeeting ? `📝 Active meeting: *${data.activeMeeting.title}* · ${data.activeMeeting.entries?.length || 0} points.` : "📝 No meeting is active.");
};

const handleMinutes = async ({ msg, from, args, sendMessageWTyping }) => {
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const data = await getGroupTools(from);
	const minutes = data.minutes || [];
	if (String(args[0] || "list").toLowerCase() === "read") {
		const entry = resolveNumber(minutes, args[1]);
		if (!entry) return reply("❌ Meeting minutes not found.");
		return reply(`📝 *${entry.title}*\n\n${(entry.entries || []).map((point, index) => `${index + 1}. ${point.text} — _${safeName(point.authorName, point.authorJid)}_`).join("\n") || "No points recorded."}`);
	}
	return reply(minutes.length ? `📝 *Meeting Minutes*\n\n${minutes.map((entry, index) => `${index + 1}. *${entry.title}* — ${entry.entries?.length || 0} points`).join("\n")}` : "📝 No completed meeting minutes.");
};

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const context = { sock, msg, from, args, ...msgInfoObj };
	if (!allowWrite(`${from}:${msgInfoObj.senderJid}:${msgInfoObj.command}`)) return;
	try {
		if (["event", "calendar"].includes(msgInfoObj.command)) return handleEvents(context);
		if (msgInfoObj.command === "decision") return handleDecisions(context);
		if (["bookmark", "bookmarks"].includes(msgInfoObj.command)) {
			return handleBookmarks({
				...context,
				args: msgInfoObj.command === "bookmark" && !args.length
					? ["save"]
					: msgInfoObj.command === "bookmarks" && !args.length
						? ["list"]
						: args,
			});
		}
		if (msgInfoObj.command === "meeting") return handleMeeting(context);
		if (msgInfoObj.command === "minutes") return handleMinutes(context);
	} catch (error) {
		console.error("Group Tools Plus failed:", error.message);
		return msgInfoObj.sendMessageWTyping(from, { text: `❌ ${error.message}` }, { quoted: msg });
	}
};

export default () => ({
	cmd: ["event", "calendar", "meeting", "minutes", "decision", "bookmark", "bookmarks"],
	desc: "Persistent events, calendar, meeting minutes, decisions and bookmarks",
	usage: "event add | calendar | meeting start/add/end | minutes | decision | bookmark",
	handler,
});
