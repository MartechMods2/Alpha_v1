const cooldowns = new Map();

const clean = (value, limit) =>
	String(value || "").replace(/[\r\n\t]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { senderJid, sendMessageWTyping } = msgInfoObj;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const now = Date.now();
	if ((cooldowns.get(senderJid) || 0) > now) return;

	const parts = args.join(" ").split("|").map((part) => part.trim()).filter(Boolean);
	const name = clean(parts.shift(), 200);
	const values = [...new Set(parts.map((part) => clean(part, 80)))].filter(Boolean).slice(0, 8);
	if (!name || values.length < 2) {
		return reply("📊 Usage: `poll Question | Option 1 | Option 2` (2–8 choices)");
	}
	cooldowns.set(senderJid, now + 30_000);
	if (cooldowns.size > 2000) {
		for (const [key, expires] of cooldowns) if (expires <= now) cooldowns.delete(key);
	}
	return sendMessageWTyping(
		from,
		{ poll: { name, values, selectableCount: 1 } },
		{ quoted: msg },
	);
};

export default () => ({
	cmd: ["poll", "vote"],
	desc: "Create a native WhatsApp group poll",
	usage: "poll Question | Option 1 | Option 2",
	handler,
});
