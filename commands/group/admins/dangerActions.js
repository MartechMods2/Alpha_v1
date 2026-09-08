import crypto from "node:crypto";
import { config } from "dotenv";
import { group } from "../../../db/groupData.js";
import { alphaPanel, safeDisplayName } from "../../../utils/alphaStyle.js";
import { mergeLiveGroupActivity } from "../../../utils/groupActivity.js";
import {
	candidateAliasSet,
	chunkDangerTargets,
	DANGER_CONFIRM_TTL_MS,
	keepPreviewedCandidates,
	parseDayToken,
	REMOVAL_BATCH_DELAY_MS,
	selectInactiveCandidates,
	selectKickAllCandidates,
	unknownActivityMembers,
} from "../../../utils/dangerGroupActions.js";
import { isSameGroupUser, normalizeUserJid } from "../../../utils/groupParticipants.js";

config();

const configuredProtectedJids = [process.env.MY_NUMBER, process.env.MODERATORS]
	.filter(Boolean)
	.flatMap((value) => String(value).split(","))
	.map((value) => value.replace(/[^0-9]/g, ""))
	.filter(Boolean)
	.map((value) => `${value}@s.whatsapp.net`);

const pendingDangerActions = new Map();

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const confirmationCode = () => crypto.randomBytes(3).toString("hex").toUpperCase();
const actionKey = (from, senderJid, action) => `${from}:${normalizeUserJid(senderJid) || senderJid}:${action}`;

const cleanupExpiredPreviews = () => {
	const now = Date.now();
	for (const [key, value] of pendingDangerActions.entries()) {
		if (!value || value.expiresAt <= now) pendingDangerActions.delete(key);
	}
};

const savePreview = ({ from, senderJid, action, candidates, days = null }) => {
	cleanupExpiredPreviews();
	const code = confirmationCode();
	pendingDangerActions.set(actionKey(from, senderJid, action), {
		code,
		days,
		previewAliases: [...candidateAliasSet(candidates)],
		expiresAt: Date.now() + DANGER_CONFIRM_TTL_MS,
	});
	return code;
};

const getPreview = ({ from, senderJid, action, code }) => {
	cleanupExpiredPreviews();
	const key = actionKey(from, senderJid, action);
	const preview = pendingDangerActions.get(key);
	if (!preview || preview.code !== String(code || "").trim().toUpperCase()) return null;
	pendingDangerActions.delete(key);
	return preview;
};

const isProtectedMember = (member, metadata) => {
	if (member?.isAdmin) return true;
	return configuredProtectedJids.some((jid) => isSameGroupUser(metadata, member?.id, jid));
};

const withoutProtected = (members, metadata) =>
	members.filter((member) => !isProtectedMember(member, metadata));

const loadLiveRoster = async ({ sock, from, botJids = [] }) => {
	const [res, metadata] = await Promise.all([
		group.findOne({ _id: from }),
		sock.groupMetadata(from),
	]);
	if (!metadata?.participants?.length) throw new Error("Live WhatsApp participant list is unavailable.");
	const roster = mergeLiveGroupActivity({
		participants: metadata.participants,
		trackedMembers: res?.members || [],
		botJids,
	});
	return { res, metadata, roster };
};

const daysAgo = (value) => {
	if (!value) return "unknown";
	const time = new Date(value).getTime();
	if (!Number.isFinite(time)) return "unknown";
	return `${Math.max(0, Math.floor((Date.now() - time) / 86_400_000))}d ago`;
};

const previewRows = (members, limit = 20) => {
	const visible = members.slice(0, limit).map((member, index) =>
		`${index + 1}. *${safeDisplayName(member.name, member.id)}* — ${Number(member.count || 0)} msgs · ${daysAgo(member.lastMessageAt)}`,
	);
	if (members.length > limit) visible.push(`…and *${members.length - limit} more*.`);
	return visible;
};

const removeInBatches = async ({ sock, from, members }) => {
	let removed = 0;
	let failed = 0;
	const batches = chunkDangerTargets(members);

	for (let index = 0; index < batches.length; index += 1) {
		const batch = batches[index];
		try {
			await sock.groupParticipantsUpdate(from, batch.map((member) => member.id), "remove");
			removed += batch.length;
		} catch (error) {
			failed += batch.length;
			console.error("[danger group removal error]", error.message);
		}
		if (index < batches.length - 1) await delay(REMOVAL_BATCH_DELAY_MS);
	}

	return { removed, failed };
};

const confirmationFromArgs = (args) => {
	const words = args.map((arg) => String(arg).toLowerCase());
	const index = words.indexOf("confirm");
	return index >= 0 ? String(args[index + 1] || "").trim().toUpperCase() : "";
};

const dangerHelp = ({ sendMessageWTyping, from, msg }) => sendMessageWTyping(from, {
	text: alphaPanel({
		icon: "☢️",
		title: "Danger Actions",
		lines: [
			"`kickinactive 120d` — preview members proven inactive for 120+ days",
			"`kickinactive confirm CODE` — remove only the reviewed stale members",
			"`muteall` — preview admin-only posting mode",
			"`muteall confirm CODE` — mute ordinary members; admins can still send",
			"`unmuteall` — reopen posting to everyone",
			"`kickall` — OWNER ONLY preview of all removable ordinary members",
			"`kickall confirm CODE` — OWNER ONLY bulk removal after review",
		],
		footer: "Safeguards: live roster required, Alpha/admins/owner/moderators protected, 2-minute codes, fresh revalidation, paced removal batches.",
	}),
}, { quoted: msg });

const handleKickInactive = async ({ sock, msg, from, args, senderJid, botJids, isBotAdmin, sendMessageWTyping }) => {
	if (!isBotAdmin) return sendMessageWTyping(from, { text: "❌ Alpha must be a group admin before it can remove members." }, { quoted: msg });

	const confirmCode = confirmationFromArgs(args);
	if (confirmCode) {
		const pending = getPreview({ from, senderJid, action: "kickinactive", code: confirmCode });
		if (!pending) {
			return sendMessageWTyping(from, { text: "❌ Invalid or expired confirmation. Run `kickinactive 120d` again." }, { quoted: msg });
		}
		const { metadata, roster } = await loadLiveRoster({ sock, from, botJids });
		const currentEligible = withoutProtected(
			selectInactiveCandidates(roster, pending.days),
			metadata,
		);
		const targets = keepPreviewedCandidates(currentEligible, pending.previewAliases);
		if (!targets.length) {
			return sendMessageWTyping(from, { text: "✅ No reviewed member is still eligible. Nobody was removed." }, { quoted: msg });
		}
		const result = await removeInBatches({ sock, from, members: targets });
		return sendMessageWTyping(from, {
			text: alphaPanel({
				icon: "🧹",
				title: "Inactive Cleanup Complete",
				lines: [
					`Rule: *${pending.days}+ days inactive*`,
					`Removed: *${result.removed}*`,
					`Failed/skipped by WhatsApp: *${result.failed}*`,
				],
				footer: "Only members from the confirmed preview who were still inactive were targeted.",
			}),
		}, { quoted: msg });
	}

	const dayToken = args.find((arg) => parseDayToken(arg));
	const days = parseDayToken(dayToken);
	if (!days) {
		return sendMessageWTyping(from, { text: "❌ Usage: `kickinactive 120d` then `kickinactive confirm CODE`." }, { quoted: msg });
	}

	const { metadata, roster } = await loadLiveRoster({ sock, from, botJids });
	const candidates = withoutProtected(selectInactiveCandidates(roster, days), metadata);
	const unknown = withoutProtected(unknownActivityMembers(roster), metadata);
	if (!candidates.length) {
		return sendMessageWTyping(from, {
			text: alphaPanel({
				icon: "✅",
				title: "Inactive Cleanup Review",
				lines: [
					`Rule: *${days}+ days inactive*`,
					"Provably stale members: *0*",
					`Unknown/no tracked last-message date: *${unknown.length}*`,
				],
				footer: "Unknown-history members are not auto-kicked because Alpha cannot prove they have been inactive that long.",
			}),
		}, { quoted: msg });
	}

	const code = savePreview({ from, senderJid, action: "kickinactive", candidates, days });
	const rows = previewRows(candidates);
	return sendMessageWTyping(from, {
		text: alphaPanel({
			icon: "⚠️",
			title: "Inactive Removal Preview",
			lines: [
				`Rule: *${days}+ days since last tracked message*`,
				`Will remove: *${candidates.length} ordinary member${candidates.length === 1 ? "" : "s"}*`,
				`Unknown history excluded: *${unknown.length}*`,
				...rows,
				"",
				`Confirm within 2 minutes: \`kickinactive confirm ${code}\``,
			],
			footer: "Admins, Alpha, configured owner and moderators are protected automatically.",
		}),
	}, { quoted: msg });
};

const handleMuteAll = async ({ sock, msg, from, args, senderJid, botJids, isBotAdmin, sendMessageWTyping }) => {
	if (!isBotAdmin) return sendMessageWTyping(from, { text: "❌ Alpha must be a group admin to change group posting permissions." }, { quoted: msg });
	const confirmCode = confirmationFromArgs(args);
	if (confirmCode) {
		const pending = getPreview({ from, senderJid, action: "muteall", code: confirmCode });
		if (!pending) return sendMessageWTyping(from, { text: "❌ Invalid or expired confirmation. Run `muteall` again." }, { quoted: msg });
		await sock.groupSettingUpdate(from, "announcement");
		return sendMessageWTyping(from, {
			text: alphaPanel({
				icon: "🔇",
				title: "Members Muted",
				lines: ["Only group admins can send messages now."],
				footer: "Use `unmuteall` to reopen the group.",
			}),
		}, { quoted: msg });
	}

	const { metadata, roster } = await loadLiveRoster({ sock, from, botJids });
	if (metadata.announce === true) {
		return sendMessageWTyping(from, { text: "🔇 The group is already in admin-only posting mode. Use `unmuteall` to reopen it." }, { quoted: msg });
	}
	const ordinary = withoutProtected(selectKickAllCandidates(roster), metadata);
	const code = savePreview({ from, senderJid, action: "muteall", candidates: ordinary });
	return sendMessageWTyping(from, {
		text: alphaPanel({
			icon: "⚠️",
			title: "Mute-All Preview",
			lines: [
				`Current human members: *${roster.length}*`,
				`Ordinary members affected: *${ordinary.length}*`,
				"Admins will still be able to send messages.",
				`Confirm within 2 minutes: \`muteall confirm ${code}\``,
			],
			footer: "This changes the WhatsApp group to admin-only posting mode; it does not individually blacklist members.",
		}),
	}, { quoted: msg });
};

const handleUnmuteAll = async ({ sock, msg, from, isBotAdmin, sendMessageWTyping }) => {
	if (!isBotAdmin) return sendMessageWTyping(from, { text: "❌ Alpha must be a group admin to reopen the group." }, { quoted: msg });
	await sock.groupSettingUpdate(from, "not_announcement");
	return sendMessageWTyping(from, {
		text: alphaPanel({
			icon: "🔊",
			title: "Group Reopened",
			lines: ["All group members can send messages again."],
		}),
	}, { quoted: msg });
};

const handleKickAll = async ({ sock, msg, from, args, senderJid, botJids, isBotAdmin, isOwner, sendMessageWTyping }) => {
	if (!isOwner) {
		return sendMessageWTyping(from, { text: "⛔ `kickall` is restricted to the configured Alpha owner." }, { quoted: msg });
	}
	if (!isBotAdmin) return sendMessageWTyping(from, { text: "❌ Alpha must be a group admin before it can remove members." }, { quoted: msg });

	const confirmCode = confirmationFromArgs(args);
	if (confirmCode) {
		const pending = getPreview({ from, senderJid, action: "kickall", code: confirmCode });
		if (!pending) return sendMessageWTyping(from, { text: "❌ Invalid or expired confirmation. Run `kickall` again." }, { quoted: msg });
		const { metadata, roster } = await loadLiveRoster({ sock, from, botJids });
		const currentEligible = withoutProtected(selectKickAllCandidates(roster), metadata);
		const targets = keepPreviewedCandidates(currentEligible, pending.previewAliases);
		if (!targets.length) return sendMessageWTyping(from, { text: "✅ No reviewed ordinary members remain eligible. Nobody was removed." }, { quoted: msg });
		const result = await removeInBatches({ sock, from, members: targets });
		return sendMessageWTyping(from, {
			text: alphaPanel({
				icon: "☢️",
				title: "Bulk Removal Complete",
				lines: [
					`Removed ordinary members: *${result.removed}*`,
					`Failed/skipped by WhatsApp: *${result.failed}*`,
				],
				footer: "Admins, Alpha, configured owner and moderators were protected. Newly joined members after the preview were not targeted.",
			}),
		}, { quoted: msg });
	}

	const { metadata, roster } = await loadLiveRoster({ sock, from, botJids });
	const candidates = withoutProtected(selectKickAllCandidates(roster), metadata);
	if (!candidates.length) return sendMessageWTyping(from, { text: "✅ There are no removable ordinary members in this group." }, { quoted: msg });
	const code = savePreview({ from, senderJid, action: "kickall", candidates });
	const rows = previewRows(candidates);
	return sendMessageWTyping(from, {
		text: alphaPanel({
			icon: "☢️",
			title: "KICK-ALL DANGER PREVIEW",
			lines: [
				`Will remove: *${candidates.length} ordinary member${candidates.length === 1 ? "" : "s"}*`,
				"Protected: all current admins, Alpha, configured owner and moderators.",
				...rows,
				"",
				`Confirm within 2 minutes: \`kickall confirm ${code}\``,
			],
			footer: "This is destructive. Alpha re-checks the live roster before removal and sends removals in paced batches.",
		}),
	}, { quoted: msg });
};

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const context = { sock, msg, from, args, ...msgInfoObj };
	try {
		switch (msgInfoObj.command) {
			case "danger":
			case "dangerhelp":
				return dangerHelp(context);
			case "kickinactive":
			case "purgeinactive":
				return handleKickInactive(context);
			case "muteall":
			case "lockgroup":
				return handleMuteAll(context);
			case "unmuteall":
			case "opengroup":
				return handleUnmuteAll(context);
			case "kickall":
			case "purgeall":
				return handleKickAll(context);
			default:
				return dangerHelp(context);
		}
	} catch (error) {
		console.error("[danger actions error]", error);
		return msgInfoObj.sendMessageWTyping(from, {
			text: `❌ Danger action stopped safely: ${error.message}`,
		}, { quoted: msg });
	}
};

export default () => ({
	cmd: [
		"danger", "dangerhelp",
		"kickinactive", "purgeinactive",
		"muteall", "lockgroup",
		"unmuteall", "opengroup",
		"kickall", "purgeall",
	],
	desc: "Guarded high-impact group controls with preview, confirmation and protected accounts",
	usage: "danger | kickinactive 120d | muteall | unmuteall | kickall",
	handler,
});
