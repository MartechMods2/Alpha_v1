import { GROUP_TEMPLATE_KEYS, GROUP_TEMPLATES } from "../../../utils/groupTemplates.js";
import { alphaPanel } from "../../../utils/alphaStyle.js";

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { sendMessageWTyping } = msgInfoObj;
	const key = String(args[0] || "").toLowerCase();
	if (!key) {
		return sendMessageWTyping(from, {
			text: alphaPanel({
				icon: "🧰",
				title: "Alpha Group Starter Pack",
				lines: [
					"Ready-made professional templates for a new community.",
					"",
					...GROUP_TEMPLATE_KEYS.map((name) => `• \`template ${name}\``),
					"",
					"Welcome placeholders already supported by Alpha: {user}, {users}, {group}, {count}.",
				],
				footer: "Use `templates` anytime to reopen this menu.",
			}),
		}, { quoted: msg });
	}
	if (!GROUP_TEMPLATES[key]) {
		return sendMessageWTyping(from, { text: `❌ Unknown template. Available: ${GROUP_TEMPLATE_KEYS.join(", ")}.` }, { quoted: msg });
	}
	return sendMessageWTyping(from, {
		text: `🧩 *${key.toUpperCase()} TEMPLATE*\n\n${GROUP_TEMPLATES[key]}\n\n_Edit the placeholders to suit your group._`,
	}, { quoted: msg });
};

export default () => ({
	cmd: ["templates", "template", "grouptemplates"],
	desc: "Professional starter templates for welcome, rules, birthdays, warnings, games and group automation",
	usage: "templates | template welcome | template rules",
	handler,
});
