import { formatVibeCheck, generateDesireGame, generateRizzReplies } from "../../../utils/desireHub.js";
import { generateSocialGamePrompt } from "../../../utils/socialGameGenerator.js";
import { parseWouldYouRatherPoll } from "../../../utils/alphaPolls.js";

const normalizedGameType = (args = []) => String(args.join(" ") || "").toLowerCase().replace(/[\s_-]+/g, "");

const handler = async (_sock, msg, from, args, msgInfoObj) => {
	const { command, senderJid, isOwner, groupMetadata, sendMessageWTyping } = msgInfoObj;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	const quotaInput = {
		groupJid: from,
		senderJid,
		memberName: msg?.pushName || "",
		groupMetadata,
		isOwner,
		candidates: [msg?.key?.participantPn, msg?.key?.participantAlt],
	};

	if (["vibecheck", "vibe", "energy"].includes(command)) {
		return reply(formatVibeCheck(from));
	}
	if (["rizz", "rizzcoach"].includes(command)) {
		return reply(await generateRizzReplies({
			groupJid: from,
			senderJid,
			context: args.join(" "),
			groupMetadata,
			isOwner,
			memberName: msg?.pushName || "",
			candidates: [msg?.key?.participantPn, msg?.key?.participantAlt],
		}));
	}
	if (["game", "desiregame"].includes(command)) {
		const type = normalizedGameType(args);
		if (["wyr", "wouldyourather"].includes(type)) {
			const prompt = await generateSocialGamePrompt({ groupJid: from, type: "wyr", quotaInput });
			const poll = parseWouldYouRatherPoll(prompt);
			if (poll) return sendMessageWTyping(from, { poll }, { quoted: msg });
		}
		return reply(await generateDesireGame({ groupJid: from, type: args.join(" "), quotaInput }));
	}
};

export default () => ({
	cmd: ["vibecheck", "vibe", "energy", "rizz", "rizzcoach", "game", "desiregame"],
	desc: "Desire Hub vibe check, respectful RIZZ coach and social game host with native WYR polls",
	usage: "vibecheck | rizz <what they said> | game 2truths | game wouldyourather",
	handler,
});
