export const GROUP_SAFETY_DEFAULTS = Object.freeze({
	isWelcomeOn: false,
	isGoodbyeOn: false,
	isAntiLinkOn: false,
	antiLinkAction: "warn",
	allowedDomains: [],
	isAntiSpamOn: false,
	spamLimit: 6,
	spamWindowSeconds: 12,
	duplicateLimit: 3,
	warningLimit: 3,
	warningAction: "remove",
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
	};
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
