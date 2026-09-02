import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const { normalizeCookies } = await import("../utils/youtubeCookies.js");
const {
	describeYtDlpError,
	ensureYtDlp,
	getPoTokenProviderStatus,
	isYouTubeUrl,
	shouldRetryWithAlternateClient,
	shouldRetryWithCookies,
	youtubePublicProfiles,
} = await import("../utils/ytdlp.js");

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

test("cookie fallback is limited to authentication failures and never retries rate limits", () => {
	assert.equal(shouldRetryWithCookies(new Error("Sign in to confirm you’re not a bot")), true);
	assert.equal(shouldRetryWithCookies(new Error("HTTP Error 403: Forbidden")), true);
	assert.equal(shouldRetryWithCookies(new Error("This video is age-restricted")), true);
	assert.equal(shouldRetryWithCookies(new Error("Requested format is not available")), false);
	assert.equal(shouldRetryWithCookies(new Error("HTTP Error 429: Too Many Requests")), false);
	assert.equal(shouldRetryWithCookies(new Error("Network is unreachable")), false);
});

test("safe YouTube client fallbacks are bounded and prefer a recently working profile", () => {
	const normal = youtubePublicProfiles();
	assert.deepEqual(normal.map((profile) => profile.id), ["default", "android_vr", "web_safari", "web_embedded"]);
	assert.equal(normal.length, 4);
	assert.equal(normal.some((profile) => profile.usesCookies), false);

	const preferred = youtubePublicProfiles("android_vr");
	assert.equal(preferred[0].id, "android_vr");
	assert.equal(new Set(preferred.map((profile) => profile.id)).size, 4);
});

test("local PO-token profile is added only when its pinned runtime is available", () => {
	const profiles = youtubePublicProfiles(null, null, "/app/vendor/provider", "/app/vendor/provider");
	assert.equal(profiles.length, 5);
	assert.equal(profiles[1].id, "mweb_pot");
	assert.deepEqual(profiles[1].extractorArgs, [
		"youtube:player_client=mweb",
		"youtubepot-bgutilscript:server_home=/app/vendor/provider",
	]);
	assert.equal(profiles[1].pluginDirs, "/app/vendor/provider");
	assert.equal(youtubePublicProfiles().some((profile) => profile.id === "mweb_pot"), false);
});

test("native PO-token workspace is detected and exposes its plugin directory", async (t) => {
	const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "alpha-pot-provider-test-"));
	const home = path.join(directory, "provider");
	const pluginDirectory = path.join(home, "yt-dlp-plugins");
	await fs.promises.mkdir(path.join(home, "build"), { recursive: true });
	await fs.promises.mkdir(path.join(pluginDirectory, "yt_dlp_plugins", "extractor"), { recursive: true });
	await fs.promises.writeFile(path.join(home, "build", "generate_once.js"), "// fixture\n");
	await fs.promises.writeFile(
		path.join(pluginDirectory, "yt_dlp_plugins", "extractor", "getpot_bgutil_script.py"),
		"# fixture\n",
	);
	const previousHome = process.env.YTDLP_POT_PROVIDER_HOME;
	const previousPlugin = process.env.YTDLP_POT_PLUGIN_PATH;
	process.env.YTDLP_POT_PROVIDER_HOME = home;
	process.env.YTDLP_POT_PLUGIN_PATH = pluginDirectory;
	t.after(async () => {
		if (previousHome === undefined) delete process.env.YTDLP_POT_PROVIDER_HOME;
		else process.env.YTDLP_POT_PROVIDER_HOME = previousHome;
		if (previousPlugin === undefined) delete process.env.YTDLP_POT_PLUGIN_PATH;
		else process.env.YTDLP_POT_PLUGIN_PATH = previousPlugin;
		await fs.promises.rm(directory, { recursive: true, force: true });
	});
	const status = getPoTokenProviderStatus();
	assert.equal(status.ready, true);
	assert.equal(status.home, home);
	assert.equal(status.pluginPath, pluginDirectory);
	assert.equal(status.pluginDirectory, home);
});

test("PO-token provider status never treats a partial installation as ready", () => {
	const previousHome = process.env.YTDLP_POT_PROVIDER_HOME;
	const previousPlugin = process.env.YTDLP_POT_PLUGIN_PATH;
	process.env.YTDLP_POT_PROVIDER_HOME = path.join(os.tmpdir(), "alpha-pot-provider-missing");
	process.env.YTDLP_POT_PLUGIN_PATH = path.join(os.tmpdir(), "alpha-pot-plugin-missing.zip");
	try {
		const status = getPoTokenProviderStatus();
		assert.equal(status.ready, false);
		assert.match(status.reason, /missing/i);
	} finally {
		if (previousHome === undefined) delete process.env.YTDLP_POT_PROVIDER_HOME;
		else process.env.YTDLP_POT_PROVIDER_HOME = previousHome;
		if (previousPlugin === undefined) delete process.env.YTDLP_POT_PLUGIN_PATH;
		else process.env.YTDLP_POT_PLUGIN_PATH = previousPlugin;
	}
});

test("explicit extractor settings are respected without multiplying attempts", () => {
	const profiles = youtubePublicProfiles(null, "youtube:player_client=tv");
	assert.deepEqual(profiles, [{
		id: "custom",
		label: "custom YouTube client",
		extractorArgs: "youtube:player_client=tv",
	}]);
});

test("alternate clients are limited to challenge and format failures", () => {
	assert.equal(shouldRetryWithAlternateClient(new Error("No video formats found")), true);
	assert.equal(shouldRetryWithAlternateClient(new Error("The page needs to be reloaded")), true);
	assert.equal(shouldRetryWithAlternateClient(new Error("HTTP Error 429: Too Many Requests")), false);
	assert.equal(shouldRetryWithAlternateClient(new Error("Network is unreachable")), false);
});

test("rejected cookie fallback identifies deployment rejection instead of blaming syntax", () => {
	const error = new Error("Sign in to confirm you’re not a bot");
	error.alphaCookieAttempted = true;
	assert.match(describeYtDlpError(error), /every safe public client.*deployment IP/i);
});
