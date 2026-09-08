import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_PERSONALIZATION, sanitizePersonalization } from '../dashboard/src/lib/personalization.js'

test('dashboard personalization accepts safe values and clamps numeric settings', () => {
  const safe = sanitizePersonalization({
    displayName: '  Alpha Prime  ',
    theme: 'electric',
    accent: 'cyan',
    refreshSeconds: 2,
    activityRows: 999,
    highContrast: true,
  })
  assert.equal(safe.displayName, 'Alpha Prime')
  assert.equal(safe.theme, 'electric')
  assert.equal(safe.accent, 'cyan')
  assert.equal(safe.refreshSeconds, 15)
  assert.equal(safe.activityRows, 50)
  assert.equal(safe.highContrast, true)
})

test('dashboard personalization rejects arbitrary script/css style fields and unsafe avatars', () => {
  const safe = sanitizePersonalization({
    theme: 'javascript:alert(1)',
    customCss: 'body{display:none}',
    script: '<script>alert(1)</script>',
    avatarDataUrl: 'https://example.com/evil.svg',
    startupPage: 'https://evil.example',
  })
  assert.equal(safe.theme, DEFAULT_PERSONALIZATION.theme)
  assert.equal(safe.avatarDataUrl, '')
  assert.equal(safe.startupPage, '/')
  assert.equal('customCss' in safe, false)
  assert.equal('script' in safe, false)
})

test('dashboard personalization accepts only bounded local image data urls', () => {
  const avatar = 'data:image/png;base64,' + 'A'.repeat(120)
  const safe = sanitizePersonalization({ avatarDataUrl: avatar })
  assert.equal(safe.avatarDataUrl, avatar)
  const tooLarge = sanitizePersonalization({ avatarDataUrl: 'data:image/png;base64,' + 'A'.repeat(750_001) })
  assert.equal(tooLarge.avatarDataUrl, '')
})
