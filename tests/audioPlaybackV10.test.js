import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import openMediaCommand from "../commands/public/openMedia.js";
import {
	rankYouTubeMusicCandidates,
	scoreAudioCandidate,
	scoreYouTubeMusicCandidate,
	selectBestAudioCandidate,
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

test("audio-provider matching rejects unrelated Jamendo-style results", () => {
	const reference = {
		title: "Asake - Forgiveness (Official Video)",
		artist: "Asake",
		url: "https://www.youtube.com/watch?v=example",
	};
	const wrong = {
		title: "Fury",
		artist: "Blindmoore",
		source: "Jamendo",
		fullLength: true,
	};
	const correct = {
		title: "Forgiveness",
		artist: "Asake",
		source: "Apple Music preview",
		fullLength: false,
	};
	assert.equal(scoreAudioCandidate(wrong, "Asake - Forgiveness", reference), 0);
	assert.ok(scoreAudioCandidate(correct, "Asake - Forgiveness", reference) >= 0.9);
	assert.equal(
		selectBestAudioCandidate([wrong, correct], "Asake - Forgiveness", reference)?.title,
		"Forgiveness",
	);
});

test("natural artist-title searches still accept the correct provider track", () => {
	const candidate = {
		title: "Forgiveness",
		artist: "Asake",
		source: "Audius",
		fullLength: true,
	};
	assert.ok(scoreAudioCandidate(candidate, "Asake Forgiveness") >= 0.8);
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
	assert.ok(command.cmd.includes("playfull"));
	assert.ok(command.cmd.includes("playpreview"));
	assert.equal(new Set(command.cmd).size, command.cmd.length);

	const source = await readFile(new URL("../commands/public/openMedia.js", import.meta.url), "utf8");
	assert.match(source, /searchOfficialYouTubeVideo/);
	assert.match(source, /findWhatsAppFullAudio\(query, youtube\)/);
	assert.match(source, /findWhatsAppPreviewAudio\(query, youtube\)/);
	assert.doesNotMatch(source, /findWhatsAppPlayableAudio\(query, youtube\)/);
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


test("playy no longer silently sends a short provider preview", async () => {
	const source = await readFile(new URL("../commands/public/openMedia.js", import.meta.url), "utf8");
	assert.match(source, /full-track mode/);
	assert.match(source, /playpreview/);
	assert.match(source, /Official preview/);
	assert.match(source, /~\$\{Math\.round\(result\.previewSeconds\)\}s/);
});

test("audio source layer separates full-length and preview providers", async () => {
	const source = await readFile(new URL("../utils/openMediaSources.js", import.meta.url), "utf8");
	assert.match(source, /export const findWhatsAppFullAudio/);
	assert.match(source, /export const findWhatsAppPreviewAudio/);
	assert.match(source, /candidate\?\.fullLength === true/);
	assert.match(source, /candidate\?\.fullLength === false/);
	assert.match(source, /searchArchiveMedia\(query, "audio", reference\)/);
});
