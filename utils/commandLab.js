import { parseCommandChain } from './multiCommand.js';
import { parseTruthDareStart } from './truthDareStartOptions.js';
import { parseHostedOptions } from './hostedGameOptions.js';
import calcCommand from '../commands/public/calc.js';
import textCommand from '../commands/public/textLab.js';

const offline = [calcCommand(), textCommand()];
export const OFFLINE_COMMANDS = offline.flatMap(entry => entry.cmd);
export const runCommandLab = async ({ text, prefix = '$', guide, context = 'group', role = 'member' }) => {
  if (typeof text !== 'string' || !text.trim() || text.length > 4000) throw new Error('Enter 1–4000 characters.');
  if (!['group', 'direct'].includes(context) || !['member', 'admin', 'owner'].includes(role)) throw new Error('Invalid test context or role.');
  const chain = parseCommandChain(text, prefix, 6);
  if (!chain.commands.length) throw new Error(`Start the command with ${prefix}.`);
  const results = [];
  for (const segment of chain.commands) {
    const entry = guide.find(row => row.name === segment.command);
    const row = { command: segment.command, args: segment.args, mode: 'validation', output: [] };
    results.push(row);
    if (!entry) { row.ok = false; row.output.push('Unknown or failed-to-load command.'); continue; }
    row.syntax = entry.syntax;
    const permission = entry.type === 'public' || (entry.type === 'group' && (context === 'group' || role === 'owner')) ||
      (entry.type === 'admin' && context === 'group' && ['admin', 'owner'].includes(role)) || (entry.type === 'owner' && role === 'owner');
    if (!permission || entry.disabled) { row.ok = false; row.output.push(entry.disabled ? 'Globally disabled.' : `Permission/context denied: ${entry.access}`); continue; }
    row.ok = true;
    try {
      if (['td', 'tod', 'truthdare', 'truthordare', 'tord', 'todgame'].includes(segment.command) && segment.args[0] === 'start') {
        row.options = parseTruthDareStart(segment.args.slice(1));
        row.output.push('Truth or Dare start options parsed. No lobby or poll created.');
      } else if (segment.command === 'game' && ['start', 'host', 'lobby', 'joinpoll', 'random'].includes(segment.args[0])) {
        row.options = parseHostedOptions(segment.args.slice(1), { rounds: 2, lobbyMs: 60_000 });
        row.output.push('Hosted game options parsed. No lobby or poll created.');
      } else {
        const handler = offline.find(item => item.cmd.includes(segment.command))?.handler;
        if (handler) {
          row.mode = 'offline execution';
          const capture = async (_to, payload) => { row.output.push(String(payload.text || '').slice(0, 4000)); };
          await handler(Object.freeze({}), { key: {}, message: { conversation: segment.raw } }, 'command-lab', segment.args,
            { ...segment, prefix, sendMessageWTyping: capture });
        } else row.output.push('Command recognized. Handler not executed: it may send WhatsApp messages, use external services or change stored data. Use the guide to test it in your WhatsApp test group.');
      }
    } catch (error) { row.ok = false; row.output.push(error.message); }
  }
  return { results, truncated: chain.truncated, notice: 'Sandbox only. No WhatsApp messages, database changes or AI charges. Permissions are simulated; group blocks, quota and live media are not tested.' };
};
