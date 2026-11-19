import { BoundedTtlMap } from "./boundedTtlMap.js";
const deletionBudgets = new BoundedTtlMap({max:1000,ttl:60000});

export const claimDeletionBudget = (groupJid, limit = 10, windowMs = 60_000) => {
	const now = Date.now();
	const entries = (deletionBudgets.get(groupJid) || []).filter((time) => now - time < windowMs);
	if (entries.length >= limit) {
		deletionBudgets.set(groupJid, entries);
		return false;
	}
	entries.push(now);
	deletionBudgets.set(groupJid, entries);
	return true;
};

export const moderationCircuitStatus = () => ({ deletionGroups: deletionBudgets.size });
