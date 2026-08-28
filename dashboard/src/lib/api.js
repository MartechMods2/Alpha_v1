const call = async (method, path, body) => {
  const r = await fetch(path, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) {
    const e = await r.json().catch(() => ({}))
    throw new Error(e.error || r.statusText)
  }
  return r.json()
}

export const api = {
	get:   (path)        => call('GET',   path),
	post:  (path, body)  => call('POST',  path, body),
	patch: (path, body)  => call('PATCH', path, body),
	delete: (path)       => call('DELETE', path),
}

// Auth
export const getMe    = ()         => api.get('/api/admin/me')
export const login    = (password) => api.post('/api/admin/login', { password })
export const logout   = ()         => api.post('/api/admin/logout')

// Stats
export const getStats = () => api.get('/api/admin/stats')

// Commands
export const getCommands   = ()                           => api.get('/api/admin/commands')
export const toggleCommand = (cmd, disabled, aliases)     =>
  api.patch(`/api/admin/commands/${encodeURIComponent(cmd)}`, { disabled, aliases })

// Groups
export const getGroups           = ()            => api.get('/api/admin/groups')
export const updateGroup         = (jid, update) =>
  api.patch(`/api/admin/groups/${encodeURIComponent(jid)}`, update)
export const getGroupChatHistory = (jid, hours = 24) =>
  api.get(`/api/admin/groups/${encodeURIComponent(jid)}/chat-history?hours=${hours}`)

// Members
export const getMembers  = (params) =>
  api.get(`/api/admin/members?${new URLSearchParams(params)}`)
export const memberAction = (jid, action) =>
  api.patch(`/api/admin/members/${encodeURIComponent(jid)}`, { action })

// Analytics
export const getAnalytics = () => api.get('/api/admin/analytics')

// Health
export const getHealth = () => api.get('/api/admin/bot/health')
export const getSafePack = () => api.get('/api/admin/safe-pack')

// Broadcast
export const broadcast = (message, targetJids) =>
  api.post('/api/admin/broadcast', { message, targetJids })

// Pairing code login
export const requestPair = (phoneNumber) =>
  api.post('/api/admin/request-pair', { phoneNumber })

// Clear WhatsApp auth (forces re-login)
export const clearAuth = () =>
  api.post('/api/admin/clear-auth')

// Logout bot from WhatsApp (sends proper logout signal)
export const logoutBot = () =>
  api.post('/api/admin/logout-bot')

// Reconnect — spins up a fresh socket (use after logout or clear-auth)
export const reconnectBot = () =>
  api.post('/api/admin/reconnect')

// Full process restart (last resort — use when reconnect alone isn't enough)
export const restartBot = () =>
  api.post('/api/admin/restart')

// Logs
export const getLogs         = (params) => api.get(`/api/admin/logs?${new URLSearchParams(params)}`)

// Activity
export const getActivity     = ()        => api.get('/api/admin/activity')

// Command usage stats
export const getCommandStats = ()        => api.get('/api/admin/command-stats')

// Direct message
export const sendDirect      = (jid, message) => api.post('/api/admin/dm', { jid, message })

// YT Cookies
export const getYtCookies  = ()        => api.get('/api/admin/yt-cookies')
export const saveYtCookies = (content) => api.post('/api/admin/yt-cookies', { content })

// Media Studio
export const getMediaStudio = () => api.get('/api/admin/media-studio')
export const updateMediaStudio = (settings) => api.patch('/api/admin/media-studio', settings)
export const retryMediaJob = (id) => api.post(`/api/admin/media-studio/jobs/${encodeURIComponent(id)}/retry`)
export const getSavedStickers = (group = '') => api.get(`/api/admin/media-studio/stickers${group ? `?group=${encodeURIComponent(group)}` : ''}`)
export const deleteSavedSticker = (id) => api.delete(`/api/admin/media-studio/stickers/${encodeURIComponent(id)}`)
export const getMemeTemplates = () => api.get('/api/admin/media-studio/templates')
export const saveMemeTemplate = (name, templateId) => api.post('/api/admin/media-studio/templates', { name, templateId })
export const deleteMemeTemplate = (id) => api.delete(`/api/admin/media-studio/templates/${encodeURIComponent(id)}`)
export const exportGroupConfig = (jid) => api.get(`/api/admin/groups/${encodeURIComponent(jid)}/export`)
export const importGroupConfig = (jid, payload) => api.post(`/api/admin/groups/${encodeURIComponent(jid)}/import`, payload)

// Helpers
export function fmtUptime(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function fmtBytes(bytes) {
  if (bytes < 1024)        return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}
