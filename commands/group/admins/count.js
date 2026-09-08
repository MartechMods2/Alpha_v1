import { group } from "../../../db/groupData.js";
import { alphaPanel, safeDisplayName } from "../../../utils/alphaStyle.js";

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

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { sendMessageWTyping } = msgInfoObj;
	const res = await group.findOne({ _id: from });
	if (!res) return sendMessageWTyping(from, { text: "❌ No activity data found for this group yet." }, { quoted: msg });

	const members = [...(res.members || [])];
	if (!members.length) return sendMessageWTyping(from, { text: "📊 No member activity has been recorded yet." }, { quoted: msg });

	const words = args.map((arg) => String(arg).toLowerCase());
	const minIndex = words.indexOf("min");
	const inactiveIndex = words.indexOf("inactive");
	let threshold = minIndex >= 0 ? numberArg(args[minIndex + 1], -1) : inactiveIndex >= 0 ? numberArg(args[inactiveIndex + 1], -1) : -1;
	const dayToken = words.find((word) => /^\d+d$/.test(word));
	const staleDays = dayToken ? Math.max(0, numberArg(dayToken.slice(0, -1), 0)) : null;
	const showAllBreakdown = words[0] === "all";

	if ((minIndex >= 0 || inactiveIndex >= 0) && threshold < 0) {
		return sendMessageWTyping(from, {
			text: "📊 Usage: `count min 20`, `count member min 20`, or `count inactive 20 7d`.",
		}, { quoted: msg });
	}

	if (threshold >= 0) {
		let low = members.filter((member) => Number(member.count || 0) < threshold);
		if (staleDays !== null) {
			const cutoff = Date.now() - staleDays * 86_400_000;
			low = low.filter((member) => !member.lastMessageAt || new Date(member.lastMessageAt).getTime() < cutoff);
		}
		low.sort((a, b) => Number(a.count || 0) - Number(b.count || 0));
		const header = alphaPanel({
			icon: "📊",
			title: "Low-Activity Review",
			lines: [
				`Group: *${safeDisplayName(res.grpName || "This group")}*`,
				`Minimum target: *${threshold} messages*`,
				...(staleDays !== null ? [`Last activity filter: *older than ${staleDays} day${staleDays === 1 ? "" : "s"}*`] : []),
				`Below target: *${low.length}/${members.length} members*`,
			],
			footer: "Review this list manually before removing anyone; Alpha does not auto-kick for inactivity.",
		});
		await sendMessageWTyping(from, { text: header }, { quoted: msg });
		if (!low.length) return;
		const rows = low.map((member, index) =>
			`${index + 1}. *${safeDisplayName(member.name, member.id)}* — ${Number(member.count || 0)} msgs · ${lastSeenLabel(member.lastMessageAt)}`,
		);
		for (const page of chunks(rows)) await sendMessageWTyping(from, { text: page }, { quoted: msg });
		return;
	}

	const sorted = members.sort((a, b) => Number(b.count || 0) - Number(a.count || 0));
	const totalText = sorted.reduce((sum, member) => sum + Number(member.texttotal || 0), 0);
	const totalImage = sorted.reduce((sum, member) => sum + Number(member.imagetotal || 0), 0);
	const totalVideo = sorted.reduce((sum, member) => sum + Number(member.videototal || 0), 0);
	const totalSticker = sorted.reduce((sum, member) => sum + Number(member.stickertotal || 0), 0);
	const totalPdf = sorted.reduce((sum, member) => sum + Number(member.pdftotal || 0), 0);
	await sendMessageWTyping(from, {
		text: alphaPanel({
			icon: "📈",
			title: "Group Activity",
			lines: [
				`Group: *${safeDisplayName(res.grpName || "This group")}*`,
				`Tracked members: *${sorted.length}*`,
				`💬 Text ${totalText} · 🖼️ Images ${totalImage} · 🎥 Videos ${totalVideo}`,
				`🎭 Stickers ${totalSticker} · 📄 Docs ${totalPdf}`,
			],
			footer: "Tip: `count member min 20` finds everyone below 20 messages.",
		}),
	}, { quoted: msg });

	const rows = sorted.map((member, index) => showAllBreakdown
		? `${index + 1}. *${safeDisplayName(member.name, member.id)}*\n   Total ${Number(member.count || 0)} · 💬 ${Number(member.texttotal || 0)} · 🖼️ ${Number(member.imagetotal || 0)} · 🎥 ${Number(member.videototal || 0)} · 🎭 ${Number(member.stickertotal || 0)} · 📄 ${Number(member.pdftotal || 0)}`
		: `${index + 1}. ${Number(member.count || 0)} — *${safeDisplayName(member.name, member.id)}*`,
	);
	for (const page of chunks(rows)) await sendMessageWTyping(from, { text: page }, { quoted: msg });
};

export default () => ({
	cmd: ["count"],
	desc: "Review message counts and find low-activity group members",
	usage: "count | count all | count member min 20 | count inactive 20 7d",
	handler,
});
