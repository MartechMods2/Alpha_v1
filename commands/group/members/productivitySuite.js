import {
	createEnhancementItem,
	getEnhancementSettings,
	listEnhancementItems,
	removeEnhancementItem,
	updateEnhancementItem,
	updateEnhancementSettings,
} from "../../../db/enhancementData.js";
import { cleanFeatureText, dateKey, safeMemberName } from "../../../utils/featureSuite.js";
import { PRODUCTIVITY_COMMANDS } from "../../../utils/ultimateFeatureCatalog.js";

const timers = new Map();
const cooldowns = new Map();
const itemAt = (items, value) => items[Number.parseInt(value, 10) - 1] || null;
const allow = (key, ms = 8_000) => {
	const now = Date.now();
	if ((cooldowns.get(key) || 0) > now) return false;
	cooldowns.set(key, now + ms);
	return true;
};
const parseDate = (value) => {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
	const date = new Date(`${value}T00:00:00.000Z`);
	return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
};
const mentions = (msg) => {
	const context = msg?.message?.extendedTextMessage?.contextInfo || {};
	return [...new Set(Array.isArray(context.mentionedJid) ? context.mentionedJid : context.mentionedJid ? [context.mentionedJid] : [])];
};

const handleHabit = async (context) => {
	const { msg, from, args, senderJid, updateName, sendMessageWTyping } = context;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const action = String(args[0] || "list").toLowerCase();
	const habits = await listEnhancementItems(from, "habit", { memberJid: senderJid, status: "active" }, 20);
	if (action === "add") {
		const text = cleanFeatureText(args.slice(1).join(" "), 100);
		if (!text) return reply("❌ Usage: `habit add <habit>`. ");
		if (habits.length >= 10) return reply("❌ Maximum 10 active habits.");
		await createEnhancementItem({ groupJid: from, type: "habit", memberJid: senderJid, memberName: safeMemberName(updateName, senderJid), text, payload: { checkins: [] }, status: "active" });
		return reply("✅ Habit added.");
	}
	if (action === "check") {
		const item = itemAt(habits, args[1]);
		if (!item) return reply("❌ Habit not found. Check `habit list`. ");
		const today = dateKey();
		const checkins = [...new Set([...(item.payload?.checkins || []), today])].slice(-90);
		if ((item.payload?.checkins || []).includes(today)) return reply("✅ You already checked in for that habit today.");
		await updateEnhancementItem(from, "habit", item._id, { payload: { ...item.payload, checkins } });
		return reply(`✅ Habit checked for today. Total: *${checkins.length} days*.`);
	}
	if (["remove", "delete"].includes(action)) {
		const item = itemAt(habits, args[1]);
		if (!item) return reply("❌ Habit not found.");
		await removeEnhancementItem(from, "habit", item._id, senderJid);
		return reply("✅ Habit removed.");
	}
	if (action === "stats") {
		const item = itemAt(habits, args[1]);
		if (!item) return reply("❌ Habit not found.");
		const checkins = item.payload?.checkins || [];
		return reply(`📈 *${item.text}*\nCompleted days: *${checkins.length}*\nLast check-in: *${checkins.at(-1) || "never"}*`);
	}
	return reply(habits.length ? `🔁 *My Habits*\n\n${habits.map((item, index) => `${index + 1}. ${item.text} — ${item.payload?.checkins?.length || 0} checks`).join("\n")}\n\nUse \`habit check 1\`.` : "🔁 No habits yet. Use `habit add <habit>`. ");
};

const handleGoal = async (context) => {
	const { msg, from, args, senderJid, updateName, sendMessageWTyping } = context;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const action = String(args[0] || "list").toLowerCase();
	const goals = await listEnhancementItems(from, "goal", { memberJid: senderJid }, 20);
	if (action === "add") {
		const parts = args.slice(1).join(" ").split("|").map((part) => cleanFeatureText(part, 120));
		const target = Number(parts[1]);
		if (!parts[0] || !Number.isFinite(target) || target <= 0 || target > 1_000_000) return reply("❌ Usage: `goal add Read books | 12`. ");
		await createEnhancementItem({ groupJid: from, type: "goal", memberJid: senderJid, memberName: safeMemberName(updateName, senderJid), text: parts[0], payload: { current: 0, target }, status: "active" });
		return reply("✅ Goal created.");
	}
	const active = goals.filter((item) => item.status === "active");
	if (action === "progress") {
		const item = itemAt(active, args[1]);
		const amount = Number(args[2]);
		if (!item || !Number.isFinite(amount) || amount < 0) return reply("❌ Usage: `goal progress <number> <new progress>`. ");
		const current = Math.min(amount, item.payload.target);
		await updateEnhancementItem(from, "goal", item._id, { payload: { ...item.payload, current }, status: current >= item.payload.target ? "completed" : "active" });
		return reply(current >= item.payload.target ? "🏆 Goal completed!" : `✅ Progress: *${current}/${item.payload.target}*.`);
	}
	if (["remove", "delete"].includes(action)) {
		const item = itemAt(goals, args[1]);
		if (!item) return reply("❌ Goal not found.");
		await removeEnhancementItem(from, "goal", item._id, senderJid);
		return reply("✅ Goal removed.");
	}
	return reply(goals.length ? `🎯 *My Goals*\n\n${goals.map((item, index) => `${item.status === "completed" ? "✅" : "⬜"} ${index + 1}. ${item.text} — ${item.payload.current}/${item.payload.target}`).join("\n")}` : "🎯 No goals yet. Use `goal add Name | target`. ");
};

const handleDeadline = async (context) => {
	const { msg, from, args, senderJid, updateName, sendMessageWTyping } = context;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const action = String(args[0] || "list").toLowerCase();
	const deadlines = await listEnhancementItems(from, "deadline", { memberJid: senderJid }, 30);
	if (action === "add") {
		const date = parseDate(args[1]);
		const text = cleanFeatureText(args.slice(2).join(" ").replace(/^\|\s*/, ""), 160);
		if (!date || !text) return reply("❌ Usage: `deadline add YYYY-MM-DD | task`. ");
		await createEnhancementItem({ groupJid: from, type: "deadline", memberJid: senderJid, memberName: safeMemberName(updateName, senderJid), text, payload: { date: args[1] }, status: "open" });
		return reply("✅ Deadline saved.");
	}
	const open = deadlines.filter((item) => item.status === "open").sort((a, b) => a.payload.date.localeCompare(b.payload.date));
	if (action === "done") {
		const item = itemAt(open, args[1]);
		if (!item) return reply("❌ Deadline not found.");
		await updateEnhancementItem(from, "deadline", item._id, { status: "done", completedAt: new Date() });
		return reply("✅ Deadline completed.");
	}
	if (["remove", "delete"].includes(action)) {
		const item = itemAt(open, args[1]);
		if (!item) return reply("❌ Deadline not found.");
		await removeEnhancementItem(from, "deadline", item._id, senderJid);
		return reply("✅ Deadline removed.");
	}
	return reply(open.length ? `⏰ *My Deadlines*\n\n${open.map((item, index) => `${index + 1}. *${item.payload.date}* — ${item.text}`).join("\n")}` : "⏰ No open deadlines.");
};

const flashcardRounds = new Map();
const handleFlashcard = async (context) => {
	const { msg, from, args, senderJid, updateName, sendMessageWTyping } = context;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const action = String(args[0] || "list").toLowerCase();
	const cards = await listEnhancementItems(from, "flashcard", { memberJid: senderJid }, 50);
	if (action === "add") {
		const parts = args.slice(1).join(" ").split("|").map((part) => cleanFeatureText(part, 300));
		if (!parts[0] || !parts[1]) return reply("❌ Usage: `flashcard add question | answer`. ");
		await createEnhancementItem({ groupJid: from, type: "flashcard", memberJid: senderJid, memberName: safeMemberName(updateName, senderJid), text: parts[0], payload: { answer: parts[1] }, status: "active" });
		return reply("✅ Flashcard saved.");
	}
	if (action === "quiz") {
		if (!cards.length) return reply("❌ Add a flashcard first.");
		const card = cards[Math.floor(Math.random() * cards.length)];
		flashcardRounds.set(`${from}:${senderJid}`, { id: card._id, answer: card.payload.answer, expires: Date.now() + 120_000 });
		return reply(`🧠 *Flashcard*\n\n${card.text}\n\nReveal with \`flashcard reveal\`.`);
	}
	if (action === "reveal") {
		const round = flashcardRounds.get(`${from}:${senderJid}`);
		if (!round || round.expires <= Date.now()) return reply("❌ No active flashcard. Use `flashcard quiz`. ");
		flashcardRounds.delete(`${from}:${senderJid}`);
		return reply(`💡 Answer: *${round.answer}*`);
	}
	if (["remove", "delete"].includes(action)) {
		const item = itemAt(cards, args[1]);
		if (!item) return reply("❌ Flashcard not found.");
		await removeEnhancementItem(from, "flashcard", item._id, senderJid);
		return reply("✅ Flashcard removed.");
	}
	return reply(cards.length ? `🧠 *My Flashcards*\n\n${cards.map((item, index) => `${index + 1}. ${item.text}`).join("\n")}\n\nUse \`flashcard quiz\`.` : "🧠 No flashcards yet.");
};

const handleStudyRoom = async (context) => {
	const { msg, from, args, senderJid, updateName, isGroupAdmin, isOwner, sendMessageWTyping } = context;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const action = String(args[0] || "status").toLowerCase();
	const settings = await getEnhancementSettings(from);
	const room = settings.activeStudyRoom || null;
	if (action === "start") {
		if (room) return reply("❌ A study room is already active.");
		const title = cleanFeatureText(args.slice(1).join(" "), 100) || "Focus Session";
		await updateEnhancementSettings(from, { activeStudyRoom: { title, hostJid: senderJid, hostName: safeMemberName(updateName, senderJid), members: [{ jid: senderJid, name: safeMemberName(updateName, senderJid) }], startedAt: new Date() } });
		return reply(`📚 Study room started: *${title}*. Join with \`studyroom join\`.`);
	}
	if (action === "join") {
		if (!room) return reply("❌ No study room is active.");
		const members = [...(room.members || []).filter((member) => member.jid !== senderJid), { jid: senderJid, name: safeMemberName(updateName, senderJid) }].slice(-100);
		await updateEnhancementSettings(from, { activeStudyRoom: { ...room, members } });
		return reply(`✅ Joined *${room.title}*.`);
	}
	if (action === "end") {
		if (!room) return reply("❌ No study room is active.");
		if (room.hostJid !== senderJid && !isGroupAdmin && !isOwner) return reply("❌ Only the host or an admin can end it.");
		const minutes = Math.max(1, Math.round((Date.now() - new Date(room.startedAt).getTime()) / 60_000));
		await updateEnhancementSettings(from, { activeStudyRoom: null });
		return reply(`✅ Study room ended after *${minutes} minutes* with *${room.members?.length || 1} participants*.`);
	}
	return reply(room ? `📚 *${room.title}*\nHost: ${room.hostName}\nParticipants: *${room.members?.length || 1}*\nStarted: ${new Date(room.startedAt).toLocaleTimeString("en-NG", { timeZone: process.env.BOT_TIMEZONE || "Africa/Lagos", hour: "2-digit", minute: "2-digit" })}` : "📚 No study room is active. Use `studyroom start <title>`. ");
};

const handlePomodoro = async (context) => {
	const { msg, from, args, senderJid, sendMessageWTyping, command } = context;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const key = `${from}:${senderJid}`;
	if (command === "pomodorostop") {
		const timer = timers.get(key);
		if (!timer) return reply("⏱️ You have no active Pomodoro.");
		clearTimeout(timer);
		timers.delete(key);
		return reply("⏹️ Pomodoro stopped.");
	}
	const minutes = Number.parseInt(args[0] || "25", 10);
	if (!Number.isInteger(minutes) || minutes < 1 || minutes > 120) return reply("❌ Choose 1–120 minutes: `pomodoro 25`. ");
	if (timers.has(key)) return reply("❌ Stop your current Pomodoro first.");
	const timer = setTimeout(async () => {
		timers.delete(key);
		await sendMessageWTyping(from, { text: `⏰ @${senderJid.split("@")[0]}, your *${minutes}-minute Pomodoro* is complete. Take a short break!`, mentions: [senderJid] }).catch(() => {});
	}, minutes * 60_000);
	timer.unref?.();
	timers.set(key, timer);
	return reply(`⏱️ *${minutes}-minute Pomodoro* started. I will tag you when it ends.`);
};

const handleCalculator = async (context) => {
	const { msg, from, args, sendMessageWTyping, command } = context;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	if (command === "expensesplit") {
		const amount = Number(String(args[0] || "").replace(/,/g, ""));
		const people = mentions(msg);
		if (!Number.isFinite(amount) || amount <= 0 || !people.length) return reply("❌ Usage: `expensesplit 15000 @member1 @member2`. ");
		return reply(`🧾 Total: *₦${amount.toLocaleString("en-NG")}*\nPeople: *${people.length}*\nEach person: *₦${(amount / people.length).toLocaleString("en-NG", { maximumFractionDigits: 2 })}*`);
	}
	if (command === "tipcalc") {
		const amount = Number(String(args[0] || "").replace(/,/g, ""));
		const percent = Number(args[1]);
		if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(percent) || percent < 0 || percent > 100) return reply("❌ Usage: `tipcalc 25000 10`. ");
		const tip = amount * percent / 100;
		return reply(`💳 Tip: *₦${tip.toLocaleString("en-NG")}*\nTotal: *₦${(amount + tip).toLocaleString("en-NG")}*`);
	}
	if (command === "percentage") {
		const part = Number(args[0]);
		const total = Number(args[1]);
		if (!Number.isFinite(part) || !Number.isFinite(total) || total === 0) return reply("❌ Usage: `percentage 45 60`. ");
		return reply(`📊 ${part} is *${Number((part / total * 100).toFixed(2))}%* of ${total}.`);
	}
	if (command === "datecalc") {
		const first = parseDate(args[0]);
		const second = parseDate(args[1]);
		if (!first || !second) return reply("❌ Usage: `datecalc 2026-09-01 2026-12-25`. ");
		const days = Math.abs(Math.round((second - first) / 86_400_000));
		return reply(`📅 Difference: *${days} day${days === 1 ? "" : "s"}*.`);
	}
	if (command === "randompick") {
		const choices = args.join(" ").split("|").map((choice) => cleanFeatureText(choice, 100)).filter(Boolean);
		if (choices.length < 2 || choices.length > 30) return reply("❌ Usage: `randompick option one | option two | option three`. ");
		return reply(`🎯 Alpha picks: *${choices[Math.floor(Math.random() * choices.length)]}*`);
	}
};

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const context = { sock, msg, from, args, ...msgInfoObj };
	if (!["habits", "goals", "deadlines", "flashcards"].includes(msgInfoObj.command) && !allow(`${from}:${msgInfoObj.senderJid}:${msgInfoObj.command}`)) return;
	try {
		switch (msgInfoObj.command) {
			case "habit": case "habits": return handleHabit({ ...context, args: msgInfoObj.command === "habits" && !args.length ? ["list"] : args });
			case "goal": case "goals": return handleGoal({ ...context, args: msgInfoObj.command === "goals" && !args.length ? ["list"] : args });
			case "deadline": case "deadlines": return handleDeadline({ ...context, args: msgInfoObj.command === "deadlines" && !args.length ? ["list"] : args });
			case "flashcard": case "flashcards": return handleFlashcard({ ...context, args: msgInfoObj.command === "flashcards" && !args.length ? ["list"] : args });
			case "studyroom": return handleStudyRoom(context);
			case "pomodoro": case "pomodorostop": return handlePomodoro(context);
			case "expensesplit": case "tipcalc": case "percentage": case "datecalc": case "randompick": return handleCalculator(context);
			case "productivityhelp": return msgInfoObj.sendMessageWTyping(from, { text: "🧠 *Productivity Suite*\n\n`habit` · `goal` · `deadline` · `flashcard`\n`studyroom` · `pomodoro`\n`expensesplit` · `tipcalc` · `percentage`\n`datecalc` · `randompick`" }, { quoted: msg });
		}
	} catch (error) {
		console.error("Productivity Suite failed:", error.message);
		return msgInfoObj.sendMessageWTyping(from, { text: "❌ The productivity feature is temporarily unavailable." }, { quoted: msg });
	}
};

export default () => ({
	cmd: PRODUCTIVITY_COMMANDS,
	desc: "Habits, goals, deadlines, flashcards, study rooms, focus timers and everyday calculations",
	usage: "habit add | goal add | deadline add | flashcard add | studyroom start | pomodoro 25",
	handler,
});
