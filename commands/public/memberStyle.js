import { getMemberPreferences, setMemberPreferences } from "../../db/members.js";

const tones = ["auto", "friendly", "funny", "professional", "gentle", "concise"];
const pronouns = ["neutral", "he", "she", "they"];

const handler = async (sock, msg, from, args, info) => {
	const reply = (text) => info.sendMessageWTyping(from, { text }, { quoted: msg });
	const command = info.command;
	if (["mystyle", "mystatus"].includes(command) && !args.length) {
		const pref = await getMemberPreferences(info.senderJid);
		return reply(`🎭 *Your Alpha Style*\nTone: *${pref.tone}*\nPronouns: *${pref.pronouns}*\n\nUse \`${info.prefix}mytone friendly\` or \`${info.prefix}mypronouns they\`.`);
	}
	if (command === "resetstyle") {
		await setMemberPreferences(info.senderJid, { tone: "auto", pronouns: "neutral" });
		return reply("✅ Alpha will use a natural tone and gender-neutral language for you.");
	}
	if (command === "mytone") {
		const tone = String(args[0] || "").toLowerCase();
		if (!tones.includes(tone)) return reply(`🎭 Choose: ${tones.join(", ")}.`);
		await setMemberPreferences(info.senderJid, { tone });
		return reply(`✅ Your Alpha reply tone is now *${tone}*.`);
	}
	if (command === "mypronouns") {
		const pronoun = String(args[0] || "").toLowerCase();
		if (!pronouns.includes(pronoun)) return reply(`👤 Choose: ${pronouns.join(", ")}.`);
		await setMemberPreferences(info.senderJid, { pronouns: pronoun });
		return reply(`✅ Your pronoun preference is now *${pronoun}*.`);
	}
	return reply(`🎭 Use \`${info.prefix}mytone friendly\`, \`${info.prefix}mypronouns neutral\`, or \`${info.prefix}resetstyle\`.`);
};

export default () => ({
	cmd: ["mystyle", "mystatus", "mytone", "mypronouns", "resetstyle"],
	desc: "Choose how Alpha speaks to you without guessing gender",
	usage: "mytone friendly | mypronouns they | resetstyle",
	handler,
});
