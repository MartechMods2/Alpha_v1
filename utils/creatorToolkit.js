import { createHash, randomInt, randomUUID } from "node:crypto";

export const cleanInput = (value, max = 4000) => String(value || "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
const words = (value) => cleanInput(value).match(/[\p{L}\p{N}']+/gu) || [];
const tokens = (value) => words(value).map((item) => item.toLowerCase());
const titleWord = (value) => value ? value[0].toUpperCase() + value.slice(1).toLowerCase() : "";

export const textStats = (value) => {
	const text = cleanInput(value);
	const wordList = words(text);
	return {
		characters: [...text].length,
		charactersNoSpaces: [...text.replace(/\s/g, "")].length,
		words: wordList.length,
		lines: text ? text.split(/\r?\n/).length : 0,
		sentences: (text.match(/[.!?]+(?:\s|$)/g) || []).length || (text ? 1 : 0),
		readingMinutes: Math.max(1, Math.ceil(wordList.length / 200)),
	};
};

export const wordFrequency = (value, limit = 10) => {
	const counts = new Map();
	for (const word of tokens(value)) counts.set(word, (counts.get(word) || 0) + 1);
	return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
};

export const convertCase = (value, style) => {
	const text = cleanInput(value);
	const parts = tokens(text);
	if (style === "titlecase") return words(text).map(titleWord).join(" ");
	if (style === "sentencecase") return text ? text[0].toUpperCase() + text.slice(1).toLowerCase() : "";
	if (style === "camelcase") return parts.map((part, index) => index ? titleWord(part) : part).join("");
	if (style === "snakecase") return parts.join("_");
	if (style === "kebabcase" || style === "slugify") return parts.join("-");
	return text;
};

export const uniqueLines = (value) => [...new Set(cleanInput(value).split(/\r?\n/).map((line) => line.trim()).filter(Boolean))];
export const sortedLines = (value) => uniqueLines(value).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
export const reverseWords = (value) => words(value).reverse().join(" ");
export const isPalindrome = (value) => {
	const normalized = tokens(value).join("");
	return Boolean(normalized) && normalized === [...normalized].reverse().join("");
};
export const areAnagrams = (left, right) => tokens(left).join("").split("").sort().join("") === tokens(right).join("").split("").sort().join("");

export const percentageChange = (oldValue, newValue) => oldValue === 0 ? null : ((newValue - oldValue) / Math.abs(oldValue)) * 100;
export const moneyResult = (kind, values) => {
	const [a, b = 0] = values.map(Number);
	if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
	if (kind === "discountcalc") return { amount: a * (b / 100), final: a * (1 - b / 100) };
	if (kind === "profitcalc") return { amount: b - a, percent: a ? ((b - a) / a) * 100 : null };
	if (kind === "vatcalc") return { amount: a * (b / 100), final: a * (1 + b / 100) };
	return null;
};

const dayMs = 86_400_000;
export const parseDateOnly = (value) => {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
	const date = new Date(`${value}T00:00:00Z`);
	return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
};
export const daysBetween = (left, right) => {
	const a = parseDateOnly(left); const b = parseDateOnly(right);
	return a && b ? Math.round((b - a) / dayMs) : null;
};
export const ageOn = (birth, today = new Date()) => {
	const date = parseDateOnly(birth);
	if (!date || date > today) return null;
	let age = today.getUTCFullYear() - date.getUTCFullYear();
	if (today.getUTCMonth() < date.getUTCMonth() || (today.getUTCMonth() === date.getUTCMonth() && today.getUTCDate() < date.getUTCDate())) age--;
	return age;
};
export const isoWeek = (input = new Date()) => {
	const date = new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
	date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
	return { year: date.getUTCFullYear(), week: Math.ceil((((date - new Date(Date.UTC(date.getUTCFullYear(), 0, 1))) / dayMs) + 1) / 7) };
};

export const shuffle = (items) => {
	const output = [...items];
	for (let index = output.length - 1; index > 0; index--) {
		const target = randomInt(index + 1);
		[output[index], output[target]] = [output[target], output[index]];
	}
	return output;
};
export const splitTeams = (items, count) => {
	const teams = Array.from({ length: count }, () => []);
	shuffle(items).forEach((item, index) => teams[index % count].push(item));
	return teams;
};
export const hashText = (value, algorithm = "sha256") => createHash(algorithm).update(cleanInput(value)).digest("hex");
export const newUuid = () => randomUUID();
