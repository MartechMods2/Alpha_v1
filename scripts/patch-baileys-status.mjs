// Temporary, pinned rc14 compatibility patch. See upstream issues #2858/#2903.
// Do not silently patch a future version or a changed dependency source.
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export function patchStatusSource(source) {
  const marker = '// ALPHA_RC14_STATUS_V1';
  if (source.includes(marker)) return source;
  if (source.includes("'CB:status'")) throw Error('Upstream status handler changed; review compatibility patch');
  const replaceOne = (from, to) => {
    if (source.split(from).length !== 2) throw Error('Baileys rc14 patch anchor changed');
    source = source.replace(from, to);
  };
  replaceOne('    const offlineNodeProcessor = makeOfflineNodeProcessor(new Map([', `    ${marker}
    const handleStatus = async (node) => {
        try {
            // Group statuses must reach normal decryption and moderation, not be discarded.
            if (isJidGroup(node.attrs.from || '') && getBinaryNodeChild(node, 'enc')) {
                await handleMessage(node);
            }
            // Explicit ACK also covers the successful group-decryption path.
            await sendMessageAck(node);
        } catch (error) { onUnexpectedError(error, 'handling status stanza'); }
    };
    const offlineNodeProcessor = makeOfflineNodeProcessor(new Map([`);
  replaceOne("        ['notification', handleNotification]\n", "        ['notification', handleNotification],\n        ['status', handleStatus]\n");
  replaceOne("    ws.on('CB:ack,class:message', (node) => {", `    ws.on('CB:status', async (node) => {
        await processNode('status', node, 'handling status stanza', handleStatus)
            .catch(error => onUnexpectedError(error, 'handling status stanza'));
    });
    ws.on('CB:ack,class:message', (node) => {`);
  return source;
}
export async function applyStatusPatch() {
  const require = createRequire(import.meta.url);
  const root = resolve(dirname(require.resolve('baileys')), '..');
  const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  if (pkg.version !== '7.0.0-rc14') throw Error('Review status patch before changing Baileys version');
  const path = resolve(root, 'lib/Socket/messages-recv.js');
  const source = await readFile(path, 'utf8');
  await writeFile(path, patchStatusSource(source));
  console.log('[CONNECTION] Pinned status compatibility patch verified.');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await applyStatusPatch();
