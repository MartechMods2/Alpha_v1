import { createHash, timingSafeEqual } from "node:crypto";

const windows = new Map();
const WINDOW_MS = 60_000;
const DEFAULT_LIMIT = 10;

const constantTimeEqual = (left, right) => {
	const a = createHash("sha256").update(String(left || "")).digest();
	const b = createHash("sha256").update(String(right || "")).digest();
	return timingSafeEqual(a, b);
};

export const integrationApiConfigured = () => Boolean(process.env.INTEGRATION_API_KEY?.trim());

export const authenticateIntegrationRequest = (authorization) => {
	if (!integrationApiConfigured()) return { ok: false, status: 503, error: "Integration API is disabled." };
	const match = /^Bearer\s+(.+)$/i.exec(String(authorization || ""));
	if (!match || !constantTimeEqual(match[1], process.env.INTEGRATION_API_KEY.trim())) return { ok: false, status: 401, error: "Invalid integration credential." };
	return { ok: true };
};

export const integrationRecipientAllowed = (jid) => {
	const allowlist = String(process.env.INTEGRATION_ALLOWED_RECIPIENTS || "").split(",").map((x) => x.replace(/[^0-9]/g, "")).filter(Boolean);
	if (!allowlist.length) return false;
	const number = String(jid || "").split("@")[0].replace(/[^0-9]/g, "");
	return allowlist.includes(number);
};

export const consumeIntegrationRateLimit = (identity = "default") => {
	const now = Date.now();
	const limit = Math.max(1, Math.min(60, Number(process.env.INTEGRATION_RATE_LIMIT) || DEFAULT_LIMIT));
	const current = windows.get(identity);
	if (!current || current.resetAt <= now) { windows.set(identity, { count: 1, resetAt: now + WINDOW_MS }); return { ok: true, remaining: limit - 1 }; }
	if (current.count >= limit) return { ok: false, remaining: 0, retryAfter: Math.ceil((current.resetAt - now) / 1000) };
	current.count += 1;
	return { ok: true, remaining: limit - current.count };
};
