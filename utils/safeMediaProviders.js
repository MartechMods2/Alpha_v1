import axios from "axios";
import { searchArchiveMedia } from "./openMediaSources.js";

const client = axios.create({ timeout: 18_000, headers: { "User-Agent": "AlphaWhatsAppBot/3.0 (MartechMods2/Alpha_v1)" } });
const clean = (value, max = 120) => String(value || "").replace(/[\r\n\t]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const result = (data) => ({ license: "Provider terms apply", fullLength: true, ...data, title: clean(data.title || "Media", 100), artist: clean(data.artist || "", 80) });

export const providerStatus = () => ({
	giphy: Boolean(process.env.GIPHY_API_KEY),
	pixabay: Boolean(process.env.PIXABAY_API_KEY),
	freesound: Boolean(process.env.FREESOUND_API_KEY),
	openverse: true,
	nasa: true,
	archive: true,
});

export const searchGiphy = async (query, { trending = false } = {}) => {
	const key = process.env.GIPHY_API_KEY;
	if (!key) throw new Error("GIPHY_API_KEY is not configured. Create a free GIPHY developer key.");
	const endpoint = trending ? "https://api.giphy.com/v1/gifs/trending" : "https://api.giphy.com/v1/gifs/search";
	const { data } = await client.get(endpoint, { params: { api_key: key, q: clean(query), limit: 12, rating: "g", lang: "en" } });
	const items = data?.data || [];
	const item = items[Math.floor(Math.random() * Math.min(items.length, 6))];
	const media = item?.images?.downsized_small?.mp4 || item?.images?.fixed_height?.mp4 || item?.images?.original?.mp4;
	if (!media) return null;
	return result({ url: media, title: item.title || query, mime: "video/mp4", ext: "mp4", source: "GIPHY", license: "GIPHY terms; Powered by GIPHY", gifPlayback: true });
};

export const searchPixabay = async (query, kind = "image") => {
	const key = process.env.PIXABAY_API_KEY;
	if (!key) return null;
	const endpoint = kind === "video" ? "https://pixabay.com/api/videos/" : "https://pixabay.com/api/";
	const { data } = await client.get(endpoint, { params: { key, q: clean(query), per_page: 12, safesearch: true, image_type: "photo", video_type: "film" } });
	const items = data?.hits || [];
	const item = items[Math.floor(Math.random() * Math.min(items.length, 6))];
	if (!item) return null;
	if (kind === "video") {
		const video = item.videos?.medium || item.videos?.small || item.videos?.tiny;
		if (!video?.url) return null;
		return result({ url: video.url, title: item.tags || query, artist: item.user, mime: "video/mp4", ext: "mp4", source: "Pixabay", license: "Pixabay Content License" });
	}
	return result({ url: item.largeImageURL || item.webformatURL, title: item.tags || query, artist: item.user, mime: "image/jpeg", ext: "jpg", source: "Pixabay", license: "Pixabay Content License" });
};

export const searchOpenverse = async (query, kind = "image") => {
	const { data } = await client.get(`https://api.openverse.org/v1/${kind === "audio" ? "audio" : "images"}/`, {
		params: { q: clean(query), page_size: 12, mature: false },
	});
	const items = (data?.results || []).filter((item) => item.url && item.license);
	const item = items[Math.floor(Math.random() * Math.min(items.length, 6))];
	if (!item) return null;
	return result({
		url: kind === "image" ? (item.thumbnail || item.url) : item.url,
		title: item.title || query,
		artist: item.creator,
		mime: kind === "audio" ? "audio/mpeg" : "image/jpeg",
		ext: kind === "audio" ? "mp3" : "jpg",
		source: "Openverse",
		license: `${item.license}${item.license_version ? ` ${item.license_version}` : ""}`,
	});
};

export const searchFreesound = async (query) => {
	const key = process.env.FREESOUND_API_KEY;
	if (!key) return null;
	const { data } = await client.get("https://freesound.org/apiv2/search/text/", {
		params: { token: key, query: clean(query), page_size: 12, fields: "id,name,username,license,previews,duration", filter: "duration:[0 TO 120]" },
	});
	const items = (data?.results || []).filter((item) => item.previews?.["preview-hq-mp3"] || item.previews?.["preview-lq-mp3"]);
	const item = items[Math.floor(Math.random() * Math.min(items.length, 6))];
	if (!item) return null;
	return result({ url: item.previews["preview-hq-mp3"] || item.previews["preview-lq-mp3"], title: item.name, artist: item.username, mime: "audio/mpeg", ext: "mp3", source: "Freesound", license: item.license });
};

export const searchNasaImage = async (query) => {
	const { data } = await client.get("https://images-api.nasa.gov/search", { params: { q: clean(query), media_type: "image", page_size: 25 } });
	const items = (data?.collection?.items || []).filter((item) => item.links?.[0]?.href);
	const item = items[Math.floor(Math.random() * Math.min(items.length, 10))];
	if (!item) return null;
	const meta = item.data?.[0] || {};
	return result({ url: item.links[0].href, title: meta.title || query, artist: meta.photographer || meta.center || "NASA", mime: "image/jpeg", ext: "jpg", source: "NASA Image Library", license: "NASA media usage guidelines" });
};

export const findSafeImage = async (query) => (await searchPixabay(query, "image").catch(() => null)) || (await searchOpenverse(query, "image").catch(() => null));
export const findSafeVideo = async (query) => (await searchPixabay(query, "video").catch(() => null)) || (await searchArchiveMedia(query, "video").catch(() => null));
export const findSafeSound = async (query) => (await searchFreesound(query).catch(() => null)) || (await searchOpenverse(query, "audio").catch(() => null));

