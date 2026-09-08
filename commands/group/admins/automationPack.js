import { alphaPanel } from "../../../utils/alphaStyle.js";
import { automationPackStatus, setRecommendedAutomationPack } from "../../../utils/automationPack.js";

const state = (value) => value ? "✅ ON" : "⚪ OFF";
const statusPanel = (status) => alphaPanel({
	icon: "⚡", title: "Alpha Automation Pack",
	lines: [
		`Ready: *${status.enabledCount}/${status.totalCount}* recommended automations`, "",
		`👋 Welcome: *${state(status.groupStates.isWelcomeOn)}*`,
		`👋 Goodbye: *${state(status.groupStates.isGoodbyeOn)}*`,
		`🔗 Anti-Link: *${state(status.groupStates.isAntiLinkOn)}*`,
		`🚨 Anti-Spam: *${state(status.groupStates.isAntiSpamOn)}*`,
		`📵 Anti-Status: *${state(status.groupStates.isAntiStatusMentionOn)}*`, "",
		`🎂 Birthday: *${state(status.scheduledStates.birthdayEnabled)}*`,
		`📅 Event alerts: *${state(status.scheduledStates.eventAlertsEnabled)}*`,
		`☀️ Morning: *${state(status.scheduledStates.morningEnabled)}* at *${status.automation.morningTime}*`,
		`🌙 Night: *${state(status.scheduledStates.nightEnabled)}* at *${status.automation.nightTime}*`,
		`🌍 Timezone: *${status.automation.timezone}*`,
	],
	footer: "Built-in templates are automatic. Use `automationpack on` in a new group and Alpha is ready.",
});

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { sendMessageWTyping } = msgInfoObj;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const action = String(args[0] || "status").toLowerCase();
	try {
		if (action === "status") return reply(statusPanel(await automationPackStatus(from)));
		if (!["on", "off"].includes(action)) return reply("❌ Use `automationpack on`, `automationpack off`, or `automationpack status`.");
		const status = await setRecommendedAutomationPack(from, action === "on");
		return reply(`${statusPanel(status)}\n\n${action === "on" ? "✅ Recommended group automations are now enabled. No manual template setup is required." : "✅ Recommended group automations are now disabled. Built-in templates remain available."}`);
	} catch (error) { return reply(`❌ Could not update the automation pack: ${error.message}`); }
};

export default () => ({
	cmd: ["automationpack", "autopack"],
	desc: "Enable or disable Alpha's recommended welcome, safety and scheduled group automations in one command",
	usage: "automationpack on | automationpack off | automationpack status",
	handler,
});
