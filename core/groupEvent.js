import { escapeHtml } from "../notify/telegram.js";
import notifyOwner from "../notify/owner.js";
import { fake_quoted } from "../utils/fakeQuoted.js";
import { createGroupData, getGroupData } from "../db/groupData.js";
import { extractPhoneNumber } from "../utils/lid.js";
import messageQueue from "../queue/messageQueue.js";
import { delGroupMeta } from "../cache/redisCache.js";
import { getGroupSafetySettings, renderTemplate } from "../utils/groupSafety.js";
import { handleSafeJoinEvent } from "../utils/safeModeration.js";
import { recordSafeAudit } from "../db/safePackData.js";
import { GROUP_TEMPLATES } from "../utils/groupTemplates.js";

const getPhone = (p) => typeof p === "string" ? extractPhoneNumber(p) : extractPhoneNumber(p?.id || p?.jid || p?.phoneNumber || "");
const getParticipantJid = (participant) => typeof participant === "string" ? participant : participant?.id || participant?.jid || participant?.lid || participant?.phoneNumber || "";

const getGroupEvent = async (sock, events, cache) => {
	const jid = events.id;
	let groupDataDB = await getGroupData(jid);
	cache.del(jid + ":groupMetadata");
	await delGroupMeta(jid);
	if (!groupDataDB) {
		try {
			const metadata = await sock.groupMetadata(jid);
			await createGroupData(jid, metadata);
			groupDataDB = await getGroupData(jid);
		} catch (error) {
			console.warn("Could not initialize group event data:", error.message);
			return;
		}
	}
	const settings = getGroupSafetySettings(groupDataDB);
	const participantJids = events.participants.map(getParticipantJid).filter(Boolean);
	const userTags = participantJids.map((participant) => `@${getPhone(participant)}`).join(", ");
	const templateValues = {
		user: userTags,
		users: userTags,
		group: groupDataDB.grpName,
		count: groupDataDB.members?.length || "",
	};

	if (events.action === "add") {
		const raid = await handleSafeJoinEvent({ sock, groupJid: jid, participantJids });
		if (raid.locked) {
			await messageQueue.enqueue(jid, () => sock.sendMessage(jid, {
				text: `╭─ 🚨 *ANTI-RAID SAFETY LOCK*\n│\n│ ${raid.count} joins were detected in a short period.\n│ The group was switched to admin-only mode for review.\n│ Nobody was automatically removed.\n╰──────────────────`,
			}), 0).catch(() => {});
		}
		if (settings.isWelcomeOn && participantJids.length > 0) {
			const welcomeText = renderTemplate(groupDataDB.welcome || GROUP_TEMPLATES.welcome, templateValues);
			await messageQueue.enqueue(jid, () => sock.sendMessage(
				jid,
				{ text: welcomeText, mentions: participantJids },
				{ quoted: fake_quoted(events, "Welcome to " + groupDataDB.grpName) },
			), 1);
		}
		if (groupDataDB.is91Only === true) {
			const filteredParticipants = events.participants.filter((p) => {
				const phoneNumber = getPhone(p);
				return phoneNumber && !phoneNumber.startsWith("91");
			});
			if (filteredParticipants.length > 0) {
				const reviewJids = filteredParticipants.map(getParticipantJid).filter(Boolean);
				await recordSafeAudit({ groupJid: jid, action: "country-filter-review", targetJid: reviewJids[0], reason: `${reviewJids.length} non-+91 join(s) require admin review` });
				await messageQueue.enqueue(jid, () => sock.sendMessage(jid, {
					text: `╭─ 🛡️ *COUNTRY FILTER REVIEW*\n│\n│ ${reviewJids.map((value) => `@${getPhone(value)}`).join(", ")} joined with a number outside +91.\n│ No one was automatically removed; an administrator can review manually.\n╰──────────────────`,
					mentions: reviewJids,
				}, { quoted: fake_quoted(events, "Country filter admin review") }), 1);
			}
		}
		const addedNumbers = events.participants.map((p) => `<code>${escapeHtml(getPhone(p))}</code>`).join(", ");
		notifyOwner(null, `➕ <b>Group Update</b>\n━━━━━━━━━━━━━━\n🏠 <b>Group:</b> ${escapeHtml(groupDataDB?.grpName)}\n👤 <b>Joined:</b> ${addedNumbers}`);
	} else {
		if (events.action === "remove" && settings.isGoodbyeOn && participantJids.length > 0) {
			const goodbyeText = renderTemplate(groupDataDB.goodbye || GROUP_TEMPLATES.goodbye, templateValues);
			await messageQueue.enqueue(jid, () => sock.sendMessage(jid, { text: goodbyeText, mentions: participantJids }), 1);
		}
		const actionEmoji = events.action === "remove" ? "➖" : events.action === "promote" ? "⬆️" : events.action === "demote" ? "⬇️" : "🔄";
		const actionLabel = events.action === "remove" ? "Left / Removed" : events.action === "promote" ? "Promoted to Admin" : events.action === "demote" ? "Demoted from Admin" : escapeHtml(events.action);
		const numbers = events.participants.map((p) => `<code>${escapeHtml(getPhone(p))}</code>`).join(", ");
		notifyOwner(null, `${actionEmoji} <b>Group Update</b>\n━━━━━━━━━━━━━━\n🏠 <b>Group:</b> ${escapeHtml(groupDataDB?.grpName)}\n👤 <b>Member:</b> ${numbers}\n📋 <b>Action:</b> ${actionLabel}`);
	}
	console.log(events);
};

export default getGroupEvent;
