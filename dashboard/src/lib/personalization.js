export const DEFAULT_PERSONALIZATION = Object.freeze({
  displayName: 'Alpha',
  tagline: 'Martech Operations',
  workspaceLabel: 'ALPHA',
  ownerBadge: 'Martech',
  dashboardNote: 'Safe community operations console',
  avatarDataUrl: '',
  theme: 'royal',
  accent: 'violet',
  fontScale: 'normal',
  density: 'comfortable',
  cornerStyle: 'round',
  sidebarDefault: 'expanded',
  motion: 'full',
  highContrast: false,
  quietVisuals: false,
  showBotNumber: true,
  showGroupCount: true,
  showMemberCount: true,
  showUptime: true,
  showConnection: true,
  showQuickSearch: true,
  showSidebarMetrics: true,
  showPageKicker: true,
  compactTopbar: false,
  chartAnimations: true,
  refreshSeconds: 30,
  activityRows: 20,
  startupPage: '/',
  timeStyle: 'relative',
  numberStyle: 'compact',
})

export const PERSONALIZATION_KEY = 'alpha-dashboard-personalization-v2'

const ENUMS = Object.freeze({
  theme: ['royal', 'electric', 'obsidian'],
  accent: ['violet', 'cyan', 'emerald', 'gold', 'rose'],
  fontScale: ['compact', 'normal', 'large'],
  density: ['compact', 'comfortable'],
  cornerStyle: ['sharp', 'soft', 'round'],
  sidebarDefault: ['expanded', 'collapsed'],
  motion: ['full', 'reduced'],
  startupPage: ['/', '/operations', '/management', '/customize', '/control-center', '/groups', '/members', '/analytics', '/templates', '/health'],
  timeStyle: ['relative', 'clock'],
  numberStyle: ['compact', 'full'],
})

const BOOLS = [
  'highContrast', 'quietVisuals', 'showBotNumber', 'showGroupCount', 'showMemberCount',
  'showUptime', 'showConnection', 'showQuickSearch', 'showSidebarMetrics', 'showPageKicker',
  'compactTopbar', 'chartAnimations',
]

const TEXT_LIMITS = Object.freeze({
  displayName: 32,
  tagline: 64,
  workspaceLabel: 18,
  ownerBadge: 24,
  dashboardNote: 120,
})

export function sanitizePersonalization(input = {}) {
  const source = input && typeof input === 'object' ? input : {}
  const safe = { ...DEFAULT_PERSONALIZATION }

  for (const [key, limit] of Object.entries(TEXT_LIMITS)) {
    if (typeof source[key] === 'string') safe[key] = source[key].replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, limit) || DEFAULT_PERSONALIZATION[key]
  }

  for (const [key, allowed] of Object.entries(ENUMS)) {
    if (allowed.includes(source[key])) safe[key] = source[key]
  }

  for (const key of BOOLS) {
    if (typeof source[key] === 'boolean') safe[key] = source[key]
  }

  const refresh = Number(source.refreshSeconds)
  if (Number.isFinite(refresh)) safe.refreshSeconds = Math.min(120, Math.max(15, Math.round(refresh)))

  const rows = Number(source.activityRows)
  if (Number.isFinite(rows)) safe.activityRows = Math.min(50, Math.max(10, Math.round(rows)))

  if (typeof source.avatarDataUrl === 'string' && source.avatarDataUrl.length <= 750_000 && /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(source.avatarDataUrl)) {
    safe.avatarDataUrl = source.avatarDataUrl
  }

  return safe
}

export function loadPersonalization(storage = globalThis?.localStorage) {
  if (!storage) return { ...DEFAULT_PERSONALIZATION }
  try {
    const raw = storage.getItem(PERSONALIZATION_KEY)
    return raw ? sanitizePersonalization(JSON.parse(raw)) : { ...DEFAULT_PERSONALIZATION }
  } catch {
    return { ...DEFAULT_PERSONALIZATION }
  }
}

export function savePersonalization(value, storage = globalThis?.localStorage) {
  const safe = sanitizePersonalization(value)
  if (storage) storage.setItem(PERSONALIZATION_KEY, JSON.stringify(safe))
  return safe
}

export function resetPersonalization(storage = globalThis?.localStorage) {
  if (storage) storage.removeItem(PERSONALIZATION_KEY)
  return { ...DEFAULT_PERSONALIZATION }
}

export function notifyPersonalization(value) {
  const safe = sanitizePersonalization(value)
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('alpha-personalization-change', { detail: safe }))
  return safe
}
