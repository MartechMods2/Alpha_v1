import { checkForUpdate } from "../../utils/updateChecker.js";

const handler = async (sock, msg, from, args, info) => {
	const reply = (text) => info.sendMessageWTyping(from, { text }, { quoted: msg });
	try {
		const status = await checkForUpdate();
		const state = !status.current ? "DEPLOYED COMMIT UNKNOWN" : status.updateAvailable ? "UPDATE AVAILABLE" : "UP TO DATE";
		return reply(
			`🔄 *Safe Update Check*\nStatus: *${state}*\nCurrent: \`${status.current?.slice(0, 8) || "not exposed"}\`\nLatest main: \`${status.latest?.slice(0, 8) || "unknown"}\`\nChange: ${status.message}\n\nAlpha never downloads or executes code by itself. Review CI/CodeQL and deploy approved main-branch changes through Render.`,
		);
	} catch (error) {
		return reply(`❌ Update check failed: ${error.message}`);
	}
};

export default () => ({
	cmd: ["upgradecheck", "updatecheck", "updatestatus"],
	desc: "Safely compare this deployment with the latest approved main commit",
	usage: "upgradecheck",
	handler,
});
