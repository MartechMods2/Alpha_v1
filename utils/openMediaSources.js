import axios from "axios";
import { createHmac, randomBytes } from "node:crypto";
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

const configured = (name) => Boolean(String(process.env[name] || "").trim());

const provider = ({ ready, linked = false, access = "key", capability }) => ({
	configured: ready,
	credentialsConfigured: linked,
	access,
	capability,
});

export const openMusicProviderStatus = () => {
	const audiusLinked = configured("AUDIUS_API_KEY");
	const audiomackLinked = configured("AUDIOMACK_CONSUMER_KEY") && configured("AUDIOMACK_CONSUMER_SECRET");
	const geniusLinked = configured("GENIUS_ACCESS_SECRET") || configured("GENIUS_ACCESS_TOKEN");
	return {
		audius: provider({ ready: true, linked: audiusLinked, access: audiusLinked ? "linked" : "public", capability: "permitted artist streams" }),
		audiomack: provider({ ready: audiomackLinked, linked: audiomackLinked, access: "restricted", capability: "partner catalogue and permitted streams" }),
		apple: provider({ ready: true, access: "public", capability: "Nigeria catalogue and official previews" }),
		deezer: provider({ ready: true, access: "public", capability: "catalogue and official previews" }),
		jamendo: provider({ ready: configured("JAMENDO_CLIENT_ID"), linked: configured("JAMENDO_CLIENT_ID"), capability: "licensed full tracks" }),
		internetArchive: provider({ ready: true, access: "public", capability: "open full files" }),
		lrclib: provider({ ready: true, access: "public", capability: "plain and synced lyrics" }),
		musicBrainz: provider({ ready: true, access: "public", capability: "metadata matching" }),
		lastFm: provider({ ready: configured("LASTFM_API_KEY"), linked: configured("LASTFM_API_KEY"), capability: "Nigeria charts and discovery" }),
		genius: provider({ ready: geniusLinked, linked: geniusLinked, capability: "official lyrics links" }),
		discogs: provider({ ready: configured("DISCOGS_TOKEN"), linked: configured("DISCOGS_TOKEN"), capability: "release catalogue" }),
		coverArtArchive: provider({ ready: true, access: "public", capability: "release artwork" }),
	};
};

const audiusHeaders = (apiKey = process.env.AUDIUS_API_KEY) => apiKey ? { "x-api-key": apiKey } : {};

export const searchAudiusTrack = async (query, apiKey = process.env.AUDIUS_API_KEY) => {
	const { data } = await http.get("https://api.audius.co/v1/tracks/search", {
		headers: audiusHeaders(apiKey),
		params: { query: clean(query, 120), limit: 10, app_name: "AlphaWhatsAppBot" },
	});
	const track = (data?.data || []).find((entry) => entry?.id && entry?.is_streamable !== false && entry?.is_available !== false);
	if (!track) return null;
	return normalizeResult({
		url: `https://api.audius.co/v1/tracks/${encodeURIComponent(track.id)}/stream?app_name=AlphaWhatsAppBot`,
		title: track.title,
		artist: track.user?.name,
		mime: "audio/mpeg",
		ext: "mp3",
		source: "Audius",
		license: "Artist-authorized Audius API stream; provider terms apply",
		fullLength: true,
	});
};

const oauthEncode = (value) => encodeURIComponent(String(value)).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

const audiomackAuthorization = (method, url, params, consumerKey, consumerSecret) => {
	const oauth = {
		oauth_consumer_key: consumerKey,
		oauth_nonce: randomBytes(16).toString("hex"),
		oauth_signature_method: "HMAC-SHA1",
		oauth_timestamp: Math.floor(Date.now() / 1000),
		oauth_version: "1.0",
	};
	const pairs = Object.entries({ ...params, ...oauth })
		.map(([key, value]) => [oauthEncode(key), oauthEncode(value)])
		.sort(([aKey, aValue], [bKey, bValue]) => aKey.localeCompare(bKey) || aValue.localeCompare(bValue));
	const normalized = pairs.map(([key, value]) => `${key}=${value}`).join("&");
	const base = [method.toUpperCase(), oauthEncode(url), oauthEncode(normalized)].join("&");
	oauth.oauth_signature = createHmac("sha1", `${oauthEncode(consumerSecret)}&`).update(base).digest("base64");
	return `OAuth ${Object.entries(oauth).map(([key, value]) => `${oauthEncode(key)}="${oauthEncode(value)}"`).join(", ")}`;
};

export const searchAudiomackTrack = async (
	query,
	consumerKey = process.env.AUDIOMACK_CONSUMER_KEY,
	consumerSecret = process.env.AUDIOMACK_CONSUMER_SECRET,
) => {
	if (!consumerKey || !consumerSecret) return null;
	const url = "https://api.audiomack.com/v1/search";
	const params = { q: clean(query, 120), show: "songs", sort: "relevance", limit: 10, verified: 1 };
	const { data } = await http.get(url, {
		params,
		headers: { Authorization: audiomackAuthorization("GET", url, params, consumerKey, consumerSecret) },
	});
	const track = (data?.results || []).find((entry) => entry?.streaming_url && entry?.live !== false);
	if (!track) return null;
	return normalizeResult({
		url: track.streaming_url,
		title: track.title,
		artist: track.artist || track.uploader?.name,
		mime: "audio/mpeg",
		ext: "mp3",
		source: "Audiomack",
		license: "Official Audiomack stream; artist and provider terms apply",
		fullLength: true,
	});
};

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
		ext: kind === "video" ? "mp4" : "m4a",
		source: "Apple Music preview",
		license: "Official limited preview; Apple terms apply",
		fullLength: false,
		pageUrl: item.trackViewUrl,
	});
};

export const searchDeezerPreview = async (query) => {
	const { data } = await http.get("https://api.deezer.com/search", {
		params: { q: clean(query, 120), limit: 10, order: "RANKING", strict: "on" },
	});
	const track = data?.data?.find((entry) => entry.preview);
	if (!track) return null;
	return normalizeResult({
		url: track.preview,
		title: track.title,
		artist: track.artist?.name,
		mime: "audio/mpeg",
		ext: "mp3",
		source: "Deezer preview",
		license: "Official limited preview; Deezer terms apply",
		fullLength: false,
		pageUrl: track.link,
	});
};

export const findOpenAudio = async (query) =>
	(await searchAudiusTrack(query).catch(() => null)) ||
	(await searchAudiomackTrack(query).catch(() => null)) ||
	(await searchJamendoTrack(query).catch(() => null)) ||
	(await searchArchiveMedia(query, "audio").catch(() => null)) ||
	(await searchApplePreview(query, "audio").catch(() => null)) ||
	(await searchDeezerPreview(query).catch(() => null));

export const findOfficialPreview = async (query) =>
	(await searchApplePreview(query, "audio").catch(() => null)) ||
	(await searchDeezerPreview(query).catch(() => null));

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
		syncedLyrics: String(item.syncedLyrics || "").trim().slice(0, 30_000),
		source: "LRCLIB",
	};
};

export const searchGeniusLink = async (query, token = process.env.GENIUS_ACCESS_TOKEN || process.env.GENIUS_ACCESS_SECRET) => {
	if (!token) return null;
	const { data } = await http.get("https://api.genius.com/search", {
		headers: { Authorization: `Bearer ${token}` },
		params: { q: clean(query, 120) },
	});
	const hit = data?.response?.hits?.find((entry) => entry.type === "song")?.result;
	if (!hit?.url) return null;
	return { title: clean(hit.title, 100), artist: clean(hit.primary_artist?.name, 80), url: hit.url, source: "Genius" };
};

export const searchMusicBrainz = async (query) => {
	const parsed = parseArtistTitle(query);
	const terms = [parsed.title && `recording:${JSON.stringify(parsed.title)}`, parsed.artist && `artist:${JSON.stringify(parsed.artist)}`].filter(Boolean).join(" AND ");
	const { data } = await http.get("https://musicbrainz.org/ws/2/recording", {
		headers: { "User-Agent": process.env.MUSICBRAINZ_USER_AGENT || "AlphaWhatsAppBot/3.0 (https://github.com/MartechMods2/Alpha_v1)" },
		params: { query: terms || parsed.query, fmt: "json", limit: 5 },
	});
	const recording = data?.recordings?.[0];
	if (!recording?.id) return null;
	return {
		title: clean(recording.title, 100), artist: clean(recording["artist-credit"]?.[0]?.name, 80),
		url: `https://musicbrainz.org/recording/${recording.id}`, source: "MusicBrainz",
		releaseId: recording.releases?.[0]?.id,
	};
};

export const searchLastFm = async (query, apiKey = process.env.LASTFM_API_KEY) => {
	if (!apiKey) return null;
	const { data } = await http.get("https://ws.audioscrobbler.com/2.0/", {
		params: { method: "track.search", track: clean(query, 120), api_key: apiKey, format: "json", limit: 5 },
	});
	const track = data?.results?.trackmatches?.track?.[0];
	if (!track?.url) return null;
	return { title: clean(track.name, 100), artist: clean(track.artist, 80), url: track.url, source: "Last.fm" };
};

export const searchDiscogs = async (query, token = process.env.DISCOGS_TOKEN) => {
	if (!token) return null;
	const { data } = await http.get("https://api.discogs.com/database/search", {
		headers: { Authorization: `Discogs token=${token}` }, params: { q: clean(query, 120), type: "release", per_page: 5 },
	});
	const release = data?.results?.[0];
	if (!release?.uri) return null;
	return { title: clean(release.title, 120), artist: "", url: `https://www.discogs.com${release.uri}`, source: "Discogs" };
};

export const findMusicLinks = async (query) => {
	const applePromise = http.get("https://itunes.apple.com/search", {
		params: { term: clean(query, 120), country: "NG", media: "music", entity: "song", limit: 3 },
	}).then(({ data }) => {
		const item = data?.results?.find((entry) => entry.trackViewUrl);
		return item ? { title: clean(item.trackName, 100), artist: clean(item.artistName, 80), url: item.trackViewUrl, source: "Apple Music NG" } : null;
	}).catch(() => null);
	const results = await Promise.all([
		applePromise,
		searchMusicBrainz(query).catch(() => null),
		searchLastFm(query).catch(() => null),
		searchGeniusLink(query).catch(() => null),
		searchDiscogs(query).catch(() => null),
	]);
	return results.filter((entry, index, items) => entry?.url && items.findIndex((other) => other?.url === entry.url) === index);
};

export const searchNigeriaChart = async (apiKey = process.env.LASTFM_API_KEY) => {
	if (!apiKey) return [];
	const { data } = await http.get("https://ws.audioscrobbler.com/2.0/", {
		params: { method: "geo.gettoptracks", country: "Nigeria", api_key: apiKey, format: "json", limit: 10 },
	});
	return (data?.tracks?.track || []).slice(0, 10).map((track) => ({
		title: clean(track.name, 100), artist: clean(track.artist?.name, 80), url: track.url, source: "Last.fm Nigeria",
	}));
};

export const searchCoverArt = async (query) => {
	const match = await searchMusicBrainz(query);
	if (!match?.releaseId) return null;
	const { data } = await http.get(`https://coverartarchive.org/release/${encodeURIComponent(match.releaseId)}`);
	const cover = data?.images?.find((image) => image.front) || data?.images?.[0];
	const url = cover?.thumbnails?.["500"] || cover?.thumbnails?.large || cover?.image;
	if (!url) return null;
	return normalizeResult({
		url, title: match.title, artist: match.artist, mime: "image/jpeg", ext: "jpg",
		source: "Cover Art Archive", license: "Cover artwork rights remain with their owners", fullLength: true,
	});
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
