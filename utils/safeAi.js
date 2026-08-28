import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSafeSettings } from "../db/safePackData.js";
import { redactPii } from "./safePack.js";

const providerState = new Map(); const usage = new Map();
const day = () => new Date().toISOString().slice(0, 10);
const note = (name, ok, error = "") => providerState.set(name, { ok, error: String(error || "").slice(0, 300), checkedAt: new Date() });

const askNvidia = async (systemPrompt, messages) => {
	if (!process.env.NVIDIA_API_KEY) throw new Error("NVIDIA_API_KEY is not configured");
	const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: process.env.NVIDIA_AI_MODEL || "openai/gpt-oss-20b", messages: [{ role: "system", content: systemPrompt }, ...messages], temperature: 0.5, max_tokens: 700 }) });
	if (!response.ok) throw new Error(`NVIDIA ${response.status}`); const data = await response.json(); const text = data?.choices?.[0]?.message?.content?.trim(); if (!text) throw new Error("NVIDIA returned no text"); return text;
};

const askGemini = async (systemPrompt, messages) => {
	if (!process.env.GOOGLE_API_KEY) throw new Error("GOOGLE_API_KEY is not configured");
	const model = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY).getGenerativeModel({ model: process.env.GEMINI_TEXT_MODEL || process.env.GEMINI_MEDIA_MODEL || "gemini-2.0-flash", systemInstruction: systemPrompt });
	const prompt = messages.map((x) => `${x.role === "assistant" ? "Assistant" : "User"}: ${x.content}`).join("\n\n"); const response = await model.generateContent(prompt); const text = String(response.response.text() || "").trim(); if (!text) throw new Error("Gemini returned no text"); return text;
};

export const useSafeAiBudget = async (groupJid, memberJid) => {
	const settings = await getSafeSettings(groupJid); const limit = Math.min(100, Math.max(1, Number(settings.aiDailyLimit) || 20)); const key = `${day()}:${groupJid}:${memberJid}`; const used = usage.get(key) || 0; if (used >= limit) return false; usage.set(key, used + 1); return true;
};

export const askSafeAi = async ({ groupJid = "direct", systemPrompt, messages }) => {
	const settings = groupJid.endsWith("@g.us") ? await getSafeSettings(groupJid) : { aiPiiRedaction: true };
	const safeMessages = messages.map((x) => ({ ...x, content: settings.aiPiiRedaction === false ? String(x.content) : redactPii(x.content) })); const errors = [];
	for (const [name, fn] of [["nvidia", askNvidia], ["gemini", askGemini]]) {
		try { const text = await fn(systemPrompt, safeMessages); note(name, true); return { text, provider: name }; } catch (error) { note(name, false, error.message); errors.push(`${name}: ${error.message}`); }
	}
	throw new Error(`No AI provider is available (${errors.join("; ")})`);
};

export const getAiRuntimeStatus = () => ({
	providers: { nvidia: { configured: Boolean(process.env.NVIDIA_API_KEY), ...(providerState.get("nvidia") || {}) }, gemini: { configured: Boolean(process.env.GOOGLE_API_KEY), ...(providerState.get("gemini") || {}) } },
	usageToday: [...usage.entries()].filter(([key]) => key.startsWith(`${day()}:`)).reduce((sum, [, value]) => sum + value, 0),
});

