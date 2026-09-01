import axios from "axios";
import * as cheerio from "cheerio";

const handler = async (_sock, msg, from, args, msgInfoObj) => {
	const { sendMessageWTyping } = msgInfoObj;
	const username = String(args[0] || "").replace(/^@/, "").trim();
	if (!/^[a-z0-9._]{1,30}$/i.test(username)) return sendMessageWTyping(from, { text: "❌ Usage: `idp <public Instagram username>`." }, { quoted: msg });

	try {
		const response = await axios.get(`https://www.instagram.com/${encodeURIComponent(username)}/`, {
			timeout: 10_000,
			maxContentLength: 2 * 1024 * 1024,
			headers: { "User-Agent": "Mozilla/5.0 (compatible; AlphaBot/1.0)", Accept: "text/html" },
		});
		const $ = cheerio.load(response.data);
		const imageUrl = $('meta[property="og:image"]').attr("content");
		if (!imageUrl) throw new Error("public profile image was not published");
		return sendMessageWTyping(from, { image: { url: imageUrl }, caption: `Public profile picture for *@${username}*` }, { quoted: msg });
	} catch (error) {
		console.error("Public Instagram profile lookup failed:", error.message);
		return sendMessageWTyping(from, { text: "❌ I could not retrieve a public profile picture. Private profiles and login-only data are not accessed." }, { quoted: msg });
	}
};

export default () => ({
	cmd: ["idp", "dp"],
	desc: "Get a publicly published Instagram profile picture without stored cookies",
	usage: "idp | dp <public username>",
	handler,
});
