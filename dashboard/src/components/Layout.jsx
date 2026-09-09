import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth, useToast } from '../App.jsx'
import { getStats, logout, fmtUptime } from '../lib/api.js'
import { useWebSocket } from '../hooks/useWebSocket.js'
import AlphaMark from './AlphaMark.jsx'
import CommandPalette from './CommandPalette.jsx'
import { loadPersonalization, notifyPersonalization, savePersonalization } from '../lib/personalization.js'

const NAV_SECTIONS = [
  {
    label: 'Workspace',
    items: [
      { to: '/', icon: '◫', label: 'Overview', end: true },
      { to: '/operations', icon: '✦', label: 'Operations Hub' },
      { to: '/management', icon: '▦', label: 'Management Suite' },
      { to: '/engagement', icon: '🌚', label: 'Engagement Center' },
      { to: '/control-center', icon: '⚡', label: 'Control Center' },
      { to: '/analytics', icon: '◒', label: 'Analytics' },
    ],
  },
  {
    label: 'Community',
    items: [
      { to: '/groups', icon: '👥', label: 'Groups' },
      { to: '/members', icon: '👤', label: 'Members' },
      { to: '/templates', icon: '🧩', label: 'Templates' },
      { to: '/commands', icon: '⌘', label: 'Commands' },
    ],
  },
  {
    label: 'Messaging',
    items: [
      { to: '/dm', icon: '✉', label: 'Direct Message' },
      { to: '/broadcast', icon: '📢', label: 'Broadcast' },
      { to: '/media-studio', icon: '🎬', label: 'Media Studio' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/customize', icon: '✎', label: 'Customize Alpha' },
      { to: '/safe-pack', icon: '🛡', label: 'Safe Pack' },
      { to: '/logs', icon: '≡', label: 'Logs' },
      { to: '/health', icon: '♡', label: 'Bot Health' },
      { to: '/settings', icon: '⚙', label: 'Settings' },
    ],
  },
]

const FLAT_NAV = NAV_SECTIONS.flatMap((section) => section.items)

export default function Layout({ children }) {
  const { setAuth } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const wsStatus = useWebSocket()
  const [stats, setStats] = useState(null)
  const [prefs, setPrefs] = useState(() => loadPersonalization())
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('alpha-sidebar')
    if (saved === 'collapsed' || saved === 'expanded') return saved === 'collapsed'
    return loadPersonalization().sidebarDefault === 'collapsed'
  })
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    getStats().then(setStats).catch(() => {})
    const timer = setInterval(() => getStats().then(setStats).catch(() => {}), Math.max(15, prefs.refreshSeconds || 30) * 1000)
    return () => clearInterval(timer)
  }, [prefs.refreshSeconds])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.alphaTheme = prefs.theme
    root.dataset.alphaAccent = prefs.accent
    root.dataset.alphaFontScale = prefs.fontScale
    root.dataset.alphaDensity = prefs.density
    root.dataset.alphaRadius = prefs.cornerStyle
    root.dataset.alphaMotion = prefs.motion
    root.dataset.alphaContrast = prefs.highContrast ? 'high' : 'normal'
    root.dataset.alphaVisuals = prefs.quietVisuals ? 'quiet' : 'full'
    root.dataset.alphaTopbar = prefs.compactTopbar ? 'compact' : 'normal'
  }, [prefs])

  useEffect(() => {
    const update = (event) => setPrefs(event?.detail || loadPersonalization())
    const storageUpdate = (event) => {
      if (!event.key || event.key.includes('alpha-dashboard-personalization')) setPrefs(loadPersonalization())
    }
    window.addEventListener('alpha-personalization-change', update)
    window.addEventListener('storage', storageUpdate)
    return () => {
      window.removeEventListener('alpha-personalization-change', update)
      window.removeEventListener('storage', storageUpdate)
    }
  }, [])

  useEffect(() => { localStorage.setItem('alpha-sidebar', collapsed ? 'collapsed' : 'expanded') }, [collapsed])

  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); setPaletteOpen((value) => !value)
      }
      if (event.key === 'Escape') setPaletteOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function handleLogout() {
    try { await logout(); setAuth(false); navigate('/login') }
    catch { toast('Logout failed', false) }
  }

  const connected = wsStatus === 'connected'
  const activePage = useMemo(() => FLAT_NAV.find((item) => item.to === location.pathname)?.label || 'Alpha Console', [location.pathname])

  const cycleTheme = () => {
    const nextTheme = prefs.theme === 'royal' ? 'electric' : prefs.theme === 'electric' ? 'obsidian' : 'royal'
    const next = savePersonalization({ ...prefs, theme: nextTheme })
    setPrefs(next); notifyPersonalization(next)
  }

  const showMetric = prefs.showSidebarMetrics && (prefs.showGroupCount || prefs.showMemberCount || prefs.showUptime)

  return (
    <div className={`shell premium-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className="sidebar premium-sidebar">
        <div className="brand premium-brand">
          <div className="brand-mark-wrap">{prefs.avatarDataUrl ? <img src={prefs.avatarDataUrl} alt={`${prefs.displayName} avatar`} className="brand-avatar-small" /> : <AlphaMark size={42} />}</div>
          <div className="brand-text premium-brand-copy">
            <h1>{prefs.displayName}</h1>
            <p>{prefs.tagline}</p>
          </div>
          <button className="sidebar-collapse" onClick={() => setCollapsed((value) => !value)} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? '›' : '‹'}</button>
        </div>

        {prefs.showConnection && <div className="sidebar-status-card">
          <span className={`status-orb ${connected ? 'online' : ''}`} />
          <div><strong>{connected ? 'System online' : wsStatus === 'connecting' ? 'Connecting' : 'System offline'}</strong><small>{prefs.showBotNumber ? (stats?.botNumber || 'WhatsApp runtime') : prefs.ownerBadge}</small></div>
        </div>}

        <nav className="nav premium-nav">
          {NAV_SECTIONS.map((section) => (
            <div className="nav-section" key={section.label}>
              <div className="nav-section-label">{section.label}</div>
              {section.items.map(({ to, icon, label, end }) => (
                <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-item premium-nav-item${isActive ? ' active' : ''}`} title={collapsed ? label : undefined}>
                  <span className="nav-icon">{icon}</span><span className="nav-label">{label}</span><span className="nav-active-dot" />
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer premium-sidebar-footer">
          {showMetric && <div className="sidebar-metrics">
            {prefs.showGroupCount && <div><span>Groups</span><strong>{stats?.groupCount ?? '—'}</strong></div>}
            {prefs.showMemberCount && <div><span>Members</span><strong>{stats?.memberCount ?? '—'}</strong></div>}
            {prefs.showUptime && <div><span>Uptime</span><strong>{stats ? fmtUptime(stats.uptime) : '—'}</strong></div>}
          </div>}
          <button className="btn-logout" onClick={handleLogout}><span>⇥</span><span className="nav-label">Sign Out</span></button>
        </div>
      </aside>

      <section className="workspace">
        <header className="premium-topbar">
          <div className="topbar-title">{prefs.showPageKicker && <span className="topbar-kicker">{prefs.workspaceLabel} /</span>}<strong>{activePage}</strong></div>
          <div className="topbar-actions">
            {prefs.showQuickSearch && <button className="topbar-command" onClick={() => setPaletteOpen(true)}><span>⌕</span><span>Search tools</span><kbd>Ctrl K</kbd></button>}
            <button className="topbar-icon-btn" onClick={cycleTheme} title="Change dashboard color theme">◐</button>
            {prefs.showConnection && <span className={`premium-status-pill ${connected ? 'online' : ''}`}><span className="status-orb" />{connected ? 'Live' : 'Offline'}</span>}
          </div>
        </header>
        <main className="main premium-main">{children}</main>
      </section>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  )
}
