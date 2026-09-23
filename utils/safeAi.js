import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSafeSettings } from "../db/safePackData.js";
import { redactPii } from "./safePack.js";

const providerState = new Map();
const providerCircuits = new Map();
const usage = new Map();
const day = () => new Date().toISOString().slice(0, 10);
let lastUsageDay = day();

const metrics = {
  requests: 0,
  successes: 0,
  failures: 0,
  failovers: 0,
  retries: 0,
  byProvider: {
    nvidia: { requests: 0, successes: 0, failures: 0, retries: 0 },
    gemini: { requests: 0, successes: 0, failures: 0, retries: 0 },
  },
};

const creatorName = String(process.env.ALPHA_CREATOR_NAME || "Martech").trim() || "Martech";
const creatorIdentity = `Alpha identity rule: Alpha was created by ${creatorName}. If a user directly asks who created Alpha, who Alpha belongs to, or who its creator/moderator is, answer ${creatorName}. Do not repeatedly mention the creator's name in unrelated replies, generated game prompts, summaries, or ordinary conversation.`;

const clamp = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

const aiTimeoutMs = () => clamp(process.env.ALPHA_AI_TIMEOUT_MS, 5_000, 60_000, 20_000);
const retryCount = () => clamp(process.env.ALPHA_AI_RETRIES, 0, 2, 1);
const nvidiaModel = () => process.env.NVIDIA_AI_MODEL || "openai/gpt-oss-20b";
const geminiModel = () => process.env.GEMINI_TEXT_MODEL || process.env.GEMINI_MEDIA_MODEL || "gemini-2.0-flash";

const providerOrder = () => {
  const configured = String(process.env.ALPHA_AI_PROVIDER_ORDER || "nvidia,gemini")
    .toLowerCase()
    .split(",")
    .map((value) => value.trim())
    .filter((value) => ["nvidia", "gemini"].includes(value));
  return [...new Set([...configured, "nvidia", "gemini"])];
};

const providerConfigured = (name) =>
  name === "nvidia" ? Boolean(process.env.NVIDIA_API_KEY) : Boolean(process.env.GOOGLE_API_KEY);

const providerModel = (name) => (name === "nvidia" ? nvidiaModel() : geminiModel());

const circuitFor = (name) => {
  if (!providerCircuits.has(name)) {
    providerCircuits.set(name, {
      consecutiveFailures: 0,
      openUntil: 0,
      lastFailureCode: "",
      openedAt: null,
    });
  }
  return providerCircuits.get(name);
};

const note = (name, ok, detail = {}) => {
  providerState.set(name, {
    ok,
    checkedAt: new Date().toISOString(),
    model: providerModel(name),
    ...detail,
    error: detail.error ? String(detail.error).slice(0, 300) : "",
  });
};

class AiProviderError extends Error {
  constructor(provider, code, message, { status = 0, retryable = false } = {}) {
    super(message);
    this.name = "AiProviderError";
    this.provider = provider;
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

export class AiUnavailableError extends Error {
  constructor(errors = []) {
    super("No AI provider is currently available.");
    this.name = "AiUnavailableError";
    this.code = "AI_ALL_PROVIDERS_FAILED";
    this.providers = errors.map((error) => ({
      provider: error?.provider || "unknown",
      code: error?.code || "AI_PROVIDER_ERROR",
      status: Number(error?.status || 0),
    }));
  }
}

const classifyHttpError = (provider, status, message = "") => {
  if (status === 401 || status === 403) {
    return new AiProviderError(provider, "AI_PROVIDER_AUTH", message || "Provider rejected the API key.", { status, retryable: false });
  }
  if (status === 429) {
    return new AiProviderError(provider, "AI_PROVIDER_RATE_LIMIT", message || "Provider rate limit reached.", { status, retryable: false });
  }
  if ([408, 425].includes(status) || status >= 500) {
    return new AiProviderError(provider, "AI_PROVIDER_TEMPORARY", message || `Provider request failed (${status}).`, { status, retryable: true });
  }
  return new AiProviderError(provider, "AI_PROVIDER_REQUEST", message || `Provider request failed (${status}).`, { status, retryable: false });
};

const normalizeThrownError = (provider, error) => {
  if (error instanceof AiProviderError) return error;
  if (error?.name === "AbortError" || /timed? ?out|timeout/i.test(String(error?.message || ""))) {
    return new AiProviderError(provider, "AI_PROVIDER_TIMEOUT", "Provider request timed out.", { status: 504, retryable: true });
  }
  const message = String(error?.message || error || "Unknown provider error");
  const statusMatch = message.match(/\b(401|403|408|425|429|5\d\d)\b/);
  if (statusMatch) return classifyHttpError(provider, Number(statusMatch[1]), message);
  if (/quota|rate.?limit|resource exhausted/i.test(message)) {
    return new AiProviderError(provider, "AI_PROVIDER_RATE_LIMIT", message, { status: 429, retryable: false });
  }
  if (/api.?key|permission|forbidden|unauthori[sz]ed|credential/i.test(message)) {
    return new AiProviderError(provider, "AI_PROVIDER_AUTH", message, { status: 401, retryable: false });
  }
  if (/fetch failed|network|socket|econn|connection/i.test(message)) {
    return new AiProviderError(provider, "AI_PROVIDER_NETWORK", message, { status: 503, retryable: true });
  }
  return new AiProviderError(provider, "AI_PROVIDER_ERROR", message, { status: 502, retryable: false });
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = async (provider, promiseFactory) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), aiTimeoutMs());
  try {
    return await promiseFactory(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new AiProviderError(provider, "AI_PROVIDER_TIMEOUT", "Provider request timed out.", { status: 504, retryable: true });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const markFailure = (name, error, latencyMs) => {
  const circuit = circuitFor(name);
  circuit.consecutiveFailures += 1;
  circuit.lastFailureCode = error.code || "AI_PROVIDER_ERROR";

  let cooldown = 0;
  if (error.code === "AI_PROVIDER_AUTH") cooldown = 5 * 60_000;
  else if (error.code === "AI_PROVIDER_RATE_LIMIT") cooldown = 2 * 60_000;
  else if (circuit.consecutiveFailures >= 2 && ["AI_PROVIDER_TIMEOUT", "AI_PROVIDER_NETWORK", "AI_PROVIDER_TEMPORARY"].includes(error.code)) cooldown = 90_000;
  else if (circuit.consecutiveFailures >= 3) cooldown = 60_000;

  if (cooldown > 0) {
    circuit.openUntil = Date.now() + cooldown;
    circuit.openedAt = new Date().toISOString();
  }

  note(name, false, {
    code: error.code,
    status: error.status || 0,
    error: error.message,
    latencyMs,
    consecutiveFailures: circuit.consecutiveFailures,
  });
};

const markSuccess = (name, latencyMs) => {
  const circuit = circuitFor(name);
  circuit.consecutiveFailures = 0;
  circuit.openUntil = 0;
  circuit.lastFailureCode = "";
  circuit.openedAt = null;
  note(name, true, { code: "OK", status: 200, latencyMs, consecutiveFailures: 0 });
};

const circuitOpen = (name) => circuitFor(name).openUntil > Date.now();

const parseProviderBody = async (response) => {
  const raw = await response.text();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { raw: raw.slice(0, 500) };
  }
};

const askNvidia = async (systemPrompt, messages) => {
  if (!process.env.NVIDIA_API_KEY) {
    throw new AiProviderError("nvidia", "AI_NOT_CONFIGURED", "NVIDIA_API_KEY is not configured.", { status: 503 });
  }

  return withTimeout("nvidia", async (signal) => {
    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: nvidiaModel(),
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        temperature: 0.5,
        max_tokens: clamp(process.env.ALPHA_AI_MAX_TOKENS, 200, 1800, 850),
        stream: false,
      }),
    });

    const data = await parseProviderBody(response);
    if (!response.ok) {
      const detail = String(data?.error?.message || data?.message || data?.raw || "").slice(0, 300);
      throw classifyHttpError("nvidia", response.status, detail);
    }

    const text = String(data?.choices?.[0]?.message?.content || "").trim();
    if (!text) {
      throw new AiProviderError("nvidia", "AI_EMPTY_RESPONSE", "NVIDIA returned no text.", { status: 502, retryable: true });
    }
    return text;
  });
};

const askGemini = async (systemPrompt, messages) => {
  if (!process.env.GOOGLE_API_KEY) {
    throw new AiProviderError("gemini", "AI_NOT_CONFIGURED", "GOOGLE_API_KEY is not configured.", { status: 503 });
  }

  const model = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY).getGenerativeModel({
    model: geminiModel(),
    systemInstruction: systemPrompt,
  });
  const prompt = messages
    .map((item) => `${item.role === "assistant" ? "Assistant" : "User"}: ${item.content}`)
    .join("\n\n");

  return withTimeout("gemini", async (signal) => {
    const resultPromise = model.generateContent(prompt);
    const abortPromise = new Promise((_, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    });
    const response = await Promise.race([resultPromise, abortPromise]);
    const text = String(response?.response?.text?.() || "").trim();
    if (!text) {
      throw new AiProviderError("gemini", "AI_EMPTY_RESPONSE", "Gemini returned no text.", { status: 502, retryable: true });
    }
    return text;
  });
};

const providerFn = (name) => (name === "nvidia" ? askNvidia : askGemini);

const runProvider = async (name, systemPrompt, messages, { force = false, retries = retryCount() } = {}) => {
  if (!providerConfigured(name)) {
    throw new AiProviderError(name, "AI_NOT_CONFIGURED", `${name} is not configured.`, { status: 503 });
  }
  if (!force && circuitOpen(name)) {
    throw new AiProviderError(name, "AI_PROVIDER_CIRCUIT_OPEN", `${name} is temporarily paused after repeated failures.`, { status: 503 });
  }

  const maxAttempts = 1 + retries;
  let lastError = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const started = Date.now();
    metrics.byProvider[name].requests += 1;
    try {
      const text = await providerFn(name)(systemPrompt, messages);
      const latencyMs = Date.now() - started;
      metrics.byProvider[name].successes += 1;
      markSuccess(name, latencyMs);
      return { text, provider: name, latencyMs, attempts: attempt + 1 };
    } catch (rawError) {
      const error = normalizeThrownError(name, rawError);
      lastError = error;
      metrics.byProvider[name].failures += 1;
      markFailure(name, error, Date.now() - started);

      if (!error.retryable || attempt >= maxAttempts - 1) break;
      metrics.retries += 1;
      metrics.byProvider[name].retries += 1;
      await sleep(350 * (attempt + 1));
    }
  }

  throw lastError || new AiProviderError(name, "AI_PROVIDER_ERROR", "Provider failed.", { status: 502 });
};

const pruneUsage = () => {
  const current = day();
  if (current === lastUsageDay && usage.size < 2000) return;
  lastUsageDay = current;
  const prefix = `${current}:`;
  for (const key of usage.keys()) if (!key.startsWith(prefix)) usage.delete(key);
  if (usage.size > 2500) {
    const extra = usage.size - 2000;
    for (const key of [...usage.keys()].slice(0, extra)) usage.delete(key);
  }
};

export const useSafeAiBudget = async (groupJid, memberJid) => {
  pruneUsage();
  const settings = await getSafeSettings(groupJid);
  const limit = Math.min(100, Math.max(1, Number(settings.aiDailyLimit) || 20));
  const key = `${day()}:${groupJid}:${memberJid}`;
  const used = usage.get(key) || 0;
  if (used >= limit) return false;
  usage.set(key, used + 1);
  return true;
};

export const hasConfiguredAiProvider = () => providerOrder().some(providerConfigured);

export const askSafeAi = async ({ groupJid = "direct", systemPrompt, messages }) => {
  const settings = groupJid.endsWith("@g.us") ? await getSafeSettings(groupJid) : { aiPiiRedaction: true };
  const safeMessages = messages.map((item) => ({
    ...item,
    content: settings.aiPiiRedaction === false ? String(item.content) : redactPii(item.content),
  }));
  const effectiveSystemPrompt = `${String(systemPrompt || "").trim()}\n\n${creatorIdentity}`.trim();

  metrics.requests += 1;
  const errors = [];
  const order = providerOrder();
  let triedConfigured = 0;

  for (const name of order) {
    if (!providerConfigured(name)) continue;
    triedConfigured += 1;
    try {
      const result = await runProvider(name, effectiveSystemPrompt, safeMessages);
      metrics.successes += 1;
      if (errors.length > 0) metrics.failovers += 1;
      return {
        text: result.text,
        provider: result.provider,
        meta: {
          latencyMs: result.latencyMs,
          attempts: result.attempts,
          failover: errors.length > 0,
        },
      };
    } catch (error) {
      errors.push(normalizeThrownError(name, error));
    }
  }

  metrics.failures += 1;
  if (triedConfigured === 0) {
    throw new AiProviderError("none", "AI_NOT_CONFIGURED", "No AI provider is configured.", { status: 503 });
  }
  throw new AiUnavailableError(errors);
};

export const probeAiProviders = async ({ live = false } = {}) => {
  if (!live) return getAiRuntimeStatus();
  const results = {};

  for (const name of ["nvidia", "gemini"]) {
    if (!providerConfigured(name)) {
      results[name] = { configured: false, ok: false, code: "AI_NOT_CONFIGURED" };
      continue;
    }
    try {
      const result = await runProvider(
        name,
        "You are a health-check endpoint. Reply with exactly OK.",
        [{ role: "user", content: "health check" }],
        { force: true, retries: 0 },
      );
      results[name] = { configured: true, ok: true, latencyMs: result.latencyMs, model: providerModel(name) };
    } catch (rawError) {
      const error = normalizeThrownError(name, rawError);
      results[name] = {
        configured: true,
        ok: false,
        code: error.code,
        status: error.status || 0,
        error: String(error.message || "").slice(0, 160),
        model: providerModel(name),
      };
    }
  }

  return { ...getAiRuntimeStatus(), live: results };
};

export const resetAiProviderHealth = () => {
  providerCircuits.clear();
  providerState.clear();
  return getAiRuntimeStatus();
};

export const getAiRuntimeStatus = () => {
  pruneUsage();
  const providers = {};

  for (const name of ["nvidia", "gemini"]) {
    const circuit = circuitFor(name);
    const state = providerState.get(name) || {};
    providers[name] = {
      configured: providerConfigured(name),
      model: providerModel(name),
      ok: state.ok ?? null,
      code: state.code || "",
      status: Number(state.status || 0),
      error: state.error || "",
      checkedAt: state.checkedAt || null,
      latencyMs: Number(state.latencyMs || 0),
      consecutiveFailures: circuit.consecutiveFailures,
      circuitOpen: circuit.openUntil > Date.now(),
      circuitOpenUntil: circuit.openUntil > Date.now() ? new Date(circuit.openUntil).toISOString() : null,
      stats: { ...metrics.byProvider[name] },
    };
  }

  const healthy = providerOrder().find((name) => providers[name]?.configured && providers[name]?.ok === true) || null;
  const available = providerOrder().find((name) => providers[name]?.configured && !providers[name]?.circuitOpen) || null;

  return {
    ready: hasConfiguredAiProvider(),
    preferredOrder: providerOrder(),
    activeProvider: healthy || available,
    timeoutMs: aiTimeoutMs(),
    retries: retryCount(),
    providers,
    requests: metrics.requests,
    successes: metrics.successes,
    failures: metrics.failures,
    failovers: metrics.failovers,
    retriesPerformed: metrics.retries,
    usageToday: [...usage.entries()]
      .filter(([key]) => key.startsWith(`${day()}:`))
      .reduce((sum, [, value]) => sum + value, 0),
    usageKeys: usage.size,
  };
};
