import { normalizeUserJid } from "./groupParticipants.js";

export const COUNT_REVIEW_TTL_MS = 5 * 60 * 1000;

const reviews = new Map();

const reviewKey = (groupJid, senderJid) =>
	`${groupJid}:${normalizeUserJid(senderJid) || senderJid}`;

const aliasesForMembers = (members = []) => {
	const aliases = new Set();
	for (const member of members) {
		for (const value of [member?.id, ...(Array.isArray(member?.aliases) ? member.aliases : [])]) {
			const normalized = normalizeUserJid(value);
			if (normalized) aliases.add(normalized);
		}
	}
	return [...aliases];
};

const cleanupExpired = () => {
	const now = Date.now();
	for (const [key, review] of reviews.entries()) {
		if (!review || review.expiresAt <= now) reviews.delete(key);
	}
};

export const saveCountReview = ({ groupJid, senderJid, members = [], label = "count review" }) => {
	cleanupExpired();
	const review = {
		label: String(label || "count review").slice(0, 120),
		memberAliases: aliasesForMembers(members),
		memberCount: members.length,
		createdAt: Date.now(),
		expiresAt: Date.now() + COUNT_REVIEW_TTL_MS,
	};
	reviews.set(reviewKey(groupJid, senderJid), review);
	return review;
};

export const getCountReview = ({ groupJid, senderJid }) => {
	cleanupExpired();
	return reviews.get(reviewKey(groupJid, senderJid)) || null;
};

export const clearCountReview = ({ groupJid, senderJid }) =>
	reviews.delete(reviewKey(groupJid, senderJid));
