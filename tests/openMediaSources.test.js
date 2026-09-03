import test from "node:test";
import assert from "node:assert/strict";
import openMediaCommand from "../commands/public/openMedia.js";
import { MAX_OPEN_MEDIA_BYTES, openMusicProviderStatus, parseArtistTitle } from "../utils/openMediaSources.js";

test("artist-title queries are parsed without damaging simple searches", () => {
	assert.deepEqual(parseArtistTitle("Asake - Forgiveness"), {
		query: "Asake - Forgiveness",
		artist: "Asake",
		title: "Forgiveness",
	});
	assert.deepEqual(parseArtistTitle("instrumental focus music"), {
		query: "instrumental focus music",
		artist: "",
		title: "instrumental focus music",
	});
});

test("open media commands are public, collision-free and include help", () => {
	const command = openMediaCommand();
	assert.equal(typeof command.handler, "function");
	assert.equal(new Set(command.cmd).size, command.cmd.length);
	for (const name of ["music", "musicfile", "musicdirect", "streammusic", "musicfrom", "naijasong", "afrobeats", "gospelsong", "songpreview", "previewaudio", "songlink", "video", "videofile", "musicvideo", "stockvideo", "lyrics", "syncedlyrics", "musicartist", "trackinfo", "naijacharts", "albumart", "file", "mediahelp", "mediasources", "mediatest", "providercheck"]) {
		assert.ok(command.cmd.includes(name));
	}
});

test("no-key Nigerian music fallbacks remain available", () => {
	const status = openMusicProviderStatus();
	for (const provider of ["audius", "apple", "deezer", "internetArchive", "lrclib", "musicBrainz", "coverArtArchive"]) {
		assert.equal(status[provider].configured, true);
	}
	assert.equal(status.apple.access, "public");
	assert.equal(status.audiomack.access, "restricted");
});

test("open media download limit remains WhatsApp-safe", () => {
	assert.equal(MAX_OPEN_MEDIA_BYTES, 25 * 1024 * 1024);
});
