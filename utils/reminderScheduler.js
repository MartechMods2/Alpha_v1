import { getDueReminders, markReminded, scheduleNextRepeat } from "../db/reminders.js";
import { getSock } from "../core/socketRef.js";
import messageQueue from "../queue/messageQueue.js";

const botTimezone = process.env.BOT_TIMEZONE || "Africa/Lagos";

const formatBotTime = (date) =>
	new Intl.DateTimeFormat("en-GB", {
		timeZone: botTimezone,
		day: "2-digit",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12: true,
	}).format(date);

const checkReminders = async () => {
	const sock = getSock();
	if (!sock?.user) return; // bot not ready, retry next tick

	let due;
	try {
		due = await getDueReminders();
	} catch (err) {
		console.error("[REMINDER] DB fetch error:", err.message);
		return;
	}

	for (const reminder of due) {
		try {
			const isGroup = reminder.from !== reminder.jid;
			const text = `⏰ *Reminder!*\n\n📝 ${reminder.text}\n\n_Set for ${formatBotTime(reminder.remindAt)} (${botTimezone})_`;

			if (isGroup) {
				await messageQueue.enqueue(reminder.from, () => sock.sendMessage(reminder.from, {
					text,
					mentions: [reminder.jid],
				}), 1);
			} else {
				await messageQueue.enqueue(reminder.from, () => sock.sendMessage(reminder.from, { text }), 1);
			}

			if (reminder.repeat) {
				await scheduleNextRepeat(reminder._id, reminder.remindAt, reminder.repeat);
			} else {
				await markReminded(reminder._id);
			}
		} catch (err) {
			console.error(`[REMINDER] Send failed for ${reminder._id}:`, err.message);
			// not marking reminded — will retry next tick
		}
	}
};

let _interval = null;

export const startReminderScheduler = () => {
	if (_interval) return;
	_interval = setInterval(checkReminders, 60_000); // poll every minute
	checkReminders(); // immediate check catches any missed during downtime
	console.log("[REMINDER] Scheduler started");
};
