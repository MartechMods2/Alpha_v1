/**
 * Check if a JID is in LID format
 * @param {string} jid - The JID to check
 * @returns {boolean} True if the JID is in LID format
 */
export function isLID(jid) {
	return jid && jid.includes("@lid");
}

/**
 * Check if a JID is in Phone Number (PN) format
 * @param {string} jid - The JID to check
 * @returns {boolean} True if the JID is in PN format
 */
export function isPN(jid) {
	return jid && jid.includes("@s.whatsapp.net");
}

/**
 * Check if a JID is a group JID
 * @param {string} jid - The JID to check
 * @returns {boolean} True if the JID is a group
 */
export function isGroup(jid) {
	return jid && jid.includes("@g.us");
}

/**
 * Get LID from Phone Number using the socket's LID mapping repository
 * @param {object} sock - The WhatsApp socket instance
 * @param {string} phoneNumber - Phone number (with or without @s.whatsapp.net)
 * @returns {Promise<string>} The LID if found, otherwise returns PN format
 */
export async function getLIDFromPN(sock, phoneNumber) {
	try {
		const cleanNumber = phoneNumber.replace(/[^0-9]/g, "");
		const pnJid = cleanNumber + "@s.whatsapp.net";

		// Try to get LID from the mapping repository
		if (sock?.signalRepository?.lidMapping) {
			const lid = await sock.signalRepository.lidMapping.getLIDForPN(pnJid);
			if (lid) return lid;
		}

		// Fallback to PN format
		return cleanNumber + "@s.whatsapp.net";
	} catch (error) {
		console.error("Error getting LID from PN:", error);
		const cleanNumber = phoneNumber.replace(/[^0-9]/g, "");
		return cleanNumber + "@s.whatsapp.net";
	}
}

/**
 * Get Phone Number from LID using the socket's LID mapping repository
 * @param {object} sock - The WhatsApp socket instance
 * @param {string} lid - The LID to convert
 * @returns {string|null} The phone number in PN format, or null if not found
 */
export async function getPNFromLID(sock, lid) {
	try {
		if (sock?.signalRepository?.lidMapping) {
			return await sock.signalRepository.lidMapping.getPNForLID(lid);
		}
		return null;
	} catch (error) {
		console.error("Error getting PN from LID:", error);
		return null;
	}
}

/**
 * Extract phone number from any JID format (LID or PN)
 * @param {string} jid - The JID to extract from
 * @returns {string} The phone number without domain
 */
export function extractPhoneNumber(jid) {
	if (typeof jid !== "string") return jid;
	if (!jid) return "";

	// Handle colon format (some special cases)
	if (jid?.includes(":")) {
		return jid.split(":")[0];
	}

	// Extract the part before @
	return jid.split("@")[0];
}

/**
 * Normalize a JID or phone number to the preferred WhatsApp format
 * Tries to get LID first, falls back to PN format
 * @param {object} sock - The WhatsApp socket instance
 * @param {string} identifier - Phone number or JID
 * @returns {Promise<string>} Normalized JID
 */
export async function normalizeJID(sock, identifier) {
	if (!identifier) return "";

	// If already a JID (contains @), return as-is
	if (identifier.includes("@")) {
		return identifier;
	}

	const cleanNumber = identifier.replace(/[^0-9]/g, "");
	const pnJid = cleanNumber + "@s.whatsapp.net";

	// Try to get LID (preferred format)
	try {
		if (sock?.signalRepository?.lidMapping) {
			const lid = await sock.signalRepository.lidMapping.getLIDForPN(pnJid);
			if (lid) return lid;
		}
	} catch (error) {
		console.error("Error normalizing JID:", error);
	}

	// Fallback to PN format
	return pnJid;
}

/**
 * Format a JID for display (extract phone number)
 * @param {string} jid - The JID to format
 * @returns {string} Formatted phone number for display
 */
export function formatJIDForDisplay(jid) {
	return extractPhoneNumber(jid);
}
