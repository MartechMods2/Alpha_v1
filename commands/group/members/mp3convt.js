import { downloadResolvedMedia } from "../../../utils/mediaInput.js";
import { processAudio } from "../../../utils/mediaStudio.js";
import { runMediaJob } from "../../../utils/mediaJobs.js";

const MAX_INPUT_BYTES = 25 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 25 * 1024 * 1024;

const handler = async (sock, msg, from, _args, msgInfoObj) => {
	const { command, senderJid, sendMessageWTyping } = msgInfoObj;

	try {
		const media = await downloadResolvedMedia(sock, msg, {
			allowedKinds: ["video", "audio"],
			maxBytes: MAX_INPUT_BYTES,
		});

		const audio = await runMediaJob({
			feature: "video2mp3",
			groupJid: from,
			senderJid,
			task: () => processAudio(media.buffer, media.extension, "convert"),
		});

		if (!Buffer.isBuffer(audio) || !audio.length) {
			throw new Error("Audio conversion returned an empty file");
		}
		if (audio.length > MAX_OUTPUT_BYTES) {
			throw new Error("Converted audio is larger than the 25MB WhatsApp-safe limit");
		}

		return sendMessageWTyping(
			from,
			{
				audio,
				mimetype: "audio/mpeg",
				fileName: "Alpha-extracted-audio.mp3",
				ptt: false,
			},
			{ quoted: msg },
		);
	} catch (error) {
		console.error(`Audio extraction ${command} failed:`, error.message);
		return sendMessageWTyping(
			from,
			{
				text: `❌ Audio extraction failed: ${error.message}\n\nReply to a video or audio file you own or are allowed to convert, then use the command again.`,
			},
			{ quoted: msg },
		);
	}
};

export default () => ({
	cmd: ["mp3", "mp4audio", "tomp3", "video2mp3", "extractaudio", "audioextract"],
	desc: "Extract or convert a sent/replied video or audio file to WhatsApp-ready MP3",
	usage: "reply to your video/audio with mp3 | video2mp3 | extractaudio",
	handler,
});
