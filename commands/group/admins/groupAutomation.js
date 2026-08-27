import {
	getGroupAutomation,
	setGroupAutomationTime,
	setGroupAutomationTimezone,
	setGroupAutomationToggle,
} from "../../../db/groupAutomation.js";

const toggle = (value) => value === "on" ? true : value === "off" ? false : null;

const statusText = (settings) =>
	"🤖 *Group Automations*\n\n" +
	`Birthday greetings: *${settings.birthdayEnabled ? "ON" : "OFF"}*\n` +
	`Event milestone alerts: *${settings.eventAlertsEnabled ? "ON" : "OFF"}*\n` +
	`Daily friendly action: *${settings.actionDailyEnabled ? "ON" : "OFF"}*\n` +
	`Delivery time: *${settings.time}*\nTimezone: *${settings.timezone}*\n\n` +
	"Automations are off by default and send at most once per scheduled item.";

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { command, sendMessageWTyping } = msgInfoObj;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	try {
		if (command === "groupauto") {
			const action = String(args[0] || "status").toLowerCase();
			if (action === "status") return reply(statusText(await getGroupAutomation(from)));
			if (action === "time") {
				const time = await setGroupAutomationTime(from, args[1]);
				return reply(`✅ Group automations will run at *${time}*.`);
			}
			if (action === "timezone") {
				const timezone = await setGroupAutomationTimezone(from, args[1]);
				return reply(`✅ Group automation timezone changed to *${timezone}*.`);
			}
			if (action === "off") {
				for (const field of ["birthdayEnabled", "eventAlertsEnabled", "actionDailyEnabled"]) {
					await setGroupAutomationToggle(from, field, false);
				}
				return reply("✅ All group automations turned off.");
			}
			return reply("❌ Use `groupauto status`, `groupauto time 08:00`, `groupauto timezone Africa/Lagos`, or `groupauto off`.");
		}

		const value = toggle(String(args[0] || "").toLowerCase());
		const field = {
			birthdayauto: "birthdayEnabled",
			eventalerts: "eventAlertsEnabled",
			actionauto: "actionDailyEnabled",
		}[command];
		if (value === null) {
			const settings = await getGroupAutomation(from);
			return reply(statusText(settings));
		}
		await setGroupAutomationToggle(from, field, value);
		return reply(`✅ ${command} turned *${value ? "ON" : "OFF"}*.`);
	} catch (error) {
		return reply(`❌ ${error.message}`);
	}
};

export default () => ({
	cmd: ["groupauto", "birthdayauto", "eventalerts", "actionauto"],
	desc: "Schedule birthday greetings, event milestones and one daily friendly action",
	usage: "birthdayauto on | eventalerts on | actionauto on | groupauto time 08:00",
	handler,
});
