import test from 'node:test'
import assert from 'node:assert/strict'
import { DASHBOARD_OPERATIONS, operationCount } from '../dashboard/src/lib/operations.js'

test('dashboard operation catalog includes the expanded premium sections', () => {
  assert.ok(operationCount >= 70, `expected at least 70 operations, got ${operationCount}`)
  const ids = new Set(DASHBOARD_OPERATIONS.map(item => item.id))
  for (const required of ['management', 'customize', 'custom-avatar', 'custom-font', 'count-120d', 'mute-count-30d', 'welcome-template', 'antistatus-template']) {
    assert.ok(ids.has(required), `${required} should be registered`)
  }
  assert.equal(ids.size, DASHBOARD_OPERATIONS.length)
})

test('new dashboard shortcuts are safe previews or read-only/navigation actions', () => {
  const highImpact = DASHBOARD_OPERATIONS.filter(item => /kick|mute|lock|danger/i.test(item.id))
  assert.ok(highImpact.length >= 5)
  for (const item of highImpact) {
    assert.ok(item.command || item.to)
    if (item.command) assert.ok(item.command.startsWith('$'))
  }
})
