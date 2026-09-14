import { group } from "../../../db/groupData.js";

const onOff = (value) => value === "on" ? true : value === "off" ? false : null;

const statusText = (data = {}) => `🌚 *DESIRE HUB MODE*\n\n` +
	`Mode: *${data.desireHubEnabled ? "ON" : "OFF"}*\n` +
	`Consent gate: *${data.desireConsentGateEnabled === false ? "OFF" : "ON"}*\n` +
	`Alpha style: *${data.alphaPersonality || "friendly"}*\n` +
	`Reply default: *TEXT*\n` +
	`Tone: *30% teasing · 30% helpful · 40% chaotic*\n\n` +
	`Explicit requests such as “using voice”, “as an image”, or “send a video” override the text default.`;

const handler = async (_sock, msg, from, args, info) => {
	const { sendMessageWTyping } = info;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const current = await group.findOne({ _id: from }).catch(() => null) || {};
	const action = String(args[0] || "status").toLowerCase();

	if (action === "status") return reply(statusText(current));
	if (action === "consent") {
		const value = onOff(String(args[1] || "").toLowerCase());
		if (value === null) return reply("❌ Use `desiremode consent on` or `desiremode consent off`.");
		await group.updateOne({ _id: from }, { $set: { desireConsentGateEnabled: value } });
		return reply(`✅ Desire Hub consent gate turned *${value ? "ON" : "OFF"}*.`);
	}
	const value = onOff(action);
	if (value === null) return reply("❌ Use `desiremode on`, `desiremode off`, `desiremode status`, or `desiremode consent on|off`.");

	if (value) {
		const previous = current.alphaPersonality && current.alphaPersonality !== "desire"
			? current.alphaPersonality
			: current.desirePreviousAlphaPersonality || "funny";
		await group.updateOne({ _id: from }, {
			$set: {
				desireHubEnabled: true,
				desireConsentGateEnabled: current.desireConsentGateEnabled !== false,
				desirePreviousAlphaPersonality: previous,
				alphaPersonality: "desire",
				alphaResponseLength: "short",
			},
		});
		return reply("🌚 Desire Hub mode is *ON*. Alpha is now short, witty, respectful and slightly chaotic. Text stays the default unless a user explicitly asks for voice, image or video.");
	}

	const restore = current.desirePreviousAlphaPersonality || "funny";
	await group.updateOne({ _id: from }, {
		$set: { desireHubEnabled: false, alphaPersonality: current.alphaPersonality === "desire" ? restore : current.alphaPersonality || restore },
	});
	return reply("✅ Desire Hub mode is *OFF*. Existing moderation and automation settings were left untouched.");
};

export default () => ({
	cmd: ["desiremode", "desirehub"],
	desc: "Enable Desire Hub personality, consent guard and smart output routing",
	usage: "desiremode on | desiremode off | desiremode status | desiremode consent on",
	handler,
});
