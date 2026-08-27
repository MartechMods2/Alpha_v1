import {
	clearEnhancementItems,
	countEnhancementItems,
	createEnhancementItem,
	getEnhancementSettings,
	listEnhancementItems,
	removeEnhancementItem,
	updateEnhancementItem,
	updateEnhancementProfile,
	updateEnhancementSettings,
} from "../../../db/enhancementData.js";
import { cleanFeatureText, dateKey, resolveMentionTarget, shortId } from "../../../utils/featureSuite.js";
import { invalidateAdvancedAutomationCache } from "../../../utils/advancedAutomation.js";
import { ENHANCEMENT_ADMIN_COMMANDS } from "../../../utils/ultimateFeatureCatalog.js";

const itemAt = (items, value) => items[Number.parseInt(value, 10) - 1] || null;
const queueText = (title, items, render) => items.length ? `${title}\n\n${items.map(render).join("\n")}` : `${title}\n\nQueue is empty.`;

const handleReviewQueue = async (context, type, label) => {
	const { msg, from, args, sendMessageWTyping, command } = context;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const pending = await listEnhancementItems(from, type, { status: "pending" }, 50);
	if (command.endsWith("queue")) {
		return reply(queueText(`📥 *${label} Queue*`, pending, (item, index) => `${index + 1}. [${shortId(item._id)}] ${item.text} — _${item.memberName}_`));
	}
	const decision = String(args[0] || "").toLowerCase();
	const item = itemAt(pending, args[1]);
	if (!["approve", "reject"].includes(decision) || !item) return reply(`❌ Usage: \`${command} approve|reject <number>\`.`);
	await updateEnhancementItem(from, type, item._id, { status: decision === "approve" ? "approved" : "rejected", reviewedAt: new Date() });
	return reply(`✅ ${label.slice(0, -1)} *${decision}d*.`);
};

const handleReports = async (context) => {
	const { msg, from, args, sendMessageWTyping, command } = context;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const reports = await listEnhancementItems(from, "member-report", { status: "open" }, 50);
	if (command === "reportqueue") return reply(queueText("🚨 *Member Report Queue*", reports, (item, index) => `${index + 1}. [${shortId(item._id)}] Target: @${item.payload.targetJid.split("@")[0]}\n   ${item.text} — _reported by ${item.memberName}_`));
	const item = itemAt(reports, args[0]);
	if (!item) return reply("❌ Usage: `resolvereport <number> [admin note]`. ");
	await updateEnhancementItem(from, "member-report", item._id, { status: "resolved", resolution: cleanFeatureText(args.slice(1).join(" "), 300), resolvedAt: new Date() });
	return reply("✅ Report resolved and retained in the audit history.");
};

const handleTicketAdmin = async ({ msg, from, args, sendMessageWTyping }) => {
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const open = await listEnhancementItems(from, "ticket", { status: "open" }, 50);
	const action = String(args[0] || "list").toLowerCase();
	if (action === "list") return reply(queueText("🎫 *Open Support Tickets*", open, (item, index) => `${index + 1}. [${shortId(item._id)}] ${item.text} — _${item.memberName}_`));
	if (action === "close") {
		const item = itemAt(open, args[1]);
		if (!item) return reply("❌ Ticket not found.");
		await updateEnhancementItem(from, "ticket", item._id, { status: "closed", adminNote: cleanFeatureText(args.slice(2).join(" "), 300), closedAt: new Date() });
		return reply("✅ Ticket closed.");
	}
	return reply("🎫 Use `ticketadmin list` or `ticketadmin close <number> [note]`. ");
};

const handleFaqAdmin = async ({ msg, from, args, senderJid, updateName, sendMessageWTyping }) => {
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const action = String(args[0] || "list").toLowerCase();
	const faqs = await listEnhancementItems(from, "faq", { status: "active" }, 50);
	if (action === "add") {
		const [question, ...answerParts] = args.slice(1).join(" ").split("|");
		const cleanQuestion = cleanFeatureText(question, 120);
		const answer = cleanFeatureText(answerParts.join("|"), 700);
		if (!cleanQuestion || !answer) return reply("❌ Usage: `faqadmin add question | answer`. ");
		await createEnhancementItem({ groupJid: from, type: "faq", memberJid: senderJid, memberName: updateName, text: cleanQuestion, payload: { answer }, status: "active" });
		return reply("✅ FAQ entry added.");
	}
	if (["remove", "delete"].includes(action)) {
		const item = itemAt(faqs, args[1]);
		if (!item) return reply("❌ FAQ entry not found.");
		await removeEnhancementItem(from, "faq", item._id);
		return reply("✅ FAQ entry removed.");
	}
	return reply(queueText("❓ *FAQ Manager*", faqs, (item, index) => `${index + 1}. *${item.text}* — ${item.payload.answer}`));
};

const handleMarketAdmin = async ({ msg, from, args, sendMessageWTyping }) => {
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const pending = await listEnhancementItems(from, "market", { status: "pending" }, 50);
	const action = String(args[0] || "queue").toLowerCase();
	if (action === "queue") return reply(queueText("🛍️ *Market Approval Queue*", pending, (item, index) => `${index + 1}. *${item.text}* — ${item.payload.details}\n   _${item.memberName}_`));
	const item = itemAt(pending, args[1]);
	if (!["approve", "reject"].includes(action) || !item) return reply("❌ Usage: `marketadmin approve|reject <number>`. ");
	await updateEnhancementItem(from, "market", item._id, { status: action === "approve" ? "approved" : "rejected", reviewedAt: new Date() });
	return reply(`✅ Listing ${action}d.`);
};

const handleAutoReply = async ({ msg, from, args, senderJid, updateName, sendMessageWTyping }) => {
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const action = String(args[0] || "status").toLowerCase();
	const settings = await getEnhancementSettings(from);
	const entries = await listEnhancementItems(from, "autoreply", { status: "active" }, 30);
	if (["on", "off"].includes(action)) {
		await updateEnhancementSettings(from, { autoReplyEnabled: action === "on" });
		invalidateAdvancedAutomationCache(from);
		return reply(`✅ Smart auto-replies turned *${action.toUpperCase()}*.`);
	}
	if (action === "add") {
		const [trigger, ...responseParts] = args.slice(1).join(" ").split("|");
		const cleanTrigger = cleanFeatureText(trigger, 80).toLowerCase();
		const response = cleanFeatureText(responseParts.join("|"), 500);
		if (cleanTrigger.length < 2 || !response) return reply("❌ Usage: `autoreply add trigger | response`. ");
		if (entries.length >= 30) return reply("❌ Maximum 30 auto-reply rules.");
		await createEnhancementItem({ groupJid: from, type: "autoreply", memberJid: senderJid, memberName: updateName, text: cleanTrigger, payload: { response }, status: "active" });
		invalidateAdvancedAutomationCache(from);
		return reply("✅ Auto-reply rule added. It remains inactive until `autoreply on`. ");
	}
	if (["remove", "delete"].includes(action)) {
		const item = itemAt(entries, args[1]);
		if (!item) return reply("❌ Auto-reply rule not found.");
		await removeEnhancementItem(from, "autoreply", item._id);
		invalidateAdvancedAutomationCache(from);
		return reply("✅ Auto-reply rule removed.");
	}
	if (action === "hours") {
		const value = String(args[1] || "").toLowerCase();
		if (value === "off") {
			await updateEnhancementSettings(from, { autoReplyHours: null });
			invalidateAdvancedAutomationCache(from);
			return reply("✅ Auto-reply hours disabled.");
		}
		if (!/^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/.test(value)) return reply("❌ Usage: `autoreply hours 08:00-22:00` or `autoreply hours off`. ");
		await updateEnhancementSettings(from, { autoReplyHours: value });
		invalidateAdvancedAutomationCache(from);
		return reply(`✅ Auto-replies limited to *${value}* (${process.env.BOT_TIMEZONE || "Africa/Lagos"}).`);
	}
	return reply(`🤖 *Smart Auto-Replies*\nStatus: *${settings.autoReplyEnabled ? "ON" : "OFF"}*\nHours: *${settings.autoReplyHours || "all day"}*\nRules: *${entries.length}/30*\n\n${entries.map((item, index) => `${index + 1}. “${item.text}” → ${item.payload.response}`).join("\n") || "No rules configured."}`);
};

const handleCustomRoles = async (context) => {
	const { msg, from, args, senderJid, updateName, sendMessageWTyping, command } = context;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const roles = await listEnhancementItems(from, "custom-role", { status: "active" }, 30);
	if (command === "roles") return reply(queueText("🎭 *Custom Group Roles*", roles, (item, index) => `${index + 1}. *${item.text}*${item.payload.memberJid ? ` — @${item.payload.memberJid.split("@")[0]}` : " — unassigned"}`));
	const action = String(args[0] || "list").toLowerCase();
	if (action === "add") {
		const name = cleanFeatureText(args.slice(1).join(" "), 30).replace(/[*_~`]/g, "");
		if (name.length < 2) return reply("❌ Usage: `roleadmin add <role name>`. ");
		await createEnhancementItem({ groupJid: from, type: "custom-role", memberJid: senderJid, memberName: updateName, text: name, payload: { memberJid: "" }, status: "active" });
		return reply("✅ Custom role added.");
	}
	if (action === "assign") {
		const target = resolveMentionTarget(msg);
		const item = itemAt(roles, args.find((arg) => /^\d+$/.test(arg)));
		if (!target || !item) return reply("❌ Usage: `roleadmin assign <role number> @member`. ");
		await updateEnhancementItem(from, "custom-role", item._id, { payload: { memberJid: target } });
		return reply(`✅ *${item.text}* assigned to @${target.split("@")[0]}.`);
	}
	if (["remove", "delete"].includes(action)) {
		const item = itemAt(roles, args[1]);
		if (!item) return reply("❌ Role not found.");
		await removeEnhancementItem(from, "custom-role", item._id);
		return reply("✅ Role removed.");
	}
	return reply("🎭 Use `roleadmin add <name>`, `roleadmin assign <number> @member`, `roles`, or `roleadmin remove <number>`. ");
};

const handleMaintenance = async (context) => {
	const { msg, from, args, sendMessageWTyping, command } = context;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	if (command === "attendanceadmin") {
		if (String(args[0] || "").toLowerCase() !== "clear") return reply("❌ Usage: `attendanceadmin clear`. ");
		await clearEnhancementItems(from, "checkin", { "payload.date": dateKey() });
		return reply("✅ Today’s attendance cleared.");
	}
	if (command === "standupadmin") {
		if (String(args[0] || "").toLowerCase() !== "clear") return reply("❌ Usage: `standupadmin clear`. ");
		await clearEnhancementItems(from, "standup", { "payload.date": dateKey() });
		return reply("✅ Today’s stand-ups cleared.");
	}
	if (command === "nicknameadmin") {
		const target = resolveMentionTarget(msg);
		if (!target) return reply("❌ Tag or reply to a member: `nicknameadmin @member`. ");
		await updateEnhancementProfile(from, target, { nickname: "" });
		return reply("✅ Member nickname cleared.");
	}
	if (command === "communitystats") {
		const types = ["suggestion", "confession", "market", "ticket", "member-report", "checkin", "standup", "habit", "goal", "deadline", "flashcard"];
		const counts = await Promise.all(types.map((type) => countEnhancementItems(from, { type })));
		return reply(`📊 *Community Feature Statistics*\n\n${types.map((type, index) => `• ${type}: *${counts[index]}*`).join("\n")}`);
	}
	if (command === "enhancementreset") {
		if (String(args[0] || "").toLowerCase() !== "confirm") return reply("⚠️ This clears the new community/productivity data. Use `enhancementreset confirm`. ");
		await Promise.all([clearEnhancementItems(from, "suggestion"), clearEnhancementItems(from, "confession"), clearEnhancementItems(from, "market"), clearEnhancementItems(from, "ticket"), clearEnhancementItems(from, "member-report"), clearEnhancementItems(from, "checkin"), clearEnhancementItems(from, "standup"), updateEnhancementSettings(from, { autoReplyEnabled: false, activeStudyRoom: null })]);
		invalidateAdvancedAutomationCache(from);
		return reply("✅ Review queues, attendance, stand-ups and active automation were reset. Personal habits and flashcards were preserved.");
	}
};

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const context = { sock, msg, from, args, ...msgInfoObj };
	try {
		switch (msgInfoObj.command) {
			case "suggestionqueue": return handleReviewQueue(context, "suggestion", "Suggestions");
			case "suggestionreview": return handleReviewQueue(context, "suggestion", "Suggestions");
			case "confessionqueue": return handleReviewQueue(context, "confession", "Confessions");
			case "confessionreview": return handleReviewQueue(context, "confession", "Confessions");
			case "reportqueue": case "resolvereport": return handleReports(context);
			case "ticketadmin": return handleTicketAdmin(context);
			case "faqadmin": return handleFaqAdmin(context);
			case "marketadmin": return handleMarketAdmin(context);
			case "autoreply": return handleAutoReply(context);
			case "roleadmin": case "roles": return handleCustomRoles(context);
			case "attendanceadmin": case "standupadmin": case "nicknameadmin": case "communitystats": case "enhancementreset": return handleMaintenance(context);
		}
	} catch (error) {
		console.error("Enhancement Admin failed:", error.message);
		return msgInfoObj.sendMessageWTyping(from, { text: "❌ The admin feature is temporarily unavailable." }, { quoted: msg });
	}
};

export default () => ({
	cmd: ENHANCEMENT_ADMIN_COMMANDS,
	desc: "Admin review queues, FAQ, marketplace, auto-replies, custom roles and community controls",
	usage: "suggestionqueue | suggestionreview approve 1 | autoreply add trigger | response",
	handler,
});
