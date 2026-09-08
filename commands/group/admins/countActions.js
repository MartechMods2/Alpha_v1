import crypto from "node:crypto";
import { config } from "dotenv";
import { group } from "../../../db/groupData.js";
import { alphaPanel, safeDisplayName } from "../../../utils/alphaStyle.js";
import { getCountReview } from "../../../utils/countReview.js";
import { mergeLiveGroupActivity } from "../../../utils/groupActivity.js";
import {
	candidateAliasSet,
	chunkDangerTargets,
	DANGER_CONFIRM_TTL_MS,
	keepPreviewedCandidates,
	REMOVAL_BATCH_DELAY_MS,
} from "../../../utils/dangerGroupActions.js";
import { isSameGroupUser, normalizeUserJid } from "../../../utils/groupParticipants.js";
import { parseMuteDuration } from "../../../utils/groupSafety.js";

config();

const DEFAULT_MUTE_DURATION = "7d";
const MAX_BULK_MUTES = 100;
const pendingActions = new Map();

const configuredProtectedJids = [process.env.MY_NUMBER, process.env.MODERATORS]
	.filter(Boolean)
	.flatMap((value) => String(value).split(","))
	.map((value) => value.replace(/[^0-9]/g, ""))
	.filter(Boolean)
	.map((value) => `${value}@s.whatsapp.net`);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const confirmationCode = () => crypto.randomBytes(3).toString("hex").toUpperCase();
const actionKey = (from, senderJid, action) => `${from}:${normalizeUserJid(senderJid) || senderJid}:${action}`;

const cleanupExpired = () => {
	const now = Date.now();
	for (const [key, value] of pendingActions.entries()) {
		if (!value || value.expiresAt <= now) pendingActions.delete(key);
	}
};

const saveActionPreview = ({ from, senderJid, action, candidates, label, muteDuration = null }) => {
	cleanupExpired();
	const code = confirmationCode();
	pendingActions.set(actionKey(from, senderJid, action), {
		code,
		label,
		previewAliases: [...candidateAliasSet(candidates)],
		muteMilliseconds: muteDuration?.milliseconds ?? null,
		muteLabel: muteDuration?.label ?? "",
		expiresAt: Date.now() + DANGER_CONFIRM_TTL_MS,
	});
	return code;
};

const takeActionPreview = ({ from, senderJid, action, code }) => {
	cleanupExpired();
	const key = actionKey(from, senderJid, action);
	const preview = pendingActions.get(key);
	if (!preview || preview.code !== String(code || "").trim().toUpperCase()) return null;
	pendingActions.delete(key);
	return preview;
};

const confirmationFromArgs = (args) => {
	const words = args.map((arg) => String(arg).toLowerCase());
	const index = words.indexOf("confirm");
	return index >= 0 ? String(args[index + 1] || "").trim().toUpperCase() : "";
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
	return { metadata, roster };
};

const previewRows = (members, limit = 20) => {
	const rows = members.slice(0, limit).map((member, index) =>
		`${index + 1}. *${safeDisplayName(member.name, member.id)}* — ${Number(member.count || 0)} msgs`,
	);
	if (members.length > limit) rows.push(`…and *${members.length - limit} more*.`);
	return rows;
};

const removalSucceeded = (entry) => {
	if (!entry) return false;
	const raw = entry.status ?? entry.content?.status;
	if (raw === undefined || raw === null) return true;
	const status = Number(raw);
	return Number.isFinite(status) ? status >= 200 && status < 300 : String(raw) === "200";
};

const removeInBatches = async ({ sock, from, members }) => {
	let removed = 0;
	let failed = 0;
	const batches = chunkDangerTargets(members);
	for (let index = 0; index < batches.length; index += 1) {
		const batch = batches[index];
		try {
			const response = await sock.groupParticipantsUpdate(from, batch.map((member) => member.id), "remove");
			if (Array.isArray(response) && response.length) {
				for (let itemIndex = 0; itemIndex < batch.length; itemIndex += 1) {
					if (removalSucceeded(response[itemIndex])) removed += 1;
					else failed += 1;
				}
			} else {
				removed += batch.length;
			}
		} catch (error) {
			failed += batch.length;
			console.error("[kickcount removal error]", error.message);
		}
		if (index < batches.length - 1) await delay(REMOVAL_BATCH_DELAY_MS);
	}
	return { removed, failed };
};

const currentReviewTargets = async ({ sock, from, senderJid, botJids }) => {
	const review = getCountReview({ groupJid: from, senderJid });
	if (!review) return { review: null, metadata: null, targets: [] };
	const { metadata, roster } = await loadLiveRoster({ sock, from, botJids });
	const matched = keepPreviewedCandidates(roster, review.memberAliases);
	return { review, metadata, targets: withoutProtected(matched, metadata) };
};

const handleKickCount = async ({ sock, msg, from, args, senderJid, botJids = [], isBotAdmin, sendMessageWTyping }) => {
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	if (!isBotAdmin) return reply("❌ Alpha must be a group admin before it can remove reviewed members.");

	const confirmCode = confirmationFromArgs(args);
	if (confirmCode) {
		const pending = takeActionPreview({ from, senderJid, action: "kickcount", code: confirmCode });
		if (!pending) return reply("❌ Invalid or expired confirmation. Run `kickcount` again after your `$count` review.");
		const { metadata, roster } = await loadLiveRoster({ sock, from, botJids });
		const targets = withoutProtected(
			keepPreviewedCandidates(roster, pending.previewAliases),
			metadata,
		);
		if (!targets.length) return reply("✅ None of the reviewed members are still removable. Nobody was kicked.");
		const result = await removeInBatches({ sock, from, members: targets });
		return reply(alphaPanel({
			icon: "🧹",
			title: "Count Review Cleanup Complete",
			lines: [
				`Review: *${pending.label}*`,
				`Removed: *${result.removed}*`,
				`Failed/skipped by WhatsApp: *${result.failed}*`,
			],
			footer: "Only members from the confirmed count review who were still removable were targeted.",
		}));
	}

	const { review, targets } = await currentReviewTargets({ sock, from, senderJid, botJids });
	if (!review) return reply("❌ No recent `$count` review found. Run a `$count ...` command first, then use `kickcount` within 5 minutes.");
	if (!targets.length) return reply(`✅ Your last count review (*${review.label}*) has no removable ordinary members.`);

	const code = saveActionPreview({
		from,
		senderJid,
		action: "kickcount",
		candidates: targets,
		label: review.label,
	});
	return reply(alphaPanel({
		icon: "⚠️",
		title: "Kick Last Count Review",
		lines: [
			`Review: *${review.label}*`,
			`Will remove: *${targets.length} ordinary member${targets.length === 1 ? "" : "s"}*`,
			...previewRows(targets),
			`Confirm within 2 minutes: \`kickcount confirm ${code}\``,
		],
		footer: "Admins, Alpha, configured owner and moderators are protected. The live roster is checked again at confirmation.",
	}));
};

const parseRequestedMuteDuration = (args) => {
	for (const arg of args) {
		if (String(arg).toLowerCase() === "confirm") continue;
		const parsed = parseMuteDuration(arg);
		if (parsed.valid) return parsed;
	}
	return parseMuteDuration(DEFAULT_MUTE_DURATION);
};

const handleMuteCount = async ({ sock, msg, from, args, senderJid, botJids = [], isBotAdmin, sendMessageWTyping }) => {
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	if (!isBotAdmin) return reply("❌ Alpha must be a group admin before it can enforce reviewed-member mutes.");

	const confirmCode = confirmationFromArgs(args);
	if (confirmCode) {
		const pending = takeActionPreview({ from, senderJid, action: "mutecount", code: confirmCode });
		if (!pending) return reply("❌ Invalid or expired confirmation. Run `mutecount` again after your `$count` review.");
		const { metadata, roster } = await loadLiveRoster({ sock, from, botJids });
		const targets = withoutProtected(
			keepPreviewedCandidates(roster, pending.previewAliases),
			metadata,
		).slice(0, MAX_BULK_MUTES);
		if (!targets.length) return reply("✅ None of the reviewed members are still eligible for mute. Nobody was muted.");

		const aliases = [...candidateAliasSet(targets)];
		if (aliases.length) {
			await group.updateOne({ _id: from }, { $pull: { mutedMembers: { member: { $in: aliases } } } });
		}
		const mutedAt = new Date();
		const mutedUntil = pending.muteMilliseconds
			? new Date(mutedAt.getTime() + pending.muteMilliseconds)
			: null;
		await group.updateOne(
			{ _id: from },
			{
				$push: {
					mutedMembers: {
						$each: targets.map((member) => ({
							member: member.id,
							mutedBy: senderJid,
							reason: `Muted from ${pending.label}`,
							mutedAt,
							mutedUntil,
						})),
						$slice: -100,
					},
				},
			},
		);
		return reply(alphaPanel({
			icon: "🔇",
			title: "Count Review Members Muted",
			lines: [
				`Review: *${pending.label}*`,
				`Muted: *${targets.length}*`,
				`Duration: *${pending.muteLabel}*`,
			],
			footer: "Their new group messages will be deleted silently while the mute is active. Use `mutelist` to review mutes.",
		}));
	}

	const { review, targets: allTargets } = await currentReviewTargets({ sock, from, senderJid, botJids });
	if (!review) return reply("❌ No recent `$count` review found. Run a `$count ...` command first, then use `mutecount` within 5 minutes.");
	const targets = allTargets.slice(0, MAX_BULK_MUTES);
	if (!targets.length) return reply(`✅ Your last count review (*${review.label}*) has no ordinary members eligible for mute.`);

	const muteDuration = parseRequestedMuteDuration(args);
	const code = saveActionPreview({
		from,
		senderJid,
		action: "mutecount",
		candidates: targets,
		label: review.label,
		muteDuration,
	});
	return reply(alphaPanel({
		icon: "⚠️",
		title: "Mute Last Count Review",
		lines: [
			`Review: *${review.label}*`,
			`Will mute: *${targets.length} member${targets.length === 1 ? "" : "s"}*`,
			`Duration: *${muteDuration.label}*`,
			...(allTargets.length > MAX_BULK_MUTES ? [`⚠️ Only the first ${MAX_BULK_MUTES} members are included in one bulk mute.`] : []),
			...previewRows(targets),
			`Confirm within 2 minutes: \`mutecount confirm ${code}\``,
		],
		footer: "Admins, Alpha, configured owner and moderators are protected. Use `mutecount 30d` or `mutecount forever` to change the duration.",
	}));
};

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const context = { sock, msg, from, args, ...msgInfoObj };
	try {
		if (["kickcount", "purgecount"].includes(msgInfoObj.command)) return handleKickCount(context);
		if (["mutecount", "silencecount"].includes(msgInfoObj.command)) return handleMuteCount(context);
	} catch (error) {
		console.error("[count action error]", error);
		return msgInfoObj.sendMessageWTyping(from, { text: `❌ Count action stopped safely: ${error.message}` }, { quoted: msg });
	}
};

export default () => ({
	cmd: ["kickcount", "purgecount", "mutecount", "silencecount"],
	desc: "Kick or mute the exact ordinary members from your most recent count review",
	usage: "kickcount | kickcount confirm CODE | mutecount [7d|30d|forever] | mutecount confirm CODE",
	handler,
});
