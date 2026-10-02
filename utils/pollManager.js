import { createHash } from "node:crypto";
import { closePollSession, createPollSession, getPollSession, replacePollVote } from "../db/pollSessionData.js";
import { setGroupBirthday } from "../db/groupTools.js";
import messageQueue from "../queue/messageQueue.js";
import { isSameGroupUser } from "./groupParticipants.js";
import { alphaPanel, safeDisplayName } from "./alphaStyle.js";
import { encodePollMessage, rememberPollMessage } from "./pollMessageStore.js";
import { decryptInteractivePollMessage, rawPollUpdate } from "./pollVoteDecrypt.js";
import { notifyPollVote } from "./pollVoteEvents.js";

const livePolls = new Map();
const rememberSession = (session) => {
	for (const [id, row] of livePolls) if (new Date(row.expiresAt).getTime() <= Date.now()) livePolls.delete(id);
	if (livePolls.size >= 500 && !livePolls.has(session._id)) livePolls.delete(livePolls.keys().next().value);
	livePolls.set(session._id, session);
	return session;
};
const mergeVotes = (stored, live) => {
	if (!stored) return live;
	if (!live) return stored;
	const votes = new Map((stored.votes || []).map(vote => [vote.voterJid, vote]));
	for (const vote of live.votes || []) {
		const previous = votes.get(vote.voterJid);
		if (!previous || new Date(vote.votedAt || 0) >= new Date(previous.votedAt || 0)) votes.set(vote.voterJid, vote);
	}
	return { ...stored, votes: [...votes.values()] };
};

const optionHash = (option) => createHash("sha256").update(String(option)).digest();

const selectedOptionName = (options, selectedOptions = []) => {
	for (const selected of selectedOptions || []) {
		const buffer = Buffer.from(selected);
		const match = (options || []).find((option) => optionHash(option).equals(buffer));
		if (match) return match;
	}
	return "";
};

const voteAuthor = (pollUpdate, groupJid, sock) => {
	const key = pollUpdate?.pollUpdateMessageKey || {};
	if (key.participant) return key.participant;
	if (key.participantPn) return key.participantPn;
	if (key.participantAlt) return key.participantAlt;
	if (key.fromMe) return String(sock?.user?.id || "").replace(/:\d+@/, "@");
	if (key.remoteJid && key.remoteJid !== groupJid) return key.remoteJid;
	return "";
};

const sendQueued = (sock, jid, content) => messageQueue.enqueue(jid, () => sock.sendMessage(jid, content), 1);

export const registerInteractivePoll = async ({ sentMessage, groupJid, type, ownerJid = "", options, payload = {}, ttlMs = 10 * 60_000 }) => {
	const id = sentMessage?.key?.id;
	if (!id) throw new Error("WhatsApp did not return a poll message id");
	rememberPollMessage(sentMessage, ttlMs);
	const session = {
		_id: id,
		groupJid,
		type,
		ownerJid,
		creationKey: { ...sentMessage.key },
		options: [...options],
		payload,
		creationMessage: sentMessage.message ? encodePollMessage(sentMessage.message) : "",
		expiresAt: new Date(Date.now() + ttlMs),
		votes: [],
		status: "open",
	};
	rememberSession(session);
	await createPollSession(session).catch(error => console.warn("[POLL] initial persistence failed:", error.message));
	return session;
};

export const readInteractivePoll = async (id) => {
	try { return mergeVotes(await getPollSession(id), livePolls.get(id)); }
	catch (error) { if (livePolls.has(id)) return livePolls.get(id); throw error; }
};
export const finishInteractivePoll = async (id, extra = {}) => {
	const live = livePolls.get(id);
	if (live) live.status = "closed";
	try { return mergeVotes(await closePollSession(id, extra), live); }
	catch (error) { if (live) return live; throw error; }
};

export const recordInteractivePollChoice = async (id, voterJid, option) => {
	const session = await readInteractivePoll(id);
	if (!session || session.status !== "open") return;
	const vote = { voterJid, option, votedAt: new Date() };
	session.votes = [...(session.votes || []).filter(row => row.voterJid !== voterJid), vote];
	rememberSession(session);
	await replacePollVote(id, voterJid, option).catch(error => console.warn("Poll choice save failed:", error.message));
};

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
	const session = livePolls.get(key.id) || await readInteractivePoll(key.id);
	if (!session || session.status !== "open") return false;
	if (livePolls.get(key.id)?.status === "closed") return false;
	rememberSession(session);
	if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
		await closePollSession(session._id, { result: "expired" });
		return false;
	}

	let handled = false;
	for (const pollUpdate of update.pollUpdates) {
		const voterJid = voteAuthor(pollUpdate, session.groupJid, sock);
		if (!voterJid) continue;
		const option = selectedOptionName(session.options, pollUpdate?.vote?.selectedOptions || []);
		if (session.status !== "open") break;
		const sentAt = Number(pollUpdate.senderTimestampMs?.toNumber?.() ?? pollUpdate.senderTimestampMs);
        const votedAt = new Date(Number.isFinite(sentAt) && sentAt > 0 ? sentAt : Date.now());
        const previous = (session.votes || []).find(row => row.voterJid === voterJid);
        if (previous && new Date(previous.votedAt || 0).getTime() > votedAt.getTime()) continue;
        const vote = { voterJid, option, votedAt };
		session.votes = [...(session.votes || []).filter(row => row.voterJid !== voterJid), vote];
		// Reflect a decoded vote immediately; a slow DB write must not erase the
		// enrollment already received before the lobby deadline.
		await notifyPollVote(session, vote).catch(error => console.warn("Poll enrollment failed:", error.message));
		await replacePollVote(session._id, voterJid, option).catch(error => console.warn("Poll vote save failed:", error.message));
		handled = true;
		if (session.type === "birthday-confirm" && option) {
			await handleBirthdayChoice(sock, session, voterJid, option);
		}
	}
	return handled;
};

export const handleInteractivePollMessage = async (sock, message) => {
  const update = rawPollUpdate(message);
  if (!update) return false;
  const id = update.pollCreationMessageKey?.id;
  if (!id) return true;
  const session = livePolls.get(id) || await readInteractivePoll(id);
  if (!session || session.status !== "open" || session.groupJid !== message.key?.remoteJid) return true;
  try {
    const decoded = await decryptInteractivePollMessage({ sock, message, session });
    if (decoded) await handleInteractivePollUpdate(sock, decoded);
  } catch (error) {
    console.warn(`[POLL] vote decode failed (${session.type}, ${id}): ${error.message}`);
  }
  return true;
};
