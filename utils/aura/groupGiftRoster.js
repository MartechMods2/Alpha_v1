import { AuraUserError } from "./errors.js";
import { participantJids, normalizeUserJid } from "../groupParticipants.js";

// Never accumulate unbounded pending mapping lookups across commands.
let activeMappings = 0;
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
  const records = rows.map((row) => {
    const aliases = participantJids(row);
    return { aliases, phone: aliases.find((id) => /^\d{7,15}@s\.whatsapp\.net$/.test(id)) };
  });
  const missing = records.filter((row) => !row.phone &&
    !row.aliases.some((id) => bot.has(id)) && row.aliases.some((id) => id.endsWith("@lid")));
  const mapping = sock.signalRepository?.lidMapping;
  if (missing.length && typeof mapping?.getPNForLID === "function") {
    let index = 0, resolutionTimer;
    const deadline = Date.now() + 3000;
    const expired = new Promise((resolve) => {
      resolutionTimer = setTimeout(() => resolve(null), 3000);
    });
    try {
      await Promise.all(Array.from({ length: Math.min(4, missing.length) }, async () => {
        while (index < missing.length && Date.now() < deadline && activeMappings < 4) {
          const record = missing[index++];
          activeMappings++;
          const work = Promise.resolve().then(() =>
            mapping.getPNForLID(record.aliases.find((id) => id.endsWith("@lid"))))
            .catch(() => null).finally(() => { activeMappings--; });
          const phone = normalizeUserJid(await Promise.race([work, expired]));
          if (/^\d{7,15}@s\.whatsapp\.net$/.test(phone)) record.phone = phone;
        }
      }));
    } finally { clearTimeout(resolutionTimer); }
  }
  const targets = new Set();
  let unverified = 0, excluded = 0;
  for (const { aliases, phone } of records) {
    if (aliases.some((id) => bot.has(id)) || bot.has(phone)) { excluded++; continue; }
    if (!phone) { unverified++; continue; }
    if (isOwner(phone)) { excluded++; continue; }
    targets.add(phone);
  }
  return { targets: [...targets].sort(), unverified, excluded };
}
