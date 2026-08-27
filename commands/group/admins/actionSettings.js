import {
	getActionSettings,
	resetActionStats,
	setActionCooldown,
	setActionMode,
} from "../../../db/actionData.js";

const targetFromContext = (context) =>
	(Array.isArray(context?.mentionedJid) ? context.mentionedJid[0] : context?.mentionedJid) || context?.participant || "";

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { command, extendedMessageOriginal, sendMessageWTyping } = msgInfoObj;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	try {
		if (command === "actionmode") {
			const mode = String(args[0] || "status").toLowerCase();
			if (mode === "status") {
				const settings = await getActionSettings(from);
				return reply(`🎬 *Action Studio Settings*\n\nMode: *${settings.mode}*\nCooldown: *${settings.cooldownSeconds} seconds*\nOpted-out members: *${settings.optedOutMembers.length}*`);
			}
			if (!["all", "friendly", "off"].includes(mode)) return reply("❌ Use `actionmode all`, `actionmode friendly`, or `actionmode off`.");
			await setActionMode(from, mode);
			return reply(`✅ Action sticker mode changed to *${mode}*.`);
		}
		if (command === "actioncooldown") {
			const seconds = Number.parseInt(args[0], 10);
			if (!Number.isFinite(seconds) || seconds < 5 || seconds > 120) return reply("❌ Choose a cooldown from 5 to 120 seconds.");
			const saved = await setActionCooldown(from, seconds);
			return reply(`✅ Action cooldown changed to *${saved} seconds*.`);
		}
		if (command === "actionreset") {
			const target = targetFromContext(extendedMessageOriginal);
			const confirm = String(args.at(-1) || "").toLowerCase() === "confirm";
			const resetAll = !target && String(args[0] || "").toLowerCase() === "all";
			if (!confirm || (!target && !resetAll)) return reply(`⚠️ Use \`actionreset${target ? " @member" : " all"} confirm\`.`);
			await resetActionStats(from, target || null);
			return reply(target ? "✅ That member's action statistics were reset." : "✅ All action statistics in this group were reset.");
		}
	} catch (error) {
		console.error("Action settings failed:", error.message);
		return reply(`❌ ${error.message}`);
	}
};

export default () => ({
	cmd: ["actionmode", "actioncooldown", "actionreset"],
	desc: "Configure Action Sticker Studio and reset its statistics",
	usage: "actionmode all|friendly|off | actioncooldown 15 | actionreset all confirm",
	handler,
});
