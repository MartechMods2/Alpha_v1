import { getGroupData, group } from "../../db/groupData.js";
import { getMemberData, member } from "../../db/members.js";
import { getBotData, bot } from "../../db/botData.js";


const updateData = async (collection, id, data, value, sendMessageWTyping, from, msg) => {
	if (value.match(/^[0-9]+$/)) value = Number(value);
	if (value === "true") value = true;
	if (value === "false") value = false;
	await collection.updateOne({ _id: id }, { $set: { [data]: value } });
	sendMessageWTyping(from, { text: "Command Executed" }, { quoted: msg });
};

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { sendMessageWTyping, command, extendedMessageOriginal } = msgInfoObj;
	let data, value, id, collection, getDataFunc;

	switch (command) {
		case "group":
			collection = group;
			getDataFunc = getGroupData;
			id = from;
			break;
		case "member":
			if (!extendedMessageOriginal) {
				return sendMessageWTyping(from, { text: "*Reply On User's Message.*" }, { quoted: msg });
			}
			collection = member;
			getDataFunc = getMemberData;
			// Match the full JID used by member records.
			const target = extendedMessageOriginal.participant || extendedMessageOriginal.mentionedJid?.[0];
			if (!target) return sendMessageWTyping(from, { text: "Reply to or mention a user." }, { quoted: msg });
			id = target.replace(/:\d+@/, "@");
			break;
		case "bot":
			collection = bot;
			getDataFunc = getBotData;
			id = "bot";
			break;
		default:
			return;
	}

	if (!args[0]) {
		const data = await getDataFunc(id);
		sendMessageWTyping(from, { text: JSON.stringify(data, null, 2, 100) }, { quoted: msg });
	} else {
		const separator = args[0].indexOf(":");
		data = args[0].slice(0, separator);
		value = args.join(" ").slice(separator + 1);
		if (separator < 1 || !/^[A-Za-z][A-Za-z0-9_]*$/.test(data) || !value) {
			return sendMessageWTyping(from, { text: "Use field:value, e.g. isBotOn:true. Field names must be plain names." }, { quoted: msg });
		}
		await updateData(collection, id, data, value, sendMessageWTyping, from, msg);
	}
};

export default () => ({
	cmd: ["group", "member", "bot"],
	desc: "Control Database",
	usage: "group | member | bot",
	handler,
});
