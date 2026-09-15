const MAX_OPTIONS = 12;
const MAX_QUESTION = 180;
const MAX_OPTION = 100;

const clean = (value, max) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);

export const normalizeNativePoll = ({ name, values, selectableCount = 1 }) => {
	const question = clean(name, MAX_QUESTION);
	const options = [...new Set((Array.isArray(values) ? values : [])
		.map((value) => clean(value, MAX_OPTION))
		.filter(Boolean))].slice(0, MAX_OPTIONS);
	if (!question) throw new Error("poll question is empty");
	if (options.length < 2) throw new Error("a poll needs at least two different options");
	const count = Math.max(1, Math.min(options.length, Number(selectableCount) || 1));
	return { name: question, values: options, selectableCount: count };
};

export const parsePipePoll = (rawText, { multi = false } = {}) => {
	const parts = String(rawText || "").split("|").map((part) => clean(part, MAX_QUESTION)).filter(Boolean);
	if (parts.length < 3) return null;
	const [name, ...values] = parts;
	return normalizeNativePoll({ name, values, selectableCount: multi ? values.length : 1 });
};

export const parseWouldYouRatherPoll = (rawText) => {
	const prompt = clean(rawText, 500)
		.replace(/^🎮\s*/u, "")
		.replace(/^\*?(?:would\s+you\s+rather|wyr)\*?\s*[:\-–—]?\s*/i, "Would you rather ");
	const match = prompt.match(/^Would you rather\s+(.+)\s+or\s+(.+?)[?.!]*$/i);
	if (!match) return null;
	return normalizeNativePoll({
		name: "🤔 Would you rather?",
		values: [match[1], match[2]],
		selectableCount: 1,
	});
};

export const cleanAiPollJson = (rawText) => {
	const text = String(rawText || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	if (start < 0 || end <= start) throw new Error("AI did not return a poll object");
	const parsed = JSON.parse(text.slice(start, end + 1));
	const poll = normalizeNativePoll({
		name: parsed.question || parsed.name,
		values: parsed.options || parsed.values,
		selectableCount: parsed.selectableCount || 1,
	});
	const correctIndex = Number.isInteger(parsed.correctIndex)
		? Math.max(0, Math.min(poll.values.length - 1, parsed.correctIndex))
		: null;
	return { ...poll, correctIndex };
};

export const inferTwoChoicePoll = (rawText) => {
	const text = clean(rawText, 500);
	const decisionSignal = /\b(?:poll|vote|choose\s+between|decide\s+between|which\s+should\s+we|what\s+should\s+we\s+choose|let(?:'s| us)\s+vote)\b/i.test(text);
	if (!decisionSignal) return null;
	const stripped = text
		.replace(/^(?:please\s+)?(?:make|create|start|run)?\s*(?:a\s+)?(?:poll|vote)\s*(?:for|on|about)?\s*/i, "")
		.trim();
	const match = stripped.match(/^(.+?)\s+(?:or|vs\.?|versus)\s+(.+?)[?.!]*$/i);
	if (!match) return null;
	return normalizeNativePoll({
		name: text.endsWith("?") ? text : `Which one should we choose?`,
		values: [match[1], match[2]],
		selectableCount: 1,
	});
};

export const shouldUseAiPoll = (rawText) => /\b(?:make|create|start|run|build)\s+(?:a\s+)?poll\b|\b(?:let(?:'s| us)\s+vote|ask\s+(?:the\s+)?group\s+to\s+(?:choose|vote)|which\s+should\s+we\s+choose|help\s+us\s+decide)\b/i.test(String(rawText || ""));

const quizAnswers = new Map();
const QUIZ_TTL_MS = 60 * 60_000;
const MAX_QUIZZES = 300;

const pruneQuizAnswers = (now = Date.now()) => {
	for (const [key, value] of quizAnswers) if (value.expiresAt <= now) quizAnswers.delete(key);
	if (quizAnswers.size > MAX_QUIZZES) {
		const extra = [...quizAnswers.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt).slice(0, quizAnswers.size - MAX_QUIZZES);
		for (const [key] of extra) quizAnswers.delete(key);
	}
};

export const rememberQuizPoll = (groupJid, poll, correctIndex) => {
	if (!groupJid || !Number.isInteger(correctIndex) || !poll?.values?.[correctIndex]) return false;
	const now = Date.now();
	quizAnswers.set(groupJid, {
		question: poll.name,
		answer: poll.values[correctIndex],
		createdAt: now,
		expiresAt: now + QUIZ_TTL_MS,
	});
	pruneQuizAnswers(now);
	return true;
};

export const getQuizPollAnswer = (groupJid) => {
	pruneQuizAnswers();
	return quizAnswers.get(groupJid) || null;
};

export const pollRuntimeStats = () => ({ activeQuizAnswers: quizAnswers.size, maxQuizAnswers: MAX_QUIZZES });
