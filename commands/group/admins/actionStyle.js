import { getSafeSettings, updateSafeSettings } from "../../../db/safePackData.js";

const handler = async (sock, msg, from, args, info) => {
	const reply = (text) => info.sendMessageWTyping(from, { text }, { quoted: msg });
	const style = String(args[0] || "status").toLowerCase();
	if (style === "status") { const settings = await getSafeSettings(from); return reply(`🎬 Action sticker style: *${settings.actionStyle}*`); }
	if (!["anime", "human"].includes(style)) return reply("❌ Use `actionstyle anime` or `actionstyle human`. ");
	await updateSafeSettings(from, { actionStyle: style });
	return reply(`✅ Action stickers now use the *${style}* artwork pack.`);
};
export default () => ({ cmd: ["actionstyle"], desc: "Choose premium anime or realistic fictional-human action stickers", usage: "actionstyle anime|human", handler });
