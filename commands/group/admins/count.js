import { group } from "../../../db/groupData.js";
import { alphaPanel, safeDisplayName } from "../../../utils/alphaStyle.js";
import { mergeLiveGroupActivity, summarizeGroupActivity } from "../../../utils/groupActivity.js";

const DEFAULT_LOW_TARGET = 20;

const numberArg = (value, fallback = 0) => {
	const parsed = Number.parseInt(String(value || ""), 10);
	return Number.isFinite(parsed) ? parsed : fallback;
};

const lastSeenLabel = (value) => {
	if (!value) return "no tracked activity";
	const time = new Date(value).getTime();
	if (!Number.isFinite(time)) return "unknown";
	const days = Math.max(0, Math.floor((Date.now() - time) / 86_400_000));
	if (days === 0) return "today";
	if (days === 1) return "1 day ago";
	return `${days} days ago`;
};

const chunks = (rows, maxChars = 3000) => {
	const out = [];
	let current = "";
	for (const row of rows) {
		if (current && current.length + row.length + 1 > maxChars) {
			out.push(current);
			current = "";
		}
		current += `${current ? "\n" : ""}${row}`;
	}
	if (current) out.push(current);
	return out;
};

const fallbackStoredRoster = (stored = []) => [...stored]
	.map((member) => ({
		...member,
		isAdmin: false,
		hasTrackedActivity: Number(member.count || 0) > 0,
	}))
	.sort((a, b) => Number(b.count || 0) - Number(a.count || 0));

const roleMark = (member) => member.isAdmin ? " 👑" : "";

const sendRows = async ({ rows, sendMessageWTyping, from, msg }) => {
	for (const page of chunks(rows)) {
		await sendMessageWTyping(from, { text: page }, { quoted: msg });
	}
};

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { sendMessageWTyping, groupMetadata, botJids = [] } = msgInfoObj;
	const res = await group.findOne({ _id: from });
	if (!res) {
		return sendMessageWTyping(from, { text: "❌ No activity data found for this group yet." }, { quoted: msg });
	}

	const participants = Array.isArray(groupMetadata?.participants) ? groupMetadata.participants : [];
	const hasLiveRoster = participants.length > 0;
	const members = hasLiveRoster
		? mergeLiveGroupActivity({ participants, trackedMembers: res.members || [], botJids })
		: fallbackStoredRoster(res.members || []);

	if (!members.length) {
		return sendMessageWTyping(from, {
			text: "📊 No current member activity could be resolved for this group yet.",
		}, { quoted: msg });
	}

	const words = args.map((arg) => String(arg).toLowerCase());
	const mode = words[0] || "ranking";
	const minIndex = words.indexOf("min");
	const inactiveIndex = words.indexOf("inactive");
	const dayToken = words.find((word) => /^\d+d$/.test(word));
	const staleDays = dayToken ? Math.max(0, numberArg(dayToken.slice(0, -1), 0)) : null;
	const showAllBreakdown = mode === "all";
	const showSummaryOnly = mode === "summary";
	const zeroMode = mode === "zero" || mode === "none";

	if (mode === "help") {
		return sendMessageWTyping(from, {
			text: alphaPanel({
				icon: "📊",
				title: "Activity Count Help",
				lines: [
					"`count` — every current member, most active → 0 messages",
					"`count all` — full media breakdown for every member",
					"`count summary` — cleanup overview and activity buckets",
					"`count zero` — members with 0 tracked messages",
					"`count inactive` — same as zero-message review",
					"`count member min 20` — everyone below 20 messages",
					"`count inactive 20 7d` — below 20 and inactive for 7+ days",
				],
				footer: "0 messages means Alpha has recorded no messages from that current member since tracking began.",
			}),
		}, { quoted: msg });
	}

	let threshold = -1;
	if (minIndex >= 0) {
		threshold = numberArg(args[minIndex + 1], -1);
	} else if (inactiveIndex >= 0) {
		const next = args[inactiveIndex + 1];
		threshold = /^\d+$/.test(String(next || "")) ? numberArg(next, 1) : 1;
	} else if (zeroMode) {
		threshold = 1;
	}

	if (minIndex >= 0 && threshold < 0) {
		return sendMessageWTyping(from, {
			text: "📊 Usage: `count member min 20` or `count inactive 20 7d`.",
		}, { quoted: msg });
	}

	const summary = summarizeGroupActivity(members, DEFAULT_LOW_TARGET);
	const totalText = members.reduce((sum, member) => sum + Number(member.texttotal || 0), 0);
	const totalImage = members.reduce((sum, member) => sum + Number(member.imagetotal || 0), 0);
	const totalVideo = members.reduce((sum, member) => sum + Number(member.videototal || 0), 0);
	const totalSticker = members.reduce((sum, member) => sum + Number(member.stickertotal || 0), 0);
	const totalPdf = members.reduce((sum, member) => sum + Number(member.pdftotal || 0), 0);
	const buckets = summary.buckets;

	if (threshold >= 0) {
		let low = members.filter((member) => Number(member.count || 0) < threshold);
		if (staleDays !== null) {
			const cutoff = Date.now() - staleDays * 86_400_000;
			low = low.filter((member) => !member.lastMessageAt || new Date(member.lastMessageAt).getTime() < cutoff);
		}
		low.sort((a, b) => {
			const countDiff = Number(a.count || 0) - Number(b.count || 0);
			if (countDiff) return countDiff;
			const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
			const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
			return aTime - bTime;
		});

		const zeroOnly = threshold === 1 && staleDays === null;
		const header = alphaPanel({
			icon: zeroOnly ? "🪫" : "📉",
			title: zeroOnly ? "Zero-Message Members" : "Low-Activity Review",
			lines: [
				`Group: *${safeDisplayName(res.grpName || groupMetadata?.subject || "This group")}*`,
				`Current members checked: *${members.length}*`,
				zeroOnly ? "Filter: *0 tracked messages*" : `Minimum target: *${threshold} messages*`,
				...(staleDays !== null ? [`Last activity: *older than ${staleDays} day${staleDays === 1 ? "" : "s"}*`] : []),
				`Matched: *${low.length}/${members.length} members*`,
				...(!hasLiveRoster ? ["⚠️ Live WhatsApp roster unavailable; showing stored Alpha members only."] : []),
			],
			footer: "Review manually before removing anyone. 👑 marks a group admin; Alpha does not auto-kick from this report.",
		});
		await sendMessageWTyping(from, { text: header }, { quoted: msg });
		if (!low.length) return;

		const rows = low.map((member, index) =>
			`${index + 1}. *${safeDisplayName(member.name, member.id)}*${roleMark(member)} — ${Number(member.count || 0)} msgs · ${lastSeenLabel(member.lastMessageAt)}`,
		);
		await sendRows({ rows, sendMessageWTyping, from, msg });
		return;
	}

	await sendMessageWTyping(from, {
		text: alphaPanel({
			icon: "📈",
			title: "Full Group Activity",
			lines: [
				`Group: *${safeDisplayName(res.grpName || groupMetadata?.subject || "This group")}*`,
				`Current human members: *${summary.totalMembers}*`,
				`Members with tracked activity: *${summary.activeMembers}* (${summary.coverage}%)`,
				`🪫 Zero-message members: *${summary.zeroMembers}*`,
				`📉 Below ${DEFAULT_LOW_TARGET} messages: *${summary.belowTarget}*`,
				`🧮 Total tracked messages: *${summary.totalMessages.toLocaleString()}*`,
				`👑 Current admins: *${summary.admins}*`,
				`Buckets — 0: ${buckets.zero} · 1–9: ${buckets.oneToNine} · 10–19: ${buckets.tenToNineteen}`,
				`20–49: ${buckets.twentyToFortyNine} · 50–99: ${buckets.fiftyToNinetyNine} · 100+: ${buckets.hundredPlus}`,
				`💬 Text ${totalText} · 🖼️ Images ${totalImage} · 🎥 Videos ${totalVideo}`,
				`🎭 Stickers ${totalSticker} · 📄 Docs ${totalPdf}`,
				...(!hasLiveRoster ? ["⚠️ Live WhatsApp roster unavailable; zero-message members may be missing."] : []),
			],
			footer: "0 means no message recorded by Alpha since tracking began. Use `count zero` or `count member min 20` for cleanup. 👑 = admin.",
		}),
	}, { quoted: msg });

	if (showSummaryOnly) return;

	const rows = members.map((member, index) => showAllBreakdown
		? `${index + 1}. *${safeDisplayName(member.name, member.id)}*${roleMark(member)}\n   Total ${Number(member.count || 0)} · 💬 ${Number(member.texttotal || 0)} · 🖼️ ${Number(member.imagetotal || 0)} · 🎥 ${Number(member.videototal || 0)} · 🎭 ${Number(member.stickertotal || 0)} · 📄 ${Number(member.pdftotal || 0)}\n   Last: ${lastSeenLabel(member.lastMessageAt)}`
		: `${index + 1}. ${Number(member.count || 0)} — *${safeDisplayName(member.name, member.id)}*${roleMark(member)} · ${lastSeenLabel(member.lastMessageAt)}`,
	);
	await sendRows({ rows, sendMessageWTyping, from, msg });
};

export default () => ({
	cmd: ["count"],
	desc: "Show every current group member from most active to zero activity",
	usage: "count | count all | count summary | count zero | count member min 20 | count inactive 20 7d | count help",
	handler,
});
