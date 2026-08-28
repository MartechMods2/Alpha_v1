import { createSafeItem, getSafeSettings, listSafeItems, updateSafeItem } from "../../../db/safePackData.js";
import { cleanSafeText, parseSafeDuration } from "../../../utils/safePack.js";
import { listEnhancementItems } from "../../../db/enhancementData.js";

const itemAt = (items, value) => items[Number(value) - 1] || null;
const targetFrom = (context) => context?.mentionedJid?.[0] || context?.participant || "";
const similarity = (a, b) => {
	const left = new Set(String(a).toLowerCase().split(/\W+/).filter(Boolean)); const right = new Set(String(b).toLowerCase().split(/\W+/).filter(Boolean));
	const common = [...left].filter((x) => right.has(x)).length; return common / Math.max(1, new Set([...left, ...right]).size);
};

const handler = async (sock, msg, from, args, info) => {
	const { command, senderJid, updateName, extendedMessageOriginal, isGroupAdmin, isOwner, sendMessageWTyping } = info;
	const reply = (text, mentions = []) => sendMessageWTyping(from, { text, mentions }, { quoted: msg });
	try {
		if (["remindplus", "snooze", "reschedule"].includes(command)) {
			const reminders = await listSafeItems(from, "personal-reminder", { memberJid: senderJid, status: "active" }, 20);
			if (command === "remindplus") {
				if (String(args[0] || "list").toLowerCase() === "list") return reply(reminders.length ? `⏰ *My Extended Reminders*\n${reminders.map((x, i) => `${i + 1}. ${x.text} — ${new Date(x.payload.nextRun).toLocaleString("en-NG", { timeZone: process.env.BOT_TIMEZONE || "Africa/Lagos" })}`).join("\n")}` : "⏰ No extended reminders.");
				const ms = parseSafeDuration(args[0], { min: 60_000, max: 365 * 86_400_000 }); const text = cleanSafeText(args.slice(1).join(" "), 300); if (!ms || !text) return reply("❌ Usage: `remindplus 30d Renew subscription`. ");
				await createSafeItem({ groupJid: from, type: "personal-reminder", memberJid: senderJid, memberName: updateName, text, payload: { nextRun: new Date(Date.now() + ms) }, status: "active" }); return reply("✅ Extended reminder saved.");
			}
			const item = itemAt(reminders, args[0]); const ms = parseSafeDuration(args[1], { min: 60_000, max: 365 * 86_400_000 }); if (!item || !ms) return reply(`❌ Usage: \`${command} <number> <10m|2h|30d>\`.`);
			await updateSafeItem(from, "personal-reminder", item._id, { payload: { ...item.payload, nextRun: new Date(Date.now() + ms) } }); return reply(`✅ Reminder ${command === "snooze" ? "snoozed" : "rescheduled"}.`);
		}
		if (command === "taskassign") {
			const action = String(args[0] || "list").toLowerCase(); const tasks = await listSafeItems(from, "assigned-task", {}, 50);
			if (action === "list") return reply(tasks.length ? `📋 *Assigned Tasks*\n${tasks.map((x, i) => `${x.status === "done" ? "✅" : "⬜"} ${i + 1}. ${x.text} — @${x.payload.assigneeJid?.split("@")[0]}${x.payload.due ? ` — due ${x.payload.due}` : ""}`).join("\n")}` : "📋 No assigned tasks.", tasks.map((x) => x.payload.assigneeJid).filter(Boolean));
			if (action === "done") { const item = itemAt(tasks, args[1]); if (!item || (item.payload.assigneeJid !== senderJid && !isGroupAdmin && !isOwner)) return reply("❌ Task not found or not assigned to you."); await updateSafeItem(from, "assigned-task", item._id, { status: "done", completedAt: new Date() }); return reply("✅ Task completed."); }
			if (!isGroupAdmin && !isOwner) return reply("❌ Only an admin can assign tasks."); const target = targetFrom(extendedMessageOriginal); const [textPart, duePart] = args.slice(1).filter((x) => !x.startsWith("@")).join(" ").split("|").map((x) => cleanSafeText(x, 200));
			if (action !== "add" || !target || !textPart) return reply("❌ Usage: `taskassign add @member Task | YYYY-MM-DD`. "); await createSafeItem({ groupJid: from, type: "assigned-task", memberJid: senderJid, text: textPart, payload: { assigneeJid: target, due: duePart || "", subtasks: [] }, status: "open" }); return reply("✅ Task assigned.", [target]);
		}
		if (["form", "formanswer", "formresults"].includes(command)) {
			const forms = await listSafeItems(from, "group-form", { status: "active" }, 20);
			if (command === "form" && (!args.length || args[0] === "list")) return reply(forms.length ? `📝 *Forms*\n${forms.map((x, i) => `${i + 1}. ${x.text}`).join("\n")}` : "📝 No active forms.");
			if (command === "form" && args[0] === "add") { if (!isGroupAdmin && !isOwner) return reply("❌ Only admins can create forms."); const [title, ...questions] = args.slice(1).join(" ").split("|").map((x) => cleanSafeText(x, 200)).filter(Boolean); if (!title || !questions.length) return reply("❌ Usage: `form add Title | Question 1 | Question 2`. "); await createSafeItem({ groupJid: from, type: "group-form", memberJid: senderJid, text: title, payload: { questions: questions.slice(0, 10), responses: [] }, status: "active" }); return reply("✅ Form created."); }
			const item = itemAt(forms, args[0]); if (!item) return reply("❌ Form not found.");
			if (command === "formanswer") { const answers = args.slice(1).join(" ").split("|").map((x) => cleanSafeText(x, 300)); if (answers.length !== item.payload.questions.length) return reply(`❌ Submit ${item.payload.questions.length} answers separated by \`|\`.`); const responses = [...(item.payload.responses || []).filter((x) => x.memberJid !== senderJid), { memberJid: senderJid, memberName: updateName, answers, createdAt: new Date() }].slice(-100); await updateSafeItem(from, "group-form", item._id, { payload: { ...item.payload, responses } }); return reply("✅ Form response saved."); }
			if (!isGroupAdmin && !isOwner) return reply("❌ Only admins can view results."); return reply(`📊 *${item.text}* — ${item.payload.responses?.length || 0} responses\n\n${(item.payload.responses || []).map((x, i) => `${i + 1}. ${x.memberName}: ${x.answers.join(" | ")}`).join("\n") || "No responses."}`);
		}
		if (["slots", "bookslot"].includes(command)) {
			const slots = await listSafeItems(from, "booking-slot", { status: "open" }, 30);
			if (command === "slots" && args[0] === "add") { if (!isGroupAdmin && !isOwner) return reply("❌ Only admins can add slots."); const text = cleanSafeText(args.slice(1).join(" "), 100); if (!text) return reply("❌ Usage: `slots add Friday 14:00`. "); await createSafeItem({ groupJid: from, type: "booking-slot", memberJid: senderJid, text, status: "open" }); return reply("✅ Booking slot added."); }
			if (command === "bookslot") { const item = itemAt(slots, args[0]); if (!item) return reply("❌ Slot not found."); await updateSafeItem(from, "booking-slot", item._id, { status: "booked", payload: { bookedBy: senderJid, bookedName: updateName } }); return reply("✅ Slot booked."); }
			return reply(slots.length ? `📆 *Available Slots*\n${slots.map((x, i) => `${i + 1}. ${x.text}`).join("\n")}` : "📆 No available slots.");
		}
		if (["fileindex", "filesearch"].includes(command)) {
			const files = await listSafeItems(from, "file-index", { status: "active" }, 50); if (command === "fileindex") { const context = msg.message?.extendedTextMessage?.contextInfo; const quoted = context?.quotedMessage?.documentMessage; const title = cleanSafeText(args.join(" "), 100) || quoted?.fileName; if (!quoted || !title) return reply("❌ Reply to a document with `fileindex <title>`. "); await createSafeItem({ groupJid: from, type: "file-index", memberJid: senderJid, memberName: updateName, text: title, payload: { fileName: quoted.fileName || "document", mimetype: quoted.mimetype || "", messageId: context.stanzaId, participant: context.participant }, status: "active" }); return reply("✅ Document indexed. The bot stores references, not private file contents."); }
			const query = cleanSafeText(args.join(" "), 100).toLowerCase(); const matches = files.filter((x) => x.text.toLowerCase().includes(query) || x.payload.fileName?.toLowerCase().includes(query)).slice(0, 20); return reply(matches.length ? `🔎 *File Results*\n${matches.map((x, i) => `${i + 1}. ${x.text} — ${x.payload.fileName}`).join("\n")}` : "🔎 No indexed file matched.");
		}
		if (command === "smartfaq") {
			const settings = await getSafeSettings(from); if (!settings.semanticFaqEnabled) return reply("❌ Smart FAQ is disabled. An admin can enable it with `smartfaqadmin on`."); const faqs = await listEnhancementItems(from, "faq", { status: "active" }, 50); const query = cleanSafeText(args.join(" "), 200); if (!query) return reply("❌ Usage: `smartfaq <question>`. "); const best = faqs.map((x) => ({ x, score: similarity(query, x.text) })).sort((a, b) => b.score - a.score)[0]; return reply(best?.score >= 0.12 ? `🧠 *${best.x.text}*\n${best.x.payload.answer}` : "I could not find an approved FAQ answer. Ask an admin to add one.");
		}
	} catch (error) { console.error("Safe community plus failed:", error.message); return reply(`❌ ${error.message}`); }
};

export default () => ({ cmd: ["remindplus", "snooze", "reschedule", "taskassign", "form", "formanswer", "formresults", "slots", "bookslot", "fileindex", "filesearch", "smartfaq"], desc: "Extended reminders, assigned tasks, forms, booking, file index and approved FAQ search", usage: "remindplus 30d text | taskassign | form | slots | filesearch", handler });
