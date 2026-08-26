import { group } from "../../../db/groupData.js";
import { normalizeAlphaSettings } from "../../../utils/alphaMention.js";

const onOff = (value) => value === "on" ? true : value === "off" ? false : null;
const ACCESS_MODES = ["everyone", "admins", "allowlist", "denylist"];
const mentionLabel = (jid) => `@${String(jid || "").split("@")[0].split(":")[0]}`;

const resolveTargets = (extendedMessageOriginal) => [
	...(Array.isArray(extendedMessageOriginal?.mentionedJid) ? extendedMessageOriginal.mentionedJid : []),
	extendedMessageOriginal?.participant,
].filter((jid, index, all) => jid?.includes("@") && all.indexOf(jid) === index).slice(0, 20);

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { command, extendedMessageOriginal, sendMessageWTyping } = msgInfoObj;
	const reply = (text, mentions = []) => sendMessageWTyping(from, { text, mentions }, { quoted: msg });
	const current = await group.findOne({ _id: from });
	const settings = normalizeAlphaSettings(current || {});
	if (command === "alphastatus") {
		return reply(
			"⚡ *Alpha Mention Assistant*\n\n" +
			`Mode: *${settings.alphaMode}*\nStyle: *${settings.alphaPersonality}*\nLength: *${settings.alphaResponseLength}*\n` +
			`Daily quota: *${settings.alphaDailyQuota} per member*\nMemory: *${settings.alphaMemoryLimit} turns*\n` +
			`Images: *${settings.alphaImageOn ? "on" : "off"}* · Voice: *${settings.alphaVoiceOn ? "on" : "off"}* · Documents: *${settings.alphaDocOn ? "on" : "off"}*\n` +
			`Access: *${settings.alphaAccessMode}* · Allowed: *${settings.alphaAllowedMembers.length}* · Denied: *${settings.alphaDeniedMembers.length}*\n` +
			`Quiet hours: *${settings.alphaQuietStart && settings.alphaQuietEnd ? `${settings.alphaQuietStart}–${settings.alphaQuietEnd}` : "off"}*`,
		);
	}
	const raw = String(args[0] || "").toLowerCase();
	if (["alphafilter", "alphaaccess"].includes(command)) {
		const requestedMode = raw === "mode" ? String(args[1] || "").toLowerCase() : raw;
		if (ACCESS_MODES.includes(requestedMode)) {
			await group.updateOne({ _id: from }, { $set: { alphaAccessMode: requestedMode } });
			return reply(`✅ Alpha access changed to *${requestedMode}*.`);
		}
		if (["", "status", "list"].includes(raw)) {
			const allowed = settings.alphaAllowedMembers.map(mentionLabel);
			const denied = settings.alphaDeniedMembers.map(mentionLabel);
			return reply(
				"🔐 *Alpha Member Filter*\n\n" +
				`Mode: *${settings.alphaAccessMode}*\n` +
				`Allowlist: ${allowed.join(", ") || "empty"}\n` +
				`Denylist: ${denied.join(", ") || "empty"}\n\n` +
				"Admins and the bot owner can always use Alpha.\n" +
				"Use `alphafilter everyone|admins|allowlist|denylist`, `alphafilter allow|deny @member`, `alphafilter remove @member`, or `alphafilter clear`.",
				[...settings.alphaAllowedMembers, ...settings.alphaDeniedMembers],
			);
		}
		if (raw === "clear") {
			await group.updateOne({ _id: from }, { $set: { alphaAllowedMembers: [], alphaDeniedMembers: [] } });
			return reply("✅ Alpha allowlist and denylist cleared. The current access mode was kept.");
		}
		if (["allow", "deny", "remove"].includes(raw)) {
			const targets = resolveTargets(extendedMessageOriginal);
			if (!targets.length) return reply(`❌ Tag or reply to at least one member: \`alphafilter ${raw} @member\`.`);
			if (raw === "remove") {
				await group.updateOne(
					{ _id: from },
					{ $pull: { alphaAllowedMembers: { $in: targets }, alphaDeniedMembers: { $in: targets } } },
				);
				return reply(`✅ Removed ${targets.map(mentionLabel).join(", ")} from both filter lists.`, targets);
			}
			const selectedField = raw === "allow" ? "alphaAllowedMembers" : "alphaDeniedMembers";
			const oppositeField = raw === "allow" ? "alphaDeniedMembers" : "alphaAllowedMembers";
			const mode = raw === "allow" ? "allowlist" : "denylist";
			await group.updateOne(
				{ _id: from },
				{
					$addToSet: { [selectedField]: { $each: targets } },
					$pull: { [oppositeField]: { $in: targets } },
					$set: { alphaAccessMode: mode },
				},
			);
			return reply(`✅ ${targets.map(mentionLabel).join(", ")} added to the *${mode}*.`, targets);
		}
		return reply("❌ Invalid filter action. Use `alphafilter status` for help.");
	}
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
		"alphafilter", "alphaaccess",
	],
	desc: "Configure smart Alpha mention replies and media understanding",
	usage: "alphastatus | alphamode smart | alphafilter everyone|admins|allowlist|denylist",
	handler,
});
