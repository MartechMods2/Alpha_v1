import { createSafeItem, getSafeSettings, listSafeItems, removeSafeItem, updateSafeItem, updateSafeSettings } from "../../../db/safePackData.js";
import { cleanSafeText, nextClockDate } from "../../../utils/safePack.js";
import { extractPhoneNumber } from "../../../utils/lid.js";

const itemAt = (items, value) => items[Number(value) - 1] || null;
const targetFrom = (context) => context?.mentionedJid?.[0] || context?.participant || "";

const handler = async (sock, msg, from, args, info) => {
	const { command, senderJid, updateName, extendedMessageOriginal, sendMessageWTyping } = info;
	const reply = (text, mentions = []) => sendMessageWTyping(from, { text, mentions }, { quoted: msg });
	try {
		if (["schedulepost", "schedulepoll"].includes(command)) {
			const type = command; const action = String(args[0] || "list").toLowerCase(); const active = await listSafeItems(from, type, { status: "active" }, 10);
			if (action === "list") return reply(active.length ? `⏰ *${command}*\n\n${active.map((x, i) => `${i + 1}. ${x.text} — ${new Date(x.payload.nextRun).toLocaleString("en-NG", { timeZone: process.env.BOT_TIMEZONE || "Africa/Lagos" })}${x.payload.repeat ? ` (${x.payload.repeat})` : ""}`).join("\n")}` : `⏰ No active ${command}.`);
			if (["remove", "cancel"].includes(action)) { const item = itemAt(active, args[1]); if (!item) return reply("❌ Scheduled item not found."); await removeSafeItem(from, type, item._id); return reply("✅ Scheduled item cancelled."); }
			if (action !== "add") return reply(`❌ Usage: \`${command} add 20:00 [daily|weekly|once] | content\`.`);
			if (active.length >= 1) return reply(`🛡️ Only one active ${command} is allowed per group to prevent spam.`);
			const [head, ...contentParts] = args.slice(1).join(" ").split("|"); const [clock, repeatRaw = "once"] = head.trim().split(/\s+/); const nextRun = nextClockDate(clock); const repeat = ["once", "daily", "weekly"].includes(repeatRaw) ? repeatRaw : "once"; const text = cleanSafeText(contentParts.join("|"), 1000);
			if (!nextRun || !text) return reply(`❌ Usage: \`${command} add 20:00 daily | content\`.`);
			const payload = type === "schedulepoll" ? (() => { const parts = text.split(";").map((x) => cleanSafeText(x, 100)).filter(Boolean); return { nextRun, repeat, question: parts[0], options: parts.slice(1, 13) }; })() : { nextRun, repeat };
			if (type === "schedulepoll" && payload.options.length < 2) return reply("❌ Poll content must be `Question; Option 1; Option 2`. ");
			await createSafeItem({ groupJid: from, type, memberJid: senderJid, memberName: updateName, text, payload, status: "active" }); return reply(`✅ ${command} scheduled for *${clock}* (${repeat}).`);
		}
		if (command === "eventrepeat") {
			const action = String(args[0] || "list").toLowerCase(); const events = await listSafeItems(from, "recurring-event", { status: "active" }, 20);
			if (action === "list") return reply(events.length ? `🔁 *Recurring Events*\n${events.map((x, i) => `${i + 1}. ${x.text} — ${x.payload.day} ${x.payload.time}`).join("\n")}` : "🔁 No recurring events.");
			if (action === "remove") { const item = itemAt(events, args[1]); if (!item) return reply("❌ Event not found."); await removeSafeItem(from, "recurring-event", item._id); return reply("✅ Recurring event removed."); }
			const [schedule, ...titleParts] = args.slice(1).join(" ").split("|"); const [day, time] = schedule.trim().split(/\s+/); const title = cleanSafeText(titleParts.join("|"), 120);
			if (action !== "add" || !/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i.test(day || "") || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time || "") || !title) return reply("❌ Usage: `eventrepeat add Friday 20:00 | Game Night`. ");
			await createSafeItem({ groupJid: from, type: "recurring-event", memberJid: senderJid, text: title, payload: { day, time }, status: "active" }); return reply("✅ Recurring event created.");
		}
		if (command === "dutyrotate") {
			const action = String(args[0] || "status").toLowerCase(); const duties = await listSafeItems(from, "duty-rota", { status: "active" }, 20);
			if (action === "list" || action === "status") return reply(duties.length ? `🔄 *Duty Rota*\n${duties.map((x, i) => `${i + 1}. ${x.text} — ${(x.payload.members || []).map((m) => `@${extractPhoneNumber(m)}`).join(", ")}`).join("\n")}` : "🔄 No duty rota.", duties.flatMap((x) => x.payload.members || []));
			if (action === "remove") { const item = itemAt(duties, args[1]); if (!item) return reply("❌ Rota not found."); await removeSafeItem(from, "duty-rota", item._id); return reply("✅ Duty rota removed."); }
			const target = targetFrom(extendedMessageOriginal); const title = cleanSafeText(args.filter((x) => !x.startsWith("@")).slice(1).join(" "), 80); if (action !== "add" || !target || !title) return reply("❌ Tag at least one member: `dutyrotate add Clean-up @member`. ");
			const mentions = extendedMessageOriginal?.mentionedJid || [target]; await createSafeItem({ groupJid: from, type: "duty-rota", memberJid: senderJid, text: title, payload: { members: mentions, index: 0 }, status: "active" }); return reply("✅ Duty rota saved.");
		}
		if (command === "attendancesession") {
			const action = String(args[0] || "status").toLowerCase(); const sessions = await listSafeItems(from, "attendance-session", {}, 20); const open = sessions.find((x) => x.status === "open");
			if (action === "open") { if (open) return reply("❌ An attendance session is already open."); const title = cleanSafeText(args.slice(1).join(" "), 100) || "Attendance"; await createSafeItem({ groupJid: from, type: "attendance-session", memberJid: senderJid, text: title, payload: { attendees: [] }, status: "open" }); return reply(`✅ Attendance opened: *${title}*. Members use \`attendance check\`.`); }
			if (action === "close") { if (!open) return reply("❌ No attendance session is open."); await updateSafeItem(from, "attendance-session", open._id, { status: "closed", closedAt: new Date() }); return reply(`✅ Attendance closed with *${open.payload?.attendees?.length || 0}* members.`); }
			return reply(open ? `🟢 Open: *${open.text}* — ${open.payload?.attendees?.length || 0} checked in.` : "⚪ No attendance session is open.");
		}
		if (command === "attendanceexport") {
			const sessions = await listSafeItems(from, "attendance-session", {}, 20); const item = itemAt(sessions, args[0] || 1); if (!item) return reply("❌ Attendance session not found.");
			const csv = `name,jid,checked_at\n${(item.payload.attendees || []).map((x) => `"${String(x.name || "").replaceAll('"', '""')}","${x.jid}","${x.checkedAt}"`).join("\n")}`; return sendMessageWTyping(from, { document: Buffer.from(csv), mimetype: "text/csv", fileName: `attendance-${item._id.slice(0, 8)}.csv` }, { quoted: msg });
		}
		if (command === "botlang") {
			const language = String(args[0] || "status").toLowerCase(); const allowed = ["en", "yo", "ig", "ha", "pcm"];
			if (language === "status") { const settings = await getSafeSettings(from); return reply(`🌍 Bot language: *${settings.botLanguage}*`); }
			if (!allowed.includes(language)) return reply("❌ Choose `en`, `yo`, `ig`, `ha`, or `pcm`."); await updateSafeSettings(from, { botLanguage: language }); return reply(`✅ Group bot language set to *${language}*.`);
		}
		if (command === "smartfaqadmin") {
			const value = String(args[0] || "status").toLowerCase(); const settings = await getSafeSettings(from); if (["on", "off"].includes(value)) { await updateSafeSettings(from, { semanticFaqEnabled: value === "on" }); return reply(`✅ Smart FAQ ${value.toUpperCase()}.`); } return reply(`🧠 Smart FAQ: *${settings.semanticFaqEnabled ? "ON" : "OFF"}*`);
		}
		if (command === "workflow") {
			const action = String(args[0] || "list").toLowerCase(); const rows = await listSafeItems(from, "approval-workflow", { status: "active" }, 20);
			if (action === "list") return reply(rows.length ? `🔀 *Approval Workflows*\n${rows.map((x, i) => `${i + 1}. ${x.text}`).join("\n")}` : "🔀 No workflows.");
			if (action === "remove") { const item = itemAt(rows, args[1]); if (!item) return reply("❌ Workflow not found."); await removeSafeItem(from, "approval-workflow", item._id); return reply("✅ Workflow removed."); }
			const text = cleanSafeText(args.slice(1).join(" "), 200); if (action !== "add" || !text.includes("->")) return reply("❌ Usage: `workflow add trigger -> admin review queue`. "); await createSafeItem({ groupJid: from, type: "approval-workflow", memberJid: senderJid, text, status: "active" }); return reply("✅ Approval workflow saved. It never performs punishments automatically.");
		}
	} catch (error) { console.error("Safe automation admin failed:", error.message); return reply(`❌ ${error.message}`); }
};

export default () => ({ cmd: ["schedulepost", "schedulepoll", "eventrepeat", "dutyrotate", "attendancesession", "attendanceexport", "botlang", "smartfaqadmin", "workflow"], desc: "Low-volume scheduled posts, polls, events, attendance and approval workflows", usage: "schedulepost add 20:00 once | text", handler });
