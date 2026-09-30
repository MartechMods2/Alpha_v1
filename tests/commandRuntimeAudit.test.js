import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const moduleUrl = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const root = new URL('../', import.meta.url);

test('loader metadata matches successfully loaded handlers and survives help mutations', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'alpha-loader-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const category of ['public', 'group/members', 'group/admins', 'owner']) await mkdir(path.join(dir, category), { recursive: true });
  await writeFile(path.join(dir, 'package.json'), '{"type":"module"}');
  await writeFile(path.join(dir, 'public', 'good.js'), 'globalThis.__alphaFactoryCalls=0; export default ()=>{globalThis.__alphaFactoryCalls++;return {cmd:["sample","alias"],desc:"sample description",usage:"sample <text>",handler:async()=>"ok"};};');
  await writeFile(path.join(dir, 'public', 'bad.js'), 'throw new Error("fixture import error");');
  // Startup must never sweep user images/media from the current directory.
  const keep = path.join(dir, 'keep.png');
  await writeFile(keep, 'important media');
  let source = await readFile(new URL('utils/commandLoader.js', root), 'utf8');
  source = source.replace('const __filename = fileURLToPath(import.meta.url);', `const __filename = ${JSON.stringify(new URL('utils/commandLoader.js', root).pathname)};`)
    .replace('const mainPath = path.join(__dirname, "../commands/");', `const mainPath = ${JSON.stringify(dir + '/')};`);
  const mocks = {
    '../cache/redisCache.js': 'export const checkRateLimit=async()=>true;',
    '../db/botData.js': 'export const getBotData=async()=>({});',
    '../db/groupData.js': 'export const getGroupData=async()=>({});',
    '../db/members.js': 'export const getMemberPreferences=async()=>({});',
    '../db/safePackData.js': 'export const getSafeSettings=async()=>({});',
    './groupParticipants.js': 'export const isSameGroupUser=()=>false;',
    './moderatorAuthority.js': 'export const isConfiguredModerator=()=>false;',
  };
  source = source.replace(/from "([^"]+)"/g, (match, specifier) => {
    if (mocks[specifier]) return `from "${moduleUrl(mocks[specifier])}"`;
    if (specifier.startsWith('.')) return `from "${new URL(specifier, new URL('utils/commandLoader.js', root)).href}"`;
    return match;
  });
  const loaded = await import(moduleUrl(source));
  await loaded.commandsReadyPromise;
  assert.equal(await loaded.commandsPublic.alias(null, { message: {} }, '', [], {}), 'ok');
  const first = await loaded.cmdToText();
  assert.deepEqual(first.publicCommands[0].cmd, ['sample', 'alias']);
  first.publicCommands[0].cmd.push('corrupted');
  const second = await loaded.cmdToText();
  assert.deepEqual(second.publicCommands[0].cmd, ['sample', 'alias']);
  assert.equal(globalThis.__alphaFactoryCalls, 1, 'help/dashboard reads reuse the live registry');
  assert.equal(loaded.commandLoadErrors.length, 1);
  assert.equal(loaded.commandLoadErrors[0].file, 'bad.js');
  assert.equal(await readFile(keep, 'utf8'), 'important media');
  delete globalThis.__alphaFactoryCalls;
});

test('database control validates field:value and retains full member JIDs', async () => {
  const writes = [], replies = [];
  globalThis.__alphaDbAuditWrites = writes;
  const stub = moduleUrl(`const collection={updateOne:async(...args)=>globalThis.__alphaDbAuditWrites.push(args)}; export const group=collection, member=collection, bot=collection; export const getGroupData=async()=>({}), getMemberData=async()=>({}), getBotData=async()=>({});`);
  let source = await readFile(new URL('commands/owner/dbControl.js', root), 'utf8');
  source = source.replace(/from "([^"]+)"/g, () => `from "${stub}"`);
  const command = (await import(moduleUrl(source))).default();
  const info = { command: 'member', extendedMessageOriginal: { participant: '123:2@s.whatsapp.net' }, sendMessageWTyping: async (_to, value) => replies.push(value.text) };
  await command.handler({}, {}, 'group@g.us', ['isBlock'], info);
  assert.equal(writes.length, 0);
  assert.match(replies[0], /field:value/);
  await command.handler({}, {}, 'group@g.us', ['username:Alpha', 'Tester'], info);
  assert.deepEqual(writes[0][0], { _id: '123@s.whatsapp.net' });
  assert.equal(writes[0][1].$set.username, 'Alpha Tester');
  delete globalThis.__alphaDbAuditWrites;
});
