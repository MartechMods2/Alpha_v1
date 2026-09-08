import { normalizeUserJid } from "./groupParticipants.js";

export const DANGER_CONFIRM_TTL_MS = 2 * 60 * 1000;
export const REMOVAL_BATCH_SIZE = 8;
export const REMOVAL_BATCH_DELAY_MS = 1200;

const validDateMs = (value) => {
	if (!value) return null;
	const time = new Date(value).getTime();
	return Number.isFinite(time) ? time : null;
};

export const parseDayToken = (value) => {
	const match = String(value || "").trim().toLowerCase().match(/^(\d{1,4})d$/);
	if (!match) return null;
	const days = Number.parseInt(match[1], 10);
	return days > 0 ? days : null;
};

/**
 * Strict inactivity means Alpha has an actual last-message timestamp old enough
 * to prove the member has been inactive for the requested period.
 * Unknown/no-history members are intentionally not auto-selected.
 */
export const isProvablyInactive = (member, days, now = Date.now()) => {
	if (!member || member.isAdmin || !Number.isFinite(Number(days)) || Number(days) <= 0) return false;
	const lastActivity = validDateMs(member.lastMessageAt);
	if (lastActivity === null) return false;
	return lastActivity <= now - Number(days) * 86_400_000;
};

export const selectInactiveCandidates = (members = [], days, now = Date.now()) =>
	members.filter((member) => isProvablyInactive(member, days, now));

export const selectKickAllCandidates = (members = []) =>
	members.filter((member) => !member?.isAdmin);

export const unknownActivityMembers = (members = []) =>
	members.filter((member) => !member?.isAdmin && validDateMs(member?.lastMessageAt) === null);

export const candidateAliasSet = (members = []) => {
	const aliases = new Set();
	for (const member of members) {
		const values = [member?.id, ...(Array.isArray(member?.aliases) ? member.aliases : [])];
		for (const value of values) {
			const normalized = normalizeUserJid(value);
			if (normalized) aliases.add(normalized);
		}
	}
	return aliases;
};

export const keepPreviewedCandidates = (members = [], previewAliases = []) => {
	const allowed = previewAliases instanceof Set
		? previewAliases
		: new Set((previewAliases || []).map(normalizeUserJid).filter(Boolean));
	return members.filter((member) => {
		const aliases = [member?.id, ...(Array.isArray(member?.aliases) ? member.aliases : [])]
			.map(normalizeUserJid)
			.filter(Boolean);
		return aliases.some((alias) => allowed.has(alias));
	});
};

export const chunkDangerTargets = (members = [], size = REMOVAL_BATCH_SIZE) => {
	const chunkSize = Math.max(1, Number.parseInt(String(size), 10) || REMOVAL_BATCH_SIZE);
	const out = [];
	for (let index = 0; index < members.length; index += chunkSize) {
		out.push(members.slice(index, index + chunkSize));
	}
	return out;
};
