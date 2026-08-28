import { createCanvas, loadImage } from "@napi-rs/canvas";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ACTIONS = Object.freeze({
	slap: { verb: "SLAPS", emoji: "👋", tone: "rough", asset: "slap.webp" },
	beat: { verb: "BEATS", emoji: "🥊", tone: "rough", asset: "punch.webp" },
	punch: { verb: "PUNCHES", emoji: "🥊", tone: "rough", asset: "punch.webp" },
	kick: { verb: "KICKS", emoji: "💥", tone: "rough", asset: "kick.webp" },
	playkick: { verb: "KICKS", emoji: "💥", tone: "rough", asset: "kick.webp" },
	bonk: { verb: "BONKS", emoji: "🔨", tone: "rough", asset: "punch.webp" },
	bite: { verb: "BITES", emoji: "😬", tone: "rough", asset: "chase.webp" },
	chase: { verb: "CHASES", emoji: "🏃", tone: "rough", asset: "chase.webp" },
	roast: { verb: "ROASTS", emoji: "🔥", tone: "rough", asset: "laugh.webp" },
	hug: { verb: "HUGS", emoji: "🤗", tone: "friendly", asset: "hug.webp" },
	kiss: { verb: "KISSES", emoji: "😘", tone: "friendly", asset: "kiss.webp" },
	pat: { verb: "PATS", emoji: "🫳", tone: "friendly", asset: "pat.webp" },
	poke: { verb: "POKES", emoji: "👉", tone: "friendly", asset: "pat.webp" },
	wave: { verb: "WAVES AT", emoji: "👋", tone: "friendly", asset: "highfive.webp" },
	highfive: { verb: "HIGH-FIVES", emoji: "🙌", tone: "friendly", asset: "highfive.webp" },
	cheer: { verb: "CHEERS", emoji: "📣", tone: "friendly", asset: "highfive.webp" },
	cuddle: { verb: "CUDDLES", emoji: "🫂", tone: "friendly", asset: "hug.webp" },
	dance: { verb: "DANCES WITH", emoji: "💃", tone: "friendly", asset: "dance.webp" },
	laugh: { verb: "LAUGHS WITH", emoji: "😂", tone: "friendly", asset: "laugh.webp" },
	cry: { verb: "CRIES TO", emoji: "😭", tone: "friendly", asset: "cry.webp" },
	wink: { verb: "WINKS AT", emoji: "😉", tone: "friendly", asset: "kiss.webp" },
	feed: { verb: "FEEDS", emoji: "🍕", tone: "friendly", asset: "feed.webp" },
	salute: { verb: "SALUTES", emoji: "🫡", tone: "friendly", asset: "highfive.webp" },
	tickle: { verb: "TICKLES", emoji: "🤣", tone: "friendly", asset: "laugh.webp" },
	boop: { verb: "BOOPS", emoji: "👉", tone: "friendly", asset: "pat.webp" },
});

// `kick` remains available through `action kick`; the direct alias is
// `playkick` so it cannot shadow the administrator removal command.
export const ACTION_COMMANDS = Object.freeze(Object.keys(ACTIONS).filter((name) => name !== "kick"));
export const FRIENDLY_ACTIONS = Object.freeze(ACTION_COMMANDS.filter((name) => ACTIONS[name].tone === "friendly"));

const ACTION_ASSET_DIR = fileURLToPath(new URL("../media/actions/", import.meta.url));
const HUMAN_ACTION_ASSET_DIR = fileURLToPath(new URL("../media/actions-human/", import.meta.url));
const templateCache = new Map();
const HUMAN_ASSETS = Object.freeze({
	slap: "slap.webp", beat: "punch.webp", punch: "punch.webp", bonk: "punch.webp", bite: "punch.webp", roast: "laugh.webp",
	kick: "kick.webp", playkick: "kick.webp", chase: "kick.webp",
	hug: "hug.webp", kiss: "hug.webp", pat: "hug.webp", poke: "hug.webp", cuddle: "hug.webp", feed: "hug.webp", boop: "hug.webp",
	laugh: "laugh.webp", cry: "laugh.webp", wink: "laugh.webp", tickle: "laugh.webp",
	dance: "dance.webp", wave: "dance.webp", highfive: "dance.webp", cheer: "dance.webp", salute: "dance.webp",
});

const cleanName = (value) => String(value || "Member")
	.replace(/[\u0000-\u001f*_~`]/g, " ")
	.replace(/\s+/g, " ")
	.trim()
	.slice(0, 18) || "Member";

const drawContain = (ctx, image, size, padding = 0) => {
	const scale = Math.min((size - padding * 2) / image.width, (size - padding * 2) / image.height);
	const width = image.width * scale;
	const height = image.height * scale;
	ctx.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
};

const loadTemplate = (asset, style = "anime") => {
	const directory = style === "human" ? HUMAN_ACTION_ASSET_DIR : ACTION_ASSET_DIR;
	const key = `${style}:${asset}`;
	if (!templateCache.has(key)) templateCache.set(key, loadImage(path.join(directory, asset)));
	return templateCache.get(key);
};

export const getActionDefinition = (name) => ACTIONS[String(name || "").toLowerCase()] || null;
export const getActionAssetPath = (name) => {
	const definition = getActionDefinition(name);
	return definition ? path.join(ACTION_ASSET_DIR, definition.asset) : "";
};
export const getHumanActionAssetPath = (name) => getActionDefinition(name)
	? path.join(HUMAN_ACTION_ASSET_DIR, HUMAN_ASSETS[name] || "hug.webp")
	: "";

export const createActionStickerImage = async ({ action, actorName, targetName, style = "anime" }) => {
	const definition = getActionDefinition(action);
	if (!definition) throw new Error("Unknown action");
	const actor = cleanName(actorName);
	const target = cleanName(targetName);
	const selectedStyle = style === "human" ? "human" : "anime";
	const asset = selectedStyle === "human" ? (HUMAN_ASSETS[action] || "hug.webp") : definition.asset;
	const image = await loadTemplate(asset, selectedStyle);
	const canvas = createCanvas(512, 512);
	const ctx = canvas.getContext("2d");

	ctx.clearRect(0, 0, 512, 512);
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = "high";
	drawContain(ctx, image, 512, 4);

	const shade = ctx.createLinearGradient(0, 344, 0, 512);
	shade.addColorStop(0, "rgba(2,6,23,0)");
	shade.addColorStop(0.58, "rgba(2,6,23,0.40)");
	shade.addColorStop(1, "rgba(2,6,23,0.90)");
	ctx.fillStyle = shade;
	ctx.fillRect(0, 330, 512, 182);

	const label = `${actor} ${definition.verb} ${target}`.toUpperCase();
	let fontSize = 30;
	do {
		ctx.font = `900 ${fontSize}px sans-serif`;
		fontSize -= 1;
	} while (ctx.measureText(label).width > 464 && fontSize > 17);
	ctx.font = `900 ${fontSize + 1}px sans-serif`;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.lineJoin = "round";
	ctx.strokeStyle = "rgba(0,0,0,0.92)";
	ctx.lineWidth = 7;
	ctx.strokeText(label, 256, 465);
	ctx.fillStyle = "#ffffff";
	ctx.fillText(label, 256, 465);

	ctx.font = "700 13px sans-serif";
	ctx.strokeStyle = "rgba(0,0,0,0.88)";
	ctx.lineWidth = 4;
	const footer = `ALPHA ${selectedStyle.toUpperCase()} ACTION STUDIO`;
	ctx.strokeText(footer, 256, 493);
	ctx.fillStyle = "#facc15";
	ctx.fillText(footer, 256, 493);
	return canvas.toBuffer("image/png");
};
