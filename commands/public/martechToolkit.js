import { Buffer } from "node:buffer";
import {
	ageOn, areAnagrams, cleanInput, convertCase, daysBetween, hashText, isPalindrome,
	isoWeek, moneyResult, newUuid, percentageChange, reverseWords, shuffle, sortedLines,
	splitTeams, textStats, uniqueLines, wordFrequency,
} from "../../utils/creatorToolkit.js";
import { normalizeLookupNumber } from "../../utils/phoneNumber.js";

const number = (value) => Number(String(value || "").replace(/,/g, ""));
const fmt = (value) => Number(value).toLocaleString("en-NG", { maximumFractionDigits: 2 });

const handler = async (sock, msg, from, args, info) => {
	const { command, prefix, sendMessageWTyping } = info;
	const input = cleanInput(args.join(" "));
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	try {
		if (["numberformat", "phoneformat", "countrycode"].includes(command)) {
			const parsed = normalizeLookupNumber(input);
			if (!parsed) return reply(`❌ Invalid number. Example: ${prefix}${command} +2348085109399`);
			return reply(`📱 *Phone Format*\nInternational: ${parsed.e164}\nCountry: ${parsed.countryCode}\nNational number: ${parsed.national}`);
		}
		if (["textstats", "readestimate", "linecount"].includes(command)) {
			if (!input) return reply(`❌ Usage: ${prefix}${command} <text>`);
			const stats = textStats(input);
			return reply(`📝 *Text Statistics*\nWords: ${stats.words}\nCharacters: ${stats.characters}\nWithout spaces: ${stats.charactersNoSpaces}\nLines: ${stats.lines}\nSentences: ${stats.sentences}\nReading time: ~${stats.readingMinutes} min`);
		}
		if (command === "wordfreq") {
			const result = wordFrequency(input);
			return reply(result.length ? `🔤 *Most Frequent Words*\n${result.map(([word, count], index) => `${index + 1}. ${word} — ${count}`).join("\n")}` : `❌ Usage: ${prefix}wordfreq <text>`);
		}
		if (["smarttitle", "sentencecase", "camelcase", "snakecase", "kebabcase", "webslug"].includes(command)) {
			const style = command === "smarttitle" ? "titlecase" : command === "webslug" ? "slugify" : command;
			return reply(convertCase(input, style) || `❌ Usage: ${prefix}${command} <text>`);
		}
		if (command === "dedupe") return reply(uniqueLines(input).join("\n") || `❌ Put each item on a new line.`);
		if (command === "linesort") return reply(sortedLines(input).join("\n") || `❌ Put each item on a new line.`);
		if (command === "reversewords") return reply(reverseWords(input) || `❌ Usage: ${prefix}reversewords <text>`);
		if (command === "palindrome") return reply(`🔁 “${input}” is ${isPalindrome(input) ? "a palindrome ✅" : "not a palindrome ❌"}`);
		if (command === "anagramcheck") {
			const [left, right] = input.split("|").map((item) => item.trim());
			if (!left || !right) return reply(`❌ Usage: ${prefix}anagram listen | silent`);
			return reply(areAnagrams(left, right) ? "✅ They are anagrams." : "❌ They are not anagrams.");
		}
		if (command === "percentchange") {
			const [oldValue, newValue] = args.map(number); const result = percentageChange(oldValue, newValue);
			return reply(result === null || !Number.isFinite(result) ? `❌ Usage: ${prefix}percentchange <old> <new>` : `📊 Percentage change: *${fmt(result)}%*`);
		}
		if (["discountcalc", "profitcalc", "vatcalc"].includes(command)) {
			const result = moneyResult(command, args.map(number));
			if (!result) return reply(`❌ Usage: ${prefix}${command} <amount/cost> <percent/selling-price>`);
			return reply(`🧮 *${command}*\nAmount: ${fmt(result.amount)}${result.percent === null || result.percent === undefined ? "" : `\nPercentage: ${fmt(result.percent)}%`}${result.final === undefined ? "" : `\nFinal total: ${fmt(result.final)}`}`);
		}
		if (command === "daysbetween") {
			const result = daysBetween(args[0], args[1]);
			return reply(result === null ? `❌ Usage: ${prefix}daysbetween YYYY-MM-DD YYYY-MM-DD` : `📅 Difference: *${Math.abs(result)} days*`);
		}
		if (command === "agecalc") {
			const result = ageOn(args[0]); return reply(result === null ? `❌ Usage: ${prefix}agecalc YYYY-MM-DD` : `🎂 Age: *${result} years*`);
		}
		if (command === "weeknumber") { const result = isoWeek(); return reply(`📅 ISO week: *${result.week}* of ${result.year}`); }
		if (["datetime", "unixdate"].includes(command)) {
			if (!input) return reply(`🕒 Unix: ${Math.floor(Date.now() / 1000)}\nISO: ${new Date().toISOString()}`);
			const millis = /^\d{10,13}$/.test(input) ? Number(input) * (input.length === 10 ? 1000 : 1) : Date.parse(input);
			return reply(Number.isFinite(millis) ? `🕒 ${new Date(millis).toISOString()}\nUnix: ${Math.floor(millis / 1000)}` : `❌ Provide a Unix timestamp or a valid date.`);
		}
		const list = input.split("|").map((item) => item.trim()).filter(Boolean).slice(0, 50);
		if (command === "choicepick") return reply(list.length >= 2 ? `🎯 Picked: *${list[Math.floor(Math.random() * list.length)]}*` : `❌ Usage: ${prefix}choicepick rice | beans | yam`);
		if (command === "shufflelist") return reply(list.length >= 2 ? `🔀 ${shuffle(list).join(" | ")}` : `❌ Usage: ${prefix}shufflelist one | two | three`);
		if (command === "randomteams") {
			const count = Math.min(10, Math.max(2, Number(args.shift()) || 2));
			const members = args.join(" ").split("|").map((item) => item.trim()).filter(Boolean).slice(0, 50);
			if (members.length < count) return reply(`❌ Usage: ${prefix}randomteams 2 Ada | Musa | Tunde | Chioma`);
			return reply(`👥 *Random Teams*\n\n${splitTeams(members, count).map((team, index) => `Team ${index + 1}: ${team.join(", ")}`).join("\n")}`);
		}
		if (command === "tosscoin") return reply(Math.random() < 0.5 ? "🪙 Heads" : "🪙 Tails");
		if (command === "newuuid") return reply(`🆔 ${newUuid()}`);
		if (command === "jsoncheck") { try { JSON.parse(input); return reply("✅ Valid JSON."); } catch { return reply("❌ Invalid JSON."); } }
		if (command === "percentencode") return reply(encodeURIComponent(input));
		if (command === "percentdecode") return reply(decodeURIComponent(input));
		if (command === "b64encode") return reply(Buffer.from(input, "utf8").toString("base64"));
		if (command === "b64decode") return reply(Buffer.from(input, "base64").toString("utf8").slice(0, 4000));
		if (["texthash", "md5text"].includes(command)) return reply(`🔐 ${hashText(input, command === "md5text" ? "md5" : "sha256")}`);
	} catch (error) {
		return reply(`❌ ${error.message || "Could not process that request."}`);
	}
};

export default () => ({
	cmd: [
		"numberformat", "phoneformat", "countrycode", "textstats", "readestimate", "linecount", "wordfreq",
		"smarttitle", "sentencecase", "camelcase", "snakecase", "kebabcase", "webslug", "dedupe", "linesort",
		"reversewords", "palindrome", "anagramcheck", "percentchange", "discountcalc", "profitcalc", "vatcalc",
		"daysbetween", "agecalc", "weeknumber", "datetime", "unixdate", "choicepick", "shufflelist",
		"randomteams", "tosscoin", "newuuid", "jsoncheck", "percentencode", "percentdecode", "b64encode",
		"b64decode", "texthash", "md5text",
	],
	desc: "Martech's safe text, number, date, decision and developer toolkit",
	usage: "textstats <text> | discountcalc <amount> <percent> | randompick a | b | c",
	handler,
});
