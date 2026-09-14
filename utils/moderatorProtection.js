import { extractPhoneNumber } from "./lid.js";
import { isGroupOwner, isSameGroupUser } from "./groupParticipants.js";

const configuredNumbers = (name) => String(process.env[name] || "")
	.split(",")
	.map((value) => value.replace(/\D/g, ""))
	.filter(Boolean);

const moderatorNumbers = () => configuredNumbers("MODERATORS");
const ownerNumbers = () => configuredNumbers("MY_NUMBER");
const asPn = (number) => `${number}@s.whatsapp.net`;

const digitsOf = (jid) => {
	try { return String(extractPhoneNumber(jid) || "").replace(/\D/g, ""); }
	catch { return String(jid || "").replace(/\D/g, ""); }
};

export const configuredModeratorNumbers = () => moderatorNumbers();

export const isConfiguredModerator = (metadata, candidates = []) => {
	const values = (Array.isArray(candidates) ? candidates : [candidates]).filter(Boolean);
	const configured = moderatorNumbers();
	for (const candidate of values) {
		const digits = digitsOf(candidate);
		if (digits && configured.includes(digits)) return true;
		if (configured.some((number) => isSameGroupUser(metadata, candidate, asPn(number)))) return true;
	}
	return false;
};

/**
 * Moderator actions have two safety tiers:
 * - rootProtected: Alpha and the configured creator account can never be muted,
 *   warned, demoted or removed by Moderator Override.
 * - destructiveProtected: group owners and configured moderators are additionally
 *   protected from destructive actions such as demote/kick/ban, but they may be
 *   muted or warned by another configured moderator.
 */
export const getModeratorTargetProtection = (metadata, target, botJids = []) => {
	if (!target) {
		return {
			rootProtected: true,
			destructiveProtected: true,
			reason: "invalid-target",
		};
	}
	if (isSameGroupUser(metadata, target, botJids)) {
		return {
			rootProtected: true,
			destructiveProtected: true,
			reason: "alpha",
		};
	}
	if (ownerNumbers().some((number) => isSameGroupUser(metadata, target, asPn(number)))) {
		return {
			rootProtected: true,
			destructiveProtected: true,
			reason: "creator",
		};
	}
	if (isGroupOwner(metadata, target)) {
		return {
			rootProtected: false,
			destructiveProtected: true,
			reason: "group-owner",
		};
	}
	if (isConfiguredModerator(metadata, [target])) {
		return {
			rootProtected: false,
			destructiveProtected: true,
			reason: "moderator",
		};
	}
	return {
		rootProtected: false,
		destructiveProtected: false,
		reason: "ordinary",
	};
};

export const isModeratorRootProtectedTarget = (metadata, target, botJids = []) =>
	getModeratorTargetProtection(metadata, target, botJids).rootProtected;

export const isModeratorProtectedTarget = (metadata, target, botJids = []) =>
	getModeratorTargetProtection(metadata, target, botJids).destructiveProtected;
