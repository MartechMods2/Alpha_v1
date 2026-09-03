import { readFileEfficiently } from "../../utils/file.js";

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { sendMessageWTyping } = msgInfoObj;

	try {
		const imageBuffer = await readFileEfficiently("./assets/donate.png");
		await sendMessageWTyping(
			from,
			{
				image: imageBuffer,
				caption: "Alpha is created and maintained by Martech.\n\nOfficial project: https://github.com/MartechMods2/Alpha_v1",
			},
			{ quoted: msg }
		);
	} catch (err) {
		console.error("Failed to load donation image:", err.message);
		await sendMessageWTyping(
			from,
			{
				text: "Alpha is created and maintained by Martech.\n\nOfficial project: https://github.com/MartechMods2/Alpha_v1",
			},
			{ quoted: msg }
		);
	}
};

export default () => ({
	cmd: ["donate", "donation"],
	desc: "Show Alpha's official creator and project",
	usage: "donate",
	handler,
});
