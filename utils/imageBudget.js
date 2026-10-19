// Header inspection only; no decoder runs here. Limits decoded allocation risk.
export function assertImageBudget(buffer, ext, maxPixels = 16000000) {
  let width, height;
  if (ext === "png" && buffer.length >= 24) {
    width = buffer.readUInt32BE(16);
    height = buffer.readUInt32BE(20);
  } else if (ext === "gif" && buffer.length >= 10) {
    width = buffer.readUInt16LE(6);
    height = buffer.readUInt16LE(8);
  } else if (ext === "webp" && buffer.length >= 30) {
    const kind = buffer.toString("ascii", 12, 16);
    if (kind === "VP8X") {
      width = 1 + buffer.readUIntLE(24, 3);
      height = 1 + buffer.readUIntLE(27, 3);
    } else if (kind === "VP8 ") {
      width = buffer.readUInt16LE(26) & 16383;
      height = buffer.readUInt16LE(28) & 16383;
    } else if (kind === "VP8L" && buffer.length >= 25) {
      const bits = buffer.readUInt32LE(21);
      width = 1 + (bits & 16383);
      height = 1 + ((bits >>> 14) & 16383);
    }
  } else if (ext === "jpg") {
    let at = 2;
    while (at + 8 < Math.min(buffer.length, 262144)) {
      if (buffer[at] !== 255) break;
      const marker = buffer[at + 1];
      if (marker === 255) {
        at++;
        continue;
      }
      if (marker === 0xd9 || marker === 0xda) break;
      const length = buffer.readUInt16BE(at + 2);
      if (length < 2) break;
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker)
      ) {
        height = buffer.readUInt16BE(at + 5);
        width = buffer.readUInt16BE(at + 7);
        break;
      }
      at += 2 + length;
    }
  }
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width * height > maxPixels ||
    width > 16000 ||
    height > 16000
  )
    throw Error(
      "Image dimensions are unsupported or exceed the processing limit",
    );
  return { width, height };
}
