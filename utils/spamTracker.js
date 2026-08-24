const activity = new Map();
const AUTOMOD_COOLDOWN_MS = 60_000;

const normalizeBody = (body) =>
	String(body || "")
		.trim()
		.toLowerCase()
		.replace(/\s+/g, " ")
		.slice(0, 500);

export const detectSpam = ({ key, body, settings, now = Date.now() }) => {
	if (activity.size > 5000) {
		for (const [entryKey, entryState] of activity) {
			const latestMessage = entryState.messages.at(-1)?.time || 0;
			if (entryState.cooldownUntil <= now && now - latestMessage > 5 * 60_000) {
				activity.delete(entryKey);
			}
		}
	}
	const windowMs = settings.spamWindowSeconds * 1000;
	const state = activity.get(key) || { messages: [], cooldownUntil: 0 };
	if (state.cooldownUntil > now) return null;

	const normalized = normalizeBody(body);
	state.messages = state.messages.filter((entry) => now - entry.time <= windowMs);
	state.messages.push({ time: now, body: normalized });

	const duplicates = normalized
		? state.messages.filter((entry) => entry.body === normalized).length
		: 0;
	let reason = null;
	if (duplicates >= settings.duplicateLimit) reason = "Repeated-message spam";
	else if (state.messages.length >= settings.spamLimit) reason = "Message flood detected";

	if (reason) {
		state.messages = [];
		state.cooldownUntil = now + AUTOMOD_COOLDOWN_MS;
	}
	activity.set(key, state);
	return reason;
};

export const clearSpamTracker = () => activity.clear();
