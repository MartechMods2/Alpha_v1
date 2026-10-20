import { AuraUserError } from "./errors.js";
import { participantJids } from "../groupParticipants.js";

// Fresh server roster; never trust @all text or caller-supplied mention lists.
export async function auraGiftRoster(sock, from, isOwner) {
  if (typeof sock.groupMetadata !== "function")
    throw new AuraUserError("Cannot refresh group members safely. Try again when connected.");
  let timer, metadata;
  try {
    metadata = await Promise.race([
      sock.groupMetadata(from),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new AuraUserError("Group refresh timed out. No Aura sent.")), 8000);
      }),
    ]);
  } finally { clearTimeout(timer); }
  const rows = metadata?.participants;
  if (!Array.isArray(rows) || !rows.length || rows.length > 1024)
    throw new AuraUserError("Invalid group roster; no Aura sent.");
  const bot = new Set([
    ...participantJids(sock.user),
    ...participantJids(sock.authState?.creds?.me),
  ]);
  // Retain alternate aliases from the same participant record.
  for (const row of rows) {
    const aliases = participantJids(row);
    if (aliases.some((id) => bot.has(id))) aliases.forEach((id) => bot.add(id));
  }
  const targets = new Set();
  let unverified = 0, excluded = 0;
  for (const row of rows) {
    const aliases = participantJids(row);
    if (aliases.some((id) => bot.has(id))) { excluded++; continue; }
    const phone = aliases.find((id) => /^\d{7,15}@s\.whatsapp\.net$/.test(id));
    if (!phone) { unverified++; continue; }
    if (isOwner(phone)) { excluded++; continue; }
    targets.add(phone);
  }
  return { targets: [...targets].sort(), unverified, excluded };
}
