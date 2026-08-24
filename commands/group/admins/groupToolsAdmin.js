import { resetGroupTools } from "../../../db/groupTools.js";

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const reply = (text) => msgInfoObj.sendMessageWTyping(from, { text }, { quoted: msg });
	if (String(args[0] || "").toLowerCase() !== "confirm") {
		return reply("⚠️ This clears all shared notes, tasks and birthdays in this group. Use `groupkitreset confirm`.");
	}
	await resetGroupTools(from);
	return reply("✅ Group toolkit data cleared.");
};

export default () => ({
	cmd: ["groupkitreset"],
	desc: "Clear all persistent shared notes, tasks and birthdays",
	usage: "groupkitreset confirm",
	handler,
});
