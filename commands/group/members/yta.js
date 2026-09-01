import fs from "fs";
import memoryManager from "../../../utils/memory.js";
import { readFileEfficiently } from "../../../utils/file.js";
import { buildYtDlpOptions, describeYtDlpError, isYouTubeUrl, runYtDlp } from "../../../utils/ytdlp.js";

const getRandom = (ext) => memoryManager.generateTempFileName(ext);

const ytdlpOpts = async (extra = {}) => {
	return buildYtDlpOptions(extra);
};

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { sendMessageWTyping } = msgInfoObj;

	if (!args[0] || !isYouTubeUrl(args[0])) {
		return sendMessageWTyping(from, { text: `❌ *Enter Youtube link*` }, { quoted: msg });
	}

	const fileDown = getRandom(".mp3");

	try {
		await runYtDlp(
			args[0],
			await ytdlpOpts({
				format: "bestaudio/best",
				extractAudio: true,
				audioFormat: "mp3",
				audioQuality: 0,
				output: fileDown,
			})
		);

		if (!fs.existsSync(fileDown)) throw new Error("Audio file was not created");
		console.log("Audio downloaded");

		const audioBuffer = await readFileEfficiently(fileDown);
		await sendMessageWTyping(from, { audio: audioBuffer, mimetype: "audio/mpeg" }, { quoted: msg });
		console.log("Sent");
	} catch (err) {
		console.error("yta error:", err);
		sendMessageWTyping(from, { text: `❌ Download failed. ${describeYtDlpError(err)}` }, { quoted: msg });
	} finally {
		memoryManager.safeUnlink(fileDown);
	}
};

export default () => ({
	cmd: ["yta"],
	desc: "Download youtube audio",
	usage: "yta <youtube link>",
	handler,
});
