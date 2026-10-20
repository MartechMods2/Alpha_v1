import { createCanvas } from "@napi-rs/canvas";
import { fileTypeFromBuffer } from "file-type";
import { publicRequest } from "./featureHttp.js";
import { assertImageBudget } from "./imageBudget.js";

let fallback;
function defaultPortrait() {
  if (fallback) return fallback;
  const canvas = createCanvas(640, 640),
    ctx = canvas.getContext("2d");
  ctx.fillStyle = "#101c2c";
  ctx.fillRect(0, 0, 640, 640);
  ctx.strokeStyle = "#77e3bf";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(320, 290, 180, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#f1f5f9";
  ctx.textAlign = "center";
  ctx.font = "bold 150px sans-serif";
  ctx.fillText("A", 320, 340);
  ctx.fillStyle = "#77e3bf";
  ctx.font = "bold 32px sans-serif";
  ctx.fillText("ALPHA", 320, 540);
  fallback = canvas.toBuffer("image/png");
  return fallback;
}

export function createProfileMessages({
  request = publicRequest,
  fallbackImage = defaultPortrait,
} = {}) {
  let active = 0;
  return async (sock, jid, caption, extra = {}) => {
    let image;
    if (
      active < 2 &&
      typeof jid === "string" &&
      /@(s.whatsapp.net|lid|hosted)$/.test(jid)
    ) {
      active++;
      let timer;
      const work = Promise.resolve()
        .then(async () => {
          const url = await sock.profilePictureUrl(jid, "image");
          if (!url) throw Error("No public photo");
          const { buffer } = await request(url, {
            maxBytes: 2 * 1024 * 1024,
            redirects: 0,
          });
          const type = await fileTypeFromBuffer(buffer);
          if (!["jpg", "png", "webp"].includes(type?.ext))
            throw Error("Unsupported profile photo");
          assertImageBudget(buffer, type.ext, 4000000);
          return buffer;
        })
        .finally(() => {
          active--;
        });
      try {
        image = await Promise.race([
          work,
          new Promise((_, reject) => {
            timer = setTimeout(
              () => reject(Error("Profile photo timed out")),
              5000,
            );
          }),
        ]);
      } catch {
      } finally {
        clearTimeout(timer);
      }
    }
    if (!image) {
      try {
        image = fallbackImage();
      } catch {}
    }
    // Long command pages stay readable text; never silently truncate content.
    if (!image || caption.length > 4000) return { ...extra, text: caption };
    return { ...extra, image, caption };
  };
}
export const profileMessage = createProfileMessages();
