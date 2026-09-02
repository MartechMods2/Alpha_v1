import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { constants as youtubeDlConstants, create } from "youtube-dl-exec";
import ffmpegStatic from "ffmpeg-static";

const execFileAsync = promisify(execFile);
const BOOTSTRAP_DIR = process.env.YTDLP_BOOTSTRAP_DIR || path.join(os.tmpdir(), "alpha-media-tools");
const BOOTSTRAP_PATH = path.join(BOOTSTRAP_DIR, process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");
const MAX_BINARY_BYTES = 80 * 1024 * 1024;
const PROBE_TIMEOUT_MS = 8_000;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const CLIENT_PREFERENCE_TTL_MS = 10 * 60_000;
const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_POT_PROVIDER_HOME = path.join(APP_ROOT, "vendor", "bgutil-ytdlp-pot-provider");
const DEFAULT_POT_PLUGIN_PATH = path.join(DEFAULT_POT_PROVIDER_HOME, "yt-dlp-plugins");

const PUBLIC_YOUTUBE_PROFILES = Object.freeze([
	{ id: "default", label: "public default", extractorArgs: null },
	{ id: "android_vr", label: "public Android VR", extractorArgs: "youtube:player_client=android_vr" },
	{ id: "web_safari", label: "public Safari HLS", extractorArgs: "youtube:player_client=web_safari" },
	{ id: "web_embedded", label: "public embedded", extractorArgs: "youtube:player_client=web_embedded" },
]);
const COOKIE_YOUTUBE_PROFILE = Object.freeze({
	id: "cookie_default_embedded",
	label: "cookie default + embedded",
	extractorArgs: "youtube:player_client=default,web_embedded",
	usesCookies: true,
});

export function getPoTokenProviderStatus() {
	const home = path.resolve(process.env.YTDLP_POT_PROVIDER_HOME || DEFAULT_POT_PROVIDER_HOME);
	const pluginPath = path.resolve(process.env.YTDLP_POT_PLUGIN_PATH || DEFAULT_POT_PLUGIN_PATH);
	const scriptReady = fs.existsSync(path.join(home, "build", "generate_once.js"));
	let pluginReady = false;
	let pluginDirectory = null;
	try {
		const pluginStat = fs.statSync(pluginPath);
		pluginReady = pluginStat.isDirectory()
			? fs.existsSync(path.join(pluginPath, "yt_dlp_plugins", "extractor", "getpot_bgutil_script.py"))
			: pluginStat.isFile();
		if (pluginReady) pluginDirectory = path.dirname(pluginPath);
	} catch {
		// A disappearing or unreadable plugin path is handled by the readiness result.
	}
	return {
		ready: scriptReady && pluginReady,
		home,
		pluginPath,
		pluginDirectory,
		version: String(process.env.YTDLP_POT_PROVIDER_VERSION || "1.3.2").slice(0, 40),
		reason: scriptReady && pluginReady
			? "on-demand"
			: !scriptReady && !pluginReady
				? "provider and plugin are missing"
				: !scriptReady ? "provider script is missing" : "yt-dlp plugin is missing",
	};
}

let resolvedBinary = null;
let resolvingBinary = null;
let resolvedJsRuntime = null;
let preferredPublicProfile = null;

const executableAsset = () => {
	if (process.platform === "linux") {
		if (process.arch === "arm64") return "yt-dlp_linux_aarch64";
		if (process.arch === "x64") return "yt-dlp_linux";
	}
	if (process.platform === "darwin") return "yt-dlp_macos";
	if (process.platform === "win32") return "yt-dlp.exe";
	return "yt-dlp";
};

const probe = async (candidate) => {
	if (!candidate) return null;
	try {
		const { stdout, stderr } = await execFileAsync(candidate, ["--version"], {
			timeout: PROBE_TIMEOUT_MS,
			maxBuffer: 256 * 1024,
			windowsHide: true,
		});
		const version = String(stdout || stderr).trim().split(/\r?\n/)[0].slice(0, 80);
		return { path: candidate, version };
	} catch {
		return null;
	}
};

const configuredCandidates = () => [
	process.env.YTDLP_PATH,
	youtubeDlConstants?.YOUTUBE_DL_PATH,
	"yt-dlp",
	BOOTSTRAP_PATH,
].filter(Boolean);

const downloadOfficialBinary = async () => {
	if (process.env.YTDLP_AUTO_INSTALL === "false") {
		throw new Error("yt-dlp is missing and automatic installation is disabled");
	}

	await fs.promises.mkdir(BOOTSTRAP_DIR, { recursive: true, mode: 0o700 });
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
	const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${executableAsset()}`;
	const temporaryPath = `${BOOTSTRAP_PATH}.${process.pid}.download`;
	try {
		const response = await fetch(url, {
			signal: controller.signal,
			headers: { "user-agent": "Alpha-v1 media runtime" },
			redirect: "follow",
		});
		if (!response.ok) throw new Error(`official download returned HTTP ${response.status}`);
		const declaredSize = Number(response.headers.get("content-length") || 0);
		if (declaredSize > MAX_BINARY_BYTES) throw new Error("official binary is unexpectedly large");
		const binary = Buffer.from(await response.arrayBuffer());
		if (binary.length < 500_000 || binary.length > MAX_BINARY_BYTES) {
			throw new Error("official binary failed its size validation");
		}
		await fs.promises.writeFile(temporaryPath, binary, { mode: 0o700 });
		await fs.promises.chmod(temporaryPath, 0o700);
		const validation = await probe(temporaryPath);
		if (!validation) throw new Error("downloaded yt-dlp binary did not execute");
		await fs.promises.rename(temporaryPath, BOOTSTRAP_PATH);
		return { path: BOOTSTRAP_PATH, version: validation.version, source: "official bootstrap" };
	} finally {
		clearTimeout(timer);
		await fs.promises.unlink(temporaryPath).catch(() => {});
	}
};

export async function ensureYtDlp({ allowDownload = true, refresh = false } = {}) {
	if (refresh) resolvedBinary = null;
	if (resolvedBinary) return resolvedBinary;
	if (resolvingBinary) return resolvingBinary;

	resolvingBinary = (async () => {
		for (const candidate of configuredCandidates()) {
			const result = await probe(candidate);
			if (result) {
				const source = candidate === process.env.YTDLP_PATH
					? "configured"
					: candidate === youtubeDlConstants?.YOUTUBE_DL_PATH
						? "bundled"
						: candidate === BOOTSTRAP_PATH
							? "official bootstrap"
							: "system";
				return { ...result, source };
			}
		}
		if (!allowDownload) return null;
		return downloadOfficialBinary();
	})();

	try {
		resolvedBinary = await resolvingBinary;
		return resolvedBinary;
	} finally {
		resolvingBinary = null;
	}
}

const majorVersion = (value) => Number(String(value || "").match(/v?(\d+)/)?.[1] || 0);

export async function resolveYtDlpJsRuntime() {
	if (resolvedJsRuntime) return resolvedJsRuntime;
	try {
		const { stdout } = await execFileAsync("node", ["--version"], { timeout: 3_000, windowsHide: true });
		if (majorVersion(stdout) >= 22) return (resolvedJsRuntime = "node");
	} catch {
		// Fall through to the runtime hosting the bot.
	}
	if (process.versions?.bun) return (resolvedJsRuntime = `bun:${process.execPath}`);
	if (majorVersion(process.versions?.node) >= 22) return (resolvedJsRuntime = `node:${process.execPath}`);
	return null;
}

export async function buildYtDlpOptions(extra = {}) {
	const jsRuntime = await resolveYtDlpJsRuntime();
	return {
		noPlaylist: true,
		noWarnings: true,
		retries: 3,
		fragmentRetries: 3,
		concurrentFragments: 1,
		socketTimeout: 25,
		ffmpegLocation: process.env.FFMPEG_PATH || ffmpegStatic || "ffmpeg",
		...(jsRuntime ? { jsRuntimes: jsRuntime } : {}),
		...extra,
	};
}

export async function runYtDlp(target, options = {}) {
	const binary = await ensureYtDlp();
	if (!binary?.path) throw new Error("YT_DLP_MISSING: yt-dlp is not installed");
	return create(binary.path)(target, options);
}

const rawYtDlpError = (error) => String(error?.stderr || error?.message || error || "").toLowerCase();

export function youtubePublicProfiles(preferredId = null, explicitExtractorArgs = null, poProviderHome = null, poPluginDirectory = null) {
	if (explicitExtractorArgs) {
		return [{ id: "custom", label: "custom YouTube client", extractorArgs: explicitExtractorArgs }];
	}
	const profiles = PUBLIC_YOUTUBE_PROFILES.map((profile) => ({ ...profile }));
	if (poProviderHome) {
		profiles.splice(1, 0, {
			id: "mweb_pot",
			label: "public mweb + local PO token",
			extractorArgs: [
				"youtube:player_client=mweb",
				`youtubepot-bgutilscript:server_home=${poProviderHome}`,
			],
			...(poPluginDirectory ? { pluginDirs: poPluginDirectory } : {}),
		});
	}
	if (!preferredId) return profiles;
	return profiles.sort((left, right) => Number(right.id === preferredId) - Number(left.id === preferredId));
}

export function shouldRetryWithAlternateClient(error) {
	const message = rawYtDlpError(error);
	if (message.includes("http error 429") || message.includes("too many requests")) return false;
	return message.includes("sign in")
		|| message.includes("not a bot")
		|| message.includes("login required")
		|| message.includes("age-restricted")
		|| message.includes("age restricted")
		|| message.includes("http error 403")
		|| message.includes("forbidden")
		|| message.includes("requested format is not available")
		|| message.includes("no video formats")
		|| message.includes("only images are available")
		|| message.includes("page needs to be reloaded");
}

export function shouldRetryWithCookies(error) {
	const message = rawYtDlpError(error);
	if (message.includes("http error 429") || message.includes("too many requests")) return false;
	return message.includes("sign in")
		|| message.includes("not a bot")
		|| message.includes("login required")
		|| message.includes("age-restricted")
		|| message.includes("age restricted")
		|| message.includes("http error 403")
		|| message.includes("forbidden")
		|| message.includes("page needs to be reloaded");
}

const optionsForProfile = (options, profile, cookiePath = null) => {
	const next = { ...options };
	delete next.cookies;
	if (profile.extractorArgs) next.extractorArgs = profile.extractorArgs;
	else delete next.extractorArgs;
	if (profile.pluginDirs) next.pluginDirs = profile.pluginDirs;
	if (profile.usesCookies && cookiePath) next.cookies = cookiePath;
	return next;
};

const annotateFinalError = (error, attempts, { cookieAttempted = false, publicError = null } = {}) => {
	error.alphaYoutubeAttempts = attempts.map((attempt) => attempt.label);
	error.alphaCookieAttempted = cookieAttempted;
	if (publicError) error.alphaPublicError = publicError;
	return error;
};

async function adaptiveYtDlpAttempt(target, options = {}) {
	const preferredId = preferredPublicProfile?.expires > Date.now() ? preferredPublicProfile.id : null;
	const poProvider = getPoTokenProviderStatus();
	const profiles = youtubePublicProfiles(
		preferredId,
		options.extractorArgs,
		poProvider.ready ? poProvider.home : null,
		poProvider.ready ? poProvider.pluginDirectory : null,
	);
	const attempts = [];
	let lastPublicError = null;

	for (const profile of profiles) {
		attempts.push(profile);
		try {
			const result = await runYtDlp(target, optionsForProfile(options, profile));
			if (profile.id !== "custom") {
				preferredPublicProfile = { id: profile.id, expires: Date.now() + CLIENT_PREFERENCE_TTL_MS };
			}
			return { result, authMode: profile.label, profile: profile.id };
		} catch (error) {
			lastPublicError = error;
			if (!shouldRetryWithAlternateClient(error)) {
				throw annotateFinalError(error, attempts);
			}
		}
	}

	const { getCookiePath } = await import("../functions/cookieManager.js");
	const cookiePath = await getCookiePath().catch(() => null);
	if (!cookiePath || !shouldRetryWithCookies(lastPublicError)) {
		throw annotateFinalError(lastPublicError, attempts);
	}

	attempts.push(COOKIE_YOUTUBE_PROFILE);
	try {
		return {
			result: await runYtDlp(target, optionsForProfile(options, COOKIE_YOUTUBE_PROFILE, cookiePath)),
			authMode: COOKIE_YOUTUBE_PROFILE.label,
			profile: COOKIE_YOUTUBE_PROFILE.id,
		};
	} catch (cookieError) {
		throw annotateFinalError(cookieError, attempts, { cookieAttempted: true, publicError: lastPublicError });
	}
}

/** Public access first; saved account cookies are used only when authentication is required. */
export async function runYtDlpAdaptive(target, options = {}) {
	return (await adaptiveYtDlpAttempt(target, options)).result;
}

export async function probeYoutubeAccess(target = "https://www.youtube.com/watch?v=jNQXAC9IVRw") {
	if (!isYouTubeUrl(target)) throw new Error("The live-test target must be a secure YouTube URL");
	const options = await buildYtDlpOptions({ dumpSingleJson: true, skipDownload: true });
	const { result, authMode } = await adaptiveYtDlpAttempt(target, options);
	return {
		authMode,
		title: String(result?.title || "Public YouTube video").slice(0, 100),
		duration: Number(result?.duration || 0),
	};
}

export const isYouTubeUrl = (value) => {
	try {
		const url = new URL(String(value || ""));
		const host = url.hostname.toLowerCase().replace(/^www\./, "");
		return url.protocol === "https:" && ["youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"].includes(host);
	} catch {
		return false;
	}
};

export function describeYtDlpError(error) {
	const message = rawYtDlpError(error);
	if (message.includes("yt_dlp_missing") || message.includes("yt-dlp is missing") || message.includes("enoent")) {
		return "The download engine is missing. Ask the bot owner to run -downloadhealth.";
	}
	if (message.includes("cookie") && (message.includes("invalid") || message.includes("parse"))) {
		return "The saved YouTube cookie file is invalid. Replace it with a fresh Netscape cookies.txt export.";
	}
	if (message.includes("sign in to confirm") || message.includes("not a bot") || message.includes("confirm you’re not a bot") || message.includes("confirm you're not a bot")) {
		const poAttempted = error?.alphaYoutubeAttempts?.some((attempt) => String(attempt).includes("local PO token"));
		return error?.alphaCookieAttempted
			? `YouTube rejected every safe public client${poAttempted ? ", the local PO-token provider," : ""} and the current cookie-client workaround. This deployment IP remains challenged; replacing the same cookies repeatedly will not fix it.`
			: "YouTube challenged public access and no usable cookie fallback was available.";
	}
	if (message.includes("http error 429") || message.includes("too many requests")) {
		return "YouTube temporarily rate-limited this server. Wait before trying again; do not repeat the command rapidly.";
	}
	if (message.includes("http error 403") || message.includes("forbidden")) {
		return "YouTube refused the media stream. The cookie may be stale, or this video may require additional verification.";
	}
	if (message.includes("age-restricted") || message.includes("age restricted")) {
		return "This video is age-restricted and needs a valid dedicated-account cookie.";
	}
	if (message.includes("private video") || message.includes("video unavailable") || message.includes("is unavailable")) {
		return "The video is private, unavailable or blocked in the server’s region.";
	}
	if (message.includes("requested format is not available")) {
		return "The requested audio/video format is unavailable. Try another video.";
	}
	return "The download failed. Try a different public YouTube link or a more specific search.";
}
