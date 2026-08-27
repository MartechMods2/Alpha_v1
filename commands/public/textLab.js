import {
	convertUnit,
	createPassword,
	decodeMorse,
	encodeMorse,
	fromRoman,
	textToolResult,
	toRoman,
} from "../../utils/featureSuite.js";
import { TEXT_LAB_COMMANDS } from "../../utils/ultimateFeatureCatalog.js";

const TEXT_COMMANDS = [
	"uppercase", "lowercase", "titlecase", "reverse", "wordcount", "charcount", "readingtime", "slugify",
	"base64encode", "base64decode", "urlencode", "urldecode", "sha256", "sortlines", "uniquelines",
	"shufflewords", "numberlist",
];

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { command, sendMessageWTyping } = msgInfoObj;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const input = args.join(" ");
	let result = "";

	if (TEXT_COMMANDS.includes(command)) {
		if (!input && !["uuid"].includes(command)) return reply(`❌ Usage: ${msgInfoObj.prefix}${command} <text>`);
		result = textToolResult(command, input.replace(/\s*\|\s*/g, "\n"));
	} else if (command === "uuid") {
		result = textToolResult("uuid", "");
	} else if (command === "password") {
		result = createPassword(args[0]);
	} else if (command === "timestamp") {
		const now = new Date();
		result = `Unix seconds: *${Math.floor(now.getTime() / 1000)}*\nISO: *${now.toISOString()}*`;
	} else if (command === "hexrgb") {
		const hex = String(args[0] || "").replace(/^#/, "");
		if (!/^[0-9a-f]{6}$/i.test(hex)) return reply("❌ Usage: hexrgb #33AAFF");
		result = `RGB(${Number.parseInt(hex.slice(0, 2), 16)}, ${Number.parseInt(hex.slice(2, 4), 16)}, ${Number.parseInt(hex.slice(4, 6), 16)})`;
	} else if (command === "rgbhex") {
		const values = input.split(/[\s,]+/).map(Number);
		if (values.length !== 3 || values.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return reply("❌ Usage: rgbhex 51 170 255");
		result = `#${values.map((value) => value.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
	} else if (command === "roman") {
		result = toRoman(args[0]);
		if (!result) return reply("❌ Enter a whole number from 1 to 3999.");
	} else if (command === "fromroman") {
		result = fromRoman(args[0]);
		if (result === null) return reply("❌ Enter a valid Roman numeral from I to MMMCMXCIX.");
	} else if (command === "binary") {
		const value = Number(args[0]);
		if (!Number.isSafeInteger(value) || value < 0) return reply("❌ Enter a non-negative whole number.");
		result = value.toString(2);
	} else if (command === "decimal") {
		if (!/^[01]{1,53}$/.test(String(args[0] || ""))) return reply("❌ Enter a binary value containing only 0 and 1.");
		result = String(Number.parseInt(args[0], 2));
	} else if (command === "morse") {
		result = encodeMorse(input);
	} else if (command === "unmorse") {
		result = decodeMorse(input);
	} else if (command === "unitconvert") {
		const value = convertUnit(args[0], args[1], args[2]);
		if (value === null) return reply("❌ Usage: unitconvert 5 km m\nSupported: mm, cm, m, km, in, ft, yd, mi, mg, g, kg, lb, oz, ml, l, cup, gal.");
		result = `${args[0]} ${args[1]} = *${Number(value.toPrecision(10))} ${args[2]}*`;
	}

	if (result === "" || result === null || result === undefined) return reply("❌ The input could not be processed.");
	return reply(`🧰 *Alpha Text Lab*\n\n${String(result).slice(0, 3500)}`);
};

export default () => ({
	cmd: TEXT_LAB_COMMANDS,
	desc: "Offline text, encoding, number, colour, password and unit-conversion tools",
	usage: "uppercase text | password 20 | unitconvert 5 km m | roman 49",
	handler,
});
