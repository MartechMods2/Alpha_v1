import { AuraUserError } from "./errors.js";
import { participantJids, normalizeUserJid } from "../groupParticipants.js";
let activeLookups = 0;
const mappedPhone = async (sock, jid) => {
  const mapping = sock?.signalRepository?.lidMapping;
  if (typeof mapping?.getPNForLID !== "function" || activeLookups >= 4) return "";
  activeLookups++;
  const work = Promise.resolve().then(() => mapping.getPNForLID(jid))
    .catch(() => "").finally(() => { activeLookups--; });
  let timer;
  try {
    return await Promise.race([work, new Promise((resolve) => {
      timer = setTimeout(() => resolve(""), 2000);
    })]);
  } finally { clearTimeout(timer); }
};
// Only protocol aliases paired with this actual message author are accepted.
export function withAuraSenderAliases(info, msg) {
  const author = normalizeUserJid(msg?.key?.participant || msg?.key?.remoteJid);
  return { ...info, senderAliases: author && author === normalizeUserJid(info.senderJid)
    ? [msg.key.participantPn, msg.key.participantAlt].filter((x) => typeof x === "string") : [] };
}
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
  if (normalized === normalizeUserJid(info.senderJid) && Array.isArray(info.senderAliases)) {
    const alias = info.senderAliases.slice(0, 2).map(normalizeUserJid)
      .find((id) => /^\d{7,15}@s\.whatsapp\.net$/.test(id));
    if (alias) return alias;
  }
  const mapped = normalized.endsWith("@lid")
    ? normalizeUserJid(await mappedPhone(sock, normalized))
    : "";
  if (/^\d{7,15}@s\.whatsapp\.net$/.test(mapped)) return mapped;
  throw new AuraUserError(
    "Aura cannot verify this member's phone identity yet. Refresh group metadata and try again.",
  );
}
