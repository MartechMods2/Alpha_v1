const VOICE_PROFILE_DEFINITIONS = Object.freeze({
	default: {
		voice: "coral",
		instructions: "Speak naturally, warmly and clearly like a helpful WhatsApp assistant.",
	},
	man: {
		voice: "onyx",
		instructions: "Use a warm adult masculine voice. Sound natural, confident and conversational, not announcer-like.",
	},
	woman: {
		voice: "nova",
		instructions: "Use a warm adult feminine voice. Sound natural, confident and conversational, not announcer-like.",
	},
	boy: {
		voice: "echo",
		instructions: "Use a youthful, light and upbeat voice. Keep it natural and clear, not cartoonish or exaggerated.",
	},
	girl: {
		voice: "shimmer",
		instructions: "Use a youthful, bright and friendly voice. Keep it natural and clear, not cartoonish or exaggerated.",
	},
	funny: {
		voice: "fable",
		instructions: "Use playful comic timing and a lively conversational delivery. Keep the words clear and do not over-act.",
	},
	deep: {
		voice: "onyx",
		instructions: "Use a deep, calm, grounded delivery with measured pacing and clear pronunciation.",
	},
	calm: {
		voice: "alloy",
		instructions: "Use a calm, reassuring and unhurried delivery. Keep the tone warm and easy to listen to.",
	},
	energetic: {
		voice: "nova",
		instructions: "Use an energetic, upbeat and expressive delivery while staying clear and natural.",
	},
	storyteller: {
		voice: "fable",
		instructions: "Use an engaging storyteller delivery with natural pauses, varied emphasis and warm expression.",
	},
	radio: {
		voice: "echo",
		instructions: "Use a polished radio-host delivery: confident, smooth, concise and easy to understand.",
	},
	nigerian: {
		voice: "coral",
		instructions: "Use natural Nigerian English rhythm and phrasing without caricature or an exaggerated accent. Sound relaxed and conversational.",
	},
});

export const ALPHA_VOICE_PROFILES = Object.freeze(Object.keys(VOICE_PROFILE_DEFINITIONS));
export const ALPHA_TEXT_STYLES = Object.freeze(["normal", "serif", "script", "mono", "bubble", "wide", "smallcaps"]);

export const normalizeVoiceProfile = (value, fallback = "default") => {
	const name = String(value || "").trim().toLowerCase();
	return ALPHA_VOICE_PROFILES.includes(name) ? name : fallback;
};

export const normalizeTextStyle = (value, fallback = "normal") => {
	const name = String(value || "").trim().toLowerCase();
	return ALPHA_TEXT_STYLES.includes(name) ? name : fallback;
};

export const getVoiceProfile = (value) => {
	const profile = normalizeVoiceProfile(value);
	return { profile, ...VOICE_PROFILE_DEFINITIONS[profile] };
};

export const parseVoiceProfileArgs = (args = [], fallback = "default") => {
	const values = [...args].map((value) => String(value));
	let profile = normalizeVoiceProfile(fallback);
	if (!values.length) return { profile, args: values };

	const first = values[0].toLowerCase();
	if (ALPHA_VOICE_PROFILES.includes(first)) {
		profile = first;
		values.shift();
		return { profile, args: values };
	}
	if (/^--?voice=/.test(first) || /^voice=/.test(first)) {
		const candidate = first.split("=").slice(1).join("=");
		profile = normalizeVoiceProfile(candidate, profile);
		values.shift();
		return { profile, args: values };
	}
	if (["--voice", "-voice"].includes(first) && values[1]) {
		profile = normalizeVoiceProfile(values[1], profile);
		values.splice(0, 2);
	}
	return { profile, args: values };
};

const buildAlphabetMap = (upper, lower, digits = "") => {
	const map = new Map();
	[..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].forEach((char, index) => map.set(char, [...upper][index] || char));
	[..."abcdefghijklmnopqrstuvwxyz"].forEach((char, index) => map.set(char, [...lower][index] || char));
	if (digits) [..."0123456789"].forEach((char, index) => map.set(char, [...digits][index] || char));
	return map;
};

const STYLE_MAPS = {
	serif: buildAlphabetMap(
		"𝐀𝐁𝐂𝐃𝐄𝐅𝐆𝐇𝐈𝐉𝐊𝐋𝐌𝐍𝐎𝐏𝐐𝐑𝐒𝐓𝐔𝐕𝐖𝐗𝐘𝐙",
		"𝐚𝐛𝐜𝐝𝐞𝐟𝐠𝐡𝐢𝐣𝐤𝐥𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐭𝐮𝐯𝐰𝐱𝐲𝐳",
		"𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗",
	),
	script: buildAlphabetMap(
		"𝒜𝐵𝒞𝒟ℰℱ𝒢ℋℐ𝒥𝒦ℒℳ𝒩𝒪𝒫𝒬ℛ𝒮𝒯𝒰𝒱𝒲𝒳𝒴𝒵",
		"𝒶𝒷𝒸𝒹ℯ𝒻ℊ𝒽𝒾𝒿𝓀𝓁𝓂𝓃ℴ𝓅𝓆𝓇𝓈𝓉𝓊𝓋𝓌𝓍𝓎𝓏",
	),
	mono: buildAlphabetMap(
		"𝙰𝙱𝙲𝙳𝙴𝙵𝙶𝙷𝙸𝙹𝙺𝙻𝙼𝙽𝙾𝙿𝚀𝚁𝚂𝚃𝚄𝚅𝚆𝚇𝚈𝚉",
		"𝚊𝚋𝚌𝚍𝚎𝚏𝚐𝚑𝚒𝚓𝚔𝚕𝚖𝚗𝚘𝚙𝚚𝚛𝚜𝚝𝚞𝚟𝚠𝚡𝚢𝚣",
		"𝟶𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿",
	),
	bubble: buildAlphabetMap(
		"ⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏ",
		"ⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩ",
		"⓪①②③④⑤⑥⑦⑧⑨",
	),
};

const SMALL_CAPS = Object.freeze({
	a: "ᴀ", b: "ʙ", c: "ᴄ", d: "ᴅ", e: "ᴇ", f: "ꜰ", g: "ɢ", h: "ʜ", i: "ɪ", j: "ᴊ", k: "ᴋ", l: "ʟ", m: "ᴍ",
	n: "ɴ", o: "ᴏ", p: "ᴘ", q: "ǫ", r: "ʀ", s: "ꜱ", t: "ᴛ", u: "ᴜ", v: "ᴠ", w: "ᴡ", x: "x", y: "ʏ", z: "ᴢ",
});

const styleChunk = (text, style) => {
	if (style === "normal") return text;
	if (style === "wide") {
		return [...text].map((char) => {
			const code = char.codePointAt(0);
			if (code === 32) return "　";
			if (code >= 33 && code <= 126) return String.fromCodePoint(code + 0xfee0);
			return char;
		}).join("");
	}
	if (style === "smallcaps") {
		return [...text].map((char) => SMALL_CAPS[char.toLowerCase()] || char).join("");
	}
	const map = STYLE_MAPS[style];
	if (!map) return text;
	return [...text].map((char) => map.get(char) || char).join("");
};

const PRESERVE_TOKEN = /(https?:\/\/[^\s]+|www\.[^\s]+|`[^`\n]*`|@[\w.+-]{2,})/gi;

export const applyAlphaTextStyle = (rawText, rawStyle = "normal") => {
	const text = String(rawText || "");
	const style = normalizeTextStyle(rawStyle);
	if (!text || style === "normal") return text;
	let cursor = 0;
	let output = "";
	for (const match of text.matchAll(PRESERVE_TOKEN)) {
		const index = match.index ?? 0;
		output += styleChunk(text.slice(cursor, index), style);
		output += match[0];
		cursor = index + match[0].length;
	}
	output += styleChunk(text.slice(cursor), style);
	return output;
};
