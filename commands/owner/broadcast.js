const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { sendMessageWTyping } = msgInfoObj;
	return sendMessageWTyping(from, {
		text: "🛡️ All-group broadcast is disabled for account safety. Use the admin dashboard's custom broadcast picker (maximum three explicitly selected groups per hour), or use `schedulepost` inside one group.",
	}, { quoted: msg });
};

export default () => ({
	cmd: ["bb", "broadcast"],
	desc: "Explain the account-safe alternatives to all-group broadcasting",
	usage: "broadcast",
	handler,
});
