import { declaredMediaBytes, defenseConfig } from "./ingestionDefense.js";
let active = 0;
// Baileys rc14 does not forward AbortSignal in getHttpStream. Keep a permit
// until its stream arrives, even after caller timeout, and destroy late streams.
export async function boundedDownload(
  download,
  node,
  { maxBytes = 25 * 1048576, timeoutMs = defenseConfig().mediaTimeout } = {},
) {
  const cap = Math.min(maxBytes, defenseConfig().maxMedia);
  const declared = declaredMediaBytes(node?.fileLength);
  if (declared !== null && declared > cap)
    throw Error("Media exceeds the size limit");
  if (active >= defenseConfig().mediaConcurrency)
    throw Error("Media downloads are busy");
  active++;
  let expired = false,
    stream,
    timer;
  const transfer = Promise.resolve()
    .then(download)
    .then(async (source) => {
      stream = source;
      if (expired) {
        source.destroy?.();
        throw Error("Media download timed out");
      }
      const chunks = [];
      let size = 0;
      for await (const chunk of source) {
        size += chunk.length;
        if (size > cap) {
          source.destroy?.();
          throw Error("Media exceeds the size limit");
        }
        chunks.push(chunk);
      }
      if (!size) throw Error("Empty media");
      return Buffer.concat(chunks, size);
    })
    .finally(() => {
      active--;
    });
  try {
    return await Promise.race([
      transfer,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          expired = true;
          stream?.destroy?.(new Error("Media download timed out"));
          reject(Error("Media download timed out"));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
export const mediaDownloadStats = () => ({ active });

export function assertMediaSource(node) {
  if (node?.url != null) {
    let url;
    try {
      url = new URL(node.url);
    } catch {
      throw Error("Invalid media source");
    }
    const host = url.hostname.toLowerCase();
    const allowed = ["whatsapp.net", "whatsapp.com", "fbcdn.net"].some(
      (domain) => host === domain || host.endsWith("." + domain),
    );
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443") ||
      !allowed
    )
      throw Error("Untrusted media source");
  }
  const path = node?.directPath || node?.thumbnailDirectPath;
  if (
    path != null &&
    (typeof path !== "string" ||
      path.length > 4096 ||
      !/^\/[^/]/.test(path) ||
      /[\\\u0000-\u0020]/.test(path))
  )
    throw Error("Invalid media path");
  if (!node?.url && !path) throw Error("Missing media source");
}
