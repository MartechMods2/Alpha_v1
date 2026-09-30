import { getAiFeature } from './alphaFeatureCatalog.js';
import { TEXT_LAB_COMMANDS } from './ultimateFeatureCatalog.js';

const escapeRegex = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ACCESS = {
  public: 'Everyone; direct messages and groups.',
  group: 'Group members; Alpha’s own account can also run member commands in direct messages.',
  admin: 'Groups only. Group admins, configured moderators, helpers and the bot owner.',
  owner: 'Bot owner, Alpha’s own account and configured moderators.',
};
const explicit = {
  calc: ['calc 25 * 4 + 10'], calculate: ['calculate 25 * 4 + 10'],
  game: ['game start trivia tech rounds=10 lobby=2m', 'game join', 'game status', 'game close', 'game answer my answer', 'game liveboard', 'game resume', 'game stop'],
  td: ['td start rounds=10 funny lobby=2m', 'td join', 'td status', 'td close', 'td truth', 'td answer My answer', 'td dare', 'td done', 'td score', 'td resume', 'td stop'],
  answer: ['answer my answer'],
  hexrgb: ['hexrgb #33AAFF'], rgbhex: ['rgbhex 51 170 255'], roman: ['roman 49'], fromroman: ['fromroman XLIX'],
  binary: ['binary 42'], decimal: ['decimal 101010'], unitconvert: ['unitconvert 5 km m'], password: ['password 20'],
  morse: ['morse Hello Alpha'], unmorse: ['unmorse .... . .-.. .-.. ---'],
};
export const GAME_GUIDE = [
  'Truth or Dare: start with td start rounds=10 funny lobby=2m. Defaults: 2 rounds, 30-second lobby. Themes: classic, funny, deep, friendship, tech, random.',
  'Automatic games: game start trivia tech rounds=10 lobby=2m. Defaults: 2 rounds, 60-second lobby. Supported: trivia, mathgame, scramble, emojiguess, riddle, fasttype, oddoneout, flagguess, truefalse, numberguess.',
  'Rounds: 1–100. Lobby: lobby=30s through lobby=10m. Each enrolled player gets one turn per round. The starter auto-joins and admins can play. Others vote Join game or type td join / game join. Use status to check counted players. Minimum 2; maximum 20. Voting does not close the lobby early.',
  'The starter, admins and owner can close the lobby early, skip the current turn with next, or stop. Use leave during the lobby. Alpha shuffles players and advances automatically.',
  'Truth or Dare: the named player has 45 seconds to choose truth, dare or skip, then 90 seconds to answer or type done. Truth earns 10, Dare 15, streak bonuses add 2/4/6, and a perfect run adds 5. Matching media can complete media dares. Score shows live points; board and stats show saved totals.',
  'Automatic games: the named player has 60 seconds to answer with #answer, answer <text> or game answer <text>. Correct answers earn the question’s points; wrong answers, skips and timeouts earn zero. Use game liveboard for session points and game board for permanent totals.',
  'Alpha announces the highest scorer, including ties, after the final round. Saved sessions restore after reconnect; td resume / game resume restore on demand. Players on Alpha’s own account must use prefixed commands rather than passive chat answers.',
];
const concrete = value => value.replace(/<([^>]+)>/g, (_, name) => {
  if (/url|link/i.test(name)) return 'https://example.com';
  if (/number|count|amount|progress|target|index/i.test(name)) return '10';
  if (/user|member|mention/i.test(name)) return '@2348012345678';
  if (/expression/i.test(name)) return '25 * 4 + 10';
  return 'example text';
}).replace(/YYYY-MM-DD/g, '2027-01-01').replace(/HH:MM/g, '20:00').replace(/\b(on|off|enable|disable)\/(?:on|off|enable|disable)\b/g, '$1').replace(/\[[^\]]+\]/g, '').replace(/\s+/g, ' ').trim();

// Metadata comes exclusively from successfully registered handlers. Source hints
// are displayed as syntax templates, never evaluated as code.
export const buildCommandGuide = ({ commands, prefix = '$', disabled = [], sourceText = {} }) => {
  const rows = [];
  for (const [key, type] of [['publicCommands', 'public'], ['groupCommands', 'group'], ['adminCommands', 'admin'], ['ownerCommands', 'owner']]) {
    for (const entry of commands[key] || []) for (const name of entry.cmd) {
      const feature = getAiFeature(name);
      const source = sourceText[entry.source] || '';
      const usageParts = String(entry.usage || '').split(/\s+\|\s+/);
      const matching = usageParts.filter(part => new RegExp(`^${escapeRegex(name)}(?:\\s|$)`, 'i').test(part));
      // Usage strings inside each handler often document individual subcommands.
      const tick = String.fromCharCode(96);
      const opening = "(?:\\$\\{(?:prefix|msgInfoObj\\.prefix|info\\.prefix)\\}|Usage:\\s*[" + tick + "\\\\]*|\\$|" + tick + ")";
      const sourcePattern = new RegExp(opening + "(" + escapeRegex(name) + "(?:\\s+[^\\n\\r" + tick + "\"'\\*]+)?)", "gi");
      const hints = [...source.matchAll(sourcePattern)].map(match => match[1].split('\\n')[0].replace(/\\$/, '').trim())
        .filter(value => !value.includes('${') && value.length < 180);
      let syntax = [...new Set([...matching, ...hints])].slice(0, 12);
      let examples = explicit[name];
      if (feature) { syntax = [`${name} <text or topic>`]; examples = [`${name} Explain a topic or process I am learning`]; }
      if (TEXT_LAB_COMMANDS.includes(name) && !['uuid', 'timestamp', 'password'].includes(name) && !explicit[name]) {
        syntax = [`${name} <text>`]; examples = [`${name} Hello Alpha`];
        if (name === 'base64decode') examples = ['base64decode SGVsbG8gQWxwaGE='];
        if (name === 'urldecode') examples = ['urldecode Hello%20Alpha'];
      }
      // True aliases share syntax; modules with many independent commands keep
      // their shared reference visible rather than assuming they are aliases.
      if (!syntax.length && entry.cmd.length <= 6 && usageParts[0]?.startsWith(entry.cmd[0])) {
        syntax = [usageParts[0].replace(new RegExp(`^${escapeRegex(entry.cmd[0])}`), name)];
      }
      if (!syntax.length) syntax = [name];
      if (!examples?.length) examples = syntax.slice(0, 3).map(concrete);
      const requiresReply = /reply|mention|tag|image|video|audio|sticker/i.test(`${entry.usage || ''} ${entry.desc || ''}`);
      rows.push({ name, type, access: ACCESS[type], description: feature?.instruction || entry.desc || `Run ${name}.`,
        category: feature?.category || type, related: entry.cmd.filter(alias => alias !== name), source: entry.source,
        syntax: syntax.map(value => prefix + value.replace(/^\$/, '')), examples: examples.map(value => prefix + value),
        reference: entry.usage || name, disabled: disabled.includes(name),
        notes: [
          ...(feature ? ['Add your input after the command, or reply to a text message. An AI provider and available quota are required.'] : []),
          ...(requiresReply ? ['Check the syntax for required media, replies or mentions. Replace example URLs and phone numbers with your intended target.'] : []),
          ...(type !== 'public' ? ['Group commands also depend on the bot being enabled and the command not being blocked in that group.'] : []),
          'Syntax templates use <required> and [optional] arguments. Examples are editable starting points; shared module reference lists additional operations.',
        ],
      });
    }
  }
  // Dispatch precedence matches core/messages.js when two modules register a name.
  const dispatched = new Map();
  for (const row of rows) {
    if (!dispatched.has(row.name) || dispatched.get(row.name).type === row.type) dispatched.set(row.name, row);
  }
  return [...dispatched.values()].sort((a, b) => a.name.localeCompare(b.name));
};
