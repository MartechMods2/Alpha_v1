import fs from "fs";
import os from "os";
import path from "path";
import mdClient from "../db/client.js";
import { normalizeCookies } from "../utils/youtubeCookies.js";

const TEMP_PATH = path.join(os.tmpdir(), "ytdlp-cookies.txt");
const col = () => mdClient.db("MyBotDataDB").collection("AuthTable");

// Three states: null = not loaded yet, false = no cookies, string = file path
let _cachedPath = null;
let _cachedStatus = null;

async function _writeTemp(content) {
	fs.writeFileSync(TEMP_PATH, content, "utf8");
	return TEMP_PATH;
}

/** Returns file path for yt-dlp --cookies, or null if none configured. */
export async function getCookiePath() {
	if (process.env.YTDLP_COOKIES) {
		try {
			const parsed = normalizeCookies(await fs.promises.readFile(process.env.YTDLP_COOKIES, "utf8"));
			_cachedStatus = { configured: true, source: "environment file", ...parsed, content: undefined };
			if (!parsed.valid) return null;
			_cachedPath = await _writeTemp(parsed.content);
			return _cachedPath;
		} catch (error) {
			_cachedStatus = { configured: true, valid: false, count: 0, source: "environment file", reason: error.code === "ENOENT" ? "Configured cookie file was not found" : "Configured cookie file could not be read" };
			return null;
		}
	}
	if (_cachedPath !== null) return _cachedPath || null;

	try {
		const doc = await col().findOne({ _id: "bot" }, { projection: { ytdlp_cookies: 1 } });
		const content = doc?.ytdlp_cookies?.trim();
		if (content) {
			const parsed = normalizeCookies(content);
			_cachedStatus = { configured: true, source: "dashboard", ...parsed, content: undefined };
			_cachedPath = parsed.valid ? await _writeTemp(parsed.content) : false;
		} else {
			_cachedStatus = { configured: false, valid: false, count: 0, source: "none", reason: "No cookies configured" };
			_cachedPath = false;
		}
	} catch (error) {
		_cachedStatus = { configured: false, valid: false, count: 0, source: "database", reason: String(error.message || "Cookie database could not be read").slice(0, 160) };
		_cachedPath = false;
	}
	return _cachedPath || null;
}

/** Save new cookies content to DB + temp file. Pass empty string to clear. */
export async function saveCookies(content) {
	const trimmed = (content || "").trim();
	if (trimmed) {
		const parsed = normalizeCookies(trimmed);
		if (!parsed.valid) {
			const error = new Error(parsed.reason);
			error.code = "INVALID_COOKIE_FILE";
			throw error;
		}
		await col().updateOne({ _id: "bot" }, { $set: { ytdlp_cookies: parsed.content } }, { upsert: true });
		_cachedPath = await _writeTemp(parsed.content);
		_cachedStatus = { configured: true, valid: true, count: parsed.count, source: "dashboard", reason: "" };
	} else {
		await col().updateOne({ _id: "bot" }, { $set: { ytdlp_cookies: "" } }, { upsert: true });
		try { fs.unlinkSync(TEMP_PATH); } catch { /* already gone */ }
		_cachedPath = false;
		_cachedStatus = { configured: false, valid: false, count: 0, source: "none", reason: "No cookies configured" };
	}
}

/** Returns metadata only; never returns cookie values. */
export async function getCookieStatus() {
	await getCookiePath();
	return _cachedStatus || { configured: false, valid: false, count: 0, source: "none", reason: "No cookies configured" };
}
