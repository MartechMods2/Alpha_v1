// Poll votes require the original creation message, including its binary secret.
// Keep it independently of the short general message cache and persist a portable
// representation for getMessage after a reconnect or process restart.
const polls = new Map();
const cacheKey = (key) => `${key?.remoteJid || ""}:${key?.id || ""}`;

const encodeValue = (value) => {
  if (value instanceof Uint8Array) return { __alphaPollBytes: Buffer.from(value).toString("base64") };
  if (Array.isArray(value)) return value.map(encodeValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encodeValue(item)]));
  }
  return value;
};

export const encodePollMessage = (message) => JSON.stringify(encodeValue(message));
export const decodePollMessage = (encoded) => JSON.parse(encoded, (_key, value) =>
  value && typeof value.__alphaPollBytes === "string"
    ? Buffer.from(value.__alphaPollBytes, "base64")
    : value);

export const rememberPollMessage = (sentMessage, ttlMs) => {
  if (!sentMessage?.key?.id || !sentMessage?.message) return;
  const now = Date.now();
  for (const [key, entry] of polls) if (entry.expiresAt <= now) polls.delete(key);
  if (polls.size >= 500) polls.delete(polls.keys().next().value);
  polls.set(cacheKey(sentMessage.key), { message: sentMessage.message, expiresAt: now + ttlMs });
};

export const readCachedPollMessage = (key) => {
  const id = cacheKey(key);
  const entry = polls.get(id);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    polls.delete(id);
    return undefined;
  }
  return entry.message;
};
