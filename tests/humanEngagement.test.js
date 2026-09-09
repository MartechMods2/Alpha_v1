import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHumanSettings, parseMinutesToken, sanitizeEngagementLine, shouldActiveEngage, shouldSilenceEngage } from '../utils/humanEngagementPolicy.js';
import { renderGroupTemplate } from '../utils/groupTemplates.js';

test('human engagement settings normalize safely', () => {
  const settings = normalizeHumanSettings({ isChatBotOn: true, humanEngagementLevel: 'lively', humanSilenceMinutes: 5, humanDailyLimit: 99 });
  assert.equal(settings.enabled, true);
  assert.equal(settings.level, 'lively');
  assert.equal(settings.silenceMinutes, 30);
  assert.equal(settings.dailyLimit, 5);
  assert.equal(parseMinutesToken('2h'), 120);
});

test('silence engagement respects silence and daily caps', () => {
  const settings = normalizeHumanSettings({ isChatBotOn: true, humanSilenceMinutes: 60, humanDailyLimit: 2 });
  const now = Date.now();
  assert.equal(shouldSilenceEngage({ nowMs: now, lastHumanAt: now - 61 * 60_000, lastAlphaAt: 0, dailyCount: 0, settings, localHour: 14 }), true);
  assert.equal(shouldSilenceEngage({ nowMs: now, lastHumanAt: now - 61 * 60_000, lastAlphaAt: 0, dailyCount: 2, settings, localHour: 14 }), false);
  assert.equal(shouldSilenceEngage({ nowMs: now, lastHumanAt: now - 61 * 60_000, lastAlphaAt: 0, dailyCount: 0, settings, localHour: 3 }), false);
});

test('active joining needs a real multi-member burst', () => {
  const settings = normalizeHumanSettings({ isChatBotOn: true, humanEngagementLevel: 'balanced' });
  const now = Date.now();
  const recent = Array.from({ length: 7 }, (_, i) => ({ at: now - i * 20_000, sender: i % 2 ? 'a' : 'b', text: `message ${i}` }));
  assert.equal(shouldActiveEngage({ nowMs: now, recent, lastAlphaAt: 0, dailyCount: 0, settings, localHour: 16, chanceSeed: 6 }), true);
  assert.equal(shouldActiveEngage({ nowMs: now, recent: recent.slice(0, 2), lastAlphaAt: 0, dailyCount: 0, settings, localHour: 16, chanceSeed: 6 }), false);
});

test('runtime templates are concise and human', () => {
  const welcome = renderGroupTemplate('welcome', { user: '@Tobi', group: 'Desire Hub' });
  const warning = renderGroupTemplate('warning', { user: '@Tobi', reason: 'Spam detected', warning: 1, max: 3 });
  assert.ok(welcome.length < 220);
  assert.ok(warning.length < 220);
  assert.ok(!welcome.includes('Dear members'));
  assert.ok(sanitizeEngagementLine('hello\nthere').includes('hello there'));
});
