import dotenv from "dotenv";
dotenv.config();
const GENIUS_ACCESS_SECRET = process.env.GENIUS_ACCESS_SECRET || "";


import Genius from "genius-lyrics";
const Client = new Genius.Client(GENIUS_ACCESS_SECRET);

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { sendMessageWTyping, evv } = msgInfoObj;

	if (!GENIUS_ACCESS_SECRET)
		return sendMessageWTyping(from, { text: "```Genius Access Secret is Missing```" }, { quoted: msg });

	if (!args[0]) return sendMessageWTyping(from, { text: "Enter the song name." }, { quoted: msg });

	let firstSong, lyric;
	try {
		const searches = await Client.songs.search(evv);
		firstSong = searches?.[0];
		if (!firstSong) return sendMessageWTyping(from, {text:"I couldn't find that song. Try its title and artist."}, {quoted:msg});
		lyric = await firstSong.lyrics(true);
	} catch {
		return sendMessageWTyping(from, {text:"The lyrics service is unavailable right now. Please try again shortly."}, {quoted:msg});
	}

	const mess = `🎵 *${firstSong.title}*\n🎤 *Artist:* ${firstSong.artist.name}\n\n*Lyrics:*\n${lyric}`;

	if (lyric) {
		return sendMessageWTyping(from, { text: mess }, { quoted: msg });
	} else {
		return sendMessageWTyping(from, { text: "Lyrics not found." }, { quoted: msg });
	}
};

export default () => ({
	cmd: ["l", "lyric"],
	desc: "Get lyrics of a song",
	usage: "lyric <song name>",
	handler,
});
