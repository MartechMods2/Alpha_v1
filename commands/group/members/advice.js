import axios from "axios";

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { sendMessageWTyping } = msgInfoObj;
	try {
		const res = await axios(`https://api.adviceslip.com/advice`);
		sendMessageWTyping(from, { text: `💭 *Advice*\n\n_${res.data.slip.advice}_` }, { quoted: msg });
	} catch (error) {
		console.error("Error in axios request:", error);
		sendMessageWTyping(from, { text: error.toString() }, { quoted: msg });
	}
};

export default () => ({
	cmd: ["advice"],
	desc: "Get random advice from advice slip api",
	usage: "advice",
	handler,
});
