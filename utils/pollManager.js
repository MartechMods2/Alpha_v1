import { createHash } from "node:crypto";
import { closePollSession, createPollSession, getPollSession, replacePollVote } from "../db/pollSessionData.js";
import { setGroupBirthday } from "../db/groupTools.js";
import messageQueue from "../queue/messageQueue.js";
import { isSameGroupUser } from "./groupParticipants.js";
import { alphaPanel, safeDisplayName } from "./alphaStyle.js";

const optionHash = (option) => createHash("sha256").update(String(option)).digest();

const selectedOptionName = (options, selectedOptions = []) => {
	for (const selected of selectedOptions || []) {
		const buffer = Buffer.from(selected);
		const match = (options || []).find((option) => optionHash(option).equals(buffer));
		if (match) return match;
	}
	return "";
};

const voteAuthor = (pollUpdate, groupJid) => {
	const key = pollUpdate?.pollUpdateMessageKey || {};
	if (key.participant) return key.participant;
	if (key.participantAlt) return key.participantAlt;
	if (key.remoteJid && key.remoteJid !== groupJid) return key.remoteJid;
	return "";
};

const sendQueued = (sock, jid, content) => messageQueue.enqueue(jid, () => sock.sendMessage(jid, content), 1);

export const registerInteractivePoll = async ({ sentMessage, groupJid, type, ownerJid = "", options, payload = {}, ttlMs = 10 * 60_000 }) => {
	const id = sentMessage?.key?.id;
	if (!id) throw new Error("WhatsApp did not return a poll message id");
	return createPollSession({
		_id: id,
		groupJid,
		type,
		ownerJid,
		options: [...options],
		payload,
		expiresAt: new Date(Date.now() + ttlMs),
	});
};

export const readInteractivePoll = (id) => getPollSession(id);
export const finishInteractivePoll = (id, extra = {}) => closePollSession(id, extra);

const handleBirthdayChoice = async (sock, session, voterJid, option) => {
	let sameOwner = voterJid === session.ownerJid;
	if (!sameOwner) {
		try {
			const metadata = await sock.groupMetadata(session.groupJid);
			sameOwner = isSameGroupUser(metadata, voterJid, [session.ownerJid]);
		} catch {}
	}
	if (!sameOwner) return;

	if (option.startsWith("✅")) {
		const { day, month, name } = session.payload || {};
		await setGroupBirthday(session.groupJid, {
			memberJid: session.ownerJid,
			name: safeDisplayName(name, session.ownerJid),
			day: Number(day),
			month: Number(month),
			updatedAt: new Date(),
		});
		await closePollSession(session._id, { result: "saved" });
		await sendQueued(sock, session.groupJid, {
			text: alphaPanel({
				icon: "🎂",
				title: "Birthday Saved",
				lines: [
					`Date: *${String(day).padStart(2, "0")}-${String(month).padStart(2, "0")}*`,
					"Alpha will use this date for automatic birthday greetings when birthday automation is enabled.",
				],
			}),
		});
		return;
	}
	if (option.startsWith("✏️") || option.startsWith("❌")) {
		await closePollSession(session._id, { result: "cancelled" });
		await sendQueued(sock, session.groupJid, { text: "🎂 Birthday setup cancelled. Send `birthday set DD-MM` with the correct date." });
	}
};

export const handleInteractivePollUpdate = async (sock, eventItem) => {
	const key = eventItem?.key;
	const update = eventItem?.update;
	if (!key?.id || !Array.isArray(update?.pollUpdates) || !update.pollUpdates.length) return false;
	const session = await getPollSession(key.id);
	if (!session || session.status !== "open") return false;
	if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
		await closePollSession(session._id, { result: "expired" });
		return false;
	}

	let handled = false;
	for (const pollUpdate of update.pollUpdates) {
		const voterJid = voteAuthor(pollUpdate, session.groupJid);
		if (!voterJid) continue;
		const option = selectedOptionName(session.options, pollUpdate?.vote?.selectedOptions || []);
		await replacePollVote(session._id, voterJid, option);
		handled = true;
		if (session.type === "birthday-confirm" && option) {
			await handleBirthdayChoice(sock, session, voterJid, option);
		}
	}
	return handled;
};
