import test from "node:test";
import assert from "node:assert/strict";
import openMediaCommand from "../commands/public/openMedia.js";
import { MAX_OPEN_MEDIA_BYTES, parseArtistTitle } from "../utils/openMediaSources.js";

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
	for (const name of ["music", "musicfile", "video", "videofile", "lyrics", "file", "mediahelp", "mediasources"]) {
		assert.ok(command.cmd.includes(name));
	}
});

test("open media download limit remains WhatsApp-safe", () => {
	assert.equal(MAX_OPEN_MEDIA_BYTES, 25 * 1024 * 1024);
});

