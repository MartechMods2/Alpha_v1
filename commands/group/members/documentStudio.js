import { GoogleGenerativeAI } from "@google/generative-ai";
import { fileTypeFromBuffer } from "file-type";
import { downloadResolvedMedia } from "../../../utils/mediaInput.js";
import { runMediaJob } from "../../../utils/mediaJobs.js";
import { cleanSafeText, sha256 } from "../../../utils/safePack.js";
import { compressPdf, createQr, imageOcr, imageToPdf, mergePdfs, optionalVirusScan, pdfToImage, readQr, splitPdf, stripImageMetadata, withTempFiles } from "../../../utils/documentStudio.js";
import { writeFile } from "node:fs/promises";

const pdfSessions = new Map();
const albumSessions = new Map();

const aiMedia = async (media, instruction) => {
	if (!process.env.GOOGLE_API_KEY) throw new Error("GOOGLE_API_KEY is required for this AI media feature");
	const client = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY); const model = client.getGenerativeModel({ model: process.env.GEMINI_MEDIA_MODEL || "gemini-2.0-flash" });
	const response = await model.generateContent([instruction, { inlineData: { data: media.buffer.toString("base64"), mimeType: media.mime } }]); return String(response.response.text() || "").trim().slice(0, 4000);
};

const sendDocument = (send, from, msg, buffer, fileName, mimetype = "application/pdf") => send(from, { document: buffer, mimetype, fileName }, { quoted: msg });

const handler = async (sock, msg, from, args, info) => {
	const { command, senderJid, sendMessageWTyping } = info; const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg }); const key = `${from}:${senderJid}`;
	try {
		if (command === "ocr") { const media = await downloadResolvedMedia(sock, msg, { allowedKinds: ["image"], maxBytes: 12 * 1024 * 1024 }); const text = await runMediaJob({ feature: "ocr", groupJid: from, senderJid, task: () => imageOcr(media.buffer, args[0] || "eng") }); return reply(text ? `🔤 *Extracted Text*\n\n${text.slice(0, 4000)}` : "No readable text was found."); }
		if (command === "qr") { const text = cleanSafeText(args.join(" "), 1500); if (!text) return reply("❌ Usage: `qr <text or link>`. "); const image = await runMediaJob({ feature: "qr", groupJid: from, senderJid, task: () => createQr(text) }); return sendMessageWTyping(from, { image, caption: "✅ QR code generated locally" }, { quoted: msg }); }
		if (command === "readqr") { const media = await downloadResolvedMedia(sock, msg, { allowedKinds: ["image"], maxBytes: 12 * 1024 * 1024 }); const text = await runMediaJob({ feature: "readqr", groupJid: from, senderJid, task: () => readQr(media.buffer) }); return reply(`🔎 *QR Content*\n${text.slice(0, 3000)}`); }
		if (command === "img2pdf") { const media = await downloadResolvedMedia(sock, msg, { allowedKinds: ["image"], maxBytes: 12 * 1024 * 1024 }); const pdf = await runMediaJob({ feature: "img2pdf", groupJid: from, senderJid, task: () => imageToPdf(media.buffer) }); return sendDocument(sendMessageWTyping, from, msg, pdf, "alpha-image.pdf"); }
		if (command === "pdf2img") { const media = await downloadResolvedMedia(sock, msg, { allowedKinds: ["document"], maxBytes: 20 * 1024 * 1024 }); const page = Math.max(1, Math.min(50, Number(args[0]) || 1)); const image = await runMediaJob({ feature: "pdf2img", groupJid: from, senderJid, task: () => pdfToImage(media.buffer, page) }); return sendMessageWTyping(from, { image, caption: `PDF page ${page}` }, { quoted: msg }); }
		if (command === "pdfmerge") {
			const action = String(args[0] || "add").toLowerCase(); if (action === "start") { pdfSessions.set(key, { buffers: [], expires: Date.now() + 10 * 60_000 }); return reply("📚 PDF merge started. Reply to 2–5 PDFs with `pdfmerge add`, then use `pdfmerge done`."); }
			const session = pdfSessions.get(key); if (!session || session.expires < Date.now()) { pdfSessions.delete(key); return reply("❌ Start with `pdfmerge start`."); }
			if (action === "done") { if (session.buffers.length < 2) return reply("❌ Add at least two PDFs."); pdfSessions.delete(key); const pdf = await runMediaJob({ feature: "pdfmerge", groupJid: from, senderJid, task: () => mergePdfs(session.buffers) }); return sendDocument(sendMessageWTyping, from, msg, pdf, "alpha-merged.pdf"); }
			const media = await downloadResolvedMedia(sock, msg, { allowedKinds: ["document"], maxBytes: 15 * 1024 * 1024 }); if (session.buffers.length >= 5) return reply("❌ Maximum five PDFs."); session.buffers.push(media.buffer); return reply(`✅ PDF ${session.buffers.length}/5 added.`);
		}
		if (["pdfsplit", "pdfcompress"].includes(command)) { const media = await downloadResolvedMedia(sock, msg, { allowedKinds: ["document"], maxBytes: 25 * 1024 * 1024 }); const output = await runMediaJob({ feature: command, groupJid: from, senderJid, task: () => command === "pdfsplit" ? splitPdf(media.buffer, Math.max(1, Number(args[0]) || 1)) : compressPdf(media.buffer) }); return sendDocument(sendMessageWTyping, from, msg, output, command === "pdfsplit" ? `page-${Math.max(1, Number(args[0]) || 1)}.pdf` : "alpha-compressed.pdf"); }
		if (["fileinfo", "filescan"].includes(command)) {
			const media = await downloadResolvedMedia(sock, msg, { allowedKinds: ["image", "video", "audio", "sticker", "document"], maxBytes: 30 * 1024 * 1024 }); const type = await fileTypeFromBuffer(media.buffer).catch(() => null); if (command === "fileinfo") return reply(`📄 *File Information*\nType: ${type?.mime || media.mime}\nExtension: ${type?.ext || media.extension}\nSize: ${(media.buffer.length / 1024 / 1024).toFixed(2)} MB\nSHA-256: ${sha256(media.buffer)}`);
			const scan = await withTempFiles([`.${media.extension || "bin"}`], async ([file]) => { await writeFile(file, media.buffer); return optionalVirusScan(file); }); return reply(`🛡️ *File Scan*\nSHA-256: ${sha256(media.buffer)}\n${scan.available ? scan.clean ? "No known malware signature detected." : "⚠️ The scanner flagged this file. Do not open it." : scan.output}`);
		}
		if (["transcribe", "voicesummary", "voicetranslate"].includes(command)) { const media = await downloadResolvedMedia(sock, msg, { allowedKinds: ["audio", "video"], maxBytes: 20 * 1024 * 1024 }); const instruction = command === "transcribe" ? "Transcribe this audio accurately. Return only the transcript." : command === "voicesummary" ? "Summarize the important spoken content in short bullet points." : `Transcribe and translate the speech into ${cleanSafeText(args.join(" "), 40) || "English"}.`; return reply(`🎙️ *${command}*\n\n${await aiMedia(media, instruction)}`); }
		if (command === "autocaption") { const media = await downloadResolvedMedia(sock, msg, { allowedKinds: ["video"], maxBytes: 25 * 1024 * 1024 }); const captions = await aiMedia(media, "Create concise timestamped subtitle text for the spoken audio in this short video."); return sendDocument(sendMessageWTyping, from, msg, Buffer.from(captions), "alpha-captions.txt", "text/plain"); }
		if (command === "cleanmedia") { const media = await downloadResolvedMedia(sock, msg, { allowedKinds: ["image"], maxBytes: 12 * 1024 * 1024 }); const image = await runMediaJob({ feature: "cleanmedia", groupJid: from, senderJid, task: () => stripImageMetadata(media.buffer) }); return sendMessageWTyping(from, { image, caption: "✅ Image re-encoded without EXIF/location metadata" }, { quoted: msg }); }
		if (command === "album") {
			const action = String(args[0] || "add").toLowerCase(); if (action === "start") { albumSessions.set(key, { media: [], expires: Date.now() + 5 * 60_000 }); return reply("🖼️ Album started. Add 2–5 images with `album add`, then `album done`."); }
			const session = albumSessions.get(key); if (!session || session.expires < Date.now()) { albumSessions.delete(key); return reply("❌ Start with `album start`."); }
			if (action === "done") { if (session.media.length < 2) return reply("❌ Add at least two images."); albumSessions.delete(key); const parent = await sock.sendMessage(from, { album: { expectedImageCount: session.media.length, expectedVideoCount: 0 } }, { quoted: msg }); for (let i = 0; i < session.media.length; i += 1) await sock.sendMessage(from, { image: session.media[i], caption: i === 0 ? cleanSafeText(args.slice(1).join(" "), 200) : undefined, albumParentKey: parent.key }); return; }
			const media = await downloadResolvedMedia(sock, msg, { allowedKinds: ["image"], maxBytes: 8 * 1024 * 1024 }); if (session.media.length >= 5) return reply("❌ Maximum five images."); session.media.push(media.buffer); return reply(`✅ Album image ${session.media.length}/5 added.`);
		}
	} catch (error) { console.error(`Document Studio ${command} failed:`, error.message); return reply(`❌ ${command} failed: ${error.message}`); }
};

export default () => ({ cmd: ["ocr", "qr", "readqr", "img2pdf", "pdf2img", "pdfmerge", "pdfsplit", "pdfcompress", "fileinfo", "filescan", "transcribe", "voicesummary", "voicetranslate", "autocaption", "cleanmedia", "album"], desc: "Local OCR, QR, PDF, file safety, transcription and WhatsApp albums", usage: "reply to supported media with the command", handler });

