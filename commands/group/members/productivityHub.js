import {
	addFaqEntry, addGroupTask, addMemberBookmark, assignGroupTask, clearAfkStatus,
	getMemberBookmarks, getProductivityGroup, removeFaqEntry, removeGroupTask,
	removeMemberBookmark, setAfkStatus, setGroupTaskState,
} from "../../../db/productivityData.js";
import { invalidateAfkGroupCache } from "../../../utils/afkPresence.js";
import { findBestFaq, makeProductivityId, parseTaskInput, quotedTextFromContext, safeDisplayName } from "../../../utils/groupProductivity.js";

const targetFromContext = (context) => (Array.isArray(context?.mentionedJid) ? context.mentionedJid[0] : context?.mentionedJid) || context?.participant || "";
const adminish = (info) => Boolean(info.isGroupAdmin || info.isOwner || info.isModerator);
const taskLine = (task) => `${task.done ? "✅" : "⬜"} *${task.id}* [${task.priority}] ${task.title}${task.due ? ` · due ${task.due}` : ""}${task.assigneeJid ? ` · @${task.assigneeJid.split("@")[0]}` : ""}`;

const handler = async (_sock, msg, from, args, info) => {
	const { command, prefix = "$", senderJid, updateName, extendedMessageOriginal, sendMessageWTyping } = info;
	const reply = (text, mentions = []) => sendMessageWTyping(from, { text, mentions }, { quoted: msg });
	const target = targetFromContext(extendedMessageOriginal);
	const action = String(args[0] || "").toLowerCase();

	if (["productivity", "workhub", "groupwork"].includes(command)) return reply(
		`🧰 *Alpha Group Productivity*\n\n` +
		`${prefix}task add <task> | high | due Friday\n${prefix}task list\n${prefix}task mine\n${prefix}task done <id>\n${prefix}task assign <id> @member\n\n` +
		`${prefix}faq <question>\n${prefix}faqs\n${prefix}faqadd Question | Answer\n\n` +
		`${prefix}afk [reason]\n${prefix}back\n\n${prefix}save (reply to a message)\n${prefix}saved [search]\n${prefix}delsave <id>`
	);

	if (command === "task") {
		const data = await getProductivityGroup(from);
		if (!action || action === "list" || action === "board") {
			const open = data.tasks.filter((task) => !task.done).slice(-20);
			return reply(open.length ? `📋 *Open Tasks (${open.length})*\n\n${open.map(taskLine).join("\n")}` : "📋 No open tasks right now.", open.map((task) => task.assigneeJid).filter(Boolean));
		}
		if (action === "mine") {
			const mine = data.tasks.filter((task) => !task.done && (task.assigneeJid === senderJid || task.createdBy === senderJid)).slice(-20);
			return reply(mine.length ? `👤 *Your Tasks*\n\n${mine.map(taskLine).join("\n")}` : "✅ You have no open tasks here.", mine.map((task) => task.assigneeJid).filter(Boolean));
		}
		if (action === "add") {
			const parsed = parseTaskInput(args.slice(1).join(" "));
			if (!parsed) return reply(`❌ Use: ${prefix}task add Finish chapter 4 | high | due Friday`);
			const task = { id: makeProductivityId("t"), ...parsed, assigneeJid: target || "", createdBy: senderJid, createdAt: new Date(), done: false };
			await addGroupTask(from, task);
			return reply(`✅ Task added: ${taskLine(task)}`, task.assigneeJid ? [task.assigneeJid] : []);
		}
		const taskId = String(args[1] || "").trim();
		const task = data.tasks.find((item) => item.id === taskId);
		if (!task) return reply("❌ Task not found. Use `task list` to see current IDs.");
		const canChange = adminish(info) || task.createdBy === senderJid || task.assigneeJid === senderJid;
		if (!canChange) return reply("🛡️ Only the task creator, assigned member or an admin can change that task.");
		if (["done", "reopen"].includes(action)) {
			await setGroupTaskState(from, taskId, { done: action === "done", actorJid: senderJid });
			return reply(action === "done" ? `✅ Task *${taskId}* completed.` : `↩️ Task *${taskId}* reopened.`);
		}
		if (action === "assign") {
			if (!target) return reply(`❌ Tag the assignee: ${prefix}task assign ${taskId} @member`);
			await assignGroupTask(from, taskId, target);
			return reply(`👤 Task *${taskId}* assigned to @${target.split("@")[0]}.`, [target]);
		}
		if (["delete", "remove"].includes(action)) {
			await removeGroupTask(from, taskId);
			return reply(`🗑️ Task *${taskId}* removed.`);
		}
		return reply(`❌ Unknown task action. Try ${prefix}task list or ${prefix}productivity.`);
	}

	if (command === "faq") {
		const query = args.join(" ").trim();
		if (!query) return reply(`❌ Ask something: ${prefix}faq What time does the group close?`);
		const data = await getProductivityGroup(from);
		const match = findBestFaq(data.faqs, query);
		return match ? reply(`💡 *${match.entry.question}*\n${match.entry.answer}`) : reply("🤔 I couldn't find a close FAQ answer. Try `faqs` to see what the group has saved.");
	}
	if (command === "faqs") {
		const data = await getProductivityGroup(from);
		return reply(data.faqs.length ? `📚 *Group FAQs*\n\n${data.faqs.slice(-25).map((item) => `• *${item.id}* — ${item.question}`).join("\n")}` : "📚 No FAQs have been added yet.");
	}
	if (command === "faqadd") {
		if (!adminish(info)) return reply("🛡️ Only admins can add official group FAQs.");
		const [question, ...rest] = args.join(" ").split("|").map((part) => part.trim());
		const answer = rest.join(" | ").trim();
		if (!question || !answer) return reply(`❌ Use: ${prefix}faqadd Question | Answer`);
		const entry = { id: makeProductivityId("f"), question: question.slice(0, 220), answer: answer.slice(0, 1200), createdBy: senderJid, createdAt: new Date() };
		await addFaqEntry(from, entry);
		return reply(`📚 FAQ *${entry.id}* saved.`);
	}
	if (command === "faqdel") {
		if (!adminish(info)) return reply("🛡️ Only admins can remove official group FAQs.");
		const id = String(args[0] || "");
		if (!id) return reply(`❌ Use: ${prefix}faqdel <id>`);
		await removeFaqEntry(from, id);
		return reply(`🗑️ FAQ *${id}* removed.`);
	}

	if (command === "afk") {
		const reason = args.join(" ").trim().slice(0, 180) || "Away for a bit";
		await setAfkStatus({ groupJid: from, memberJid: senderJid, reason, name: safeDisplayName(updateName, senderJid) });
		invalidateAfkGroupCache(from);
		return reply(`🌙 AFK set for @${senderJid.split("@")[0]} — ${reason}`, [senderJid]);
	}
	if (command === "back") {
		await clearAfkStatus(from, senderJid);
		invalidateAfkGroupCache(from);
		return reply(`👋 Welcome back, @${senderJid.split("@")[0]}. AFK cleared.`, [senderJid]);
	}

	if (command === "save") {
		const text = (args.join(" ").trim() || quotedTextFromContext(extendedMessageOriginal)).slice(0, 1200);
		if (!text) return reply(`❌ Reply to a text message with *${prefix}save*, or use *${prefix}save <text>*.`);
		const sourceJid = extendedMessageOriginal?.contextInfo?.participant || senderJid;
		const bookmark = { id: makeProductivityId("s"), text, sourceJid, savedAt: new Date() };
		await addMemberBookmark({ groupJid: from, memberJid: senderJid, bookmark });
		return reply(`🔖 Saved as *${bookmark.id}*.`);
	}
	if (["saved", "findsave"].includes(command)) {
		const query = args.join(" ").trim().toLowerCase();
		const items = await getMemberBookmarks(from, senderJid);
		const rows = (query ? items.filter((item) => String(item.text).toLowerCase().includes(query)) : items).slice(-20);
		return reply(rows.length ? `🔖 *Your Saved Messages*\n\n${rows.map((item) => `• *${item.id}* — ${String(item.text).slice(0, 180)}`).join("\n")}` : "🔖 No matching saved messages.");
	}
	if (command === "delsave") {
		const id = String(args[0] || "");
		if (!id) return reply(`❌ Use: ${prefix}delsave <id>`);
		await removeMemberBookmark(from, senderJid, id);
		return reply(`🗑️ Saved item *${id}* removed.`);
	}
};

export default () => ({
	cmd: ["productivity", "workhub", "groupwork", "task", "faq", "faqs", "faqadd", "faqdel", "afk", "back", "save", "saved", "findsave", "delsave"],
	desc: "Group task board, FAQ knowledge base, AFK status and personal saved-message tools",
	usage: "productivity | task add <task> | faq <question> | afk <reason> | reply + save",
	handler,
});
