import { getActionSettings, recordAction } from "../db/actionData.js";
import {
	claimAutomationDelivery,
	listEnabledGroupAutomations,
	releaseAutomationDelivery,
} from "../db/groupAutomation.js";
import { getGroupTools } from "../db/groupTools.js";
import { getMemberData } from "../db/members.js";
import { getSock } from "../core/socketRef.js";
import messageQueue from "../queue/messageQueue.js";
import { FRIENDLY_ACTIONS, createActionStickerImage } from "./actionStudio.js";
import { daysBetweenDateKeys, localClock } from "./groupAutomationHelpers.js";
import {
	getBotIdentityJids,
	isSameGroupUser,
	participantJids,
} from "./groupParticipants.js";
import { runMediaJob } from "./mediaJobs.js";
import { imageBufferToSticker } from "./mediaStudio.js";
import { getSafeSettings } from "../db/safePackData.js";

const safeName = (value, jid) => String(value || jid?.split("@")[0] || "Member")
	.replace(/[\r\n\t*_~`]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);

const memberName = async (jid) => {
	const data = await getMemberData(jid).catch(() => null);
	return safeName(data && data !== -1 ? data.username : "", jid);
};

const sendQueued = (sock, jid, content) =>
	messageQueue.enqueue(jid, () => sock.sendMessage(jid, content), 2);

const sendBirthdays = async (sock, automation, tools, clock) => {
	if (!automation.birthdayEnabled) return;
	const birthdays = (tools.birthdays || []).filter((item) => Number(item.day) === clock.day && Number(item.month) === clock.month);
	if (!birthdays.length) return;
	const claimed = await claimAutomationDelivery({ groupJid: automation._id, type: "birthday", key: clock.dateKey });
	if (!claimed) return;
	const mentions = birthdays.map((item) => item.memberJid).filter(Boolean);
	const names = birthdays.map((item) => `@${String(item.memberJid || "").split("@")[0] || safeName(item.name)}`);
	try {
		await sendQueued(sock, automation._id, {
			text: `🎂🎉 *Happy Birthday${birthdays.length > 1 ? "s" : ""}!*\n\n${names.join(", ")} — Alpha and the whole group wish you a wonderful day! 🥳`,
			mentions,
		});
	} catch (error) {
		await releaseAutomationDelivery({ groupJid: automation._id, type: "birthday", key: clock.dateKey });
		throw error;
	}
};

const sendEventAlerts = async (sock, automation, tools, clock) => {
	if (!automation.eventAlertsEnabled) return;
	for (const event of tools.events || []) {
		const eventKey = new Date(event.date).toISOString().slice(0, 10);
		const days = daysBetweenDateKeys(clock.dateKey, eventKey);
		if (![30, 7, 1, 0].includes(days)) continue;
		const deliveryKey = `${event.id}:${clock.dateKey}:${days}`;
		const claimed = await claimAutomationDelivery({
			groupJid: automation._id,
			type: "event",
			key: deliveryKey,
		});
		if (!claimed) continue;
		const when = days === 0 ? "is today" : `is in ${days} day${days === 1 ? "" : "s"}`;
		try {
			await sendQueued(sock, automation._id, { text: `📅 *Event Reminder*\n\n*${safeName(event.title)}* ${when}.` });
		} catch (error) {
			await releaseAutomationDelivery({ groupJid: automation._id, type: "event", key: deliveryKey });
			throw error;
		}
	}
};

const sendDailyAction = async (sock, automation, clock) => {
	if (!automation.actionDailyEnabled) return;
	const metadata = await sock.groupMetadata(automation._id);
	const [settings, safeSettings, botJids] = await Promise.all([
		getActionSettings(automation._id),
		getSafeSettings(automation._id),
		getBotIdentityJids(sock, metadata),
	]);
	if (settings.mode === "off") return;
	const candidates = (metadata.participants || [])
		.map((participant) => participantJids(participant)[0])
		.filter(Boolean)
		.filter((jid) => !isSameGroupUser(metadata, jid, botJids))
		.filter((jid) => !(settings.optedOutMembers || []).some((blocked) => isSameGroupUser(metadata, jid, blocked)));
	if (candidates.length < 2) return;
	const delivery = { groupJid: automation._id, type: "daily-action", key: clock.dateKey };
	const claimed = await claimAutomationDelivery(delivery);
	if (!claimed) return;
	try {
		const actorIndex = Math.floor(Math.random() * candidates.length);
		let targetIndex = Math.floor(Math.random() * (candidates.length - 1));
		if (targetIndex >= actorIndex) targetIndex += 1;
		const actorJid = candidates[actorIndex];
		const targetJid = candidates[targetIndex];
		const action = FRIENDLY_ACTIONS[Math.floor(Math.random() * FRIENDLY_ACTIONS.length)];
		const [actorName, targetName] = await Promise.all([
			memberName(actorJid),
			memberName(targetJid),
		]);
		const sticker = await runMediaJob({
			feature: "daily-action",
			groupJid: automation._id,
			senderJid: `automation:${automation._id}`,
			retryable: false,
			task: async () => imageBufferToSticker(await createActionStickerImage({
				action, actorName, targetName, style: safeSettings.actionStyle,
			}), { pack: "Alpha Daily Action", author: "Martech", quality: 84 }),
		});
		await sendQueued(sock, automation._id, { sticker, mentions: [actorJid, targetJid] });
		await recordAction({ groupJid: automation._id, actorJid, actorName, targetJid, targetName, action });
	} catch (error) {
		await releaseAutomationDelivery(delivery);
		throw error;
	}
};

export const checkGroupAutomations = async (now = new Date()) => {
	const sock = getSock();
	if (!sock?.user) return;
	let automations;
	try {
		automations = await listEnabledGroupAutomations();
	} catch (error) {
		console.error("[GROUP AUTOMATION] DB fetch failed:", error.message);
		return;
	}
	for (const automation of automations) {
		try {
			const clock = localClock(now, automation.timezone || process.env.BOT_TIMEZONE || "Africa/Lagos");
			if (clock.time !== (automation.time || "08:00")) continue;
			const tools = automation.birthdayEnabled || automation.eventAlertsEnabled
				? await getGroupTools(automation._id)
				: {};
			await sendBirthdays(sock, automation, tools, clock);
			await sendEventAlerts(sock, automation, tools, clock);
			await sendDailyAction(sock, automation, clock);
		} catch (error) {
			console.error(`[GROUP AUTOMATION] ${automation._id} failed:`, error.message);
		}
	}
};

let interval = null;
export const startGroupAutomationScheduler = () => {
	if (interval) return;
	interval = setInterval(() => checkGroupAutomations(), 30_000);
	checkGroupAutomations();
	console.log("[GROUP AUTOMATION] Scheduler started");
};
