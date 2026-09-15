import {
	generateAlphaImage as generatePrimaryImage,
	imageMimeFromBuffer,
	imageProviderStatus as primaryProviderStatus,
} from "./alphaMediaAi.js";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const cleanError = (value) => String(value || "").replace(/\s+/g, " ").trim().slice(0, 260);

const validateGeneratedImage = (buffer) => {
	if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error("Gemini returned an empty image");
	if (buffer.length > MAX_IMAGE_BYTES) throw new Error("Gemini returned an image that is too large for Alpha");
	const mimetype = imageMimeFromBuffer(buffer);
	if (!mimetype) throw new Error("Gemini returned data that is not a supported PNG, JPEG or WebP image");
	return { buffer, mimetype };
};

const generateGeminiImage = async (rawPrompt) => {
	const apiKey = String(process.env.GOOGLE_API_KEY || "").trim();
	if (!apiKey) throw new Error("GOOGLE_API_KEY is not configured");
	const model = String(process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image").trim();
	if (!/^[a-zA-Z0-9._-]{3,100}$/.test(model)) throw new Error("GEMINI_IMAGE_MODEL is invalid");
	const prompt = String(rawPrompt || "").trim().slice(0, 1400);
	const endpoint = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent`;
	const response = await fetch(endpoint, {
		method: "POST",
		headers: {
			"x-goog-api-key": apiKey,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			contents: [{ parts: [{ text: prompt }] }],
			generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
		}),
		signal: AbortSignal.timeout(120_000),
	});
	if (!response.ok) {
		let detail = "";
		try {
			const data = await response.json();
			detail = cleanError(data?.error?.message || data?.message);
		} catch {}
		throw new Error(`Gemini image provider HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
	}
	const data = await response.json();
	const parts = data?.candidates?.[0]?.content?.parts || [];
	const imagePart = parts.find((part) => part?.inlineData?.data || part?.inline_data?.data);
	const base64 = imagePart?.inlineData?.data || imagePart?.inline_data?.data;
	if (!base64) throw new Error("Gemini returned no generated image in the response");
	const image = validateGeneratedImage(Buffer.from(base64, "base64"));
	return { ...image, provider: "gemini", model };
};

export const imageProviderStatus = () => {
	const primary = primaryProviderStatus();
	return {
		...primary,
		gemini: Boolean(String(process.env.GOOGLE_API_KEY || "").trim()),
		geminiModel: String(process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image").trim(),
	};
};

export const generateAlphaImage = async (prompt) => {
	let primaryError = null;
	try {
		return await generatePrimaryImage(prompt);
	} catch (error) {
		primaryError = error;
	}

	if (String(process.env.GOOGLE_API_KEY || "").trim()) {
		try {
			return await generateGeminiImage(prompt);
		} catch (error) {
			throw new Error(`${cleanError(primaryError?.message)} | ${cleanError(error.message)}`.replace(/^\s*\|\s*/, "").slice(0, 650));
		}
	}

	throw primaryError || new Error("image generation is not configured");
};
