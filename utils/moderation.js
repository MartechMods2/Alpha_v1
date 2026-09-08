import { config } from "dotenv";
import { group } from "../db/groupData.js";
import { member } from "../db/members.js";
import { extractPhoneNumber } from "./lid.js";
import { isGroupOwner, isJidGroupAdmin, isSameGroupUser } from "./groupParticipants.js";
import { findMutedMember, getGroupSafetySettings } from "./groupSafety.js";
import { getSafeSettings } from "../db/safePackData.js";
import { claimDeletionBudget } from "./moderationCircuit.js";
import { renderGroupTemplate } from "./groupTemplates.js";

config();
const ownerJids = (process.env.MY_NUMBER || "").split(",").map((number) => number.replace(/[^0-9]/g, "")).filter(Boolean).map((number) => `${number}@s.whatsapp.net`);
const warningLocks = new Map();
const withWarningLock = async (key, operation) => {
	const previous = warningLocks.get(key) || Promise.resolve();
	let release;
	const current = new Promise((resolve) => { release = resolve; });
	warningLocks.set(key, current);
	await previous;
	try { return await operation(); }
	finally { release(); if (warningLocks.get(key) === current) warningLocks.delete(key); }
};

export const getGroupWarningCount = (groupData, memberJid) => (Array.isArray(groupData?.memberWarnCount) ? groupData.memberWarnCount : []).find((entry) => entry.member === memberJid)?.count || 0;

export const addGroupWarning = async (groupJid, memberJid) => withWarningLock(`${groupJid}:${memberJid}`, async () => {
	const groupData = await group.findOne({ _id: groupJid }, { projection: { memberWarnCount: 1 } });
	const safeSettings = await getSafeSettings(groupJid);
	if (safeSettings.warningExpiryDays > 0) {
		const cutoff = Date.now() - safeSettings.warningExpiryDays * 86_400_000;
		const expired = (groupData?.memberWarnCount || []).find((entry) => entry.member === memberJid && entry.updatedAt && new Date(entry.updatedAt).getTime() < cutoff);
		if (expired) await clearGroupWarnings(groupJid, memberJid);
	}
	const count = (safeSettings.warningExpiryDays > 0 && (groupData?.memberWarnCount || []).find((entry) => entry.member === memberJid && entry.updatedAt && new Date(entry.updatedAt).getTime() < Date.now() - safeSettings.warningExpiryDays * 86_400_000) ? 0 : getGroupWarningCount(groupData, memberJid)) + 1;
	const updated = await group.updateOne({ _id: groupJid, "memberWarnCount.member": memberJid }, { $set: { "memberWarnCount.$.count": count, "memberWarnCount.$.updatedAt": new Date() } });
	if (updated.matchedCount === 0) await group.updateOne({ _id: groupJid }, { $push: { memberWarnCount: { member: memberJid, count, updatedAt: new Date() } } });
	await member.updateOne({ _id: memberJid }, { $setOnInsert: { username: extractPhoneNumber(memberJid), isBlock: false, totalmsg: 0, warning: [] } }, { upsert: true });
	const memberUpdated = await member.updateOne({ _id: memberJid, "warning.group": groupJid }, { $set: { "warning.$.count": count, "warning.$.updatedAt": new Date() } });
	if (memberUpdated.matchedCount === 0) await member.updateOne({ _id: memberJid }, { $push: { warning: { group: groupJid, count, updatedAt: new Date() } } });
	return count;
});

export const clearGroupWarnings = async (groupJid, memberJid) => Promise.all([
	group.updateOne({ _id: groupJid }, { $pull: { memberWarnCount: { member: memberJid } } }),
	member.updateOne({ _id: memberJid }, { $pull: { warning: { group: groupJid } } }),
]);

export const addStatusMentionWarning = async ({ groupJid, memberJid, matches }) => withWarningLock(`status:${groupJid}`, async () => {
	const groupData = await group.findOne({ _id: groupJid }, { projection: { statusMentionWarnCount: 1 } });
	const entries = Array.isArray(groupData?.statusMentionWarnCount) ? groupData.statusMentionWarnCount : [];
	const existing = entries.find((entry) => matches(memberJid, entry.member));
	const count = Math.min(3, Number(existing?.count || 0) + 1);
	if (existing) await group.updateOne({ _id: groupJid, "statusMentionWarnCount.member": existing.member }, { $set: { "statusMentionWarnCount.$.count": count, "statusMentionWarnCount.$.updatedAt": new Date() } });
	else await group.updateOne({ _id: groupJid }, { $push: { statusMentionWarnCount: { $each: [{ member: memberJid, count, updatedAt: new Date() }], $slice: -200 } } });
	return count;
});

export const clearStatusMentionWarnings = async (groupJid, memberJid, matches = (left, right) => left === right) => {
	const groupData = await group.findOne({ _id: groupJid }, { projection: { statusMentionWarnCount: 1 } });
	const members = (Array.isArray(groupData?.statusMentionWarnCount) ? groupData.statusMentionWarnCount : []).filter((entry) => matches(memberJid, entry.member)).map((entry) => entry.member);
	if (members.length) await group.updateOne({ _id: groupJid }, { $pull: { statusMentionWarnCount: { member: { $in: members } } } });
};

export const enforceMemberMute = async ({ sock, msg, groupJid, memberJid, groupData, groupMetadata, botJids, isBotAdmin }) => {
	if (isProtectedGroupMember(groupMetadata, memberJid, botJids)) return { handled: false };
	const matches = (left, right) => isSameGroupUser(groupMetadata, left, right);
	const muted = findMutedMember(groupData, memberJid, matches);
	if (muted.expiredMembers.length) await group.updateOne({ _id: groupJid }, { $pull: { mutedMembers: { member: { $in: muted.expiredMembers } } } });
	if (!muted.entry) return { handled: false };
	if (isBotAdmin && claimDeletionBudget(groupJid)) await sock.sendMessage(groupJid, { delete: msg.key }).catch((error) => console.warn("Could not delete a muted member's message:", error.message));
	return { handled: true, muted: true };
};

export const warnStatusMentionMember = async ({ sock, msg, groupJid, memberJid, groupData, groupMetadata, botJids, isBotAdmin, sendMessageWTyping }) => {
	const settings = getGroupSafetySettings(groupData);
	if (!settings.isAntiStatusMentionOn || isProtectedGroupMember(groupMetadata, memberJid, botJids)) return { handled: false };
	const matches = (left, right) => isSameGroupUser(groupMetadata, left, right);
	if (isBotAdmin) await sock.sendMessage(groupJid, { delete: msg.key }).catch((error) => console.warn("Could not delete group status mention:", error.message));
	const limit = settings.statusMentionWarningLimit || 3;
	const count = await addStatusMentionWarning({ groupJid, memberJid, matches });
	let removed = false;
	let action = "Do not mention this group in your WhatsApp Status.";
	if (count >= limit) {
		if (!isBotAdmin) action = "Strike limit reached, but Alpha must be a group admin before it can remove this member.";
		else {
			try { await sock.groupParticipantsUpdate(groupJid, [memberJid], "remove"); await clearStatusMentionWarnings(groupJid, memberJid, matches); removed = true; action = "Member removed after reaching the Status-Mention strike limit."; }
			catch (error) { console.warn("Could not remove status-mention offender:", error.message); action = "Strike limit reached; automatic removal failed, so an admin should review this member."; }
		}
	}
	const phone = extractPhoneNumber(memberJid);
	const text = renderGroupTemplate(count >= limit ? "anti-status-final" : "anti-status", { user: `@${phone}`, group: groupData?.grpName || "this group", warning: count, count, max: limit, action });
	await sendMessageWTyping(groupJid, { text, mentions: [memberJid] }, { quoted: msg });
	return { handled: true, count, limit, removed };
};

export const isProtectedGroupMember = (metadata, memberJid, botJids = []) => isGroupOwner(metadata, memberJid) || isJidGroupAdmin(metadata, memberJid) || isSameGroupUser(metadata, memberJid, botJids) || ownerJids.some((ownerJid) => isSameGroupUser(metadata, memberJid, ownerJid));

export const warnGroupMember = async ({ sock, msg, groupJid, memberJid, groupData, groupMetadata, botJids, isBotAdmin, sendMessageWTyping, reason = "Group rule violation", templateKey = "warning" }) => {
	const settings = getGroupSafetySettings(groupData);
	const count = await addGroupWarning(groupJid, memberJid);
	const atLimit = count >= settings.warningLimit;
	const protectedMember = isProtectedGroupMember(groupMetadata, memberJid, botJids);
	let removed = false;
	let action = "Please correct the behaviour and follow the group rules.";
	if (atLimit && settings.warningAction === "remove") {
		if (protectedMember) action = "Removal skipped because this member is an admin/owner or otherwise protected.";
		else if (!isBotAdmin) action = "Removal skipped because Alpha is not a group admin.";
		else {
			try { await sock.groupParticipantsUpdate(groupJid, [memberJid], "remove"); await clearGroupWarnings(groupJid, memberJid); removed = true; action = "Member removed after reaching the configured warning limit."; }
			catch (error) { console.warn("Could not remove warned member:", error.message); action = "Removal failed; an admin should review this member."; }
		}
	} else if (atLimit) action = "Warning limit reached; admins should review this member.";
	const phone = extractPhoneNumber(memberJid);
	const meter = `${"🔴".repeat(Math.min(count, settings.warningLimit))}${"⚪".repeat(Math.max(0, settings.warningLimit - count))}`;
	let key = templateKey;
	if (atLimit && templateKey === "anti-link") key = "anti-link-action";
	else if (atLimit && templateKey === "warning") key = "final-warning";
	const text = renderGroupTemplate(key, { user: `@${phone}`, group: groupData?.grpName || "this group", reason, warning: count, count, max: settings.warningLimit, meter, action });
	await sendMessageWTyping(groupJid, { text, mentions: [memberJid] }, { quoted: msg });
	return { count, limit: settings.warningLimit, atLimit, removed };
};
