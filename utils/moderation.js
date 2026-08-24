import { config } from "dotenv";
import { group } from "../db/groupData.js";
import { member } from "../db/members.js";
import { extractPhoneNumber } from "./lid.js";
import {
	isGroupOwner,
	isJidGroupAdmin,
	isSameGroupUser,
} from "./groupParticipants.js";
import { getGroupSafetySettings } from "./groupSafety.js";

config();

const ownerJids = (process.env.MY_NUMBER || "")
	.split(",")
	.map((number) => number.replace(/[^0-9]/g, ""))
	.filter(Boolean)
	.map((number) => `${number}@s.whatsapp.net`);

const warningLocks = new Map();

const withWarningLock = async (key, operation) => {
	const previous = warningLocks.get(key) || Promise.resolve();
	let release;
	const current = new Promise((resolve) => {
		release = resolve;
	});
	warningLocks.set(key, current);
	await previous;
	try {
		return await operation();
	} finally {
		release();
		if (warningLocks.get(key) === current) warningLocks.delete(key);
	}
};

export const getGroupWarningCount = (groupData, memberJid) =>
	(Array.isArray(groupData?.memberWarnCount) ? groupData.memberWarnCount : []).find(
		(entry) => entry.member === memberJid,
	)?.count || 0;

export const addGroupWarning = async (groupJid, memberJid) =>
	withWarningLock(`${groupJid}:${memberJid}`, async () => {
		const groupData = await group.findOne(
			{ _id: groupJid },
			{ projection: { memberWarnCount: 1 } },
		);
		const count = getGroupWarningCount(groupData, memberJid) + 1;
		const updated = await group.updateOne(
			{ _id: groupJid, "memberWarnCount.member": memberJid },
			{
				$set: {
					"memberWarnCount.$.count": count,
					"memberWarnCount.$.updatedAt": new Date(),
				},
			},
		);
		if (updated.matchedCount === 0) {
			await group.updateOne(
				{ _id: groupJid },
				{
					$push: {
						memberWarnCount: { member: memberJid, count, updatedAt: new Date() },
					},
				},
			);
		}

		await member.updateOne(
			{ _id: memberJid },
			{
				$setOnInsert: {
					username: extractPhoneNumber(memberJid),
					isBlock: false,
					totalmsg: 0,
					warning: [],
				},
			},
			{ upsert: true },
		);
		const memberUpdated = await member.updateOne(
			{ _id: memberJid, "warning.group": groupJid },
			{ $set: { "warning.$.count": count, "warning.$.updatedAt": new Date() } },
		);
		if (memberUpdated.matchedCount === 0) {
			await member.updateOne(
				{ _id: memberJid },
				{ $push: { warning: { group: groupJid, count, updatedAt: new Date() } } },
			);
		}
		return count;
	});

export const clearGroupWarnings = async (groupJid, memberJid) => {
	await Promise.all([
		group.updateOne(
			{ _id: groupJid },
			{ $pull: { memberWarnCount: { member: memberJid } } },
		),
		member.updateOne(
			{ _id: memberJid },
			{ $pull: { warning: { group: groupJid } } },
		),
	]);
};

export const isProtectedGroupMember = (metadata, memberJid, botJids = []) =>
	isGroupOwner(metadata, memberJid) ||
	isJidGroupAdmin(metadata, memberJid) ||
	isSameGroupUser(metadata, memberJid, botJids) ||
	ownerJids.some((ownerJid) => isSameGroupUser(metadata, memberJid, ownerJid));

export const warnGroupMember = async ({
	sock,
	msg,
	groupJid,
	memberJid,
	groupData,
	groupMetadata,
	botJids,
	isBotAdmin,
	sendMessageWTyping,
	reason = "Group rule violation",
}) => {
	const settings = getGroupSafetySettings(groupData);
	const count = await addGroupWarning(groupJid, memberJid);
	const atLimit = count >= settings.warningLimit;
	const protectedMember = isProtectedGroupMember(groupMetadata, memberJid, botJids);
	let removed = false;
	let suffix = "Please follow the group rules.";

	if (atLimit && settings.warningAction === "remove") {
		if (protectedMember) {
			suffix = "Removal skipped because this member is an admin/owner.";
		} else if (!isBotAdmin) {
			suffix = "Removal skipped because the bot is not an admin.";
		} else {
			try {
				await sock.groupParticipantsUpdate(groupJid, [memberJid], "remove");
				await clearGroupWarnings(groupJid, memberJid);
				removed = true;
				suffix = "Removed after reaching the warning limit.";
			} catch (error) {
				console.warn("Could not remove warned member:", error.message);
				suffix = "Removal failed; an admin should review this member.";
			}
		}
	} else if (atLimit) {
		suffix = "Warning limit reached; admins have been notified.";
	}

	const phone = extractPhoneNumber(memberJid);
	const bars = "🔴".repeat(Math.min(count, settings.warningLimit));
	const empty = "⚪".repeat(Math.max(0, settings.warningLimit - count));
	await sendMessageWTyping(
		groupJid,
		{
			text:
				`⚠️ *Warning ${count}/${settings.warningLimit}*\n` +
				`@${phone} — ${reason}\n${bars}${empty}\n\n${suffix}`,
			mentions: [memberJid],
		},
		{ quoted: msg },
	);

	return { count, limit: settings.warningLimit, atLimit, removed };
};
