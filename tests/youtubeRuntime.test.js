import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const { normalizeCookies } = await import("../utils/youtubeCookies.js");
const { describeYtDlpError, ensureYtDlp, isYouTubeUrl } = await import("../utils/ytdlp.js");

test("cookie validator accepts and minimizes a Netscape YouTube export", () => {
	const input = [
		"# Netscape HTTP Cookie File",
		".youtube.com\tTRUE\t/\tTRUE\t1893456000\tSID\tsecret-one",
		".unrelated.example\tTRUE\t/\tTRUE\t1893456000\tSID\tsecret-two",
		"#HttpOnly_.google.com\tTRUE\t/\tTRUE\t1893456000\tHSID\tsecret-three",
	].join("\r\n");
	const result = normalizeCookies(input);
	assert.equal(result.valid, true);
	assert.equal(result.count, 2);
	assert.match(result.content, /^# Netscape HTTP Cookie File\n/);
	assert.match(result.content, /youtube\.com/);
	assert.match(result.content, /google\.com/);
	assert.doesNotMatch(result.content, /unrelated\.example/);
});

test("cookie validator rejects pasted headers and malformed exports", () => {
	const result = normalizeCookies("Cookie: SID=secret; HSID=secret");
	assert.equal(result.valid, false);
	assert.match(result.reason, /first line/i);
});

test("YouTube target validation rejects arbitrary downloader URLs", () => {
	assert.equal(isYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), true);
	assert.equal(isYouTubeUrl("https://youtu.be/dQw4w9WgXcQ"), true);
	assert.equal(isYouTubeUrl("http://youtube.com/watch?v=test"), false);
	assert.equal(isYouTubeUrl("https://youtube.com.example.org/watch?v=test"), false);
	assert.equal(isYouTubeUrl("https://127.0.0.1/private"), false);
});

test("yt-dlp resolver ignores a stale default and accepts a working configured binary", async (t) => {
	if (process.platform === "win32") return t.skip("POSIX executable fixture");
	const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "alpha-ytdlp-test-"));
	const executable = path.join(directory, "yt-dlp");
	await fs.promises.writeFile(executable, "#!/bin/sh\necho 2026.test\n", { mode: 0o700 });
	const previous = process.env.YTDLP_PATH;
	process.env.YTDLP_PATH = executable;
	t.after(async () => {
		if (previous === undefined) delete process.env.YTDLP_PATH;
		else process.env.YTDLP_PATH = previous;
		await fs.promises.rm(directory, { recursive: true, force: true });
	});
	const result = await ensureYtDlp({ allowDownload: false, refresh: true });
	assert.equal(result.path, executable);
	assert.equal(result.version, "2026.test");
	assert.equal(result.source, "configured");
});

test("yt-dlp errors produce useful user-facing diagnoses", () => {
	assert.match(describeYtDlpError(new Error("spawn ENOENT")), /engine is missing/i);
	assert.match(describeYtDlpError(new Error("HTTP Error 429: Too Many Requests")), /rate-limited/i);
	assert.match(describeYtDlpError(new Error("Sign in to confirm you’re not a bot")), /challenged/i);
});
