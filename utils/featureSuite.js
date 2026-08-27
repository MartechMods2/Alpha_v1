import { randomBytes, randomUUID, createHash } from "node:crypto";

export const cleanFeatureText = (value, limit = 500) => String(value || "")
	.replace(/[\u0000-\u001f\u007f]/g, " ")
	.replace(/\s+/g, " ")
	.trim()
	.slice(0, limit);

export const cleanMultilineText = (value, limit = 2000) => String(value || "")
	.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
	.trim()
	.slice(0, limit);

export const safeMemberName = (value, jid = "") =>
	cleanFeatureText(value || String(jid).split("@")[0] || "Member", 50).replace(/[*_~`]/g, " ");

export const resolveMentionTarget = (msg) => {
	const context = msg?.message?.extendedTextMessage?.contextInfo || msg?.message?.imageMessage?.contextInfo || {};
	const mentioned = Array.isArray(context.mentionedJid) ? context.mentionedJid[0] : context.mentionedJid;
	return mentioned || context.participant || "";
};

export const shortId = (value) => String(value || "").split("-")[0].slice(0, 8).toUpperCase();

export const dateKey = (date = new Date()) => {
	const formatter = new Intl.DateTimeFormat("en-CA", {
		timeZone: process.env.BOT_TIMEZONE || "Africa/Lagos",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
	return formatter.format(date);
};

export const parseDurationMs = (value, { minMinutes = 1, maxMinutes = 24 * 60 } = {}) => {
	const match = String(value || "").trim().toLowerCase().match(/^(\d+)(m|h|d)$/);
	if (!match) return 0;
	const multipliers = { m: 60_000, h: 3_600_000, d: 86_400_000 };
	const duration = Number(match[1]) * multipliers[match[2]];
	return duration >= minMinutes * 60_000 && duration <= maxMinutes * 60_000 ? duration : 0;
};

export const normalizeTriggerText = (value) => String(value || "")
	.toLowerCase()
	.replace(/[^\p{L}\p{N}]+/gu, " ")
	.replace(/\s+/g, " ")
	.trim();

export const matchesTriggerPhrase = (message, trigger) => {
	const cleanMessage = normalizeTriggerText(message);
	const cleanTrigger = normalizeTriggerText(trigger);
	return Boolean(cleanTrigger) && (cleanMessage === cleanTrigger || (` ${cleanMessage} `).includes(` ${cleanTrigger} `));
};

export const minuteWithinWindow = (minute, startMinute, endMinute) =>
	startMinute <= endMinute ? minute >= startMinute && minute <= endMinute : minute >= startMinute || minute <= endMinute;

const UNITS = Object.freeze({
	mm: { family: "length", factor: 0.001 }, cm: { family: "length", factor: 0.01 }, m: { family: "length", factor: 1 }, km: { family: "length", factor: 1000 },
	in: { family: "length", factor: 0.0254 }, ft: { family: "length", factor: 0.3048 }, yd: { family: "length", factor: 0.9144 }, mi: { family: "length", factor: 1609.344 },
	mg: { family: "mass", factor: 0.000001 }, g: { family: "mass", factor: 0.001 }, kg: { family: "mass", factor: 1 }, lb: { family: "mass", factor: 0.45359237 }, oz: { family: "mass", factor: 0.028349523125 },
	ml: { family: "volume", factor: 0.001 }, l: { family: "volume", factor: 1 }, cup: { family: "volume", factor: 0.236588 }, gal: { family: "volume", factor: 3.785411784 },
});

export const convertUnit = (amount, from, to) => {
	const value = Number(amount);
	const source = UNITS[String(from || "").toLowerCase()];
	const target = UNITS[String(to || "").toLowerCase()];
	if (!Number.isFinite(value) || !source || !target || source.family !== target.family) return null;
	return value * source.factor / target.factor;
};

const ROMAN_PAIRS = [
	[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
	[50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

export const toRoman = (input) => {
	let number = Number(input);
	if (!Number.isInteger(number) || number < 1 || number > 3999) return "";
	let output = "";
	for (const [value, symbol] of ROMAN_PAIRS) {
		while (number >= value) { output += symbol; number -= value; }
	}
	return output;
};

export const fromRoman = (input) => {
	const roman = String(input || "").toUpperCase();
	if (!/^[MDCLXVI]+$/.test(roman)) return null;
	let index = 0;
	let total = 0;
	for (const [value, symbol] of ROMAN_PAIRS) {
		while (roman.slice(index, index + symbol.length) === symbol) { total += value; index += symbol.length; }
	}
	return index === roman.length && toRoman(total) === roman ? total : null;
};

const MORSE = Object.freeze({
	a: ".-", b: "-...", c: "-.-.", d: "-..", e: ".", f: "..-.", g: "--.", h: "....", i: "..", j: ".---", k: "-.-", l: ".-..", m: "--", n: "-.", o: "---", p: ".--.", q: "--.-", r: ".-.", s: "...", t: "-", u: "..-", v: "...-", w: ".--", x: "-..-", y: "-.--", z: "--..",
	0: "-----", 1: ".----", 2: "..---", 3: "...--", 4: "....-", 5: ".....", 6: "-....", 7: "--...", 8: "---..", 9: "----.",
});
const MORSE_REVERSE = Object.freeze(Object.fromEntries(Object.entries(MORSE).map(([key, value]) => [value, key])));

export const encodeMorse = (value) => String(value || "").toLowerCase().split("").map((character) => character === " " ? "/" : MORSE[character] || "?").join(" ");
export const decodeMorse = (value) => String(value || "").trim().split(/\s+/).map((code) => code === "/" ? " " : MORSE_REVERSE[code] || "?").join("");

export const createPassword = (length = 16) => {
	const size = Math.min(Math.max(Number.parseInt(length, 10) || 16, 8), 64);
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";
	const bytes = randomBytes(size);
	return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
};

export const textToolResult = (command, rawInput) => {
	const input = cleanMultilineText(rawInput, 3000);
	switch (command) {
		case "uppercase": return input.toUpperCase();
		case "lowercase": return input.toLowerCase();
		case "titlecase": return input.toLowerCase().replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
		case "reverse": return Array.from(input).reverse().join("");
		case "wordcount": return `Words: *${input.match(/[\p{L}\p{N}']+/gu)?.length || 0}*`;
		case "charcount": return `Characters: *${Array.from(input).length}* · Without spaces: *${Array.from(input.replace(/\s/g, "")).length}*`;
		case "readingtime": {
			const words = input.match(/[\p{L}\p{N}']+/gu)?.length || 0;
			return `Estimated reading time: *${Math.max(1, Math.ceil(words / 200))} minute${words > 200 ? "s" : ""}* (${words} words)`;
		}
		case "slugify": return input.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
		case "base64encode": return Buffer.from(input, "utf8").toString("base64");
		case "base64decode": {
			if (!/^[A-Za-z0-9+/]*={0,2}$/.test(input.replace(/\s/g, ""))) return "";
			return Buffer.from(input, "base64").toString("utf8").slice(0, 3000);
		}
		case "urlencode": return encodeURIComponent(input);
		case "urldecode": try { return decodeURIComponent(input); } catch { return ""; }
		case "sha256": return createHash("sha256").update(input).digest("hex");
		case "uuid": return randomUUID();
		case "sortlines": return input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b)).join("\n");
		case "uniquelines": return [...new Set(input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))].join("\n");
		case "shufflewords": {
			const words = input.split(/\s+/).filter(Boolean);
			for (let index = words.length - 1; index > 0; index -= 1) {
				const target = randomBytes(1)[0] % (index + 1);
				[words[index], words[target]] = [words[target], words[index]];
			}
			return words.join(" ");
		}
		case "numberlist": return input.split(/\r?\n|\s*\|\s*/).map((line) => line.trim()).filter(Boolean).map((line, index) => `${index + 1}. ${line}`).join("\n");
		default: return "";
	}
};
