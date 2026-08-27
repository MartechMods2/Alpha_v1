import mdClient from "./client.js";

const groupAutomations = mdClient.db("MyBotDataDB").collection("GroupAutomations");
const automationDeliveries = mdClient.db("MyBotDataDB").collection("AutomationDeliveries");

export const DEFAULT_GROUP_AUTOMATION = Object.freeze({
	birthdayEnabled: false,
	eventAlertsEnabled: false,
	actionDailyEnabled: false,
	time: "08:00",
	timezone: process.env.BOT_TIMEZONE || "Africa/Lagos",
});

const cleanTimezone = (value) => {
	const timezone = String(value || "").trim();
	try {
		new Intl.DateTimeFormat("en", { timeZone: timezone }).format(new Date());
		return timezone;
	} catch {
		throw new Error("Invalid timezone. Example: Africa/Lagos");
	}
};

const cleanTime = (value) => {
	const match = String(value || "").trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
	if (!match) throw new Error("Invalid time. Use 24-hour HH:MM, for example 08:00");
	return `${match[1]}:${match[2]}`;
};

export const getGroupAutomation = async (groupJid) => ({
	...DEFAULT_GROUP_AUTOMATION,
	...((await groupAutomations.findOne({ _id: groupJid })) || {}),
});

export const setGroupAutomationToggle = async (groupJid, field, enabled) => {
	if (!["birthdayEnabled", "eventAlertsEnabled", "actionDailyEnabled"].includes(field)) throw new Error("Unknown automation");
	await groupAutomations.updateOne(
		{ _id: groupJid },
		{ $set: { [field]: Boolean(enabled), updatedAt: new Date() }, $setOnInsert: { createdAt: new Date(), time: "08:00", timezone: DEFAULT_GROUP_AUTOMATION.timezone } },
		{ upsert: true },
	);
};

export const setGroupAutomationTime = async (groupJid, value) => {
	const time = cleanTime(value);
	await groupAutomations.updateOne(
		{ _id: groupJid },
		{ $set: { time, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date(), timezone: DEFAULT_GROUP_AUTOMATION.timezone } },
		{ upsert: true },
	);
	return time;
};

export const setGroupAutomationTimezone = async (groupJid, value) => {
	const timezone = cleanTimezone(value);
	await groupAutomations.updateOne(
		{ _id: groupJid },
		{ $set: { timezone, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date(), time: "08:00" } },
		{ upsert: true },
	);
	return timezone;
};

export const listEnabledGroupAutomations = () => groupAutomations.find({
	$or: [
		{ birthdayEnabled: true },
		{ eventAlertsEnabled: true },
		{ actionDailyEnabled: true },
	],
}).toArray();

export const claimAutomationDelivery = async ({ groupJid, type, key }) => {
	try {
		await automationDeliveries.insertOne({
			_id: `${groupJid}:${type}:${key}`,
			groupJid,
			type,
			key,
			createdAt: new Date(),
		});
		return true;
	} catch (error) {
		if (error?.code === 11000) return false;
		throw error;
	}
};

export const releaseAutomationDelivery = ({ groupJid, type, key }) =>
	automationDeliveries.deleteOne({ _id: `${groupJid}:${type}:${key}` });

export { automationDeliveries, cleanTime, cleanTimezone, groupAutomations };
