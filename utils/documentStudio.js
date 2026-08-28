import { createCanvas, loadImage } from "@napi-rs/canvas";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
import memoryManager from "./memory.js";

const execFileAsync = promisify(execFile);

const runFile = async (command, args, { timeout = 60_000, maxBuffer = 10 * 1024 * 1024 } = {}) => execFileAsync(command, args, { timeout, maxBuffer });

export const withTempFiles = async (extensions, operation) => {
	const paths = extensions.map((extension) => memoryManager.generateTempFileName(extension));
	try { return await operation(paths); } finally { paths.forEach((file) => memoryManager.safeUnlink(file)); }
};

export const imageOcr = (buffer, language = "eng") => withTempFiles([".png"], async ([input]) => {
	await writeFile(input, buffer); const { stdout } = await runFile("tesseract", [input, "stdout", "-l", language], { timeout: 90_000 }); return String(stdout).trim();
});

export const createQr = (text) => withTempFiles([".png"], async ([output]) => {
	await runFile("qrencode", ["-o", output, "-s", "10", "-m", "2", String(text).slice(0, 1500)]); return readFile(output);
});

export const readQr = (buffer) => withTempFiles([".png"], async ([input]) => {
	await writeFile(input, buffer); const { stdout } = await runFile("zbarimg", ["--quiet", "--raw", input]); return String(stdout).trim();
});

export const imageToPdf = async (buffer) => withTempFiles([".jpg", ".pdf"], async ([input, output]) => {
	const image = await loadImage(buffer); const scale = Math.min(1, 1600 / Math.max(image.width, image.height)); const canvas = createCanvas(Math.round(image.width * scale), Math.round(image.height * scale)); const ctx = canvas.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height); await writeFile(input, canvas.toBuffer("image/jpeg", 90)); await runFile("img2pdf", [input, "-o", output]); return readFile(output);
});

export const pdfToImage = (buffer, page = 1) => withTempFiles([".pdf", ".png"], async ([input, output]) => {
	await writeFile(input, buffer); const prefix = output.replace(/\.png$/, ""); await runFile("pdftoppm", ["-f", String(page), "-l", String(page), "-singlefile", "-png", "-r", "130", input, prefix], { timeout: 90_000 }); return readFile(output);
});

export const mergePdfs = (buffers) => withTempFiles([...buffers.map(() => ".pdf"), ".pdf"], async (paths) => {
	const output = paths.at(-1); const inputs = paths.slice(0, -1); await Promise.all(inputs.map((file, index) => writeFile(file, buffers[index]))); await runFile("pdfunite", [...inputs, output], { timeout: 90_000 }); return readFile(output);
});

export const splitPdf = (buffer, page = 1) => withTempFiles([".pdf", ".pdf"], async ([input, output]) => {
	await writeFile(input, buffer); const pattern = output.replace(/\.pdf$/, "-%d.pdf"); await runFile("pdfseparate", ["-f", String(page), "-l", String(page), input, pattern]); return readFile(pattern.replace("%d", String(page)));
});

export const compressPdf = (buffer) => withTempFiles([".pdf", ".pdf"], async ([input, output]) => {
	await writeFile(input, buffer); await runFile("gs", ["-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.4", "-dPDFSETTINGS=/ebook", "-dNOPAUSE", "-dQUIET", "-dBATCH", `-sOutputFile=${output}`, input], { timeout: 120_000 }); return readFile(output);
});

export const stripImageMetadata = async (buffer) => { const image = await loadImage(buffer); const canvas = createCanvas(image.width, image.height); canvas.getContext("2d").drawImage(image, 0, 0); return canvas.toBuffer("image/png"); };

export const optionalVirusScan = (file) => runFile("clamscan", ["--no-summary", file], { timeout: 120_000 }).then(({ stdout }) => ({ available: true, clean: /\bOK\s*$/m.test(stdout), output: stdout })).catch((error) => {
	if (error.code === "ENOENT") return { available: false, clean: null, output: "ClamAV is not installed; SHA-256 identification is still available." };
	return { available: true, clean: false, output: String(error.stdout || error.message) };
});

