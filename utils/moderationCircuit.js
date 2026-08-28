const deletionBudgets = new Map();

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
