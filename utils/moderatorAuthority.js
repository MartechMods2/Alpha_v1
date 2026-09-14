import { group } from "../db/groupData.js";
import { extractPhoneNumber } from "./lid.js";
import { isGroupOwner, isSameGroupUser } from "./groupParticipants.js";
import { claimDeletionBudget } from "./moderationCircuit.js";

const configuredNumbers = (name) => String(process.env[name] || "")
	.split(",")
	.map((value) => value.replace(/\D/g, ""))
	.filter(Boolean);

const moderatorNumbers = configuredNumbers("MODERATORS");
const ownerNumbers = configuredNumbers("MY_NUMBER");
const asPn = (number) => `${number}@s.whatsapp.net`;

const digitsOf = (jid) => {
	try { return String(extractPhoneNumber(jid) || "").replace(/\D/g, ""); }
	catch { return String(jid || "").replace(/\D/g, ""); }
};

export const configuredModeratorNumbers = () => [...moderatorNumbers];

export const isConfiguredModerator = (metadata, candidates = []) => {
	const values = (Array.isArray(candidates) ? candidates : [candidates]).filter(Boolean);
	for (const candidate of values) {
		const digits = digitsOf(candidate);
		if (digits && moderatorNumbers.includes(digits)) return true;
		if (moderatorNumbers.some((number) => isSameGroupUser(metadata, candidate, asPn(number)))) return true;
	}
	return false;
};

export const isModeratorProtectedTarget = (metadata, target, botJids = []) => {
	if (!target) return true;
	if (isGroupOwner(metadata, target)) return true;
	if (isSameGroupUser(metadata, target, botJids)) return true;
	if (ownerNumbers.some((number) => isSameGroupUser(metadata, target, asPn(number)))) return true;
	if (isConfiguredModerator(metadata, [target])) return true;
	return false;
};

export const findModeratorMute = (groupData, memberJid, metadata) => {
	const entries = Array.isArray(groupData?.moderatorMutedMembers) ? groupData.moderatorMutedMembers : [];
	const now = Date.now();
	const expiredMembers = [];
	let entry = null;
	for (const item of entries) {
		if (!isSameGroupUser(metadata, memberJid, item?.member)) continue;
		if (item?.mutedUntil && new Date(item.mutedUntil).getTime() <= now) expiredMembers.push(item.member);
		else if (!entry) entry = item;
	}
	return { entry, expiredMembers };
};

export const enforceModeratorMute = async ({
	sock, msg, groupJid, memberJid, groupData, groupMetadata, botJids = [], isBotAdmin,
}) => {
	if (isModeratorProtectedTarget(groupMetadata, memberJid, botJids)) return { handled: false };
	const muted = findModeratorMute(groupData, memberJid, groupMetadata);
	if (muted.expiredMembers.length) {
		await group.updateOne(
			{ _id: groupJid },
			{ $pull: { moderatorMutedMembers: { member: { $in: muted.expiredMembers } } } },
		);
	}
	if (!muted.entry) return { handled: false };
	if (isBotAdmin && claimDeletionBudget(groupJid)) {
		await sock.sendMessage(groupJid, { delete: msg.key }).catch((error) =>
			console.warn("Could not delete moderator-muted admin message:", error.message));
	}
	return { handled: true, moderatorMuted: true };
};

export const addModeratorAudit = async (groupJid, entry) => group.updateOne(
	{ _id: groupJid },
	{
		$push: {
			moderatorAudit: {
				$each: [{ ...entry, at: new Date() }],
				$slice: -100,
			},
		},
	},
);
