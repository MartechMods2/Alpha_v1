import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const invites = new Map();
const MAX_INVITES = 20;
const DEFAULT_TTL_MS = 15 * 60_000;

const digest = (value) => createHash("sha256").update(String(value)).digest();

const purge = (now = Date.now()) => {
	for (const [key, entry] of invites) if (entry.expiresAt <= now || entry.used) invites.delete(key);
	while (invites.size > MAX_INVITES) invites.delete(invites.keys().next().value);
};

export const createPairingInvite = (ttlMs = DEFAULT_TTL_MS) => {
	purge();
	const token = randomBytes(32).toString("base64url");
	const id = randomBytes(8).toString("hex");
	const boundedTtl = Math.min(30 * 60_000, Math.max(2 * 60_000, Number(ttlMs) || DEFAULT_TTL_MS));
	invites.set(id, { hash: digest(token), expiresAt: Date.now() + boundedTtl, used: false });
	return { token: `${id}.${token}`, expiresAt: new Date(Date.now() + boundedTtl) };
};

export const consumePairingInvite = (supplied) => {
	purge();
	const [id, token, ...extra] = String(supplied || "").split(".");
	if (!id || !token || extra.length) return false;
	const entry = invites.get(id);
	if (!entry || entry.used || entry.expiresAt <= Date.now()) return false;
	const candidate = digest(token);
	if (candidate.length !== entry.hash.length || !timingSafeEqual(candidate, entry.hash)) return false;
	entry.used = true;
	invites.delete(id);
	return true;
};

export const pairingInviteStats = () => {
	purge();
	return { active: invites.size, max: MAX_INVITES };
};
