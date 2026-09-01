import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const configured = (...names) => names.every((name) => Boolean(String(process.env[name] || "").trim()));

export const FEATURE_REQUIREMENTS = [
	{ name: "Core bot and database", commands: "all commands", env: ["MONGODB_KEY", "SESSION_SECRET", "MY_NUMBER", "PREFIX"], required: true },
	{ name: "Bot self-message filter", commands: "prevents processing the bot's own messages", env: ["BOT_NUMBER"] },
	{ name: "Dashboard password login", commands: "admin dashboard", env: ["ADMIN_PASSWORD"] },
	{ name: "Alpha AI text", commands: "alpha, tagged replies, AI tools", any: [["NVIDIA_API_KEY"], ["GOOGLE_API_KEY"]] },
	{ name: "Gemini media understanding", commands: "transcribe, voicesummary, voicetranslate, autocaption, Alpha image/document/voice", env: ["GOOGLE_API_KEY"] },
	{ name: "Google web and image search", commands: "search, gs, img", env: ["GOOGLE_API_KEY_SEARCH", "SEARCH_ENGINE_KEY"] },
	{ name: "Background removal", commands: "removebg, bg, cutoutsticker, replacebg, passport", env: ["REMOVE_BG_KEY"] },
	{ name: "Lyrics", commands: "lyric, l", env: ["GENIUS_ACCESS_SECRET"] },
	{ name: "Twitter/X video", commands: "twitter, tw, x", env: ["TWITTER_BEARER_TOKEN"] },
	{ name: "Truecaller lookup", commands: "true, truecaller (legacy India-only; privacy-sensitive)", env: ["TRUECALLER_ID"], discouraged: true },
	{ name: "Telegram owner alerts", commands: "runtime owner alerts", env: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"] },
	{ name: "Google dashboard login", commands: "dashboard OAuth", env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_ALLOWED_EMAILS", "HOST_URL"] },
	{ name: "Redis cache", commands: "shared cache across instances", any: [["REDIS_URL"], ["REDIS_HOST", "REDIS_PASSWORD"]] },
	{ name: "Encrypted backups", commands: "backup, backupstatus", env: ["BACKUP_ENCRYPTION_KEY"] },
	{ name: "S3-compatible off-site storage", commands: "backup, storagehealth", env: ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] },
	{ name: "Signed webhooks", commands: "webhookadmin", env: ["OUTBOUND_WEBHOOK_URL", "OUTBOUND_WEBHOOK_SECRET"] },
	{ name: "External cited fact-check", commands: "webfactcheck", env: ["FACTCHECK_API_URL"] },
];

export const requirementReady = (entry) => entry.env
	? configured(...entry.env)
	: entry.any.some((option) => configured(...option));

export const missingForRequirement = (entry) => {
	if (entry.env) return entry.env.filter((name) => !configured(name));
	if (requirementReady(entry)) return [];
	return entry.any.map((option) => option.join(" + "));
};

export const checkBinary = async (command, args = ["--version"]) => {
	try {
		const { stdout, stderr } = await execFileAsync(command, args, { timeout: 5_000, maxBuffer: 256 * 1024 });
		return { ready: true, detail: String(stdout || stderr).split(/\r?\n/)[0].slice(0, 160) };
	} catch (error) {
		return { ready: false, detail: error.code === "ENOENT" ? "not installed" : String(error.message).slice(0, 160) };
	}
};

export const auditRuntimeTools = async ({ youtubeCookies = false } = {}) => {
	const checks = await Promise.all([
		checkBinary(process.env.FFMPEG_PATH || "ffmpeg", ["-version"]),
		checkBinary(process.env.YTDLP_PATH || "yt-dlp", ["--version"]),
		checkBinary("tesseract", ["--version"]),
		checkBinary("qrencode", ["--version"]),
		checkBinary("zbarimg", ["--version"]),
		checkBinary("img2pdf", ["--version"]),
		checkBinary("pdftoppm", ["-v"]),
		checkBinary("gs", ["--version"]),
		checkBinary("clamscan", ["--version"]),
	]);
	const names = ["FFmpeg", "yt-dlp", "Tesseract OCR", "QR encoder", "QR reader", "image-to-PDF", "PDF tools", "Ghostscript", "ClamAV"];
	return {
		binaries: names.map((name, index) => ({ name, ...checks[index], optional: name === "ClamAV" })),
		youtubeCookies,
	};
};
