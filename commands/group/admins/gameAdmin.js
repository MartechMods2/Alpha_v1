import { resetGroupGameScores } from "../../../db/gameData.js";
import { clearActiveGame } from "../members/scoredGames.js";

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { sendMessageWTyping } = msgInfoObj;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	if (String(args[0] || "").toLowerCase() !== "confirm") {
		return reply("⚠️ This permanently clears this group's game scores. Use `gamereset confirm`.");
	}
	const result = await resetGroupGameScores(from);
	clearActiveGame(from);
	return reply(`✅ Game season reset. Cleared *${result.deletedCount || 0}* player records.`);
};

export default () => ({
	cmd: ["gamereset"],
	desc: "Reset this group's game season and leaderboard",
	usage: "gamereset confirm",
	handler,
});
