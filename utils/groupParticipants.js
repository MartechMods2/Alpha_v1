import { jidNormalizedUser } from "baileys";

const PARTICIPANT_JID_FIELDS = ["id", "jid", "lid", "phoneNumber"];

/** Normalize a user JID while preserving whether it is a PN or LID address. */
export const normalizeUserJid = (jid) => {
	if (typeof jid !== "string" || !jid.includes("@")) return "";
	try {
		return jidNormalizedUser(jid);
	} catch {
		const [userWithDevice, server] = jid.split("@");
		return `${userWithDevice.split(":")[0]}@${server}`;
	}
};

/** Return every PN/LID alias supplied by Baileys for a group participant. */
export const participantJids = (participant) => {
	if (typeof participant === "string") {
		const normalized = normalizeUserJid(participant);
		return normalized ? [normalized] : [];
	}

	return [
		...new Set(
			PARTICIPANT_JID_FIELDS.map((field) => normalizeUserJid(participant?.[field])).filter(Boolean),
		),
	];
};

export const isAdminParticipant = (participant) =>
	participant?.admin === "admin" || participant?.admin === "superadmin";

const addIdentity = (identities, jid) => {
	const normalized = normalizeUserJid(jid);
	if (normalized) identities.add(normalized);
};

const identitiesIntersect = (left, right) => right.some((jid) => left.has(jid));

/**
 * Build the bot's real identity set. WhatsApp LIDs are not derived from phone
 * numbers, so we use the socket identity, Baileys' mapping store, and the
 * aliases contained in group metadata instead of fabricating a numeric @lid.
 */
export const getBotIdentityJids = async (sock, metadata, configuredJids = []) => {
	const identities = new Set();
	const configured = Array.isArray(configuredJids) ? configuredJids : [configuredJids];

	[
		sock?.user?.id,
		sock?.user?.lid,
		sock?.authState?.creds?.me?.id,
		sock?.authState?.creds?.me?.lid,
		...configured,
	].forEach((jid) => addIdentity(identities, jid));

	const mapping = sock?.signalRepository?.lidMapping;
	if (mapping) {
		for (const jid of [...identities]) {
			try {
				if (jid.endsWith("@s.whatsapp.net") || jid.endsWith("@hosted")) {
					addIdentity(identities, await mapping.getLIDForPN(jid));
				} else if (jid.endsWith("@lid") || jid.endsWith("@hosted.lid")) {
					addIdentity(identities, await mapping.getPNForLID(jid));
				}
			} catch (error) {
				console.warn("Could not resolve bot PN/LID mapping:", error.message);
			}
		}
	}

	// A participant record can contain both its LID and PN. Once either alias
	// matches the bot, retain every alias so later checks are constant-time.
	for (const participant of metadata?.participants || []) {
		const aliases = participantJids(participant);
		if (identitiesIntersect(identities, aliases)) {
			aliases.forEach((jid) => identities.add(jid));
		}
	}

	return [...identities];
};

export const isJidGroupAdmin = (metadata, ...jids) => {
	const identities = new Set(jids.flat().map(normalizeUserJid).filter(Boolean));
	return (metadata?.participants || []).some(
		(participant) =>
			isAdminParticipant(participant) && identitiesIntersect(identities, participantJids(participant)),
	);
};

export const isSameGroupUser = (metadata, firstJid, secondJids) => {
	const first = normalizeUserJid(firstJid);
	const seconds = new Set(
		(Array.isArray(secondJids) ? secondJids : [secondJids]).map(normalizeUserJid).filter(Boolean),
	);
	if (!first || seconds.size === 0) return false;
	if (seconds.has(first)) return true;

	return (metadata?.participants || []).some((participant) => {
		const aliases = participantJids(participant);
		return aliases.includes(first) && identitiesIntersect(seconds, aliases);
	});
};

export const isGroupOwner = (metadata, jid) =>
	isSameGroupUser(metadata, jid, [metadata?.owner, metadata?.ownerPn]);
