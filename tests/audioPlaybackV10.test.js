import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import openMediaCommand from "../commands/public/openMedia.js";
import {
	rankYouTubeMusicCandidates,
	scoreYouTubeMusicCandidate,
} from "../utils/openMediaSources.js";

test("official-looking YouTube music pages rank above lyric and fan variants", () => {
	const official = {
		url: "https://www.youtube.com/watch?v=official123",
		title: "Artist - Song (Official Music Video)",
		seconds: 210,
		author: { name: "ArtistVEVO", verified: true },
	};
	const lyric = {
		url: "https://www.youtube.com/watch?v=lyric123",
		title: "Artist - Song Lyrics",
		seconds: 210,
		author: { name: "Lyrics Channel", verified: false },
	};
	assert.ok(scoreYouTubeMusicCandidate(official, "Artist Song") > scoreYouTubeMusicCandidate(lyric, "Artist Song"));
	const ranked = rankYouTubeMusicCandidates([lyric, official], "Artist Song");
	assert.equal(ranked[0].video.url, official.url);
});

test("YouTube music ranking rejects non-YouTube and overlong candidates", () => {
	assert.equal(scoreYouTubeMusicCandidate({ url: "https://example.com/song", title: "Official Music Video" }, "song"), -Infinity);
	assert.equal(scoreYouTubeMusicCandidate({
		url: "https://youtu.be/too-long",
		title: "Song Official Video",
		seconds: 3600,
		author: { name: "Artist" },
	}, "song"), -Infinity);
});

test("playy is public and does not use a YouTube extraction engine", async () => {
	const command = openMediaCommand();
	assert.ok(command.cmd.includes("playy"));
	assert.ok(command.cmd.includes("playaudio"));
	assert.equal(new Set(command.cmd).size, command.cmd.length);

	const source = await readFile(new URL("../commands/public/openMedia.js", import.meta.url), "utf8");
	assert.match(source, /searchOfficialYouTubeVideo/);
	assert.match(source, /findWhatsAppPlayableAudio/);
	assert.doesNotMatch(source, /runYtDlp|youtube-dl-exec|extractAudio/);
});

test("uploaded-media MP3 conversion is explicit and WhatsApp size-bounded", async () => {
	const source = await readFile(new URL("../commands/group/members/mp3convt.js", import.meta.url), "utf8");
	for (const command of ["mp3", "video2mp3", "extractaudio", "audioextract"]) {
		assert.match(source, new RegExp(`"${command}"`));
	}
	assert.match(source, /downloadResolvedMedia/);
	assert.match(source, /processAudio/);
	assert.match(source, /25 \* 1024 \* 1024/);
	assert.doesNotMatch(source, /Math\.random\(\).*\.mp3/);
});
