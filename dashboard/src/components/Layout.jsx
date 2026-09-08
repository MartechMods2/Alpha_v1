import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth, useToast } from '../App.jsx'
import { getStats, logout, fmtUptime } from '../lib/api.js'
import { useWebSocket } from '../hooks/useWebSocket.js'
import AlphaMark from './AlphaMark.jsx'
import CommandPalette from './CommandPalette.jsx'

const NAV_SECTIONS = [
  {
    label: 'Workspace',
    items: [
      { to: '/', icon: '◫', label: 'Overview', end: true },
      { to: '/operations', icon: '✦', label: 'Operations Hub' },
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
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('alpha-sidebar') === 'collapsed')
  const [theme, setTheme] = useState(() => localStorage.getItem('alpha-theme') || 'royal')
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    getStats().then(setStats).catch(() => {})
    const timer = setInterval(() => getStats().then(setStats).catch(() => {}), 30_000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.alphaTheme = theme
    localStorage.setItem('alpha-theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('alpha-sidebar', collapsed ? 'collapsed' : 'expanded')
  }, [collapsed])

  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((value) => !value)
      }
      if (event.key === 'Escape') setPaletteOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function handleLogout() {
    try {
      await logout()
      setAuth(false)
      navigate('/login')
    } catch {
      toast('Logout failed', false)
    }
  }

  const connected = wsStatus === 'connected'
  const activePage = useMemo(() => {
    const current = FLAT_NAV.find((item) => item.to === location.pathname)
    return current?.label || 'Alpha Console'
  }, [location.pathname])

  const cycleTheme = () => setTheme((value) => value === 'royal' ? 'electric' : value === 'electric' ? 'obsidian' : 'royal')

  return (
    <div className={`shell premium-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className="sidebar premium-sidebar">
        <div className="brand premium-brand">
          <div className="brand-mark-wrap"><AlphaMark size={42} /></div>
          <div className="brand-text premium-brand-copy">
            <h1>Alpha</h1>
            <p>Martech Operations</p>
          </div>
          <button className="sidebar-collapse" onClick={() => setCollapsed((value) => !value)} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? '›' : '‹'}</button>
        </div>

        <div className="sidebar-status-card">
          <span className={`status-orb ${connected ? 'online' : ''}`} />
          <div><strong>{connected ? 'System online' : wsStatus === 'connecting' ? 'Connecting' : 'System offline'}</strong><small>{stats?.botNumber || 'WhatsApp runtime'}</small></div>
        </div>

        <nav className="nav premium-nav">
          {NAV_SECTIONS.map((section) => (
            <div className="nav-section" key={section.label}>
              <div className="nav-section-label">{section.label}</div>
              {section.items.map(({ to, icon, label, end }) => (
                <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-item premium-nav-item${isActive ? ' active' : ''}`} title={collapsed ? label : undefined}>
                  <span className="nav-icon">{icon}</span>
                  <span className="nav-label">{label}</span>
                  <span className="nav-active-dot" />
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer premium-sidebar-footer">
          <div className="sidebar-metrics">
            <div><span>Groups</span><strong>{stats?.groupCount ?? '—'}</strong></div>
            <div><span>Members</span><strong>{stats?.memberCount ?? '—'}</strong></div>
            <div><span>Uptime</span><strong>{stats ? fmtUptime(stats.uptime) : '—'}</strong></div>
          </div>
          <button className="btn-logout" onClick={handleLogout}><span>⇥</span><span className="nav-label">Sign Out</span></button>
        </div>
      </aside>

      <section className="workspace">
        <header className="premium-topbar">
          <div className="topbar-title"><span className="topbar-kicker">ALPHA /</span><strong>{activePage}</strong></div>
          <div className="topbar-actions">
            <button className="topbar-command" onClick={() => setPaletteOpen(true)}><span>⌕</span><span>Search tools</span><kbd>Ctrl K</kbd></button>
            <button className="topbar-icon-btn" onClick={cycleTheme} title="Change dashboard color theme">◐</button>
            <span className={`premium-status-pill ${connected ? 'online' : ''}`}><span className="status-orb" />{connected ? 'Live' : 'Offline'}</span>
          </div>
        </header>
        <main className="main premium-main">{children}</main>
      </section>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  )
}
