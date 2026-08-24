import { escapeHtml } from "../notify/telegram.js";
import notifyOwner from "../notify/owner.js";
import { fake_quoted } from "../utils/fakeQuoted.js";
import { createGroupData, getGroupData } from "../db/groupData.js";
import { extractPhoneNumber } from "../utils/lid.js";
import messageQueue from "../queue/messageQueue.js";
import { delGroupMeta } from "../cache/redisCache.js";
import { getGroupSafetySettings, renderTemplate } from "../utils/groupSafety.js";

const getPhone = (p) =>
	typeof p === "string"
		? extractPhoneNumber(p)
		: extractPhoneNumber(p?.id || p?.jid || p?.phoneNumber || "");

const getParticipantJid = (participant) =>
	typeof participant === "string"
		? participant
		: participant?.id || participant?.jid || participant?.lid || participant?.phoneNumber || "";

const getGroupEvent = async (sock, events, cache) => {
	let jid = events.id;
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
		users: userTags,
		group: groupDataDB.grpName,
		count: groupDataDB.members?.length || "",
	};

	if (events.action == "add") {
		if (settings.isWelcomeOn && participantJids.length > 0) {
			const welcomeText = renderTemplate(
				groupDataDB.welcome || "Welcome {users} to *{group}*! Please check the group rules.",
				templateValues,
			);
			await messageQueue.enqueue(
				jid,
				() =>
					sock.sendMessage(
						jid,
						{ text: welcomeText, mentions: participantJids },
						{ quoted: fake_quoted(events, "Welcome to " + groupDataDB.grpName) },
					),
				1,
			);
		}
		//91Only Working
		if (groupDataDB.is91Only == true) {
			let filteredParticipants = events.participants.filter((p) => {
				const phoneNumber = getPhone(p);
				return phoneNumber && !phoneNumber.startsWith("91");
			});
			if (filteredParticipants.length > 0) {
				await sock.groupParticipantsUpdate(
					jid,
					filteredParticipants.map(getParticipantJid).filter(Boolean),
					"remove",
				);
				await messageQueue.enqueue(jid, () => sock.sendMessage(
					jid,
					{
						text: "```Only Indian Number Allowed In This Group.\n```",
					},
					{ quoted: fake_quoted(events, "Only Indian Number Allowed, Namaste") }
				), 1);
			}
		}
		const addedNumbers = events.participants.map((p) => `<code>${escapeHtml(getPhone(p))}</code>`).join(", ");
		notifyOwner(null,
			`➕ <b>Group Update</b>\n` +
			`━━━━━━━━━━━━━━\n` +
			`🏠 <b>Group:</b> ${escapeHtml(groupDataDB?.grpName)}\n` +
			`👤 <b>Joined:</b> ${addedNumbers}`
		);
	} else {
		if (events.action === "remove" && settings.isGoodbyeOn && participantJids.length > 0) {
			const goodbyeText = renderTemplate(
				groupDataDB.goodbye || "Goodbye {users}. Thanks for being part of *{group}*.",
				templateValues,
			);
			await messageQueue.enqueue(
				jid,
				() => sock.sendMessage(jid, { text: goodbyeText, mentions: participantJids }),
				1,
			);
		}
		const actionEmoji = events.action === "remove" ? "➖" : events.action === "promote" ? "⬆️" : events.action === "demote" ? "⬇️" : "🔄";
		const actionLabel = events.action === "remove" ? "Left / Removed" : events.action === "promote" ? "Promoted to Admin" : events.action === "demote" ? "Demoted from Admin" : escapeHtml(events.action);
		const numbers = events.participants.map((p) => `<code>${escapeHtml(getPhone(p))}</code>`).join(", ");
		notifyOwner(null,
			`${actionEmoji} <b>Group Update</b>\n` +
			`━━━━━━━━━━━━━━\n` +
			`🏠 <b>Group:</b> ${escapeHtml(groupDataDB?.grpName)}\n` +
			`👤 <b>Member:</b> ${numbers}\n` +
			`📋 <b>Action:</b> ${actionLabel}`
		);
	}
	console.log(events);
};

export default getGroupEvent;
