import { GROUP_TEMPLATE_KEYS, GROUP_TEMPLATE_META, GROUP_TEMPLATES, groupTemplatePlaceholders } from "../../../utils/groupTemplates.js";
import { alphaPanel } from "../../../utils/alphaStyle.js";

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { sendMessageWTyping } = msgInfoObj;
	const key = String(args[0] || "").toLowerCase();
	if (!key) {
		const categories = [...new Set(GROUP_TEMPLATE_KEYS.map((name) => GROUP_TEMPLATE_META[name]?.category || "other"))];
		return sendMessageWTyping(from, { text: alphaPanel({
			icon: "🧰", title: "Alpha Built-In Template Library",
			lines: [
				`*${GROUP_TEMPLATE_KEYS.length}* professional templates are built into Alpha.`,
				"No manual template setup is required for a new group.", "",
				...categories.map((category) => {
					const keys = GROUP_TEMPLATE_KEYS.filter((name) => GROUP_TEMPLATE_META[name]?.category === category);
					return `*${category.toUpperCase()}*\n${keys.map((name) => `• \`template ${name}\``).join("\n")}`;
				}), "", "Use `automationpack on` to activate the recommended welcome, safety and scheduled automation set.",
			],
			footer: "Custom group welcome/goodbye text still overrides the built-in default when you choose to set one.",
		}) }, { quoted: msg });
	}
	if (!GROUP_TEMPLATES[key]) return sendMessageWTyping(from, { text: `❌ Unknown template. Available: ${GROUP_TEMPLATE_KEYS.join(", ")}.` }, { quoted: msg });
	const placeholders = groupTemplatePlaceholders(key);
	return sendMessageWTyping(from, { text: `🧩 *${GROUP_TEMPLATE_META[key]?.title || key.toUpperCase()}*\n_Category: ${GROUP_TEMPLATE_META[key]?.category || "general"}_\n\n${GROUP_TEMPLATES[key]}\n\n${placeholders.length ? `*Placeholders:* ${placeholders.map((name) => `{${name}}`).join(", ")}` : "*Placeholders:* none"}\n\n✅ This is a built-in Alpha default; you do not need to save it manually.` }, { quoted: msg });
};

export default () => ({
	cmd: ["templates", "template", "grouptemplates"],
	desc: "View Alpha's built-in professional templates for community, moderation, safety, activity and automation",
	usage: "templates | template welcome | template anti-link | template birthday",
	handler,
});
