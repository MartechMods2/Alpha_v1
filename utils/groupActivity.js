import {
	isAdminParticipant,
	normalizeUserJid,
	participantJids,
} from "./groupParticipants.js";

const countValue = (value) => Math.max(0, Number(value) || 0);

const preferredJid = (aliases = []) =>
	aliases.find((jid) => jid.endsWith("@s.whatsapp.net")) ||
	aliases.find((jid) => jid.endsWith("@hosted")) ||
	aliases[0] ||
	"";

const latestDate = (rows) => {
	let latest = null;
	for (const row of rows) {
		if (!row?.lastMessageAt) continue;
		const date = new Date(row.lastMessageAt);
		if (Number.isNaN(date.getTime())) continue;
		if (!latest || date > latest) latest = date;
	}
	return latest;
};

const bestTrackedName = (rows) => {
	const sorted = [...rows].sort((a, b) => {
		const aTime = new Date(a?.lastMessageAt || 0).getTime() || 0;
		const bTime = new Date(b?.lastMessageAt || 0).getTime() || 0;
		return bTime - aTime;
	});
	return sorted.find((row) => String(row?.name || "").trim())?.name || "";
};

const sumField = (rows, field) => rows.reduce((sum, row) => sum + countValue(row?.[field]), 0);

/**
 * Merge Alpha's stored per-group activity with WhatsApp's current participant list.
 * This makes current members with no stored activity visible with a count of zero,
 * while PN/LID aliases are treated as the same person.
 */
export const mergeLiveGroupActivity = ({ participants = [], trackedMembers = [], botJids = [] } = {}) => {
	const trackedByJid = new Map();
	for (const row of trackedMembers || []) {
		const normalized = normalizeUserJid(row?.id);
		if (!normalized) continue;
		const bucket = trackedByJid.get(normalized) || [];
		bucket.push(row);
		trackedByJid.set(normalized, bucket);
	}

	const botIdentities = new Set((botJids || []).map(normalizeUserJid).filter(Boolean));
	const roster = [];

	for (const participant of participants || []) {
		const aliases = participantJids(participant);
		if (!aliases.length) continue;
		if (aliases.some((jid) => botIdentities.has(jid))) continue;

		const matchedRows = [];
		const seenRows = new Set();
		for (const alias of aliases) {
			for (const row of trackedByJid.get(alias) || []) {
				if (seenRows.has(row)) continue;
				seenRows.add(row);
				matchedRows.push(row);
			}
		}

		const jid = preferredJid(aliases);
		const participantName =
			participant?.notify ||
			participant?.name ||
			participant?.verifiedName ||
			participant?.displayName ||
			"";
		const name = bestTrackedName(matchedRows) || participantName || jid.split("@")[0] || "Member";

		roster.push({
			id: jid,
			aliases,
			name,
			isAdmin: isAdminParticipant(participant),
			count: sumField(matchedRows, "count"),
			texttotal: sumField(matchedRows, "texttotal"),
			imagetotal: sumField(matchedRows, "imagetotal"),
			videototal: sumField(matchedRows, "videototal"),
			stickertotal: sumField(matchedRows, "stickertotal"),
			pdftotal: sumField(matchedRows, "pdftotal"),
			lastMessageAt: latestDate(matchedRows),
			hasTrackedActivity: matchedRows.length > 0 && sumField(matchedRows, "count") > 0,
		});
	}

	return roster.sort((a, b) => {
		const countDiff = countValue(b.count) - countValue(a.count);
		if (countDiff) return countDiff;
		const aLast = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
		const bLast = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
		if (aLast !== bLast) return bLast - aLast;
		return String(a.name).localeCompare(String(b.name));
	});
};

export const summarizeGroupActivity = (members = [], lowTarget = 20) => {
	const totalMembers = members.length;
	const activeMembers = members.filter((member) => countValue(member.count) > 0).length;
	const zeroMembers = totalMembers - activeMembers;
	const belowTarget = members.filter((member) => countValue(member.count) < lowTarget).length;
	const totalMessages = members.reduce((sum, member) => sum + countValue(member.count), 0);
	const admins = members.filter((member) => member.isAdmin).length;
	const coverage = totalMembers ? Math.round((activeMembers / totalMembers) * 100) : 0;
	const buckets = {
		zero: zeroMembers,
		oneToNine: members.filter((member) => member.count >= 1 && member.count <= 9).length,
		tenToNineteen: members.filter((member) => member.count >= 10 && member.count <= 19).length,
		twentyToFortyNine: members.filter((member) => member.count >= 20 && member.count <= 49).length,
		fiftyToNinetyNine: members.filter((member) => member.count >= 50 && member.count <= 99).length,
		hundredPlus: members.filter((member) => member.count >= 100).length,
	};
	return { totalMembers, activeMembers, zeroMembers, belowTarget, totalMessages, admins, coverage, buckets };
};
