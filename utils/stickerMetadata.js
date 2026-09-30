import nodeWebpmux from 'node-webpmux';

// Keep the existing WebP image/animation intact. wa-sticker-formatter 3.x no
// longer exposes the old setMetadata API used by Alpha's sticker paths.
export const setStickerMetadata = async (buffer, { pack = 'Alpha', author = 'Martech', remove = false } = {}) => {
  const image = new nodeWebpmux.Image();
  await image.load(buffer);
  if (remove) image.exif = undefined;
  else {
    const clean = value => String(value || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 64);
    const json = Buffer.from(JSON.stringify({
      'sticker-pack-id': 'alpha-martech', 'sticker-pack-name': clean(pack), 'sticker-pack-publisher': clean(author), emojis: [],
    }));
    const header = Buffer.from([0x49, 0x49, 0x2a, 0, 8, 0, 0, 0, 1, 0, 0x41, 0x57, 7, 0, 0, 0, 0, 0, 0x16, 0, 0, 0]);
    header.writeUInt32LE(json.length, 14);
    image.exif = Buffer.concat([header, json]);
  }
  return Buffer.from(await image.save(null));
};
