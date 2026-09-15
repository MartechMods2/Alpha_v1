const clean = (value, max = 500) => String(value || "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

export const TASK_PRIORITIES = Object.freeze(["low", "normal", "high", "urgent"]);

export const normalizeTaskPriority = (value) => {
	const token = clean(value, 20).toLowerCase();
	return TASK_PRIORITIES.includes(token) ? token : "normal";
};

export const parseTaskInput = (rawText) => {
	const parts = String(rawText || "").split("|").map((part) => clean(part, 300)).filter(Boolean);
	const title = clean(parts.shift(), 220);
	if (!title) return null;
	let priority = "normal";
	let due = "";
	for (const part of parts) {
		const lower = part.toLowerCase();
		if (TASK_PRIORITIES.includes(lower)) priority = lower;
		else if (/^due\s+/i.test(part)) due = clean(part.replace(/^due\s+/i, ""), 80);
	}
	return { title, priority, due };
};

export const makeProductivityId = (prefix = "x", now = Date.now(), random = Math.random()) => {
	const tail = Math.floor(Math.max(0, Math.min(0.999999, Number(random) || 0)) * 46656).toString(36).padStart(3, "0");
	return `${String(prefix).replace(/[^a-z]/gi, "").slice(0, 2).toLowerCase() || "x"}${Number(now).toString(36).slice(-5)}${tail}`;
};

export const formatElapsed = (fromMs, toMs = Date.now()) => {
	const ms = Math.max(0, Number(toMs) - Number(fromMs));
	const minutes = Math.floor(ms / 60000);
	if (minutes < 1) return "less than a minute";
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ${minutes % 60}m`;
	const days = Math.floor(hours / 24);
	return `${days}d ${hours % 24}h`;
};

const words = (value) => clean(value, 500).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word.length > 1);

export const faqScore = (query, question) => {
	const q = clean(query, 300).toLowerCase();
	const candidate = clean(question, 300).toLowerCase();
	if (!q || !candidate) return 0;
	if (candidate === q) return 1;
	if (candidate.includes(q) || q.includes(candidate)) return 0.9;
	const qWords = [...new Set(words(q))];
	const cWords = new Set(words(candidate));
	if (!qWords.length) return 0;
	const overlap = qWords.filter((word) => cWords.has(word)).length;
	return overlap / qWords.length;
};

export const findBestFaq = (entries, query, minimum = 0.45) => {
	let best = null;
	let bestScore = 0;
	for (const entry of Array.isArray(entries) ? entries : []) {
		const score = faqScore(query, entry?.question);
		if (score > bestScore) { best = entry; bestScore = score; }
	}
	return best && bestScore >= minimum ? { entry: best, score: bestScore } : null;
};

export const quotedTextFromContext = (context = {}) => {
	const q = context?.quotedMessage || {};
	return clean(q.conversation ?? q.extendedTextMessage?.text ?? q.imageMessage?.caption ?? q.videoMessage?.caption ?? q.documentMessage?.caption ?? "", 1200);
};

export const safeDisplayName = (value, jid = "") => clean(value || String(jid).split("@")[0] || "Member", 45).replace(/[*_~`]/g, " ");
