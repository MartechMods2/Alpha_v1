import { cleanAuraName, escapeAuraSvg } from "./displayName.js";
import { SHOP, PRESTIGE_FRAMES } from "./policy.js";
import sharp from "sharp";
import { profileMessage } from "../profileMessage.js";
async function baseAuraProfilePayload(sock, jid, caption, equipped) {
  const payload = await profileMessage(sock, jid, caption);
  if (!payload.image || !equipped) return payload;
  try {
    const prestige = PRESTIGE_FRAMES.find((item) => item.id === equipped);
    if (prestige) {
      const ultimate = prestige.prestige === 6;
      const title = ultimate ? "EVO-LEGENDARY+ SOVEREIGN" : "EVO SOVEREIGN";
      const accent = ultimate ? "#ffe6a0" : "#b8a0ff";
      const art = `<svg width="720" height="820" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g"><stop stop-color="${accent}"/><stop offset=".5" stop-color="#ffffff"/><stop offset="1" stop-color="${ultimate ? "#b7862f" : "#6640ba"}"/></linearGradient></defs><rect width="720" height="820" rx="42" fill="#10182b"/><rect x="16" y="16" width="688" height="788" rx="34" stroke="url(#g)" stroke-width="5" fill="none"/><rect x="38" y="38" width="644" height="644" rx="20" fill="url(#g)"/><path d="M285 725 L275 700 L310 715 L360 690 L410 715 L445 700 L435 725 Z" fill="url(#g)"/><text x="360" y="766" font-family="sans-serif" font-size="23" font-weight="bold" text-anchor="middle" fill="${accent}">${title}</text><text x="360" y="790" font-family="sans-serif" font-size="12" letter-spacing="4" text-anchor="middle" fill="#c6d0e3">ALPHA PRESTIGE COLLECTION</text></svg>`;
      const portrait = await sharp(payload.image, { limitInputPixels: 4000000 })
        .rotate()
        .resize(600, 600, { fit: "cover" })
        .png()
        .toBuffer();
      const image = await sharp(Buffer.from(art))
        .composite([{ input: portrait, left: 60, top: 60 }])
        .png()
        .toBuffer();
      return { ...payload, image };
    }
    const color = SHOP.find((item) => item.id === equipped)?.color || "#354a7c";
    const image = await sharp(payload.image, { limitInputPixels: 4000000 })
      .rotate()
      .resize(600, 600, { fit: "cover" })
      .extend({ top: 16, bottom: 16, left: 16, right: 16, background: color })
      .png()
      .toBuffer();
    return { ...payload, image };
  } catch {
    return payload;
  }
}

export async function auraProfilePayload(sock, jid, caption, equipped, displayName) {
  const payload = await baseAuraProfilePayload(sock, jid, caption, equipped);
  const name = cleanAuraName(displayName);
  if (!payload.image || !name) return payload;
  try {
    const portrait = await sharp(payload.image, { limitInputPixels: 4000000 })
      .rotate().resize({ width: 720, height: 820, fit: "inside", withoutEnlargement: true })
      .png().toBuffer();
    const { width, height } = await sharp(portrait).metadata();
    const fontSize = Math.max(12, Math.min(24, Math.floor((width - 32) / Math.max(1, [...name].length))));
    const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="68"><rect width="100%" height="100%" fill="#10182b"/><text x="50%" y="42" text-anchor="middle" font-family="sans-serif" font-size="${fontSize}" font-weight="bold" fill="#f1f5f9">${escapeAuraSvg(name)}</text></svg>`);
    const image = await sharp(portrait).extend({
      top: 0, left: 0, right: 0, bottom: 68, background: "#10182b",
    }).composite([{ input: label, left: 0, top: height }]).png().toBuffer();
    return { ...payload, image };
  } catch {
    // The readable caption still identifies the member if image rendering fails.
    return payload;
  }
}
