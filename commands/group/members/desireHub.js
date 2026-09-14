import { formatVibeCheck, generateDesireGame, generateRizzReplies } from "../../../utils/desireHub.js";

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
		return reply(await generateDesireGame({ groupJid: from, type: args.join(" ") }));
	}
};

export default () => ({
	cmd: ["vibecheck", "vibe", "energy", "rizz", "rizzcoach", "game", "desiregame"],
	desc: "Desire Hub vibe check, respectful RIZZ coach and lightweight social game host",
	usage: "vibecheck | rizz <what they said> | game 2truths | game wouldyourather",
	handler,
});
