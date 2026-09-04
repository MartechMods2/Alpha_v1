import { detectSmartIntent } from "../../utils/smartIntent.js";

const handler = async (sock, msg, from, args, info) => {
	const reply = (text) => info.sendMessageWTyping(from, { text }, { quoted: msg });
	if (info.command === "onboardme") {
		return reply(`👋 *Welcome to Alpha*\n\n- Tell Alpha what you need naturally by mentioning it in a group.\n- Use \`${info.prefix}featurefinder <task>\` to find a command without running it.\n- Choose your style with \`${info.prefix}mytone friendly\`.\n- Save your birthday with \`${info.prefix}birthdayform\`.\n- Open the full menu with \`${info.prefix}menu\`.`);
	}
	if (info.command === "privacycoach") {
		return reply("🔐 *Privacy Coach*\n- Never send passwords, OTPs, session cookies or card details in chat.\n- Use only public IP/domain data for security checks.\n- Get permission before checking someone else's number or system.\n- Remove your birthday with `birthday remove`; reset reply preferences with `resetstyle`.");
	}
	const query = args.join(" ").trim();
	if (!query) return reply(`🧭 Usage: \`${info.prefix}featurefinder download a Nigerian song\``);
	const intent = detectSmartIntent(query, { isGroup: info.isGroup });
	if (!intent) return reply(`🧭 I could not match that yet. Try \`${info.prefix}menu ${query}\` or ask Alpha “which command can ${query}?”`);
	const renderedArgs = intent.args?.length ? ` ${intent.args.join(" ")}` : "";
	return reply(`🧭 Best match: \`${info.prefix}${intent.command}${renderedArgs}\`\n\nThis is only a preview; nothing was executed.`);
};

export default () => ({
	cmd: ["onboardme", "featurefinder", "commandcoach", "privacycoach"],
	desc: "Personal onboarding, safe command discovery and privacy coaching",
	usage: "featurefinder <what you want to do>",
	handler,
});
