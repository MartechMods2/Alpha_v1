import { formatVibeCheck, generateDesireGame, generateRizzReplies } from "../../../utils/desireHub.js";
import { generateSocialGamePrompt } from "../../../utils/socialGameGenerator.js";
import { parseWouldYouRatherPoll } from "../../../utils/alphaPolls.js";

const normalizedGameType = (args = []) => String(args.join(" ") || "").toLowerCase().replace(/[\s_-]+/g, "");

const handler = async (_sock, msg, from, args, msgInfoObj) => {
	const { command, senderJid, sendMessageWTyping } = msgInfoObj;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });

	if (["vibecheck", "vibe", "energy"].includes(command)) {
		return reply(formatVibeCheck(from));
	}
	if (["rizz", "rizzcoach"].includes(command)) {
		return reply(await generateRizzReplies({ groupJid: from, senderJid, context: args.join(" ") }));
	}
	if (["game", "desiregame"].includes(command)) {
		const type = normalizedGameType(args);
		if (["wyr", "wouldyourather"].includes(type)) {
			const prompt = await generateSocialGamePrompt({ groupJid: from, type: "wyr" });
			const poll = parseWouldYouRatherPoll(prompt);
			if (poll) return sendMessageWTyping(from, { poll }, { quoted: msg });
		}
		return reply(await generateDesireGame({ groupJid: from, type: args.join(" ") }));
	}
};

export default () => ({
	cmd: ["vibecheck", "vibe", "energy", "rizz", "rizzcoach", "game", "desiregame"],
	desc: "Desire Hub vibe check, respectful RIZZ coach and social game host with native WYR polls",
	usage: "vibecheck | rizz <what they said> | game 2truths | game wouldyourather",
	handler,
});
