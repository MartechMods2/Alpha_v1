import { participantJids, normalizeUserJid } from "../groupParticipants.js";
import { getPNFromLID } from "../lid.js";
export async function auraIdentity(sock, info, jid = info.senderJid) {
  const normalized = normalizeUserJid(jid);
  if (/^\d{7,15}@s\.whatsapp\.net$/.test(normalized)) return normalized;
  const participant = info.groupMetadata?.participants?.find((p) =>
    participantJids(p).includes(normalized),
  );
  const phone = participantJids(participant).find((x) =>
    /^\d{7,15}@s\.whatsapp\.net$/.test(x),
  );
  if (phone) return phone;
  const mapped = normalized.endsWith("@lid")
    ? normalizeUserJid(await getPNFromLID(sock, normalized))
    : "";
  if (/^\d{7,15}@s\.whatsapp\.net$/.test(mapped)) return mapped;
  throw Error(
    "Aura cannot verify this member's phone identity yet. Refresh group metadata and try again.",
  );
}
