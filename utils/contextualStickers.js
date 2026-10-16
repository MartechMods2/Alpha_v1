import { getSafeSettings, listSafeItems } from "../db/safePackData.js";
import { randomInt } from "node:crypto";
const cooldown = new Map();
export function stickerSituation(text) {
  const value = String(text || "").toLowerCase();
  if (/\b(thanks|thank you|grateful)\b/.test(value)) return "thanks";
  if (/\b(congrats|congratulations|well done|passed|won)\b/.test(value))
    return "celebrate";
  if (/\b(sad|sorry|disappointed)\b/.test(value)) return "comfort";
  if (/\b(lol|lmao|hahaha)\b/.test(value)) return "laugh";
  if (/\b(hello|hi everyone|good morning)\b/.test(value)) return "greeting";
  return null;
}
export async function maybeContextSticker({
  groupJid,
  body,
  sendMessageWTyping,
  isCommand,
}) {
  if (
    isCommand ||
    !stickerSituation(body) ||
    (cooldown.get(groupJid) || 0) > Date.now()
  )
    return;
  const settings = await getSafeSettings(groupJid);
  if (!settings.contextStickers || randomInt(10) !== 0) return;
  const rows = await listSafeItems(
    groupJid,
    "reaction-sticker",
    { status: "approved", text: stickerSituation(body) },
    10,
  );
  if (!rows.length) return;
  // Another eligible message may have completed its lookup while we waited.
  if ((cooldown.get(groupJid) || 0) > Date.now()) return;
  cooldown.set(groupJid, Date.now() + 10 * 60000);
  while (cooldown.size > 1000) cooldown.delete(cooldown.keys().next().value);
  const entry = rows[randomInt(rows.length)];
  const data = entry.payload?.data;
  if (typeof data === "string" && data.length < 1400000)
    await sendMessageWTyping(groupJid, {
      sticker: Buffer.from(data, "base64"),
    });
}
