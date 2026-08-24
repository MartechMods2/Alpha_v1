import { getGroupData, group } from "../../../db/groupData.js";

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { sendMessageWTyping } = msgInfoObj;
	const groupData = await getGroupData(from);
	const action = args[0]?.toLowerCase();

	if (!action) {
		return sendMessageWTyping(
			from,
			{
				text:
					`👋 Auto-goodbye: *${groupData?.isGoodbyeOn ? "ON" : "OFF"}*\n` +
					`Template: ${groupData?.goodbye || "(default)"}\n\n` +
					"Placeholders: {user}, {users}, {group}, {count}",
			},
			{ quoted: msg },
		);
	}
	if (action === "on" || action === "off") {
		await group.updateOne({ _id: from }, { $set: { isGoodbyeOn: action === "on" } });
		return sendMessageWTyping(
			from,
			{ text: `✅ Auto-goodbye turned *${action.toUpperCase()}*.` },
			{ quoted: msg },
		);
	}
	if (action === "reset") {
		await group.updateOne({ _id: from }, { $set: { goodbye: "", isGoodbyeOn: false } });
		return sendMessageWTyping(
			from,
			{ text: "✅ Goodbye template reset and auto-goodbye disabled." },
			{ quoted: msg },
		);
	}

	const template = (action === "set" ? args.slice(1).join(" ") : args.join(" "))
		.trim()
		.slice(0, 1000);
	if (!template) {
		return sendMessageWTyping(
			from,
			{ text: "❌ Add a goodbye message after `goodbye set`." },
			{ quoted: msg },
		);
	}
	await group.updateOne({ _id: from }, { $set: { goodbye: template, isGoodbyeOn: true } });
	return sendMessageWTyping(
		from,
		{ text: `✅ Goodbye template saved and enabled:\n${template}` },
		{ quoted: msg },
	);
};

export default () => ({
	cmd: ["goodbye"],
	desc: "Configure one-message auto-goodbye",
	usage: "goodbye on/off | set <message> | reset",
	handler,
});
