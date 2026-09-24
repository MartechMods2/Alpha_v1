import { getMemberPreferences, setMemberPreferences } from "../../db/members.js";

const tones = ["auto", "friendly", "funny", "professional", "gentle", "concise", "chill", "energetic", "witty", "mentor", "teacher", "developer", "storyteller", "direct", "polished"];
const pronouns = ["neutral", "he", "she", "they"];
const lengths = ["auto", "short", "balanced", "detailed"];
const formats = ["auto", "paragraphs", "bullets", "steps"];
const emojis = ["low", "normal", "high"];
const expertise = ["auto", "beginner", "intermediate", "expert"];
const answerModes = ["auto", "direct", "coach", "tutor", "analyst", "developer", "creator"];

const showProfile = (pref, prefix) => [
	"🎭 *Your Alpha Response Profile*",
	"",
	`Tone: *${pref.tone}*`,
	`Length: *${pref.replyLength}*`,
	`Format: *${pref.replyFormat}*`,
	`Emoji level: *${pref.emojiLevel}*`,
	`Expertise: *${pref.expertise}*`,
	`Answer mode: *${pref.answerMode}*`,
	`Pronouns: *${pref.pronouns}*`,
	`Voice: *${pref.voiceProfile}*`,
	`Text style: *${pref.textStyle}*`,
	"",
	`Try: \`${prefix}mymode developer\` · \`${prefix}mylength short\` · \`${prefix}myformat steps\``,
].join("\n");

const handler = async (_sock, msg, from, args, info) => {
	const reply = (text) => info.sendMessageWTyping(from, { text }, { quoted: msg });
	const command = info.command;
	const prefix = info.prefix || process.env.PREFIX || "$";

	if (["mystyle", "mystatus", "myalpha"].includes(command) && !args.length) {
		return reply(showProfile(await getMemberPreferences(info.senderJid), prefix));
	}

	if (command === "resetstyle") {
		const pref = await setMemberPreferences(info.senderJid, {
			tone: "auto",
			pronouns: "neutral",
			replyLength: "auto",
			replyFormat: "auto",
			emojiLevel: "normal",
			expertise: "auto",
			answerMode: "auto",
		});
		return reply(`✅ Alpha response preferences reset.\n\n${showProfile(pref, prefix)}`);
	}

	const setChoice = async ({ field, value, allowed, label }) => {
		if (!allowed.includes(value)) return reply(`🎛️ Choose ${label}: ${allowed.join(", ")}.`);
		const pref = await setMemberPreferences(info.senderJid, { [field]: value });
		return reply(`✅ Alpha ${label} set to *${pref[field]}*.`);
	};

	if (command === "mytone") return setChoice({ field: "tone", value: String(args[0] || "").toLowerCase(), allowed: tones, label: "tone" });
	if (command === "mypronouns") return setChoice({ field: "pronouns", value: String(args[0] || "").toLowerCase(), allowed: pronouns, label: "pronouns" });
	if (command === "mylength") return setChoice({ field: "replyLength", value: String(args[0] || "").toLowerCase(), allowed: lengths, label: "reply length" });
	if (command === "myformat") return setChoice({ field: "replyFormat", value: String(args[0] || "").toLowerCase(), allowed: formats, label: "reply format" });
	if (command === "myemoji") return setChoice({ field: "emojiLevel", value: String(args[0] || "").toLowerCase(), allowed: emojis, label: "emoji level" });
	if (command === "myexpertise") return setChoice({ field: "expertise", value: String(args[0] || "").toLowerCase(), allowed: expertise, label: "expertise level" });
	if (command === "mymode") return setChoice({ field: "answerMode", value: String(args[0] || "").toLowerCase(), allowed: answerModes, label: "answer mode" });

	return reply([
		"🎭 *Alpha Response Controls*",
		"",
		`${prefix}mytone <${tones.join("|")}>`,
		`${prefix}mylength <${lengths.join("|")}>`,
		`${prefix}myformat <${formats.join("|")}>`,
		`${prefix}myemoji <${emojis.join("|")}>`,
		`${prefix}myexpertise <${expertise.join("|")}>`,
		`${prefix}mymode <${answerModes.join("|")}>`,
		`${prefix}mypronouns <${pronouns.join("|")}>`,
		`${prefix}resetstyle`,
	].join("\n"));
};

export default () => ({
	cmd: ["mystyle", "mystatus", "myalpha", "mytone", "mypronouns", "mylength", "myformat", "myemoji", "myexpertise", "mymode", "resetstyle"],
	desc: "Personalize Alpha's tone, depth, format, expertise and response mode",
	usage: "myalpha | mymode developer | mylength short | myformat steps | myemoji low",
	handler,
});
