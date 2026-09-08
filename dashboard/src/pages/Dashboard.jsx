import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
import { getStats, getAnalytics, getActivity, getCommandStats, getHealth, fmtBytes, fmtUptime } from '../lib/api.js'
import { useWebSocket } from '../hooks/useWebSocket.js'
import { useWsEvent } from '../hooks/useWsEvent.js'
import { useToast } from '../App.jsx'
import AlphaMark from '../components/AlphaMark.jsx'
import { DASHBOARD_OPERATIONS, operationCount } from '../lib/operations.js'
import { loadPersonalization } from '../lib/personalization.js'

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

const CHART_COLORS = ['#8b5cf6', '#22d3ee', '#a78bfa', '#38bdf8', '#f59e0b']
const TOOLTIP = {
  backgroundColor: '#111224',
  borderColor: 'rgba(167,139,250,.25)',
  borderWidth: 1,
  titleColor: '#c4b5fd',
  bodyColor: '#f8fafc',
  padding: 12,
  cornerRadius: 12,
  boxWidth: 8,
  boxHeight: 8,
}

const ACTIVITY_META = {
  command_used: { icon: '⌘', label: 'Command', color: '#8b5cf6' },
  member_blocked: { icon: '⊘', label: 'Blocked', color: '#fb7185' },
  member_unblocked: { icon: '✓', label: 'Unblocked', color: '#34d399' },
  broadcast_sent: { icon: '↗', label: 'Broadcast', color: '#f59e0b' },
  dm_sent: { icon: '✉', label: 'DM', color: '#22d3ee' },
}

function fmtAgo(ts) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function fmtEventTime(ts, style) {
  if (style !== 'clock') return fmtAgo(ts)
  try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  catch { return fmtAgo(ts) }
}

function formatNumber(value, style) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  if (style === 'compact' && Math.abs(n) >= 1000) return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n)
  return n.toLocaleString()
}

function ActivityDetail({ kind, detail }) {
  if (kind === 'command_used') return <span><code>{detail.cmd}</code> by {detail.name || detail.from?.split('@')[0]} in {detail.group}</span>
  if (kind === 'member_blocked' || kind === 'member_unblocked') return <code>{detail.jid}</code>
  if (kind === 'broadcast_sent') return <span>{detail.sent}/{detail.total} sent — “{detail.preview}”</span>
  if (kind === 'dm_sent') return <span>to <code>{detail.to}</code></span>
  return <span>{JSON.stringify(detail)}</span>
}

function Metric({ icon, value, label, hint }) {
  return <div className="premium-metric"><span className="premium-metric-icon">{icon}</span><div><strong>{value ?? '—'}</strong><span>{label}</span>{hint && <small>{hint}</small>}</div></div>
}

export default function Dashboard() {
  const toast = useToast()
  const wsStatus = useWebSocket()
  const [prefs, setPrefs] = useState(() => loadPersonalization())
  const [stats, setStats] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [health, setHealth] = useState(null)
  const [commandStats, setCommandStats] = useState({})
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getStats(), getAnalytics(), getActivity(), getCommandStats(), getHealth()])
      .then(([s, a, act, commands, h]) => {
        setStats(s); setAnalytics(a); setHealth(h); setCommandStats(commands.stats || {}); setActivity((act.activity || []).slice().reverse())
      })
      .catch(() => toast('Failed to load dashboard data', false))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const update = (event) => setPrefs(event?.detail || loadPersonalization())
    window.addEventListener('alpha-personalization-change', update)
    return () => window.removeEventListener('alpha-personalization-change', update)
  }, [])

  const handleActivity = useCallback((data) => {
    const event = data.event || data
    if (event?.id) setActivity((prev) => [event, ...prev.slice(0, Math.max(9, prefs.activityRows - 1))])
  }, [prefs.activityRows])
  const handleActivitySnapshot = useCallback((data) => {
    if (data.activity?.length) setActivity(data.activity.slice().reverse())
  }, [])
  useWsEvent('activity', handleActivity)
  useWsEvent('activity_snapshot', handleActivitySnapshot)

  const topCommands = useMemo(() => Object.entries(commandStats)
    .map(([name, count]) => ({ name, count: Number(count) || 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5), [commandStats])

  if (loading) return <div className="loading-state premium-loading"><span className="spinner" /><span>Loading {prefs.displayName} console…</span></div>

  const connected = wsStatus === 'connected' || health?.connected
  const typeData = analytics ? [
    { name: 'Text', value: analytics.typeBreakdown.text },
    { name: 'Image', value: analytics.typeBreakdown.image },
    { name: 'Video', value: analytics.typeBreakdown.video },
    { name: 'Sticker', value: analytics.typeBreakdown.sticker },
    { name: 'PDF', value: analytics.typeBreakdown.pdf },
  ].filter((item) => item.value > 0) : []
  const topGroups = analytics?.topGroups?.slice(0, 7) || []
  const memoryPct = health?.memory?.heapTotal ? Math.min(100, Math.round((health.memory.heapUsed / health.memory.heapTotal) * 100)) : 0
  const animation = prefs.chartAnimations && prefs.motion !== 'reduced'

  const groupBarData = {
    labels: topGroups.map((group) => group.name),
    datasets: [{ data: topGroups.map((group) => group.messages), backgroundColor: '#8b5cf6', hoverBackgroundColor: '#a78bfa', borderRadius: 8, barThickness: 20 }],
  }
  const messageData = {
    labels: typeData.map((item) => item.name),
    datasets: [{ data: typeData.map((item) => item.value), backgroundColor: CHART_COLORS, borderColor: '#101124', borderWidth: 4, hoverOffset: 8 }],
  }

  const quickOps = DASHBOARD_OPERATIONS.filter((item) => item.to).slice(1, 9)

  return (
    <div className="premium-page premium-dashboard">
      <section className="dashboard-hero premium-panel">
        <div className="dashboard-hero-copy">
          <div className="hero-mark">{prefs.avatarDataUrl ? <img src={prefs.avatarDataUrl} alt={`${prefs.displayName} avatar`} className="alpha-avatar-preview" style={{width:68,height:68,borderRadius:20}} /> : <AlphaMark size={58} />}</div>
          <div>
            <span className="eyebrow">{prefs.workspaceLabel} · {prefs.ownerBadge}</span>
            <h2>{prefs.displayName} operations console.</h2>
            <p>{prefs.dashboardNote}</p>
            <div className="hero-actions"><Link className="btn btn-primary" to="/management">▦ Open Management Suite</Link><Link className="btn btn-ghost" to="/customize">✎ Customize Alpha</Link></div>
          </div>
        </div>
        <div className="hero-status-cluster">
          <div className={`hero-live-card ${connected ? 'online' : ''}`}><span className="status-orb" /><div><strong>{connected ? `${prefs.displayName} is live` : `${prefs.displayName} is offline`}</strong><small>{prefs.showBotNumber ? (stats?.botNumber || 'WhatsApp connection') : prefs.tagline}</small></div></div>
          <div className="hero-operation-count"><strong>{operationCount + 5}</strong><span>dashboard functions</span></div>
        </div>
      </section>

      <section className="premium-metric-grid">
        <Metric icon="👥" value={formatNumber(stats?.groupCount, prefs.numberStyle)} label="Managed groups" hint={`${analytics?.activeGroups ?? 0} active`} />
        <Metric icon="👤" value={formatNumber(stats?.memberCount, prefs.numberStyle)} label="Known members" hint={`${analytics?.blockedMembers ?? 0} blocked`} />
        <Metric icon="💬" value={formatNumber(analytics?.totalMessages, prefs.numberStyle)} label="Tracked messages" hint="Across all media types" />
        <Metric icon="⏱" value={stats ? fmtUptime(stats.uptime) : '—'} label="Current uptime" hint={health?.nodeVersion || 'Node runtime'} />
        <Metric icon="⌘" value={formatNumber(Object.keys(commandStats).length, prefs.numberStyle)} label="Commands used" hint={topCommands[0] ? `Top: ${topCommands[0].name}` : 'Awaiting usage'} />
        <Metric icon="◒" value={`${memoryPct}%`} label="Heap usage" hint={health?.memory ? `${fmtBytes(health.memory.heapUsed)} used` : 'Runtime memory'} />
      </section>

      <section className="dashboard-bento">
        <div className="premium-panel bento-wide chart-card premium-chart-card">
          <div className="section-heading"><div><span className="eyebrow">ACTIVITY</span><h3>Top groups</h3></div><Link to="/analytics">Open analytics ↗</Link></div>
          {topGroups.length ? <div className="premium-chart-wrap"><Bar data={groupBarData} options={{ animation, indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { ...TOOLTIP, callbacks: { label: (ctx) => ` ${ctx.parsed.x.toLocaleString()} messages` } } }, scales: { x: { grid: { color: 'rgba(148,163,184,.08)' }, ticks: { color: '#64748b' }, border: { display: false } }, y: { grid: { display: false }, ticks: { color: '#a8b2c7' }, border: { display: false } } } }} /></div> : <div className="empty-state">No group activity yet.</div>}
        </div>

        <div className="premium-panel bento-small premium-chart-card">
          <div className="section-heading"><div><span className="eyebrow">MESSAGE MIX</span><h3>Media share</h3></div></div>
          {typeData.length ? <div className="donut-wrap"><Doughnut data={messageData} options={{ animation, responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', usePointStyle: true, boxWidth: 7, padding: 14 } }, tooltip: TOOLTIP } }} /><div className="donut-center"><strong>{formatNumber(analytics?.totalMessages, prefs.numberStyle)}</strong><span>messages</span></div></div> : <div className="empty-state">No message data yet.</div>}
        </div>

        <div className="premium-panel bento-small command-leaderboard">
          <div className="section-heading"><div><span className="eyebrow">COMMANDS</span><h3>Most used</h3></div><Link to="/commands">Manage ↗</Link></div>
          <div className="leaderboard-list">{topCommands.length ? topCommands.map((item, index) => <div key={item.name}><span>{String(index + 1).padStart(2, '0')}</span><code>{item.name}</code><strong>{item.count}</strong></div>) : <div className="empty-state">Command usage will appear here.</div>}</div>
        </div>

        <div className="premium-panel bento-wide quick-actions-panel">
          <div className="section-heading"><div><span className="eyebrow">FAST ACCESS</span><h3>Premium shortcuts</h3></div><Link to="/operations">All functions ↗</Link></div>
          <div className="premium-quick-grid">{quickOps.map((item) => <Link key={item.id} to={item.to} className="premium-quick-card"><span>{item.icon}</span><div><strong>{item.label}</strong><small>{item.description}</small></div><em>↗</em></Link>)}</div>
        </div>
      </section>

      <section className="premium-panel activity-panel">
        <div className="section-heading"><div><span className="eyebrow">LIVE FEED</span><h3>Recent activity</h3></div><Link to="/logs">Open logs ↗</Link></div>
        {activity.length === 0 ? <div className="empty-state">No activity yet. Use {prefs.displayName} to populate the live feed.</div> : <div className="activity-list premium-activity-list">{activity.slice(0, prefs.activityRows).map((event) => {
          const meta = ACTIVITY_META[event.kind] || { icon: '•', label: event.kind, color: '#94a3b8' }
          return <div key={event.id} className="activity-row premium-activity-row"><span className="activity-icon" style={{ color: meta.color }}>{meta.icon}</span><span className="activity-badge" style={{ color: meta.color, background: `${meta.color}16` }}>{meta.label}</span><span className="activity-detail"><ActivityDetail kind={event.kind} detail={event.detail || {}} /></span><span className="activity-time">{fmtEventTime(event.ts, prefs.timeStyle)}</span></div>
        })}</div>}
      </section>
    </div>
  )
}
