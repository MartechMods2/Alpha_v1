import { createCanvas, loadImage } from "@napi-rs/canvas";
import axios from "axios";
import FormData from "form-data";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import { writeFile } from "fs/promises";
import WSF from "wa-sticker-formatter";
import memoryManager from "./memory.js";

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
	if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) throw new Error("Image is empty");
	if (imageBuffer.length > 10 * 1024 * 1024) throw new Error("Image is larger than 10MB");
	const formData = new FormData();
	formData.append("size", "auto");
	formData.append("image_file", imageBuffer, {
		filename: "sticker-input.png",
		contentType: "image/png",
	});
	const response = await axios.post("https://api.remove.bg/v1.0/removebg", formData, {
		responseType: "arraybuffer",
		headers: { ...formData.getHeaders(), "X-Api-Key": apiKey },
		maxContentLength: 12 * 1024 * 1024,
		timeout: 45_000,
	});
	return Buffer.from(response.data);
};
