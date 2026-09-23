import notifyOwner from "../notify/owner.js";

const alertCooldowns = new Map();
const ALERT_COOLDOWN_MS = 2 * 60_000;
const MAX_ALERT_KEYS = 250;

const redactSecrets = (value) => String(value || "")
  .replace(/([?&](?:key|api_key|token)=)[^&\s]+/gi, "$1[REDACTED]")
  .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s"']+/gi, "$1[REDACTED]")
  .replace(/\b(?:sk|gsk|AIza|nvapi)-?[A-Za-z0-9_\-]{16,}\b/g, "[REDACTED_KEY]")
  .replace(/\bBearer\s+[A-Za-z0-9._\-]{12,}\b/gi, "Bearer [REDACTED]");

const errorCode = (error) => String(error?.code || error?.status || "AI_ERROR").slice(0, 80);

export const sanitizeAlphaErrorMessage = (error, max = 1200) => {
  const message = error?.message || error || "Unknown Alpha AI failure";
  return redactSecrets(message).replace(/\s+/g, " ").trim().slice(0, max);
};

export const alphaPublicFailureMessage = (mode = "request") => {
  if (mode === "media") {
    return "⚡ Alpha could not inspect that media right now because the AI service is busy. Please try again shortly.";
  }
  if (mode === "voice") {
    return "⚡ Alpha could not create that voice response right now. Please try again shortly.";
  }
  if (mode === "image") {
    return "⚡ Alpha could not create that image right now. Please try again shortly.";
  }
  return "⚡ Alpha hit a temporary AI service problem. Please try again shortly.";
};

const prune = (now = Date.now()) => {
  for (const [key, expires] of alertCooldowns) if (expires <= now) alertCooldowns.delete(key);
  if (alertCooldowns.size <= MAX_ALERT_KEYS) return;
  const extra = [...alertCooldowns.keys()].slice(0, alertCooldowns.size - MAX_ALERT_KEYS);
  for (const key of extra) alertCooldowns.delete(key);
};

export const notifyAlphaOwnerFailure = ({
  sock,
  scope = "alpha",
  error,
  groupName = "",
  senderName = "",
  detail = "",
}) => {
  const safeError = sanitizeAlphaErrorMessage(error);
  const code = errorCode(error);
  const signature = `${scope}:${code}:${safeError.slice(0, 240)}`;
  const now = Date.now();
  prune(now);
  if ((alertCooldowns.get(signature) || 0) > now) return false;
  alertCooldowns.set(signature, now + ALERT_COOLDOWN_MS);

  const lines = [
    "🚨 *Alpha AI Error*",
    `Scope: *${String(scope || "alpha").slice(0, 80)}*`,
    `Code: *${code}*`,
  ];
  if (groupName) lines.push(`Group: *${String(groupName).replace(/[*_~`]/g, "").slice(0, 120)}*`);
  if (senderName) lines.push(`Triggered by: *${String(senderName).replace(/[*_~`]/g, "").slice(0, 80)}*`);
  if (detail) lines.push(`Context: ${redactSecrets(detail).replace(/\s+/g, " ").slice(0, 300)}`);
  lines.push("", safeError);

  try {
    notifyOwner(sock, lines.join("\n"));
    return true;
  } catch {
    return false;
  }
};

export const alphaErrorAlertStats = () => ({ dedupeKeys: alertCooldowns.size, cooldownMs: ALERT_COOLDOWN_MS });
