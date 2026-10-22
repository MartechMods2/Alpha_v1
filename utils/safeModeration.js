import {isSameGroupUser} from "./groupParticipants.js";
import {containsBannedPhrase} from "./premiumReplies.js";
import { getSafeSettings, updateSafeSettings, recordSafeAudit, createSafeItem, listSafeItems } from "../db/safePackData.js";
import { isProtectedGroupMember } from "./moderation.js";
import { moderationCircuitStatus } from "./moderationCircuit.js";
import { deleteModerationMessage, deletionNotice } from "./moderationDelete.js";

const lastMessages = new Map();
const mediaWindows = new Map();
const joinWindows = new Map();
const noticeCooldowns = new Map();

const mentionCount = (msg) => {
	const message = msg?.message || {};
	for (const value of Object.values(message)) {
		const mentions = value?.contextInfo?.mentionedJid;
		if (Array.isArray(mentions)) return mentions.length;
	}
	return 0;
};

const messageKind = (msg) => Object.keys(msg?.message || {}).find((key) => /^(image|video|audio|sticker|document)Message$/.test(key)) || "";

export const handleSafeModerationMessage = async ({ sock, msg, groupJid, senderJid, body, isCommand, isOwner, isGroupAdmin, groupMetadata, botJids, isBotAdmin, sendMessageWTyping }) => {
	if (isOwner || isGroupAdmin || isProtectedGroupMember(groupMetadata, senderJid, botJids)) return { handled: false };
	const settings = await getSafeSettings(groupJid);
	const violation = async (action, reason) => {
		const deletion = await deleteModerationMessage({ sock, msg, groupJid, memberJid: senderJid, groupMetadata, botJids, isBotAdmin });
		if (deletion.status === "protected") return { handled: false };
		await recordSafeAudit({ groupJid, action, targetJid: senderJid, reason: `${reason} Deletion: ${deletion.status}.` });
		const noticeKey = `${groupJid}:${senderJid}:${action}`;
		if ((noticeCooldowns.get(noticeKey) || 0) < Date.now()) {
			noticeCooldowns.set(noticeKey, Date.now() + 10 * 60_000);
			await sendMessageWTyping(groupJid, { text: `🛡️ @${senderJid.split("@")[0]}: ${reason}\n${deletionNotice(deletion)}`, mentions: [senderJid] }).catch(() => {});
		}
		return { handled: true, deleted: deletion.deleted, deletionStatus: deletion.status };
	};

	if ((settings.blockedBotJids||[]).some(jid=>isSameGroupUser(groupMetadata,jid,senderJid))) return violation('confirmed-bot','This account is blocked by the group administrators.');
    // Message IDs alone are never evidence. A native bot marker only prompts review.
    if(settings.antiBotEnabled && msg?.message?.botInvokeMessage){
      const key=`${groupJid}:${senderJid}:bot-review`;
      if((noticeCooldowns.get(key)||0)<Date.now()){
        noticeCooldowns.set(key,Date.now()+3600000);
        await recordSafeAudit({groupJid,action:'bot-review',targetJid:senderJid,reason:'Native bot invocation observed; manual review required'});
        await sendMessageWTyping(groupJid,{text:'🛡️ An automation-related message was observed. Admin review is needed; nobody was removed.'}).catch(()=>{});
      }
    }
	if (settings.slowModeSeconds > 0) {
		const key = `${groupJid}:${senderJid}`;
		const ready = (lastMessages.get(key) || 0) + settings.slowModeSeconds * 1_000;
		lastMessages.set(key, Date.now());
		if (Date.now() < ready) return violation("slowmode", `Slow mode is active. Wait ${settings.slowModeSeconds} seconds between messages.`);
	}

	if (settings.wordFilterEnabled && body) {
		const lower = body;
		const phrase = (settings.blockedPhrases || []).find((item) => containsBannedPhrase(lower,item));
		if (phrase) return violation("word-filter", "That message contains a blocked phrase.");
	}
	if (settings.mentionLimit > 0 && mentionCount(msg) > settings.mentionLimit) return violation("mention-limit", `Maximum ${settings.mentionLimit} mentions per message.`);

	const kind = messageKind(msg);
	if (settings.mediaLimit > 0 && kind) {
		const key = `${groupJid}:${senderJid}`;
		const entries = (mediaWindows.get(key) || []).filter((time) => Date.now() - time < 60_000);
		entries.push(Date.now()); mediaWindows.set(key, entries);
		if (entries.length > settings.mediaLimit) return violation("media-limit", `Maximum ${settings.mediaLimit} media messages per minute.`);
	}

	if (settings.probationHours > 0) {
		const joins = await listSafeItems(groupJid, "member-join", { memberJid: senderJid }, 1);
		const joinedAt = joins[0]?.createdAt ? new Date(joins[0].createdAt).getTime() : 0;
		if (joinedAt && Date.now() - joinedAt < settings.probationHours * 3_600_000 && (isCommand || /https?:\/\/|chat\.whatsapp\.com/i.test(body))) {
			return violation("probation", `New members cannot use commands or post links during the ${settings.probationHours}-hour probation period.`);
		}
	}
	return { handled: false };
};

export const handleSafeJoinEvent = async ({ sock, groupJid, participantJids }) => {
	for (const memberJid of participantJids) await createSafeItem({ groupJid, type: "member-join", memberJid, status: "active" });
	const settings = await getSafeSettings(groupJid);
	if (!settings.antiRaidEnabled) return { locked: false };
	const now = Date.now();
	const entries = [...(joinWindows.get(groupJid) || []), ...participantJids.map(() => now)].filter((time) => now - time < settings.antiRaidWindowSeconds * 1_000);
	joinWindows.set(groupJid, entries);
	if (entries.length < settings.antiRaidLimit) return { locked: false };
	try {
		await sock.groupSettingUpdate(groupJid, "announcement");
		await updateSafeSettings(groupJid, { lockdownUntil: new Date(Date.now() + 10 * 60_000) });
		await recordSafeAudit({ groupJid, action: "anti-raid-lock", reason: `${entries.length} joins in ${settings.antiRaidWindowSeconds}s` });
		return { locked: true, count: entries.length };
	} catch { return { locked: false }; }
};

export const safeModerationRuntimeStatus = () => ({
	slowModeMembers: lastMessages.size,
	mediaWindows: mediaWindows.size,
	...moderationCircuitStatus(),
	antiRaidGroups: joinWindows.size,
});
