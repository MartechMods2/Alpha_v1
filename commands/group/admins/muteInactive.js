import crypto from "node:crypto";
import { group } from "../../../db/groupData.js";
import { alphaPanel, safeDisplayName } from "../../../utils/alphaStyle.js";
import { mergeLiveGroupActivity } from "../../../utils/groupActivity.js";
import {
	candidateAliasSet,
	DANGER_CONFIRM_TTL_MS,
	keepPreviewedCandidates,
	parseDayToken,
} from "../../../utils/dangerGroupActions.js";
import {
	selectActionableInactiveMembers,
	selectUnknownInactiveHistoryMembers,
} from "../../../utils/inactiveReview.js";
import { normalizeUserJid } from "../../../utils/groupParticipants.js";
import { parseMuteDuration } from "../../../utils/groupSafety.js";

const DEFAULT_MUTE_DURATION = "7d";
const MAX_BULK_MUTES = 100;
const pendingInactiveMutes = new Map();

const confirmationCode = () => crypto.randomBytes(3).toString("hex").toUpperCase();
const previewKey = (from, senderJid) => `${from}:${normalizeUserJid(senderJid) || senderJid}`;

const cleanupExpired = () => {
	const now = Date.now();
	for (const [key, value] of pendingInactiveMutes.entries()) {
		if (!value || value.expiresAt <= now) pendingInactiveMutes.delete(key);
	}
};

const savePreview = ({ from, senderJid, days, muteDuration, candidates }) => {
	cleanupExpired();
	const code = confirmationCode();
	pendingInactiveMutes.set(previewKey(from, senderJid), {
		code,
		days,
		muteMilliseconds: muteDuration.milliseconds,
		muteLabel: muteDuration.label,
		previewAliases: [...candidateAliasSet(candidates)],
		expiresAt: Date.now() + DANGER_CONFIRM_TTL_MS,
	});
	return code;
};

const takePreview = ({ from, senderJid, code }) => {
	cleanupExpired();
	const key = previewKey(from, senderJid);
	const preview = pendingInactiveMutes.get(key);
	if (!preview || preview.code !== String(code || "").trim().toUpperCase()) return null;
	pendingInactiveMutes.delete(key);
	return preview;
};

const confirmationFromArgs = (args) => {
	const words = args.map((arg) => String(arg).toLowerCase());
	const index = words.indexOf("confirm");
	return index >= 0 ? String(args[index + 1] || "").trim().toUpperCase() : "";
};

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

const lastSeen = (value) => {
	const time = value ? new Date(value).getTime() : NaN;
	if (!Number.isFinite(time)) return "unknown";
	return `${Math.max(0, Math.floor((Date.now() - time) / 86_400_000))}d ago`;
};

const parseRequest = (args) => {
	const inactivityIndex = args.findIndex((arg) => parseDayToken(arg));
	if (inactivityIndex < 0) return null;
	const days = parseDayToken(args[inactivityIndex]);
	let muteDuration = parseMuteDuration(DEFAULT_MUTE_DURATION);
	for (let index = 0; index < args.length; index += 1) {
		if (index === inactivityIndex) continue;
		const parsed = parseMuteDuration(args[index]);
		if (parsed.valid) {
			muteDuration = parsed;
			break;
		}
	}
	return { days, muteDuration };
};

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { senderJid, botJids = [], isBotAdmin, sendMessageWTyping } = msgInfoObj;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });

	if (!isBotAdmin) return reply("❌ Alpha must be a group admin before it can enforce member mutes.");

	const confirmCode = confirmationFromArgs(args);
	if (confirmCode) {
		const pending = takePreview({ from, senderJid, code: confirmCode });
		if (!pending) return reply("❌ Invalid or expired confirmation. Run `muteinactive 60d` again.");

		const { metadata, roster } = await loadLiveRoster({ sock, from, botJids });
		const currentEligible = selectActionableInactiveMembers(roster, pending.days, metadata);
		const targets = keepPreviewedCandidates(currentEligible, pending.previewAliases).slice(0, MAX_BULK_MUTES);
		if (!targets.length) return reply("✅ No reviewed member is still eligible. Nobody was muted.");

		const aliases = [...candidateAliasSet(targets)];
		if (aliases.length) {
			await group.updateOne(
				{ _id: from },
				{ $pull: { mutedMembers: { member: { $in: aliases } } } },
			);
		}

		const mutedAt = new Date();
		const mutedUntil = pending.muteMilliseconds
			? new Date(mutedAt.getTime() + pending.muteMilliseconds)
			: null;
		const entries = targets.map((member) => ({
			member: member.id,
			mutedBy: senderJid,
			reason: `Inactive ${pending.days}+ days review`,
			mutedAt,
			mutedUntil,
		}));

		await group.updateOne(
			{ _id: from },
			{
				$push: {
					mutedMembers: {
						$each: entries,
						$slice: -100,
					},
				},
			},
		);

		return reply(alphaPanel({
			icon: "🔇",
			title: "Inactive Members Muted",
			lines: [
				`Inactivity rule: *${pending.days}+ days*`,
				`Muted members: *${targets.length}*`,
				`Mute duration: *${pending.muteLabel}*`,
			],
			footer: "Their new group messages will be deleted silently while the mute is active. Use `mutelist` to review them.",
		}));
	}

	const request = parseRequest(args);
	if (!request?.days) {
		return reply("❌ Usage: `muteinactive 60d` or `muteinactive 60d 30d`, then `muteinactive confirm CODE`.");
	}

	const { metadata, roster } = await loadLiveRoster({ sock, from, botJids });
	const allCandidates = selectActionableInactiveMembers(roster, request.days, metadata)
		.sort((a, b) => new Date(a.lastMessageAt).getTime() - new Date(b.lastMessageAt).getTime());
	const candidates = allCandidates.slice(0, MAX_BULK_MUTES);
	const unknown = selectUnknownInactiveHistoryMembers(roster, metadata);
	if (!candidates.length) {
		return reply(alphaPanel({
			icon: "✅",
			title: "Inactive Mute Review",
			lines: [
				`Rule: *${request.days}+ days inactive*`,
				"Eligible ordinary members: *0*",
				`Unknown/no last-message date excluded: *${unknown.length}*`,
			],
			footer: "Nobody was muted.",
		}));
	}

	const code = savePreview({
		from,
		senderJid,
		days: request.days,
		muteDuration: request.muteDuration,
		candidates,
	});
	const rows = candidates.slice(0, 20).map((member, index) =>
		`${index + 1}. *${safeDisplayName(member.name, member.id)}* — ${Number(member.count || 0)} msgs · ${lastSeen(member.lastMessageAt)}`,
	);
	if (candidates.length > 20) rows.push(`…and *${candidates.length - 20} more*.`);

	return reply(alphaPanel({
		icon: "⚠️",
		title: "Inactive Mute Preview",
		lines: [
			`Inactivity rule: *${request.days}+ days*`,
			`Will mute: *${candidates.length} member${candidates.length === 1 ? "" : "s"}*`,
			`Mute duration: *${request.muteDuration.label}*`,
			`Unknown history excluded: *${unknown.length}*`,
			...(allCandidates.length > MAX_BULK_MUTES ? [`⚠️ Only the first ${MAX_BULK_MUTES} are included in this bulk mute.`] : []),
			...rows,
			`Confirm within 2 minutes: \`muteinactive confirm ${code}\``,
		],
		footer: "The live roster and inactivity status are rechecked before muting. Admins, Alpha, configured owner and moderators are protected.",
	}));
};

export default () => ({
	cmd: ["muteinactive", "silenceinactive"],
	desc: "Preview and mute members proven inactive for a chosen number of days",
	usage: "muteinactive 60d [7d|30d|forever] | muteinactive confirm CODE",
	handler,
});
