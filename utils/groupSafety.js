export const GROUP_SAFETY_DEFAULTS = Object.freeze({
	isWelcomeOn: false,
	isGoodbyeOn: false,
	isAntiLinkOn: false,
	antiLinkAction: "warn",
	allowedDomains: [],
	isAntiSpamOn: false,
	isAntiStatusMentionOn: false,
	spamLimit: 6,
	spamWindowSeconds: 12,
	duplicateLimit: 3,
	warningLimit: 3,
	warningAction: "remove",
	statusMentionWarningLimit: 3,
	mutedMembers: [],
});

const clampInteger = (value, fallback, min, max) => {
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

export const normalizeDomain = (value = "") =>
	String(value)
		.trim()
		.toLowerCase()
		.replace(/^https?:\/\//, "")
		.replace(/^www\./, "")
		.split(/[/?#]/)[0]
		.replace(/:\d+$/, "");

export const getGroupSafetySettings = (groupData = {}) => {
	const data = groupData && typeof groupData === "object" ? groupData : {};
	return {
		isWelcomeOn:
			typeof data.isWelcomeOn === "boolean" ? data.isWelcomeOn : Boolean(data.welcome),
		isGoodbyeOn: Boolean(data.isGoodbyeOn),
		isAntiLinkOn: Boolean(data.isAntiLinkOn),
		antiLinkAction: ["warn", "delete"].includes(data.antiLinkAction)
			? data.antiLinkAction
			: GROUP_SAFETY_DEFAULTS.antiLinkAction,
		allowedDomains: [
			...new Set(
				(Array.isArray(data.allowedDomains) ? data.allowedDomains : [])
					.map(normalizeDomain)
					.filter(Boolean),
			),
		],
		isAntiSpamOn: Boolean(data.isAntiSpamOn),
		isAntiStatusMentionOn: Boolean(data.isAntiStatusMentionOn),
		spamLimit: clampInteger(data.spamLimit, GROUP_SAFETY_DEFAULTS.spamLimit, 4, 12),
		spamWindowSeconds: clampInteger(
			data.spamWindowSeconds,
			GROUP_SAFETY_DEFAULTS.spamWindowSeconds,
			5,
			30,
		),
		duplicateLimit: clampInteger(
			data.duplicateLimit,
			GROUP_SAFETY_DEFAULTS.duplicateLimit,
			2,
			5,
		),
		warningLimit: clampInteger(data.warningLimit, GROUP_SAFETY_DEFAULTS.warningLimit, 2, 10),
		warningAction: ["remove", "notify"].includes(data.warningAction)
			? data.warningAction
			: GROUP_SAFETY_DEFAULTS.warningAction,
		statusMentionWarningLimit: 3,
		mutedMembers: normalizeMutedMembers(data.mutedMembers),
	};
};

export const normalizeMutedMembers = (value) => (Array.isArray(value) ? value : [])
	.map((entry) => ({
		member: String(entry?.member || "").trim(),
		mutedBy: String(entry?.mutedBy || "").trim(),
		reason: String(entry?.reason || "").trim().slice(0, 200),
		mutedAt: entry?.mutedAt ? new Date(entry.mutedAt) : new Date(0),
		mutedUntil: entry?.mutedUntil ? new Date(entry.mutedUntil) : null,
	}))
	.filter((entry) => entry.member.includes("@") && (!entry.mutedUntil || !Number.isNaN(entry.mutedUntil.getTime())))
	.slice(-100);

export const parseMuteDuration = (value = "") => {
	const input = String(value || "").trim().toLowerCase();
	if (!input || ["forever", "permanent", "perm"].includes(input)) {
		return { valid: true, milliseconds: null, label: "until manually unmuted" };
	}
	const match = input.match(/^(\d{1,3})(m|h|d|w)$/);
	if (!match) return { valid: false, milliseconds: null, label: "" };
	const unitMs = { m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 }[match[2]];
	const milliseconds = Number(match[1]) * unitMs;
	if (milliseconds < 60_000 || milliseconds > 30 * 86_400_000) {
		return { valid: false, milliseconds: null, label: "" };
	}
	return { valid: true, milliseconds, label: `for ${input}` };
};

export const findMutedMember = (groupData, memberJid, matches = (left, right) => left === right, now = Date.now()) => {
	const matching = normalizeMutedMembers(groupData?.mutedMembers).filter((entry) => matches(memberJid, entry.member));
	const active = matching.find((entry) => !entry.mutedUntil || entry.mutedUntil.getTime() > now);
	return {
		entry: active || null,
		expiredMembers: active ? [] : matching.map((entry) => entry.member),
	};
};

export const isGroupStatusMentionMessage = (msg) => {
	if (msg?.statusMentionMessageInfo?.quotedStatus) return true;
	let content = msg?.message;
	for (let depth = 0; content && depth < 6; depth += 1) {
		if (content.groupStatusMentionMessage) return true;
		content = content.ephemeralMessage?.message ||
			content.viewOnceMessage?.message ||
			content.viewOnceMessageV2?.message ||
			content.viewOnceMessageV2Extension?.message ||
			content.associatedChildMessage?.message ||
			content.groupStatusMessage?.message ||
			null;
	}
	return false;
};

const LINK_PATTERN = /(?:https?:\/\/|www\.)[^\s<>()]+|\b(?:chat\.whatsapp\.com|wa\.me)\/[^\s<>()]+/gi;

export const extractLinkHosts = (text = "") => {
	const matches = String(text).match(LINK_PATTERN) || [];
	return matches
		.map((candidate) => {
			try {
				const url = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
				return normalizeDomain(url.hostname);
			} catch {
				return "";
			}
		})
		.filter(Boolean);
};

export const hasDisallowedLink = (text, allowedDomains = []) => {
	const hosts = extractLinkHosts(text);
	if (hosts.length === 0) return false;
	const allowed = allowedDomains.map(normalizeDomain).filter(Boolean);
	return hosts.some(
		(host) => !allowed.some((domain) => host === domain || host.endsWith(`.${domain}`)),
	);
};

export const renderTemplate = (template, { users, group, count }) =>
	String(template || "")
		.replaceAll("{user}", users)
		.replaceAll("{users}", users)
		.replaceAll("{group}", group || "this group")
		.replaceAll("{count}", String(count ?? ""));
