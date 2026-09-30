import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCommandGuide } from '../utils/commandGuide.js';
import { runCommandLab } from '../utils/commandLab.js';
import { parseCommandSegment } from '../utils/multiCommand.js';
import ownerTest from '../commands/owner/cmdTest.js';

const commands = {
  publicCommands: [
    { cmd: ['calc', 'calculate'], desc: 'Calculate', usage: 'calc <expression>', source: 'calc.js' },
    { cmd: ['uppercase', 'hexrgb', 'unitconvert', 'base64decode'], desc: 'Text tools', usage: 'uppercase text', source: 'text.js' },
    { cmd: ['aisummarize'], desc: 'AI pack', usage: 'aifeatures', source: 'ai.js' },
  ],
  groupCommands: [{ cmd: ['td', 'tod'], desc: 'Truth/Dare', usage: 'td start [rounds] | td join' }, { cmd: ['game'], desc: 'Games', usage: 'game start trivia' }],
  adminCommands: [{ cmd: ['mute'], desc: 'Mute', usage: 'mute @mention' }],
  ownerCommands: [{ cmd: ['removebot'], desc: 'Leave group', usage: 'removebot' }],
};
const guide = buildCommandGuide({ commands, prefix: '!!', disabled: ['calculate'] });

test('guide includes every registered name, descriptions, examples and configured prefix', () => {
  assert.equal(guide.length, 12);
  for (const row of guide) {
    assert.ok(row.description);
    assert.ok(row.syntax.length);
    assert.ok(row.examples.length);
    for (const example of row.examples) {
      const parsed = parseCommandSegment(example, '!!');
      assert.equal(parsed.command, row.name);
    }
  }
  assert.match(guide.find(row => row.name === 'aisummarize').description, /Summarize/);
  assert.equal(guide.find(row => row.name === 'calculate').disabled, true);
  assert.equal(guide.find(row => row.name === 'tod').syntax[0], '!!tod start [rounds]');
});

test('lab executes actual offline handlers and parses multi-character prefixes', async () => {
  const result = await runCommandLab({ text: '!! calc 25 * 4 + 10; !!uppercase Hello Alpha; !!hexrgb #33AAFF; !!unitconvert 5 km m', prefix: '!!', guide });
  assert.equal(result.results.length, 4);
  assert.match(result.results[0].output.join(''), /110/);
  assert.match(result.results[1].output.join(''), /HELLO ALPHA/);
  assert.match(result.results[2].output.join(''), /RGB\(51, 170, 255\)/);
  assert.match(result.results[3].output.join(''), /5000/);
  assert.ok(result.results.every(row => row.mode === 'offline execution'));
});

test('lab enforces simulated permissions, global disablement and unknown commands', async () => {
  const result = await runCommandLab({ text: '!!mute @123; !!removebot; !!calculate 2+2; !!nonesuch', prefix: '!!', guide, role: 'member' });
  assert.ok(result.results.every(row => row.ok === false));
  const direct = await runCommandLab({ text: '!!td start', prefix: '!!', guide, context: 'direct', role: 'admin' });
  assert.equal(direct.results[0].ok, false);
});

test('lab validates real game settings without opening sessions', async () => {
  const result = await runCommandLab({ text: '!!td start rounds=10 funny lobby=2m; !!game start trivia tech rounds=7 lobby=90s', prefix: '!!', guide });
  assert.deepEqual(result.results[0].options, { rounds: 10, theme: 'funny', lobbyMs: 120000 });
  assert.equal(result.results[1].options.rounds, 7);
  assert.equal(result.results[1].options.lobbyMs, 90000);
  const invalid = await runCommandLab({ text: '!!td start rounds=0; !!game start trivia lobby=5s', prefix: '!!', guide });
  assert.ok(invalid.results.every(row => row.ok === false));
});

test('lab bounds batches/input and never evaluates JavaScript', async () => {
  await assert.rejects(runCommandLab({ text: 'x'.repeat(4001), guide }), /4000/);
  await assert.rejects(runCommandLab({ text: 'calc 1+1', guide }), /Start/);
  const result = await runCommandLab({ text: '!!calc process.exit()', prefix: '!!', guide });
  assert.match(result.results[0].output.join(''), /Invalid expression/);
  const batch = await runCommandLab({ text: Array(7).fill('!!calc 1+1').join('; '), prefix: '!!', guide });
  assert.equal(batch.results.length, 6);
  assert.equal(batch.truncated, true);
});

test('owner test/code cannot access bot secrets or execute arbitrary code', async () => {
  const output = [];
  await ownerTest().handler({}, {}, '', ['process.env'], { evv: 'process.env', prefix: '$', sendMessageWTyping: async (_to, payload) => output.push(payload.text) });
  assert.match(output[0], /Invalid expression/);
});

test('guide mirrors handler precedence for duplicate registrations', () => {
  const rows = buildCommandGuide({ commands: {
    publicCommands: [{cmd:['same'],desc:'first',usage:'same'}, {cmd:['same'],desc:'last',usage:'same'}],
    ownerCommands: [{cmd:['same'],desc:'owner',usage:'same'}],
  } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].description, 'last');
  assert.equal(rows[0].type, 'public');
});
