import { createCanvas } from "@napi-rs/canvas";
import { COLLECTIBLES } from "./policy.js";
export function collectionCardPayload(cardName, total, caption) {
  try {
    const index = COLLECTIBLES.findIndex((x) => x.name === cardName);
    if (index < 0) return { text: caption };
    const canvas = createCanvas(720, 440),
      ctx = canvas.getContext("2d");
    const colors = [
      "#78e5c0",
      "#78b9f1",
      "#ca9af2",
      "#f1b777",
      "#80d0df",
      "#ea99bb",
      "#edce77",
      "#9daaf1",
    ];
    const accent = colors[index];
    ctx.fillStyle = "#101b2b";
    ctx.fillRect(0, 0, 720, 440);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, 680, 400);
    ctx.fillStyle = accent;
    ctx.font = "bold 19px sans-serif";
    ctx.fillText("ALPHA  /  AURA COLLECTION", 48, 66);
    ctx.globalAlpha = 0.13;
    ctx.beginPath();
    ctx.arc(608, 167, 110, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.font = "bold 74px sans-serif";
    ctx.fillText(String(index + 1).padStart(2, "0"), 530, 185);
    ctx.fillStyle = "#f1f5f9";
    ctx.font = "bold 42px sans-serif";
    ctx.fillText(cardName, 48, 231, 610);
    ctx.fillStyle = "#bdcbd9";
    ctx.font = "22px sans-serif";
    ctx.fillText("A new piece of your Alpha story.", 48, 278);
    ctx.fillStyle = accent;
    ctx.fillRect(48, 328, (624 * Math.max(0, Math.min(8, total))) / 8, 5);
    ctx.font = "bold 19px sans-serif";
    ctx.fillText(`COLLECTED ${total} / 8`, 48, 381);
    return { image: canvas.toBuffer("image/png"), caption };
  } catch {
    return { text: caption };
  }
}
