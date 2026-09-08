import { getGroupData, group } from "../../../db/groupData.js";
import { GROUP_TEMPLATES } from "../../../utils/groupTemplates.js";
import { alphaPanel, safeDisplayName } from "../../../utils/alphaStyle.js";

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { isGroupAdmin, isOwner, sendMessageWTyping } = msgInfoObj;
	const action = args[0]?.toLowerCase();
	const groupData = await getGroupData(from);
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });

	if (!action) {
		if (!groupData?.rules) {
			return reply(`${GROUP_TEMPLATES.rules}\n\n_Admin tip: customise these with \`rules set <your rules>\`._`);
		}
		return reply(alphaPanel({
			icon: "📜",
			title: `${safeDisplayName(groupData.grpName || "Group")} Rules`,
			lines: String(groupData.rules).split(/\n+/).filter(Boolean),
			footer: "Please help keep the group useful, respectful and comfortable for everyone.",
		}));
	}

	if (!["set", "reset"].includes(action)) return reply("❌ Usage: `rules` | `rules set <text>` | `rules reset`");
	if (!isGroupAdmin && !isOwner) return reply("❌ Only a group admin can change the rules.");
	if (action === "reset") {
		await group.updateOne({ _id: from }, { $set: { rules: "" } });
		return reply("✅ Custom rules cleared. Alpha's professional default rules will be shown instead.");
	}
	const rules = args.slice(1).join(" ").trim().slice(0, 1500);
	if (!rules) return reply("❌ Add the rules after `rules set`.");
	await group.updateOne({ _id: from }, { $set: { rules } });
	return reply("✅ Group rules saved. Members can view them with `rules`.");
};

export default () => ({
	cmd: ["rules"],
	desc: "View or configure professionally formatted group rules",
	usage: "rules | rules set <text> | rules reset",
	handler,
});
