import { SHOP, PRESTIGE_FRAMES } from "./policy.js";
import sharp from "sharp";
import { profileMessage } from "../profileMessage.js";
export async function auraProfilePayload(sock, jid, caption, equipped) {
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
