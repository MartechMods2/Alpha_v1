import { createCanvas, loadImage } from "@napi-rs/canvas";
import axios from "axios";
import FormData from "form-data";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import { readFile, writeFile } from "fs/promises";
import WSF from "wa-sticker-formatter";
import memoryManager from "./memory.js";
import { isProviderAvailable, reportProviderResult } from "./mediaJobs.js";

let ffmpegPath = process.env.FFMPEG_PATH;
if (!ffmpegPath) {
	try {
		const { default: ffmpegStatic } = await import("ffmpeg-static");
		ffmpegPath = ffmpegStatic && fs.existsSync(ffmpegStatic) ? ffmpegStatic : "ffmpeg";
	} catch {
		ffmpegPath = "ffmpeg";
	}
}
ffmpeg.setFfmpegPath(ffmpegPath);

export const getFfmpegPath = () => ffmpegPath;

const cleanText = (value, maxLength) =>
	String(value || "")
		.replace(/[\u0000-\u001f\u007f]/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, maxLength);

const wrapText = (ctx, text, maxWidth, maxLines = 4) => {
	const words = cleanText(text, 240).split(" ").filter(Boolean);
	const lines = [];
	let current = "";
	for (const word of words) {
		const candidate = current ? `${current} ${word}` : word;
		if (ctx.measureText(candidate).width <= maxWidth || !current) current = candidate;
		else {
			lines.push(current);
			current = word;
			if (lines.length === maxLines - 1) break;
		}
	}
	if (current && lines.length < maxLines) lines.push(current);
	return lines;
};

const drawOutlinedLines = (ctx, lines, { x, startY, lineHeight, align = "center" }) => {
	ctx.textAlign = align;
	ctx.textBaseline = "top";
	ctx.lineJoin = "round";
	ctx.strokeStyle = "#000000";
	ctx.fillStyle = "#ffffff";
	ctx.lineWidth = Math.max(5, lineHeight * 0.13);
	lines.forEach((line, index) => {
		const y = startY + index * lineHeight;
		ctx.strokeText(line, x, y);
		ctx.fillText(line, x, y);
	});
};

export const createMemeImage = async (imageBuffer, topText = "", bottomText = "") => {
	if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) throw new Error("Image is empty");
	if (imageBuffer.length > 12 * 1024 * 1024) throw new Error("Image is larger than 12MB");
	const image = await loadImage(imageBuffer);
	const maxDimension = 1280;
	const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
	const width = Math.max(320, Math.round(image.width * scale));
	const height = Math.max(320, Math.round(image.height * scale));
	const canvas = createCanvas(width, height);
	const ctx = canvas.getContext("2d");
	ctx.drawImage(image, 0, 0, width, height);

	const fontSize = Math.max(28, Math.min(72, Math.round(height * 0.085)));
	const lineHeight = Math.round(fontSize * 1.05);
	ctx.font = `900 ${fontSize}px sans-serif`;
	const maxWidth = width * 0.9;
	const topLines = wrapText(ctx, cleanText(topText, 120).toUpperCase(), maxWidth, 3);
	const bottomLines = wrapText(ctx, cleanText(bottomText, 120).toUpperCase(), maxWidth, 3);
	if (topLines.length) {
		drawOutlinedLines(ctx, topLines, { x: width / 2, startY: height * 0.035, lineHeight });
	}
	if (bottomLines.length) {
		const blockHeight = bottomLines.length * lineHeight;
		drawOutlinedLines(ctx, bottomLines, {
			x: width / 2,
			startY: height - blockHeight - height * 0.035,
			lineHeight,
		});
	}
	return canvas.toBuffer("image/png");
};

export const createTextStickerImage = (text) => {
	const content = cleanText(text, 140);
	if (!content) throw new Error("Sticker text is empty");
	const canvas = createCanvas(512, 512);
	const ctx = canvas.getContext("2d");
	const gradient = ctx.createLinearGradient(0, 0, 512, 512);
	gradient.addColorStop(0, "#6d28d9");
	gradient.addColorStop(0.5, "#2563eb");
	gradient.addColorStop(1, "#0891b2");
	ctx.fillStyle = gradient;
	ctx.beginPath();
	ctx.roundRect(18, 18, 476, 476, 72);
	ctx.fill();
	ctx.strokeStyle = "rgba(255,255,255,0.35)";
	ctx.lineWidth = 8;
	ctx.stroke();

	let fontSize = 72;
	let lines = [];
	do {
		ctx.font = `800 ${fontSize}px sans-serif`;
		lines = wrapText(ctx, content, 410, 6);
		fontSize -= 4;
	} while ((lines.length > 5 || lines.some((line) => ctx.measureText(line).width > 410)) && fontSize > 32);
	const lineHeight = Math.round((fontSize + 4) * 1.15);
	ctx.font = `800 ${fontSize + 4}px sans-serif`;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillStyle = "#ffffff";
	ctx.shadowColor = "rgba(0,0,0,0.35)";
	ctx.shadowBlur = 12;
	const startY = 256 - ((lines.length - 1) * lineHeight) / 2;
	lines.forEach((line, index) => ctx.fillText(line, 256, startY + index * lineHeight));
	return canvas.toBuffer("image/png");
};

export const imageBufferToSticker = async (
	imageBuffer,
	{ pack = "Alpha", author = "MartechMods2", quality = 82 } = {},
) => {
	if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) throw new Error("Image is empty");
	if (imageBuffer.length > 12 * 1024 * 1024) throw new Error("Image is larger than 12MB");
	const inputPath = memoryManager.generateTempFileName(".png");
	const outputPath = memoryManager.generateTempFileName(".webp");
	await writeFile(inputPath, imageBuffer);
	try {
		await new Promise((resolve, reject) => {
			ffmpeg(inputPath)
				.addOutputOptions([
					"-vcodec",
					"libwebp",
					"-vf",
					"scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,format=yuva420p",
					"-lossless",
					"0",
					"-q:v",
					String(Math.min(100, Math.max(30, quality))),
					"-an",
				])
				.toFormat("webp")
				.on("end", resolve)
				.on("error", reject)
				.save(outputPath);
		});
		return Buffer.from(await WSF.setMetadata(cleanText(pack, 64), cleanText(author, 64), outputPath));
	} finally {
		memoryManager.safeUnlink(inputPath);
		memoryManager.safeUnlink(outputPath);
	}
};

export const removeImageBackground = async (imageBuffer) => {
	const apiKey = process.env.REMOVE_BG_KEY;
	if (!apiKey) throw new Error("REMOVE_BG_KEY is not configured");
	if (!isProviderAvailable("removebg")) throw new Error("remove.bg is temporarily paused after repeated failures");
	if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) throw new Error("Image is empty");
	if (imageBuffer.length > 10 * 1024 * 1024) throw new Error("Image is larger than 10MB");
	const formData = new FormData();
	formData.append("size", "auto");
	formData.append("image_file", imageBuffer, {
		filename: "sticker-input.png",
		contentType: "image/png",
	});
	try {
		const response = await axios.post("https://api.remove.bg/v1.0/removebg", formData, {
			responseType: "arraybuffer",
			headers: { ...formData.getHeaders(), "X-Api-Key": apiKey },
			maxContentLength: 12 * 1024 * 1024,
			timeout: 45_000,
		});
		reportProviderResult("removebg", true);
		return Buffer.from(response.data);
	} catch (error) {
		reportProviderResult("removebg", false, error.response?.data?.errors?.[0]?.title || error.message);
		throw error;
	}
};

const validHexColor = (value, fallback = "#ffffff") =>
	/^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value) : fallback;

const drawCover = (ctx, image, width, height) => {
	const scale = Math.max(width / image.width, height / image.height);
	const drawWidth = image.width * scale;
	const drawHeight = image.height * scale;
	ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
};

const drawContain = (ctx, image, width, height, padding = 0) => {
	const scale = Math.min((width - padding * 2) / image.width, (height - padding * 2) / image.height);
	const drawWidth = image.width * scale;
	const drawHeight = image.height * scale;
	ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
};

export const transformImage = async (imageBuffer, operation, options = {}) => {
	if (!Buffer.isBuffer(imageBuffer) || !imageBuffer.length) throw new Error("Image is empty");
	const image = await loadImage(imageBuffer);
	let width = image.width;
	let height = image.height;
	if (operation === "upscale") {
		const factor = Math.min(3, Math.max(1, Number(options.factor) || 2));
		const scale = Math.min(factor, 2048 / Math.max(width, height));
		width = Math.max(1, Math.round(width * scale));
		height = Math.max(1, Math.round(height * scale));
	}
	if (operation === "passport") {
		width = 600;
		height = 720;
	}
	if (operation === "socialresize") {
		const presets = { square: [1080, 1080], story: [1080, 1920], landscape: [1200, 630], portrait: [1080, 1350] };
		[width, height] = presets[String(options.preset || "square").toLowerCase()] || presets.square;
	}
	const canvas = createCanvas(width, height);
	const ctx = canvas.getContext("2d");
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = "high";
	if (["replacebg", "passport", "socialresize"].includes(operation)) {
		ctx.fillStyle = validHexColor(options.color, operation === "passport" ? "#f4f8ff" : "#ffffff");
		ctx.fillRect(0, 0, width, height);
	}
	if (["passport", "socialresize"].includes(operation)) drawCover(ctx, image, width, height);
	else ctx.drawImage(image, 0, 0, width, height);
	if (["scan", "signature"].includes(operation)) {
		const pixels = ctx.getImageData(0, 0, width, height);
		for (let index = 0; index < pixels.data.length; index += 4) {
			const gray = 0.299 * pixels.data[index] + 0.587 * pixels.data[index + 1] + 0.114 * pixels.data[index + 2];
			if (operation === "signature") {
				const alpha = Math.max(0, Math.min(255, (235 - gray) * 3));
				pixels.data[index] = 20;
				pixels.data[index + 1] = 20;
				pixels.data[index + 2] = 20;
				pixels.data[index + 3] = alpha;
			} else {
				const adjusted = gray > 210 ? 255 : gray < 70 ? 0 : Math.round((gray - 70) * 1.82);
				pixels.data[index] = adjusted;
				pixels.data[index + 1] = adjusted;
				pixels.data[index + 2] = adjusted;
			}
		}
		ctx.putImageData(pixels, 0, 0);
	}
	return canvas.toBuffer("image/png");
};

export const createPhotoGrid = async (buffers, { color = "#0f172a" } = {}) => {
	const images = await Promise.all(buffers.filter(Buffer.isBuffer).slice(0, 4).map((buffer) => loadImage(buffer)));
	if (images.length < 2) throw new Error("Add at least two photos to the grid");
	const canvas = createCanvas(1080, 1080);
	const ctx = canvas.getContext("2d");
	ctx.fillStyle = validHexColor(color, "#0f172a");
	ctx.fillRect(0, 0, 1080, 1080);
	const cells = images.length === 2
		? [[10, 10, 525, 1060], [545, 10, 525, 1060]]
		: [[10, 10, 525, 525], [545, 10, 525, 525], [10, 545, 525, 525], [545, 545, 525, 525]];
	images.forEach((image, index) => {
		const [x, y, width, height] = cells[index];
		ctx.save();
		ctx.beginPath();
		ctx.roundRect(x, y, width, height, 24);
		ctx.clip();
		ctx.translate(x, y);
		drawCover(ctx, image, width, height);
		ctx.restore();
	});
	return canvas.toBuffer("image/jpeg", 88);
};

export const createThumbnail = async (imageBuffer, title, subtitle = "") => {
	const image = await loadImage(imageBuffer);
	const canvas = createCanvas(1280, 720);
	const ctx = canvas.getContext("2d");
	drawCover(ctx, image, 1280, 720);
	const gradient = ctx.createLinearGradient(0, 180, 0, 720);
	gradient.addColorStop(0, "rgba(0,0,0,0.05)");
	gradient.addColorStop(1, "rgba(0,0,0,0.88)");
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, 1280, 720);
	ctx.font = "900 76px sans-serif";
	const lines = wrapText(ctx, cleanText(title, 100), 1120, 3);
	drawOutlinedLines(ctx, lines, { x: 640, startY: 420 - Math.max(0, lines.length - 1) * 50, lineHeight: 82 });
	if (subtitle) {
		ctx.font = "700 30px sans-serif";
		ctx.fillStyle = "#facc15";
		ctx.textAlign = "center";
		ctx.fillText(cleanText(subtitle, 80), 640, 660);
	}
	return canvas.toBuffer("image/jpeg", 90);
};

export const createProfileCard = async ({ name, subtitle, points = 0, avatarBuffer = null, accent = "#7c3aed" }) => {
	const canvas = createCanvas(1080, 1080);
	const ctx = canvas.getContext("2d");
	const gradient = ctx.createLinearGradient(0, 0, 1080, 1080);
	gradient.addColorStop(0, "#07111f");
	gradient.addColorStop(1, validHexColor(accent, "#7c3aed"));
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, 1080, 1080);
	ctx.fillStyle = "rgba(255,255,255,.09)";
	ctx.beginPath();
	ctx.roundRect(80, 80, 920, 920, 70);
	ctx.fill();
	if (avatarBuffer) {
		try {
			const avatar = await loadImage(avatarBuffer);
			ctx.save();
			ctx.beginPath();
			ctx.arc(540, 350, 190, 0, Math.PI * 2);
			ctx.clip();
			ctx.translate(350, 160);
			drawCover(ctx, avatar, 380, 380);
			ctx.restore();
		} catch {}
	}
	ctx.textAlign = "center";
	ctx.fillStyle = "#ffffff";
	ctx.font = "900 70px sans-serif";
	ctx.fillText(cleanText(name, 40) || "Alpha Member", 540, 640);
	ctx.fillStyle = "#dbeafe";
	ctx.font = "600 36px sans-serif";
	ctx.fillText(cleanText(subtitle, 70), 540, 710);
	ctx.fillStyle = "#facc15";
	ctx.font = "900 86px sans-serif";
	ctx.fillText(String(Math.max(0, Number(points) || 0)), 540, 850);
	ctx.font = "700 28px sans-serif";
	ctx.fillText("ALPHA POINTS", 540, 900);
	return canvas.toBuffer("image/png");
};

const runFfmpeg = ({ inputBuffer, inputExtension, outputExtension, configure }) => {
	const inputPath = memoryManager.generateTempFileName(`.${String(inputExtension || "bin").replace(/[^a-z0-9]/gi, "")}`);
	const outputPath = memoryManager.generateTempFileName(`.${String(outputExtension || "bin").replace(/[^a-z0-9]/gi, "")}`);
	return writeFile(inputPath, inputBuffer)
		.then(() => new Promise((resolve, reject) => {
			const command = ffmpeg(inputPath);
			configure(command);
			command.on("end", resolve).on("error", reject).save(outputPath);
		}))
		.then(() => readFile(outputPath))
		.finally(() => {
			memoryManager.safeUnlink(inputPath);
			memoryManager.safeUnlink(outputPath);
		});
};

export const convertMediaToSticker = async (inputBuffer, {
	inputExtension = "mp4",
	animated = false,
	pack = "Alpha",
	author = "MartechMods2",
	quality = 78,
	crop = false,
} = {}) => {
	if (!animated) return imageBufferToSticker(inputBuffer, { pack, author, quality });
	const filter = crop
		? "crop=min(iw\\,ih):min(iw\\,ih),scale=512:512,fps=12"
		: "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,fps=12";
	const webp = await runFfmpeg({
		inputBuffer,
		inputExtension,
		outputExtension: "webp",
		configure: (command) => command.duration(8).noAudio().outputOptions([
			"-vcodec", "libwebp", "-vf", filter, "-loop", "0", "-q:v", String(Math.min(90, Math.max(40, quality))), "-preset", "default",
		]),
	});
	return webp;
};

export const processAudio = (inputBuffer, inputExtension, operation, options = {}) => {
	const configure = (command) => {
		command.noVideo().audioCodec("libmp3lame").audioBitrate("128k");
		if (operation === "audiocut") {
			command.seekInput(Math.max(0, Number(options.start) || 0)).duration(Math.min(60, Math.max(1, Number(options.duration) || 15)));
		} else if (operation === "denoise") command.audioFilters("afftdn=nf=-25");
		else if (operation === "normalize") command.audioFilters("loudnorm=I=-16:TP=-1.5:LRA=11");
	};
	return runFfmpeg({ inputBuffer, inputExtension, outputExtension: "mp3", configure });
};

export const createWaveform = (inputBuffer, inputExtension) => runFfmpeg({
	inputBuffer,
	inputExtension,
	outputExtension: "png",
	configure: (command) => command.complexFilter("showwavespic=s=1200x400:colors=7c3aed").frames(1),
});

const escapeDrawText = (value) => cleanText(value, 120).replace(/([\\':%])/g, "\\$1");

export const processVideo = (inputBuffer, inputExtension, operation, options = {}) => {
	if (operation === "videothumbnail") {
		return runFfmpeg({
			inputBuffer,
			inputExtension,
			outputExtension: "jpg",
			configure: (command) => command.seekInput(Math.max(0, Number(options.at) || 1)).frames(1).videoFilters("scale=1280:-2"),
		});
	}
	return runFfmpeg({
		inputBuffer,
		inputExtension,
		outputExtension: "mp4",
		configure: (command) => {
			command.videoCodec("libx264").audioCodec("aac").outputOptions(["-movflags", "+faststart", "-preset", "veryfast"]);
			if (operation === "videocut") {
				command.seekInput(Math.max(0, Number(options.start) || 0)).duration(Math.min(60, Math.max(1, Number(options.duration) || 10)));
			}
			if (operation === "videocaption") {
				command.videoFilters(`drawtext=text='${escapeDrawText(options.text)}':fontcolor=white:fontsize=36:borderw=3:bordercolor=black:x=(w-text_w)/2:y=h-text_h-40`);
			}
		},
	});
};
