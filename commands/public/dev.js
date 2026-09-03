const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { sendMessageWTyping } = msgInfoObj;

	const text = `*👨‍💻 Creator — Martech*

╭───────────────────────────
│ *🔗 GitHub*
│ github.com/MartechMods2
│
│ *🤖 Project*
│ github.com/MartechMods2/Alpha_v1
╰───────────────────────────`;

	await sendMessageWTyping(from, { text }, { quoted: msg });
};

export default () => ({
	cmd: ["dev", "developer"],
	desc: "Creator and official project information",
	usage: "dev | developer",
	handler,
});
