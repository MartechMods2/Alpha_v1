import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSafeSettings } from "../db/safePackData.js";
import { redactPii } from "./safePack.js";
import { getCreatorBirthdayKnowledge } from "./creatorBirthday.js";

const PROVIDERS = Object.freeze([
  "groq",
  "gemini",
  "mistral",
  "kilo",
  "cloudflare",
  "openrouter",
  "aion",
  "nvidia",
]);

const providerState = new Map();
const providerCircuits = new Map();

const emptyProviderMetrics = () => ({
  requests: 0,
  successes: 0,
  failures: 0,
  retries: 0,
  probes: 0,
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
});

const metrics = {
  requests: 0,
  successes: 0,
  failures: 0,
  failovers: 0,
  retries: 0,
  probes: 0,
  byProvider: Object.fromEntries(PROVIDERS.map((name) => [name, emptyProviderMetrics()])),
};

const creatorName = String(process.env.ALPHA_CREATOR_NAME || "Martech").trim() || "Martech";
const creatorIdentity = () => `Alpha identity rule: Alpha was created by ${creatorName}. If a user directly asks who created Alpha, who Alpha belongs to, or who its creator/moderator is, answer ${creatorName}. Do not repeatedly mention the creator's name in unrelated replies, generated game prompts, summaries, or ordinary conversation. ${getCreatorBirthdayKnowledge()}`;

const clamp = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

const aiTimeoutMs = () => clamp(process.env.ALPHA_AI_TIMEOUT_MS, 5_000, 60_000, 15_000);
const providerTimeoutMs = (name) =>
  clamp(process.env[`${String(name || "").toUpperCase()}_AI_TIMEOUT_MS`], 5_000, 60_000, aiTimeoutMs());
const retryCount = () => clamp(process.env.ALPHA_AI_RETRIES, 0, 2, 0);
const maxOutputTokens = () => clamp(process.env.ALPHA_AI_MAX_TOKENS, 100, 2400, 850);
const probeOutputTokens = () => clamp(process.env.ALPHA_AI_PROBE_MAX_TOKENS, 64, 512, 256);

const providerDefinitions = () => ({
  groq: {
    key: process.env.GROQ_API_KEY || "",
    model: process.env.GROQ_AI_MODEL || "openai/gpt-oss-120b",
    url: "https://api.groq.com/openai/v1/chat/completions",
  },
  gemini: {
    key: process.env.GOOGLE_API_KEY || "",
    model: process.env.GEMINI_TEXT_MODEL || process.env.GEMINI_MEDIA_MODEL || "gemini-3.5-flash-lite",
  },
  mistral: {
    key: process.env.MISTRAL_API_KEY || "",
    model: process.env.MISTRAL_AI_MODEL || "mistral-small-latest",
    url: "https://api.mistral.ai/v1/chat/completions",
  },
  kilo: {
    key: process.env.KILO_API_KEY || "",
    model: process.env.KILO_AI_MODEL || "kilo-auto/free",
    url: "https://api.kilo.ai/api/gateway/chat/completions",
  },
  cloudflare: {
    key: process.env.CLOUDFLARE_API_TOKEN || "",
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || "",
    model: process.env.CLOUDFLARE_AI_MODEL || "@cf/zai-org/glm-4.7-flash",
    get url() {
      return this.accountId
        ? `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(this.accountId)}/ai/v1/chat/completions`
        : "";
    },
  },
  openrouter: {
    key: process.env.OPENROUTER_API_KEY || "",
    model: process.env.OPENROUTER_AI_MODEL || "openrouter/free",
    url: "https://openrouter.ai/api/v1/chat/completions",
  },
  aion: {
    key: process.env.AION_API_KEY || "",
    model: process.env.AION_AI_MODEL || "aion-labs/aion-3.0-mini",
    url: "https://api.aionlabs.ai/v1/chat/completions",
  },
  nvidia: {
    key: process.env.NVIDIA_API_KEY || "",
    model: process.env.NVIDIA_AI_MODEL || "openai/gpt-oss-20b",
    url: "https://integrate.api.nvidia.com/v1/chat/completions",
  },
});

export const getAiProviderNames = () => [...PROVIDERS];

const defaultProviderOrder = Object.freeze([
  "groq",
  "kilo",
  "cloudflare",
  "openrouter",
  "gemini",
  "aion",
  "mistral",
  "nvidia",
]);

const disabledProviders = () => new Set(
  String(process.env.ALPHA_AI_DISABLED_PROVIDERS || "")
    .toLowerCase()
    .split(",")
    .map((value) => value.trim())
    .filter((value) => PROVIDERS.includes(value)),
);

const providerOrder = () => {
  const raw = String(process.env.ALPHA_AI_PROVIDER_ORDER || "").trim();
  const requested = (raw ? raw.split(",") : defaultProviderOrder)
    .map((value) => String(value).toLowerCase().trim())
    .filter((value) => PROVIDERS.includes(value));
  const disabled = disabledProviders();
  return [...new Set(requested)].filter((name) => !disabled.has(name));
};

const providerConfigured = (name) => {
  const config = providerDefinitions()[name];
  if (!config) return false;
  if (name === "cloudflare") return Boolean(config.key && config.accountId);
  return Boolean(config.key);
};

const providerModel = (name) => providerDefinitions()[name]?.model || "";
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
  constructor(provider, code, message, { status = 0, retryable = false, retryAfterMs = 0 } = {}) {
    super(message);
    this.name = "AiProviderError";
    this.provider = provider;
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
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

const parseRetryAfterMs = (value) => {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const dateMs = Date.parse(value);
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - Date.now()) : 0;
};

const classifyHttpError = (provider, status, message = "", retryAfterMs = 0) => {
  if (status === 401 || status === 403) {
    return new AiProviderError(provider, "AI_PROVIDER_AUTH", message || "Provider rejected the API key.", {
      status, retryable: false, retryAfterMs,
    });
  }
  if (status === 402) {
    return new AiProviderError(provider, "AI_PROVIDER_QUOTA", message || "Provider credits or quota are exhausted.", {
      status, retryable: false, retryAfterMs,
    });
  }
  if (status === 404) {
    return new AiProviderError(provider, "AI_PROVIDER_MODEL", message || "Provider model or endpoint was not found.", {
      status, retryable: false, retryAfterMs,
    });
  }
  if (status === 429) {
    return new AiProviderError(provider, "AI_PROVIDER_RATE_LIMIT", message || "Provider rate limit reached.", {
      status, retryable: false, retryAfterMs,
    });
  }
  if ([408, 425].includes(status) || status >= 500) {
    return new AiProviderError(provider, "AI_PROVIDER_TEMPORARY", message || `Provider request failed (${status}).`, {
      status, retryable: true, retryAfterMs,
    });
  }
  return new AiProviderError(provider, "AI_PROVIDER_REQUEST", message || `Provider request failed (${status}).`, {
    status, retryable: false, retryAfterMs,
  });
};

const normalizeThrownError = (provider, error) => {
  if (error instanceof AiProviderError) return error;
  if (error?.name === "AbortError" || /timed? ?out|timeout/i.test(String(error?.message || ""))) {
    return new AiProviderError(provider, "AI_PROVIDER_TIMEOUT", "Provider request timed out.", {
      status: 504, retryable: true,
    });
  }
  const message = String(error?.message || error || "Unknown provider error");
  const statusMatch = message.match(/\b(400|401|402|403|404|408|425|429|5\d\d)\b/);
  if (statusMatch) return classifyHttpError(provider, Number(statusMatch[1]), message);
  if (/quota|credits? exhausted|insufficient balance/i.test(message)) {
    return new AiProviderError(provider, "AI_PROVIDER_QUOTA", message, { status: 402, retryable: false });
  }
  if (/rate.?limit|resource exhausted/i.test(message)) {
    return new AiProviderError(provider, "AI_PROVIDER_RATE_LIMIT", message, { status: 429, retryable: false });
  }
  if (/api.?key|permission|forbidden|unauthori[sz]ed|credential/i.test(message)) {
    return new AiProviderError(provider, "AI_PROVIDER_AUTH", message, { status: 401, retryable: false });
  }
  if (/model.*(?:not found|unknown|invalid)|unknown model/i.test(message)) {
    return new AiProviderError(provider, "AI_PROVIDER_MODEL", message, { status: 404, retryable: false });
  }
  if (/fetch failed|network|socket|econn|connection/i.test(message)) {
    const cause = String(error?.cause?.code || error?.cause?.message || "").slice(0, 120);
    const detail = cause ? `${message} (${cause})` : message;
    return new AiProviderError(provider, "AI_PROVIDER_NETWORK", detail, { status: 503, retryable: true });
  }
  return new AiProviderError(provider, "AI_PROVIDER_ERROR", message, { status: 502, retryable: false });
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = async (provider, promiseFactory) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), providerTimeoutMs(provider));
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

const cooldownForError = (error, consecutiveFailures) => {
  if (error.retryAfterMs > 0) return clamp(error.retryAfterMs, 2_000, 6 * 60 * 60_000, 60_000);
  if (error.code === "AI_PROVIDER_AUTH") return 15 * 60_000;
  if (error.code === "AI_PROVIDER_QUOTA") return 6 * 60 * 60_000;
  if (error.code === "AI_PROVIDER_RATE_LIMIT") return 60_000;
  if (error.code === "AI_PROVIDER_MODEL") return 30 * 60_000;
  if (error.code === "AI_PROVIDER_REQUEST") return 10 * 60_000;
  if (["AI_PROVIDER_TIMEOUT", "AI_PROVIDER_NETWORK", "AI_PROVIDER_TEMPORARY", "AI_EMPTY_RESPONSE"].includes(error.code)) {
    return consecutiveFailures >= 2 ? 90_000 : 45_000;
  }
  if (consecutiveFailures >= 3) return 60_000;
  return 0;
};

const markFailure = (name, error, latencyMs) => {
  const circuit = circuitFor(name);
  circuit.consecutiveFailures += 1;
  circuit.lastFailureCode = error.code || "AI_PROVIDER_ERROR";
  const cooldown = cooldownForError(error, circuit.consecutiveFailures);
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
    lastFailureAt: new Date().toISOString(),
  });
};

const markSuccess = (name, latencyMs) => {
  const circuit = circuitFor(name);
  circuit.consecutiveFailures = 0;
  circuit.openUntil = 0;
  circuit.lastFailureCode = "";
  circuit.openedAt = null;
  note(name, true, {
    code: "OK",
    status: 200,
    latencyMs,
    consecutiveFailures: 0,
    lastSuccessAt: new Date().toISOString(),
  });
};
const circuitOpen = (name) => circuitFor(name).openUntil > Date.now();

const parseProviderBody = async (response) => {
  const raw = await response.text();
  if (!raw) return {};
  try { return JSON.parse(raw); }
  catch { return { raw: raw.slice(0, 500) }; }
};

const extractText = (content) => {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((item) => (typeof item === "string" ? item : item?.text || item?.content || ""))
      .join("")
      .trim();
  }
  return String(content?.text || content?.content || "").trim();
};

const normalizeUsage = (data = {}) => {
  const raw = data?.usage || {};
  const inputTokens = Number(raw.prompt_tokens ?? raw.input_tokens ?? 0) || 0;
  const outputTokens = Number(raw.completion_tokens ?? raw.output_tokens ?? 0) || 0;
  const totalTokens = Number(raw.total_tokens ?? inputTokens + outputTokens) || inputTokens + outputTokens;
  return { inputTokens, outputTokens, totalTokens };
};

const openAiHeaders = (name, config) => {
  const headers = {
    Authorization: `Bearer ${config.key}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (name === "openrouter") {
    if (process.env.HOST_URL) headers["HTTP-Referer"] = process.env.HOST_URL;
    headers["X-Title"] = process.env.OPENROUTER_APP_NAME || "Alpha by Martech";
  }
  return headers;
};

const askOpenAiCompatible = async (name, systemPrompt, messages, { maxTokens = maxOutputTokens(), isProbe = false } = {}) => {
  const config = providerDefinitions()[name];
  if (!providerConfigured(name)) {
    throw new AiProviderError(name, "AI_NOT_CONFIGURED", `${name} is not configured.`, { status: 503 });
  }
  return withTimeout(name, async (signal) => {
    const body = {
      model: config.model,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.5,
      max_tokens: maxTokens,
      stream: false,
    };
    if (name === "groq") {
      body.reasoning_effort = process.env.GROQ_REASONING_EFFORT || "low";
      body.include_reasoning = false;
    }
    if (name === "cloudflare") {
      body.options = { rejectIfBusy: true };
      body.reasoning_effort = isProbe ? "low" : (process.env.CLOUDFLARE_REASONING_EFFORT || "low");
    }
    if (name === "aion") {
      body.reasoning_effort = isProbe ? "none" : (process.env.AION_REASONING_EFFORT || "low");
      body.reasoning_split = true;
    }
    const response = await fetch(config.url, {
      method: "POST",
      signal,
      headers: openAiHeaders(name, config),
      body: JSON.stringify(body),
    });
    const data = await parseProviderBody(response);
    if (!response.ok) {
      const detail = String(
        data?.error?.message ||
        data?.error?.error ||
        data?.message ||
        data?.errors?.[0]?.message ||
        data?.raw || "",
      ).slice(0, 300);
      throw classifyHttpError(
        name,
        response.status,
        detail,
        parseRetryAfterMs(response.headers.get("retry-after")),
      );
    }
    const choice = data?.choices?.[0] || {};
    const text = extractText(choice?.message?.content);
    if (!text) {
      const finishReason = String(choice?.finish_reason || "unknown");
      const hasReasoning = Boolean(extractText(choice?.message?.reasoning));
      const reason = hasReasoning && finishReason === "length"
        ? `${name} used the output budget on reasoning before producing visible text.`
        : `${name} returned no visible text (finish=${finishReason}).`;
      throw new AiProviderError(name, "AI_EMPTY_RESPONSE", reason, {
        status: 502, retryable: true,
      });
    }
    return { text, usage: normalizeUsage(data) };
  });
};

const askGemini = async (systemPrompt, messages, { maxTokens = maxOutputTokens() } = {}) => {
  if (!process.env.GOOGLE_API_KEY) {
    throw new AiProviderError("gemini", "AI_NOT_CONFIGURED", "GOOGLE_API_KEY is not configured.", { status: 503 });
  }
  const model = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY).getGenerativeModel({
    model: providerModel("gemini"),
    systemInstruction: systemPrompt,
    generationConfig: { temperature: 0.5, maxOutputTokens: maxTokens },
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
      throw new AiProviderError("gemini", "AI_EMPTY_RESPONSE", "Gemini returned no text.", {
        status: 502, retryable: true,
      });
    }
    const usageMetadata = response?.response?.usageMetadata || {};
    return {
      text,
      usage: {
        inputTokens: Number(usageMetadata.promptTokenCount || 0),
        outputTokens: Number(usageMetadata.candidatesTokenCount || 0),
        totalTokens: Number(usageMetadata.totalTokenCount || 0),
      },
    };
  });
};

const providerFn = (name) => name === "gemini"
  ? askGemini
  : (systemPrompt, messages, options) => askOpenAiCompatible(name, systemPrompt, messages, options);

const applyUsageMetrics = (name, providerUsage = {}) => {
  const stats = metrics.byProvider[name];
  stats.inputTokens += Number(providerUsage.inputTokens || 0);
  stats.outputTokens += Number(providerUsage.outputTokens || 0);
  stats.totalTokens += Number(providerUsage.totalTokens || 0);
};
const runProvider = async (
  name,
  systemPrompt,
  messages,
  {
    force = false,
    retries = retryCount(),
    countMetrics = true,
    isProbe = false,
    affectCircuit = true,
    maxTokens = maxOutputTokens(),
  } = {},
) => {
  if (!providerConfigured(name)) {
    throw new AiProviderError(name, "AI_NOT_CONFIGURED", `${name} is not configured.`, { status: 503 });
  }
  if (!force && circuitOpen(name)) {
    throw new AiProviderError(name, "AI_PROVIDER_CIRCUIT_OPEN", `${name} is temporarily paused after repeated failures.`, {
      status: 503,
    });
  }
  const maxAttempts = 1 + retries;
  let lastError = null;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const started = Date.now();
    if (countMetrics) metrics.byProvider[name].requests += 1;
    if (isProbe) {
      metrics.probes += 1;
      metrics.byProvider[name].probes += 1;
    }
    try {
      const result = await providerFn(name)(systemPrompt, messages, { maxTokens, isProbe });
      const latencyMs = Date.now() - started;
      if (countMetrics) {
        metrics.byProvider[name].successes += 1;
        applyUsageMetrics(name, result.usage);
      }
      if (affectCircuit) {
        markSuccess(name, latencyMs);
      } else {
        note(name, true, { code: "OK", status: 200, latencyMs, consecutiveFailures: circuitFor(name).consecutiveFailures });
      }
      return {
        text: result.text,
        provider: name,
        latencyMs,
        attempts: attempt + 1,
        usage: result.usage || {},
      };
    } catch (rawError) {
      const error = normalizeThrownError(name, rawError);
      lastError = error;
      if (countMetrics) metrics.byProvider[name].failures += 1;
      const latencyMs = Date.now() - started;
      if (affectCircuit) {
        markFailure(name, error, latencyMs);
      } else {
        note(name, false, {
          code: error.code,
          status: error.status || 0,
          error: error.message,
          latencyMs,
          consecutiveFailures: circuitFor(name).consecutiveFailures,
          lastFailureAt: new Date().toISOString(),
        });
      }
      if (!error.retryable || attempt >= maxAttempts - 1) break;
      if (countMetrics) {
        metrics.retries += 1;
        metrics.byProvider[name].retries += 1;
      }
      await sleep(350 * (attempt + 1));
    }
  }
  throw lastError || new AiProviderError(name, "AI_PROVIDER_ERROR", "Provider failed.", { status: 502 });
};
export const hasConfiguredAiProvider = () => providerOrder().some(providerConfigured);

export const askSafeAi = async ({ groupJid = "direct", systemPrompt, messages }) => {
  const settings = groupJid.endsWith("@g.us") ? await getSafeSettings(groupJid) : { aiPiiRedaction: true };
  const safeMessages = messages.map((item) => ({
    ...item,
    content: settings.aiPiiRedaction === false ? String(item.content) : redactPii(item.content),
  }));
  const effectiveSystemPrompt = `${String(systemPrompt || "").trim()}\n\n${creatorIdentity()}`.trim();

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
          usage: result.usage,
          triedProviders: errors.length + 1,
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

export const probeAiProviders = async ({ live = false, providers: requestedProviders = null } = {}) => {
  if (!live) return getAiRuntimeStatus();
  const selected = Array.isArray(requestedProviders) && requestedProviders.length
    ? [...new Set(requestedProviders.map((name) => String(name).toLowerCase()).filter((name) => PROVIDERS.includes(name)))]
    : providerOrder();
  const results = {};
  await Promise.all(selected.map(async (name) => {
    if (!providerConfigured(name)) {
      results[name] = { configured: false, ok: false, code: "AI_NOT_CONFIGURED" };
      return;
    }
    try {
      const result = await runProvider(
        name,
        "You are a health-check endpoint. Reply with exactly OK.",
        [{ role: "user", content: "health check" }],
        {
          force: true,
          retries: 0,
          countMetrics: false,
          isProbe: true,
          affectCircuit: false,
          maxTokens: probeOutputTokens(),
        },
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
  }));
  return { ...getAiRuntimeStatus(), live: results };
};

export const resetAiProviderHealth = () => {
  providerCircuits.clear();
  providerState.clear();
  return getAiRuntimeStatus();
};

export const getAiRuntimeStatus = () => {
  const providers = {};
  const order = providerOrder();
  for (const name of PROVIDERS) {
    const circuit = circuitFor(name);
    const state = providerState.get(name) || {};
    providers[name] = {
      configured: providerConfigured(name),
      enabled: order.includes(name),
      model: providerModel(name),
      timeoutMs: providerTimeoutMs(name),
      ok: state.ok ?? null,
      code: state.code || "",
      status: Number(state.status || 0),
      error: state.error || "",
      checkedAt: state.checkedAt || null,
      latencyMs: Number(state.latencyMs || 0),
      consecutiveFailures: circuit.consecutiveFailures,
      circuitOpen: circuit.openUntil > Date.now(),
      circuitOpenUntil: circuit.openUntil > Date.now() ? new Date(circuit.openUntil).toISOString() : null,
      lastSuccessAt: state.lastSuccessAt || null,
      lastFailureAt: state.lastFailureAt || null,
      stats: { ...metrics.byProvider[name] },
    };
  }
  const healthy = order.find(
    (name) => providers[name]?.configured && providers[name]?.ok === true && !providers[name]?.circuitOpen,
  ) || null;
  const available = order.filter(
    (name) => providers[name]?.configured && !providers[name]?.circuitOpen,
  );
  const activeIndex = healthy ? available.indexOf(healthy) : -1;
  const nextProvider = activeIndex >= 0
    ? (available.slice(activeIndex + 1)[0] || null)
    : (available[0] || null);
  return {
    ready: hasConfiguredAiProvider(),
    operational: Boolean(healthy),
    preferredOrder: order,
    disabledProviders: [...disabledProviders()],
    activeProvider: healthy,
    nextProvider,
    timeoutMs: aiTimeoutMs(),
    retries: retryCount(),
    maxOutputTokens: maxOutputTokens(),
    probeOutputTokens: probeOutputTokens(),
    providers,
    requests: metrics.requests,
    successes: metrics.successes,
    failures: metrics.failures,
    failovers: metrics.failovers,
    retriesPerformed: metrics.retries,
    probes: metrics.probes,
  };
};
