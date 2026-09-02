import axios from "axios";
import dns from "node:dns/promises";
import { isIP } from "node:net";
import { isPublicIp } from "./passiveOsint.js";

const REQUEST_TIMEOUT_MS = 20_000;
export const MAX_OPEN_MEDIA_BYTES = 25 * 1024 * 1024;

const clean = (value, max = 180) =>
	String(value || "").replace(/[\r\n\t]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

export const parseArtistTitle = (value) => {
	const query = clean(value);
	const separator = query.indexOf(" - ");
	if (separator < 1) return { query, artist: "", title: query };
	return {
		query,
		artist: clean(query.slice(0, separator), 80),
		title: clean(query.slice(separator + 3), 100),
	};
};

const http = axios.create({
	timeout: REQUEST_TIMEOUT_MS,
	maxRedirects: 4,
	headers: { "User-Agent": "AlphaWhatsAppBot/3.0 (MartechMods2/Alpha_v1)" },
});

const normalizeResult = (result) => ({
	...result,
	title: clean(result.title || "Media", 100),
	artist: clean(result.artist || "", 80),
	source: clean(result.source || "Open media", 40),
	license: clean(result.license || "Provider terms apply", 160),
});

export const searchJamendoTrack = async (query, clientId = process.env.JAMENDO_CLIENT_ID) => {
	if (!clientId) return null;
	const { data } = await http.get("https://api.jamendo.com/v3.0/tracks/", {
		params: { client_id: clientId, format: "json", limit: 5, search: clean(query, 120), audioformat: "mp32" },
	});
	const track = data?.results?.find((entry) => entry.audio && entry.audiodownload_allowed !== false);
	if (!track) return null;
	return normalizeResult({
		url: track.audiodownload || track.audio,
		title: track.name,
		artist: track.artist_name,
		mime: "audio/mpeg",
		ext: "mp3",
		source: "Jamendo",
		license: track.license_ccurl || "Jamendo licence",
		fullLength: true,
	});
};

const archiveSearch = async (query, mediaType) => {
	const safeQuery = clean(query, 120).replace(/["(){}\[\]:]/g, " ");
	const q = `(${safeQuery}) AND mediatype:${mediaType} AND licenseurl:*`;
	const { data } = await http.get("https://archive.org/advancedsearch.php", {
		params: { q, fl: "identifier,title,creator,licenseurl", rows: 8, page: 1, output: "json" },
	});
	return data?.response?.docs || [];
};

const archiveFile = async (item, kind) => {
	const { data } = await http.get(`https://archive.org/metadata/${encodeURIComponent(item.identifier)}`);
	const allowed = kind === "audio"
		? /audio\/(mpeg|mp3|mp4|ogg)/i
		: /video\/(mp4|webm)/i;
	const candidates = (data?.files || [])
		.filter((file) => allowed.test(file.mime || "") && Number(file.size || 0) > 0 && Number(file.size) <= MAX_OPEN_MEDIA_BYTES)
		.sort((a, b) => Number(b.source === "original") - Number(a.source === "original") || Number(b.size) - Number(a.size));
	const file = candidates[0];
	if (!file) return null;
	const ext = String(file.name).split(".").pop().toLowerCase().slice(0, 5);
	return normalizeResult({
		url: `https://archive.org/download/${encodeURIComponent(item.identifier)}/${encodeURIComponent(file.name).replace(/%2F/g, "/")}`,
		title: item.title || file.name,
		artist: Array.isArray(item.creator) ? item.creator[0] : item.creator,
		mime: file.mime,
		ext,
		source: "Internet Archive",
		license: item.licenseurl,
		fullLength: true,
	});
};

export const searchArchiveMedia = async (query, kind) => {
	const items = await archiveSearch(query, kind === "audio" ? "audio" : "movies");
	for (const item of items) {
		const result = await archiveFile(item, kind).catch(() => null);
		if (result) return result;
	}
	return null;
};

export const searchApplePreview = async (query, kind = "audio") => {
	const { data } = await http.get("https://itunes.apple.com/search", {
		params: { term: clean(query, 120), media: "music", entity: kind === "video" ? "musicVideo" : "song", limit: 5, country: "NG" },
	});
	const item = data?.results?.find((entry) => entry.previewUrl);
	if (!item) return null;
	return normalizeResult({
		url: item.previewUrl,
		title: item.trackName,
		artist: item.artistName,
		mime: kind === "video" ? "video/mp4" : "audio/mp4",
		ext: "m4a",
		source: "Apple Music preview",
		license: "Official limited preview; Apple terms apply",
		fullLength: false,
	});
};

export const findOpenAudio = async (query) =>
	(await searchJamendoTrack(query).catch(() => null)) ||
	(await searchArchiveMedia(query, "audio").catch(() => null)) ||
	(await searchApplePreview(query, "audio").catch(() => null));

export const searchPexelsVideo = async (query, apiKey = process.env.PEXELS_API_KEY) => {
	if (!apiKey) return null;
	const { data } = await http.get("https://api.pexels.com/v1/videos/search", {
		headers: { Authorization: apiKey, "User-Agent": "AlphaWhatsAppBot/3.0 (MartechMods2/Alpha_v1)" },
		params: { query: clean(query, 120), per_page: 8, orientation: "portrait" },
	});
	for (const video of data?.videos || []) {
		const file = (video.video_files || [])
			.filter((entry) => entry.file_type === "video/mp4" && entry.link && (!entry.width || entry.width <= 1280))
			.sort((a, b) => Number(a.width || 0) - Number(b.width || 0))[0];
		if (!file) continue;
		return normalizeResult({
			url: file.link, title: video.alt || clean(query), artist: video.user?.name,
			mime: "video/mp4", ext: "mp4", source: "Pexels", license: "Pexels licence", fullLength: true,
		});
	}
	return null;
};

export const findOpenVideo = async (query) =>
	(await searchPexelsVideo(query).catch(() => null)) ||
	(await searchArchiveMedia(query, "video").catch(() => null)) ||
	(await searchApplePreview(query, "video").catch(() => null));

export const searchCommonsFile = async (query) => {
	const { data } = await http.get("https://commons.wikimedia.org/w/api.php", {
		params: {
			action: "query", generator: "search", gsrsearch: clean(query, 120), gsrnamespace: 6,
			gsrlimit: 10, prop: "imageinfo", iiprop: "url|size|mime|mediatype|extmetadata", format: "json", origin: "*",
		},
	});
	const pages = Object.values(data?.query?.pages || {});
	for (const page of pages) {
		const info = page.imageinfo?.[0];
		if (!info?.url || !info.mime || Number(info.size || 0) > MAX_OPEN_MEDIA_BYTES) continue;
		if (!/^(image|audio|video)\//i.test(info.mime) && info.mime !== "application/pdf") continue;
		const license = info.extmetadata?.LicenseShortName?.value || info.extmetadata?.UsageTerms?.value || "Wikimedia licence";
		return normalizeResult({
			url: info.url, title: page.title?.replace(/^File:/, ""), mime: info.mime,
			ext: page.title?.split(".").pop()?.toLowerCase() || "bin", source: "Wikimedia Commons", license,
		});
	}
	return null;
};

export const searchLyrics = async (query) => {
	const parsed = parseArtistTitle(query);
	const params = parsed.artist
		? { artist_name: parsed.artist, track_name: parsed.title }
		: { q: parsed.query };
	const { data } = await http.get("https://lrclib.net/api/search", { params });
	const item = data?.find((entry) => entry.plainLyrics);
	if (!item) return null;
	return {
		title: clean(item.trackName || parsed.title, 100),
		artist: clean(item.artistName || parsed.artist, 80),
		lyrics: String(item.plainLyrics).trim().slice(0, 30_000),
		source: "LRCLIB",
	};
};

export const downloadOpenMedia = async (result, maxBytes = MAX_OPEN_MEDIA_BYTES) => {
	const target = new URL(result.url);
	if (target.protocol !== "https:") throw new Error("Only secure HTTPS media URLs are accepted");
	if (["localhost", "localhost.localdomain"].includes(target.hostname.toLowerCase())) throw new Error("Private media hosts are blocked");
	const addresses = isIP(target.hostname)
		? [{ address: target.hostname }]
		: await dns.lookup(target.hostname, { all: true, verbatim: true });
	if (!addresses.length || addresses.some(({ address }) => !isPublicIp(address))) throw new Error("Private or reserved media hosts are blocked");
	const response = await http.get(result.url, {
		responseType: "arraybuffer",
		maxContentLength: maxBytes,
		maxBodyLength: maxBytes,
		headers: { Range: `bytes=0-${maxBytes - 1}`, "User-Agent": "AlphaWhatsAppBot/3.0 (MartechMods2/Alpha_v1)" },
		beforeRedirect: (options) => {
			const host = String(options.hostname || "").toLowerCase();
			if (!host || host === "localhost" || (isIP(host) && !isPublicIp(host))) throw new Error("Unsafe media redirect blocked");
		},
	});
	const buffer = Buffer.from(response.data);
	if (!buffer.length) throw new Error("The provider returned an empty file");
	if (buffer.length >= maxBytes) throw new Error("The media exceeds the 25MB safety limit");
	return buffer;
};
