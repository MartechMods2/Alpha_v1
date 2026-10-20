import { SHOP } from "./policy.js";
import sharp from "sharp";
import { profileMessage } from "../profileMessage.js";
export async function auraProfilePayload(sock, jid, caption, equipped) {
  const payload = await profileMessage(sock, jid, caption);
  if (!payload.image || !equipped) return payload;
  try {
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
