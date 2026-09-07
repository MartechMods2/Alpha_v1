import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

const tickets = new Map();
const TTL_MS = 60_000;
const MAX_TICKETS = 50;

const digest = (value) => createHash("sha256").update(String(value || "")).digest("hex");

const prune = () => {
	const now = Date.now();
	for (const [key, expiresAt] of tickets) if (expiresAt <= now) tickets.delete(key);
	while (tickets.size > MAX_TICKETS) tickets.delete(tickets.keys().next().value);
};

export const createAdminWebsocketTicket = () => {
	prune();
	const token = randomBytes(32).toString("base64url");
	tickets.set(digest(token), Date.now() + TTL_MS);
	return { token, expiresAt: new Date(Date.now() + TTL_MS).toISOString() };
};

export const consumeAdminWebsocketTicket = (token) => {
	prune();
	if (typeof token !== "string" || token.length < 32 || token.length > 128) return false;
	const key = digest(token);
	let matched = null;
	for (const candidate of tickets.keys()) {
		const a = Buffer.from(candidate, "hex");
		const b = Buffer.from(key, "hex");
		if (a.length === b.length && timingSafeEqual(a, b)) { matched = candidate; break; }
	}
	if (!matched) return false;
	const expiresAt = tickets.get(matched);
	tickets.delete(matched);
	return expiresAt > Date.now();
};

export const adminWebsocketTicketStats = () => { prune(); return { pending: tickets.size, ttlSeconds: TTL_MS / 1000 }; };
