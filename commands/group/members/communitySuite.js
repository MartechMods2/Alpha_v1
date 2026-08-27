import {
	addReputation,
	createEnhancementItem,
	getEnhancementProfile,
	getReputationBoard,
	listEnhancementItems,
	listEnhancementProfiles,
	removeEnhancementItem,
	updateEnhancementItem,
	updateEnhancementProfile,
} from "../../../db/enhancementData.js";
import { getGroupTools } from "../../../db/groupTools.js";
import {
	cleanFeatureText,
	dateKey,
	resolveMentionTarget,
	safeMemberName,
	shortId,
} from "../../../utils/featureSuite.js";
import { COMMUNITY_COMMANDS } from "../../../utils/ultimateFeatureCatalog.js";

const cooldowns = new Map();
const allowWrite = (key, milliseconds = 10_000) => {
	const now = Date.now();
	if ((cooldowns.get(key) || 0) > now) return false;
	cooldowns.set(key, now + milliseconds);
	if (cooldowns.size > 3000) for (const [entry, expiry] of cooldowns) if (expiry <= now) cooldowns.delete(entry);
	return true;
};
const itemAt = (items, number) => items[Number.parseInt(number, 10) - 1] || null;
const replyRows = (title, rows, empty) => rows.length ? `${title}\n\n${rows.join("\n")}` : empty;

const handleBio = async ({ msg, from, args, senderJid, updateName, sendMessageWTyping }) => {
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const action = String(args[0] || "show").toLowerCase();
	if (action === "set") {
		const bio = cleanFeatureText(args.slice(1).join(" "), 180);
		if (!bio) return reply("❌ Usage: `mybio set <short bio>`. ");
		await updateEnhancementProfile(from, senderJid, { bio, memberName: safeMemberName(updateName, senderJid) });
		return reply("✅ Your group bio was updated.");
	}
	if (action === "clear") {
		await updateEnhancementProfile(from, senderJid, { bio: "", memberName: safeMemberName(updateName, senderJid) });
		return reply("✅ Your group bio was cleared.");
	}
	const target = resolveMentionTarget(msg) || senderJid;
	const profile = await getEnhancementProfile(from, target);
	return reply(`👤 *Member Bio*\n${profile.nickname ? `Nickname: *${profile.nickname}*\n` : ""}Reputation: *${profile.reputation || 0}*\nBio: ${profile.bio || "Not set"}`);
};

const handleNickname = async ({ msg, from, args, senderJid, updateName, sendMessageWTyping }) => {
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const action = String(args[0] || "show").toLowerCase();
	if (action === "set") {
		const nickname = cleanFeatureText(args.slice(1).join(" "), 30).replace(/[*_~`]/g, "");
		if (nickname.length < 2) return reply("❌ Usage: `nickname set <2-30 character name>`. ");
		await updateEnhancementProfile(from, senderJid, { nickname, memberName: safeMemberName(updateName, senderJid) });
		return reply(`✅ Your group nickname is now *${nickname}*.`);
	}
	if (action === "clear") {
		await updateEnhancementProfile(from, senderJid, { nickname: "", memberName: safeMemberName(updateName, senderJid) });
		return reply("✅ Your nickname was cleared.");
	}
	if (action === "list") {
		const profiles = await listEnhancementProfiles(from, { nickname: { $ne: "" } }, 50);
		return reply(replyRows("🏷️ *Group Nicknames*", profiles.map((profile, index) => `${index + 1}. *${profile.nickname}* — ${safeMemberName(profile.memberName, profile.memberJid)}`), "🏷️ No nicknames have been set."));
	}
	const target = resolveMentionTarget(msg) || senderJid;
	const profile = await getEnhancementProfile(from, target);
	return reply(profile.nickname ? `🏷️ Nickname: *${profile.nickname}*` : "🏷️ No nickname is set.");
};

const handleReputation = async (context) => {
	const { msg, from, senderJid, updateName, sendMessageWTyping, command } = context;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	if (command === "giverep") {
		const target = resolveMentionTarget(msg);
		if (!target) return reply("❌ Tag a member or reply to their message: `giverep @member`. ");
		if (target === senderJid) return reply("❌ You cannot give reputation to yourself.");
		const today = dateKey();
		const existing = await listEnhancementItems(from, "rep-gift", { memberJid: senderJid, "payload.targetJid": target, "payload.date": today }, 1);
		if (existing.length) return reply("⏳ You already appreciated that member today.");
		await Promise.all([
			addReputation(from, target, safeMemberName(target.split("@")[0], target), 1),
			createEnhancementItem({ groupJid: from, type: "rep-gift", memberJid: senderJid, memberName: safeMemberName(updateName, senderJid), payload: { targetJid: target, date: today } }),
		]);
		return reply(`🌟 Reputation given to @${target.split("@")[0]}!`, { mentions: [target] });
	}
	if (command === "repboard") {
		const board = await getReputationBoard(from);
		return reply(replyRows("🌟 *Reputation Board*", board.map((profile, index) => `${index + 1}. *${safeMemberName(profile.nickname || profile.memberName, profile.memberJid)}* — ${profile.reputation} rep`), "🌟 No reputation has been given yet."));
	}
	const target = resolveMentionTarget(msg) || senderJid;
	const profile = await getEnhancementProfile(from, target);
	return reply(`🌟 *${safeMemberName(profile.nickname || profile.memberName, target)}* has *${profile.reputation || 0} reputation*.`);
};

const handleSubmission = async (context, type, publicCommand) => {
	const { msg, from, args, senderJid, updateName, sendMessageWTyping, command } = context;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	if (command === publicCommand) {
		const approved = await listEnhancementItems(from, type, { status: "approved" }, 20);
		const label = type === "suggestion" ? "Approved Suggestions" : "Approved Anonymous Confessions";
		return reply(replyRows(`📬 *${label}*`, approved.map((entry, index) => `${index + 1}. ${entry.text}`), `📬 No approved ${type}s yet.`));
	}
	const text = cleanFeatureText(args.join(" "), 600);
	if (text.length < 5) return reply(`❌ Usage: \`${command} <message>\`.`);
	await createEnhancementItem({ groupJid: from, type, memberJid: senderJid, memberName: safeMemberName(updateName, senderJid), text, status: "pending" });
	return reply(type === "confession" ? "✅ Your anonymous confession entered the admin review queue." : "✅ Your suggestion entered the admin review queue.");
};

const handleLost = async (context) => {
	const { msg, from, args, senderJid, updateName, isGroupAdmin, isOwner, sendMessageWTyping } = context;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const action = String(args[0] || "list").toLowerCase();
	const items = await listEnhancementItems(from, "lost", { status: "open" }, 50);
	if (action === "add") {
		const text = cleanFeatureText(args.slice(1).join(" "), 300);
		if (!text) return reply("❌ Usage: `lost add <item and details>`. ");
		await createEnhancementItem({ groupJid: from, type: "lost", memberJid: senderJid, memberName: safeMemberName(updateName, senderJid), text, status: "open" });
		return reply("✅ Lost item posted.");
	}
	if (action === "found") {
		const item = itemAt(items, args[1]);
		if (!item) return reply("❌ Lost item not found.");
		if (item.memberJid !== senderJid && !isGroupAdmin && !isOwner) return reply("❌ Only the reporter or an admin can close it.");
		await updateEnhancementItem(from, "lost", item._id, { status: "found", resolvedAt: new Date() });
		return reply("✅ Item marked as found.");
	}
	return reply(replyRows("🔎 *Lost & Found*", items.map((item, index) => `${index + 1}. ${item.text} — _${safeMemberName(item.memberName, item.memberJid)}_`), "🔎 No open lost-item reports."));
};

const handleMarket = async (context) => {
	const { msg, from, args, senderJid, updateName, isGroupAdmin, isOwner, sendMessageWTyping } = context;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const action = String(args[0] || "list").toLowerCase();
	if (action === "add") {
		const [title, ...detailParts] = args.slice(1).join(" ").split("|");
		const cleanTitle = cleanFeatureText(title, 80);
		const details = cleanFeatureText(detailParts.join("|"), 350);
		if (!cleanTitle || !details) return reply("❌ Usage: `market add Item | price and details`. ");
		await createEnhancementItem({ groupJid: from, type: "market", memberJid: senderJid, memberName: safeMemberName(updateName, senderJid), text: cleanTitle, payload: { details }, status: "pending" });
		return reply("✅ Listing entered the admin approval queue.");
	}
	const approved = await listEnhancementItems(from, "market", { status: "approved" }, 30);
	if (["remove", "delete"].includes(action)) {
		const item = itemAt(approved, args[1]);
		if (!item) return reply("❌ Listing not found.");
		if (item.memberJid !== senderJid && !isGroupAdmin && !isOwner) return reply("❌ Only its owner or an admin can remove it.");
		await removeEnhancementItem(from, "market", item._id);
		return reply("✅ Listing removed.");
	}
	return reply(replyRows("🛍️ *Approved Group Market*", approved.map((item, index) => `${index + 1}. *${item.text}* — ${item.payload?.details}\n   _Posted by ${safeMemberName(item.memberName, item.memberJid)}_`), "🛍️ No approved listings."));
};

const handleTickets = async (context) => {
	const { msg, from, args, senderJid, updateName, sendMessageWTyping, command } = context;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const own = await listEnhancementItems(from, "ticket", { memberJid: senderJid }, 20);
	if (command === "mytickets" || String(args[0] || "").toLowerCase() === "list") {
		return reply(replyRows("🎫 *My Support Tickets*", own.map((item, index) => `${index + 1}. [${shortId(item._id)}] *${item.status}* — ${item.text}`), "🎫 You have no support tickets."));
	}
	const action = String(args[0] || "open").toLowerCase();
	if (action === "open") {
		const text = cleanFeatureText(args.slice(1).join(" "), 500);
		if (!text) return reply("❌ Usage: `ticket open <what you need help with>`. ");
		if (own.filter((item) => item.status === "open").length >= 2) return reply("❌ Close an existing ticket before opening another.");
		const item = await createEnhancementItem({ groupJid: from, type: "ticket", memberJid: senderJid, memberName: safeMemberName(updateName, senderJid), text, status: "open" });
		return reply(`🎫 Ticket *${shortId(item._id)}* opened. Admins can review it without exposing it publicly.`);
	}
	if (action === "close") {
		const item = itemAt(own.filter((entry) => entry.status === "open"), args[1]);
		if (!item) return reply("❌ Open ticket not found. Check `mytickets`. ");
		await updateEnhancementItem(from, "ticket", item._id, { status: "closed", closedAt: new Date() });
		return reply("✅ Ticket closed.");
	}
	return reply("🎫 Use `ticket open <message>`, `mytickets`, or `ticket close <number>`. ");
};

const handleReport = async ({ msg, from, args, senderJid, updateName, sendMessageWTyping }) => {
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const target = resolveMentionTarget(msg);
	const reason = cleanFeatureText(args.join(" ").replace(/^@\S+\s*/, ""), 400);
	if (!target || !reason) return reply("❌ Tag or reply to a member: `reportmember @member <reason>`. ");
	if (target === senderJid) return reply("❌ You cannot report yourself.");
	await createEnhancementItem({ groupJid: from, type: "member-report", memberJid: senderJid, memberName: safeMemberName(updateName, senderJid), text: reason, payload: { targetJid: target }, status: "open" });
	return reply("✅ Your report entered the private admin queue.");
};

const handleFaq = async ({ msg, from, args, sendMessageWTyping }) => {
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const faqs = await listEnhancementItems(from, "faq", { status: "active" }, 50);
	const query = cleanFeatureText(args.join(" "), 120).toLowerCase();
	if (!query || query === "list") return reply(replyRows("❓ *Group FAQ*", faqs.map((item, index) => `${index + 1}. *${item.text}*`), "❓ No FAQ entries have been configured."));
	const matches = faqs.filter((item) => `${item.text} ${item.payload?.answer || ""}`.toLowerCase().includes(query)).slice(0, 5);
	return reply(matches.length ? `❓ *FAQ Results*\n\n${matches.map((item) => `*${item.text}*\n${item.payload.answer}`).join("\n\n")}` : "❓ No FAQ matched that search.");
};

const handleAttendance = async (context) => {
	const { msg, from, senderJid, updateName, sendMessageWTyping, command } = context;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const today = dateKey();
	if (command === "checkin") {
		const existing = await listEnhancementItems(from, "checkin", { memberJid: senderJid, "payload.date": today }, 1);
		if (existing.length) return reply("✅ You are already checked in today.");
		await createEnhancementItem({ groupJid: from, type: "checkin", memberJid: senderJid, memberName: safeMemberName(updateName, senderJid), payload: { date: today }, status: "present" });
		return reply(`✅ Checked in for *${today}*.`);
	}
	const entries = await listEnhancementItems(from, "checkin", { "payload.date": today }, 100);
	return reply(replyRows(`📋 *Attendance · ${today}*`, entries.map((item, index) => `${index + 1}. ${safeMemberName(item.memberName, item.memberJid)}`), "📋 Nobody has checked in today."));
};

const handleRsvp = async (context) => {
	const { msg, from, args, senderJid, updateName, sendMessageWTyping, command } = context;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const data = await getGroupTools(from);
	const events = [...(data.events || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
	const event = itemAt(events, args[0]);
	if (!event) return reply("❌ Choose an event number from `calendar`: `rsvp 1 yes`. ");
	if (command === "rsvplist") {
		const entries = await listEnhancementItems(from, "rsvp", { "payload.eventId": event.id }, 100);
		const groups = ["yes", "maybe", "no"].map((choice) => `*${choice.toUpperCase()}*\n${entries.filter((entry) => entry.payload.choice === choice).map((entry) => `• ${safeMemberName(entry.memberName, entry.memberJid)}`).join("\n") || "• none"}`);
		return reply(`📅 *RSVP · ${event.title}*\n\n${groups.join("\n\n")}`);
	}
	const choice = String(args[1] || "").toLowerCase();
	if (!["yes", "no", "maybe"].includes(choice)) return reply("❌ Usage: `rsvp <event number> yes|no|maybe`. ");
	const existing = await listEnhancementItems(from, "rsvp", { memberJid: senderJid, "payload.eventId": event.id }, 1);
	if (existing[0]) await updateEnhancementItem(from, "rsvp", existing[0]._id, { payload: { eventId: event.id, choice }, status: "active" });
	else await createEnhancementItem({ groupJid: from, type: "rsvp", memberJid: senderJid, memberName: safeMemberName(updateName, senderJid), payload: { eventId: event.id, choice }, status: "active" });
	return reply(`✅ RSVP for *${event.title}* set to *${choice.toUpperCase()}*.`);
};

const handleStandup = async (context) => {
	const { msg, from, args, senderJid, updateName, sendMessageWTyping, command } = context;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const today = dateKey();
	if (command === "standups") {
		const entries = await listEnhancementItems(from, "standup", { "payload.date": today }, 50);
		return reply(replyRows(`🧑‍💻 *Daily Stand-ups · ${today}*`, entries.map((item, index) => `${index + 1}. *${safeMemberName(item.memberName, item.memberJid)}*\n   Yesterday: ${item.payload.yesterday}\n   Today: ${item.payload.today}\n   Blocker: ${item.payload.blocker}`), "🧑‍💻 No stand-ups submitted today."));
	}
	const parts = args.join(" ").split("|").map((part) => cleanFeatureText(part, 220));
	if (parts.length < 3 || parts.some((part) => !part)) return reply("❌ Usage: `standup yesterday | today | blocker/none`. ");
	const existing = await listEnhancementItems(from, "standup", { memberJid: senderJid, "payload.date": today }, 1);
	const payload = { yesterday: parts[0], today: parts[1], blocker: parts[2], date: today };
	if (existing[0]) await updateEnhancementItem(from, "standup", existing[0]._id, { payload });
	else await createEnhancementItem({ groupJid: from, type: "standup", memberJid: senderJid, memberName: safeMemberName(updateName, senderJid), payload, status: "active" });
	return reply("✅ Today’s stand-up was recorded.");
};

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const context = { sock, msg, from, args, ...msgInfoObj };
	const writeCommands = new Set(["mybio", "nickname", "giverep", "suggest", "confess", "lost", "market", "ticket", "reportmember", "checkin", "rsvp", "standup"]);
	if (writeCommands.has(msgInfoObj.command) && !allowWrite(`${from}:${msgInfoObj.senderJid}:${msgInfoObj.command}`)) return;
	try {
		switch (msgInfoObj.command) {
			case "mybio": return handleBio(context);
			case "nickname": return handleNickname(context);
			case "reputation": case "giverep": case "repboard": return handleReputation(context);
			case "suggest": return handleSubmission(context, "suggestion", "suggestions");
			case "suggestions": return handleSubmission(context, "suggestion", "suggestions");
			case "confess": return handleSubmission(context, "confession", "confessions");
			case "confessions": return handleSubmission(context, "confession", "confessions");
			case "lost": return handleLost(context);
			case "market": return handleMarket(context);
			case "ticket": case "mytickets": return handleTickets(context);
			case "reportmember": return handleReport(context);
			case "faq": return handleFaq(context);
			case "checkin": case "attendance": return handleAttendance(context);
			case "rsvp": case "rsvplist": return handleRsvp(context);
			case "standup": case "standups": return handleStandup(context);
			case "communityhelp": return msgInfoObj.sendMessageWTyping(from, { text: "🤝 *Community Suite*\n\n`mybio` · `nickname` · `giverep` · `repboard`\n`suggest` · `confess` · `lost` · `market`\n`ticket` · `reportmember` · `faq`\n`checkin` · `attendance` · `rsvp` · `standup`" }, { quoted: msg });
		}
	} catch (error) {
		console.error("Community Suite failed:", error.message);
		return msgInfoObj.sendMessageWTyping(from, { text: "❌ The community feature is temporarily unavailable." }, { quoted: msg });
	}
};

export default () => ({
	cmd: COMMUNITY_COMMANDS,
	desc: "Profiles, reputation, approval queues, support, attendance, RSVP and community organisation",
	usage: "communityhelp | suggest text | checkin | rsvp 1 yes | standup yesterday | today | blocker",
	handler,
});
