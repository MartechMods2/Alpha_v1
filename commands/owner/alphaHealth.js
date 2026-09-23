import {
  getAiProviderNames,
  getAiRuntimeStatus,
  probeAiProviders,
  resetAiProviderHealth,
} from "../../utils/safeAi.js";

const icon = (provider) => {
  if (!provider.configured) return "⚪";
  if (provider.enabled === false) return "⚫";
  if (provider.circuitOpen) return "🟠";
  if (provider.ok === true) return "🟢";
  if (provider.ok === false) return "🔴";
  return "🟡";
};

const providerLine = (name, provider) => {
  const state = !provider.configured
    ? "NOT CONFIGURED"
    : provider.enabled === false
      ? "DISABLED"
      : provider.circuitOpen
      ? "CIRCUIT OPEN"
      : provider.ok === true
        ? "HEALTHY"
        : provider.ok === false
          ? "FAILED"
          : "NOT TESTED";

  const details = [];
  if (provider.model) details.push(`model=${provider.model}`);
  if (provider.code) details.push(`code=${provider.code}`);
  if (provider.status) details.push(`http=${provider.status}`);
  if (provider.latencyMs) details.push(`${provider.latencyMs}ms`);
  if (provider.timeoutMs) details.push(`timeout=${provider.timeoutMs}ms`);
  if (provider.consecutiveFailures) details.push(`fails=${provider.consecutiveFailures}`);
  if (provider.stats?.totalTokens) details.push(`tokens=${provider.stats.totalTokens}`);

  return `${icon(provider)} *${name.toUpperCase()}*: ${state}${details.length ? `\n   ${details.join(" · ")}` : ""}`;
};

const failureHint = (code) => ({
  AI_PROVIDER_NETWORK: "connection/DNS/TLS failure",
  AI_PROVIDER_MODEL: "model or endpoint unavailable",
  AI_PROVIDER_RATE_LIMIT: "rate or account quota reached",
  AI_PROVIDER_QUOTA: "credits/quota exhausted",
  AI_PROVIDER_AUTH: "API key or permission problem",
  AI_EMPTY_RESPONSE: "provider returned no visible answer",
  AI_PROVIDER_TIMEOUT: "provider exceeded Alpha timeout",
  AI_PROVIDER_TEMPORARY: "temporary upstream failure",
}[code] || "");

const formatStatus = (status, live = null) => {
  const names = getAiProviderNames();
  const configuredCount = names.filter((name) => status.providers[name]?.configured).length;
  const enabledCount = names.filter((name) => status.providers[name]?.enabled !== false).length;

  const lines = [
    "🧠 *Alpha AI Health*",
    `Configured: *${configuredCount}/${names.length}* · Enabled: *${enabledCount}/${names.length}*`,
    `Operational: *${status.operational ? "YES" : "NOT CONFIRMED"}*`,
    `Active provider: *${status.activeProvider || "none yet"}*`,
    `Next provider: *${status.nextProvider || "none"}*`,
    `Provider order: *${status.preferredOrder.join(" → ") || "none"}*`,
    `Disabled: *${status.disabledProviders?.length ? status.disabledProviders.join(", ") : "none"}*`,
    `Timeout: *${status.timeoutMs}ms* · Retries: *${status.retries}* · Max output: *${status.maxOutputTokens}* · Probe: *${status.probeOutputTokens}*`,
    "",
    ...names.map((name) => providerLine(name, status.providers[name])),
    "",
    `Requests: *${status.requests}* · Success: *${status.successes}* · Failed: *${status.failures}*`,
    `Failovers: *${status.failovers}* · Retries: *${status.retriesPerformed}* · Probes: *${status.probes}*`,
  ];

  if (live) {
    lines.push("", "🔬 *Live probe*");
    const liveNames = names.filter((name) => Object.prototype.hasOwnProperty.call(live, name));
    for (const name of liveNames) {
      const result = live[name];
      if (!result?.configured) {
        lines.push(`⚪ ${name.toUpperCase()}: not configured`);
      } else if (result.ok) {
        lines.push(`🟢 ${name.toUpperCase()}: PASS${result.latencyMs ? ` · ${result.latencyMs}ms` : ""}`);
      } else {
        const hint = failureHint(result.code);
        lines.push(
          `🔴 ${name.toUpperCase()}: ${result.code || "FAILED"}${result.status ? ` · HTTP ${result.status}` : ""}${hint ? ` · ${hint}` : ""}`,
        );
      }
    }
  }

  lines.push("", "No API keys or secret values are displayed.");
  return lines.join("\n").slice(0, 7500);
};

const handler = async (_sock, msg, from, args, info) => {
  const { command, sendMessageWTyping } = info;
  const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
  const action = command === "aitest" ? "test" : String(args[0] || "status").toLowerCase();

  try {
    if (action === "reset") {
      const status = resetAiProviderHealth();
      return reply(`♻️ *Alpha AI provider health reset.*\n\n${formatStatus(status)}`);
    }
    if (action === "test" || action === "live") {
      const target = String(command === "aitest" ? (args[0] || "") : (args[1] || "")).toLowerCase().trim();
      const providerNames = getAiProviderNames();
      if (target && !["all", "*"].includes(target) && !providerNames.includes(target)) {
        return reply(`❌ Unknown provider *${target}*. Use one of: ${providerNames.join(", ")}.`);
      }
      const providers = ["all", "*"].includes(target)
        ? providerNames
        : target
          ? [target]
          : null;
      const result = await probeAiProviders({ live: true, providers });
      return reply(formatStatus(result, result.live));
    }
    return reply(formatStatus(getAiRuntimeStatus()));
  } catch (error) {
    return reply(`❌ Alpha health check failed: ${String(error?.message || error).slice(0, 300)}`);
  }
};

export default () => ({
  cmd: ["alphahealth", "aistatus", "aitest"],
  desc: "Owner-only Alpha AI provider health, live tests, latency, failover and circuit status",
  usage: "alphahealth | alphahealth test [provider] | alphahealth reset | aitest [provider]",
  handler,
});
