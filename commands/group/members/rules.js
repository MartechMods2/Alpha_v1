import { getGroupData, group } from "../../../db/groupData.js";

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { isGroupAdmin, isOwner, sendMessageWTyping } = msgInfoObj;
	const action = args[0]?.toLowerCase();
	const groupData = await getGroupData(from);
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });

	if (!action) {
		return reply(
			groupData?.rules
				? `📜 *${groupData.grpName || "Group"} Rules*\n\n${groupData.rules}`
				: "📜 No group rules have been set yet.",
		);
	}

	if (!["set", "reset"].includes(action)) return reply("❌ Usage: rules | rules set <text> | rules reset");
	if (!isGroupAdmin && !isOwner) return reply("❌ Only a group admin can change the rules.");

	if (action === "reset") {
		await group.updateOne({ _id: from }, { $set: { rules: "" } });
		return reply("✅ Group rules cleared.");
	}

	const rules = args.slice(1).join(" ").trim().slice(0, 1500);
	if (!rules) return reply("❌ Add the rules after `rules set`.");
	await group.updateOne({ _id: from }, { $set: { rules } });
	return reply("✅ Group rules saved. Members can view them with `rules`.");
};

export default () => ({
	cmd: ["rules"],
	desc: "View or configure group rules",
	usage: "rules | rules set <text> | rules reset",
	handler,
});
