import { group } from "../../../db/groupData.js";
import { normalizeAlphaSettings } from "../../../utils/alphaMention.js";

const onOff = (value) => value === "on" ? true : value === "off" ? false : null;

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { command, sendMessageWTyping } = msgInfoObj;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const current = await group.findOne({ _id: from });
	const settings = normalizeAlphaSettings(current || {});
	if (command === "alphastatus") {
		return reply(
			"⚡ *Alpha Mention Assistant*\n\n" +
			`Mode: *${settings.alphaMode}*\nStyle: *${settings.alphaPersonality}*\nLength: *${settings.alphaResponseLength}*\n` +
			`Daily quota: *${settings.alphaDailyQuota} per member*\nMemory: *${settings.alphaMemoryLimit} turns*\n` +
			`Images: *${settings.alphaImageOn ? "on" : "off"}* · Voice: *${settings.alphaVoiceOn ? "on" : "off"}* · Documents: *${settings.alphaDocOn ? "on" : "off"}*\n` +
			`Quiet hours: *${settings.alphaQuietStart && settings.alphaQuietEnd ? `${settings.alphaQuietStart}–${settings.alphaQuietEnd}` : "off"}*`,
		);
	}
	const raw = String(args[0] || "").toLowerCase();
	const updates = {};
	if (command === "alphamode" && ["smart", "text", "mixed", "sticker", "off"].includes(raw)) updates.alphaMode = raw;
	else if (command === "alphastyle" && ["friendly", "funny", "professional"].includes(raw)) updates.alphaPersonality = raw;
	else if (command === "alphalength" && ["short", "normal", "detailed"].includes(raw)) updates.alphaResponseLength = raw;
	else if (command === "alphamemory" && Number.isFinite(Number(raw))) updates.alphaMemoryLimit = Math.min(20, Math.max(0, Number(raw)));
	else if (command === "alphaquota" && Number.isFinite(Number(raw))) updates.alphaDailyQuota = Math.min(50, Math.max(1, Number(raw)));
	else if (["alphaimage", "alphavoice", "alphadoc", "alphasticker"].includes(command) && onOff(raw) !== null) {
		updates[{ alphaimage: "alphaImageOn", alphavoice: "alphaVoiceOn", alphadoc: "alphaDocOn", alphasticker: "alphaStickerOn" }[command]] = onOff(raw);
	} else if (command === "alphaquiet") {
		if (raw === "off") Object.assign(updates, { alphaQuietStart: "", alphaQuietEnd: "" });
		else if (/^\d{2}:\d{2}$/.test(args[0] || "") && /^\d{2}:\d{2}$/.test(args[1] || "")) {
			Object.assign(updates, { alphaQuietStart: args[0], alphaQuietEnd: args[1] });
		}
	} else if (command === "alphaclear") {
		await group.updateOne({ _id: from }, { $set: { chatHistory: [] } });
		return reply("✅ Alpha's conversation memory for this group was cleared.");
	}
	if (!Object.keys(updates).length) {
		return reply("❌ Invalid setting. Use `alphastatus` to see the current configuration.");
	}
	await group.updateOne({ _id: from }, { $set: updates });
	return reply("✅ Alpha mention settings updated.");
};

export default () => ({
	cmd: [
		"alphamode", "alphastyle", "alphalength", "alphamemory", "alphaquota", "alphaquiet",
		"alphaimage", "alphavoice", "alphadoc", "alphasticker", "alphastatus", "alphaclear",
	],
	desc: "Configure smart Alpha mention replies and media understanding",
	usage: "alphastatus | alphamode smart | alphaquiet 22:00 07:00",
	handler,
});
