import {
	getGroupAutomation,
	setGroupAutomationTime,
	setGroupAutomationTimezone,
	setGroupAutomationToggle,
} from "../../../db/groupAutomation.js";
import { alphaPanel } from "../../../utils/alphaStyle.js";

const toggle = (value) => value === "on" ? true : value === "off" ? false : null;

const statusText = (settings) => alphaPanel({
	icon: "🤖",
	title: "Group Automations",
	lines: [
		`☀️ Good Morning: *${settings.morningEnabled ? "ON" : "OFF"}* at *${settings.morningTime}*`,
		`🌙 Good Night: *${settings.nightEnabled ? "ON" : "OFF"}* at *${settings.nightTime}*`,
		`🎂 Birthday greetings: *${settings.birthdayEnabled ? "ON" : "OFF"}*`,
		`📅 Event milestone alerts: *${settings.eventAlertsEnabled ? "ON" : "OFF"}*`,
		`🎭 Daily friendly action: *${settings.actionDailyEnabled ? "ON" : "OFF"}*`,
		`Other daily automations: *${settings.time}*`,
		`Timezone: *${settings.timezone}*`,
	],
	footer: "Each scheduled item is delivery-locked so Alpha does not send it twice on the same day.",
});

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { command, sendMessageWTyping } = msgInfoObj;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	try {
		if (command === "groupauto") {
			const action = String(args[0] || "status").toLowerCase();
			if (action === "status") return reply(statusText(await getGroupAutomation(from)));
			if (action === "time") {
				const time = await setGroupAutomationTime(from, args[1], "time");
				return reply(`✅ Birthday/event/action automation time set to *${time}*.`);
			}
			if (action === "morning") {
				const time = await setGroupAutomationTime(from, args[1], "morningTime");
				return reply(`☀️ Good Morning time set to *${time}*.`);
			}
			if (action === "night") {
				const time = await setGroupAutomationTime(from, args[1], "nightTime");
				return reply(`🌙 Good Night time set to *${time}*.`);
			}
			if (action === "timezone") {
				const timezone = await setGroupAutomationTimezone(from, args[1]);
				return reply(`✅ Group automation timezone changed to *${timezone}*.`);
			}
			if (action === "off") {
				for (const field of ["birthdayEnabled", "eventAlertsEnabled", "actionDailyEnabled", "morningEnabled", "nightEnabled"]) {
					await setGroupAutomationToggle(from, field, false);
				}
				return reply("✅ All group automations turned off.");
			}
			return reply("❌ Use `groupauto status`, `groupauto morning 06:00`, `groupauto night 23:00`, `groupauto time 08:00`, `groupauto timezone Africa/Lagos`, or `groupauto off`.");
		}

		const value = toggle(String(args[0] || "").toLowerCase());
		const field = {
			birthdayauto: "birthdayEnabled",
			eventalerts: "eventAlertsEnabled",
			actionauto: "actionDailyEnabled",
			morningauto: "morningEnabled",
			nightauto: "nightEnabled",
		}[command];
		if (value === null) return reply(statusText(await getGroupAutomation(from)));
		await setGroupAutomationToggle(from, field, value);
		return reply(`✅ ${command} turned *${value ? "ON" : "OFF"}*.`);
	} catch (error) {
		return reply(`❌ ${error.message}`);
	}
};

export default () => ({
	cmd: ["groupauto", "birthdayauto", "eventalerts", "actionauto", "morningauto", "nightauto"],
	desc: "Schedule Good Morning, Good Night, birthdays, event milestones and a daily friendly action",
	usage: "morningauto on | nightauto on | groupauto morning 06:00 | groupauto night 23:00",
	handler,
});
