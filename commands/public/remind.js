import { insertReminder, getUserReminders, deleteReminder } from "../../db/reminders.js";

const MAX_MS = 7 * 24 * 60 * 60 * 1000;
const UNITS = { m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };
const REPEATS = ["daily", "weekly"];
const BOT_TIMEZONE = process.env.BOT_TIMEZONE || "Africa/Lagos";

// "30m", "2h", "3d", "1w" → ms, or null
const parseRelative = (str) => {
	const m = str?.match(/^(\d+)(m|h|d|w)$/i);
	if (!m) return null;
	const ms = parseInt(m[1]) * UNITS[m[2].toLowerCase()];
	return ms > 0 && ms <= MAX_MS ? ms : null;
};

const zonedParts = (date) => {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: BOT_TIMEZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hourCycle: "h23",
	}).formatToParts(date);
	return Object.fromEntries(
		parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]),
	);
};

const localTimeToDate = (year, month, day, hour, minute) => {
	const desiredUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
	let guess = desiredUtc;
	for (let i = 0; i < 3; i += 1) {
		const actual = zonedParts(new Date(guess));
		const representedUtc = Date.UTC(
			actual.year,
			actual.month - 1,
			actual.day,
			actual.hour,
			actual.minute,
			actual.second || 0,
		);
		guess += desiredUtc - representedUtc;
	}
	return new Date(guess);
};

// "1:30PM", "9AM", "13:30" → Date in BOT_TIMEZONE, or null
const parseSpecificTime = (str) => {
	const m12 = str?.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/i);
	const m24 = str?.match(/^(\d{1,2}):(\d{2})$/);
	let h, min;
	if (m12) {
		h = parseInt(m12[1]);
		min = parseInt(m12[2] || "0");
		const pm = m12[3].toLowerCase() === "pm";
		if (h === 12) h = pm ? 12 : 0;
		else if (pm) h += 12;
	} else if (m24) {
		h = parseInt(m24[1]);
		min = parseInt(m24[2]);
	} else return null;

	if (h > 23 || min > 59) return null;

	const now = new Date();
	const today = zonedParts(now);
	let target = localTimeToDate(today.year, today.month, today.day, h, min);
	if (target <= now) {
		const tomorrow = new Date(Date.UTC(today.year, today.month - 1, today.day) + 86_400_000);
		target = localTimeToDate(
			tomorrow.getUTCFullYear(),
			tomorrow.getUTCMonth() + 1,
			tomorrow.getUTCDate(),
			h,
			min,
		);
	}
	return target;
};

const formatBotTime = (date) =>
	new Intl.DateTimeFormat("en-IN", {
		timeZone: BOT_TIMEZONE,
		day: "2-digit",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12: true,
	}).format(date);

const HELP_TEXT =
	`*Reminder Command*\n\n` +
	`*Relative:* \`remind <time> <message>\`\n` +
	`*Specific:* \`remind 1:30PM <message>\` _(${BOT_TIMEZONE})_\n` +
	`*Repeat:* add \`repeat daily\` or \`repeat weekly\`\n` +
	`*List:* \`remind list\`\n` +
	`*Cancel:* \`remind cancel <number>\`\n\n` +
	`*Time formats:*\n` +
	`• \`10m\` \`2h\` \`3d\` \`1w\` _(max 7 days)_\n` +
	`• \`1:30PM\` \`9AM\` \`13:30\` _(${BOT_TIMEZONE}, today or tomorrow)_\n\n` +
	`*Examples:*\n` +
	`\`remind 30m call mom\`\n` +
	`\`remind 9:00AM standup repeat daily\`\n` +
	`\`remind 1w project review repeat weekly\``;

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { senderJid, sendMessageWTyping } = msgInfoObj;

	if (!args[0]) return sendMessageWTyping(from, { text: HELP_TEXT }, { quoted: msg });

	// remind list
	if (args[0] === "list") {
		const pending = await getUserReminders(senderJid);
		if (!pending.length) return sendMessageWTyping(from, { text: "No pending reminders." }, { quoted: msg });
		const lines = pending
			.map((r, i) => {
				const repeatNote = r.repeat ? ` _(repeats ${r.repeat})_` : "";
				return `*${i + 1}.* ${r.text}${repeatNote}\n    ⏰ ${formatBotTime(r.remindAt)} (${BOT_TIMEZONE})`;
			})
			.join("\n\n");
		return sendMessageWTyping(from, { text: `*Your pending reminders:*\n\n${lines}` }, { quoted: msg });
	}

	// remind cancel <n>
	if (args[0] === "cancel") {
		const n = parseInt(args[1]);
		if (!n || n < 1)
			return sendMessageWTyping(
				from,
				{ text: "Usage: `remind cancel <number>`\nSee yours with `remind list`." },
				{ quoted: msg },
			);
		const pending = await getUserReminders(senderJid);
		const target = pending[n - 1];
		if (!target)
			return sendMessageWTyping(
				from,
				{ text: `❌ No reminder #${n}. You have ${pending.length} pending.` },
				{ quoted: msg },
			);
		await deleteReminder(target._id, senderJid);
		return sendMessageWTyping(from, { text: `✅ Cancelled: _${target.text}_` }, { quoted: msg });
	}

	// strip "repeat <interval>" from args before parsing text
	const repeatIdx = args.indexOf("repeat");
	const repeatVal = repeatIdx !== -1 ? args[repeatIdx + 1]?.toLowerCase() : null;
	const repeat = REPEATS.includes(repeatVal) ? repeatVal : null;
	const cleanArgs =
		repeatIdx !== -1 ? [...args.slice(0, repeatIdx), ...args.slice(repeatIdx + (repeat ? 2 : 1))] : args;

	// parse time from first arg
	const timeStr = cleanArgs[0];
	const specificTime = parseSpecificTime(timeStr);
	const relativeMs = specificTime === null ? parseRelative(timeStr) : null;

	if (!specificTime && !relativeMs) {
		return sendMessageWTyping(
			from,
			{
				text: `❌ Invalid time \`${timeStr}\`.\nUse: \`10m\` \`2h\` \`3d\` \`1w\`, or \`1:30PM\` \`9AM\` \`13:30\` (IST).`,
			},
			{ quoted: msg },
		);
	}

	const text = cleanArgs.slice(1).join(" ").trim();
	if (!text)
		return sendMessageWTyping(
			from,
			{ text: "❌ Reminder message can't be empty.\nExample: `remind 30m call mom`" },
			{ quoted: msg },
		);

	const remindAt = specificTime ?? new Date(Date.now() + relativeMs);

	await insertReminder({
		jid: senderJid,
		from,
		text,
		remindAt,
		reminded: false,
		repeat: repeat ?? null,
		createdAt: new Date(),
	});

	const repeatNote = repeat ? `\n🔁 Repeats ${repeat}` : "";
	return sendMessageWTyping(
		from,
		{
			text: `✅ *Reminder set!*\n\n📝 _${text}_\n⏰ ${formatBotTime(remindAt)} (${BOT_TIMEZONE})${repeatNote}`,
		},
		{ quoted: msg },
	);
};

export default () => ({
	cmd: ["remind", "reminder"],
	desc: "Set a timed reminder (max 1 week). Supports repeat & specific times (IST).",
	usage: "remind <10m|2h|1:30PM> <message> [repeat daily|weekly] | remind list | remind cancel <n>",
	handler,
});
