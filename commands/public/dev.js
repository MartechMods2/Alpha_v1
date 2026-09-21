const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { sendMessageWTyping } = msgInfoObj;

	const text = `*👨‍💻 Creator — Martech*

Alpha is created and maintained by Martech.
Use the official Alpha interface and support channels for product information.`;

	await sendMessageWTyping(from, { text }, { quoted: msg });
};

export default () => ({
	cmd: ["dev", "developer"],
	desc: "Creator and official project information",
	usage: "dev | developer",
	handler,
});
