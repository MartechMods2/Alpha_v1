import { useEffect, useMemo, useState } from 'react'
import { getAnalytics, getGroups, getHealth, updateGroup } from '../lib/api.js'
import { useToast } from '../App.jsx'

const CORE = [
  ['isWelcomeOn', '👋', 'Welcome', 'Greets new members with Alpha’s built-in welcome guide.'],
  ['isGoodbyeOn', '🚪', 'Goodbye', 'Posts a clear departure notice and admin guidance.'],
  ['isAntiLinkOn', '🔗', 'Anti-Link', 'Warns on unapproved links and applies the configured policy.'],
  ['isAntiSpamOn', '🚨', 'Anti-Spam', 'Detects flooding and repeated disruptive messages.'],
  ['isAntiStatusMentionOn', '📵', 'Anti-Status', 'Protects the group from repeated Status mentions.'],
]

function Toggle({ checked, onChange, disabled }) {
  return <label className="toggle"><input type="checkbox" checked={!!checked} onChange={onChange} disabled={disabled} /><span className="slider" /></label>
}

export default function ControlCenter() {
  const toast = useToast()
  const [groups, setGroups] = useState([])
  const [health, setHealth] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [busy, setBusy] = useState('')
  const [selected, setSelected] = useState('')

  const load = async () => {
    try {
      const [g, h, a] = await Promise.all([getGroups(), getHealth(), getAnalytics()])
      setGroups(g || []); setHealth(h); setAnalytics(a); setSelected(prev => prev || g?.[0]?._id || '')
    } catch (e) { toast(e.message || 'Could not load Control Center', false) }
  }
  useEffect(() => { load() }, [])

  const current = useMemo(() => groups.find(g => g._id === selected), [groups, selected])
  const enabled = current ? CORE.filter(([key]) => current[key]).length : 0
  const readiness = current ? Math.round(((current.isBotOn ? 1 : 0) + enabled) / (CORE.length + 1) * 100) : 0

  async function patch(update, message) {
    if (!current || busy) return
    setBusy(current._id)
    try {
      await updateGroup(current._id, update)
      setGroups(prev => prev.map(g => g._id === current._id ? { ...g, ...update } : g))
      toast(message || 'Group updated')
    } catch (e) { toast(e.message || 'Update failed', false) }
    finally { setBusy('') }
  }
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); toast(`Copied ${text}`) }
    catch { toast('Could not copy command', false) }
  }

  return <div>
    <div className="page-header">
      <div><h2>Control Center</h2><p className="sub">A faster admin surface for group protection, readiness and Alpha automation controls.</p></div>
      <button className="btn btn-ghost" onClick={load}>↻ Refresh</button>
    </div>

    <div className="stats-grid">
      <div className="stat-card"><span className="stat-icon">🟢</span><div className="stat-body"><strong>{health?.connected ? 'Online' : 'Offline'}</strong><span>WhatsApp</span></div></div>
      <div className="stat-card"><span className="stat-icon">👥</span><div className="stat-body"><strong>{groups.length}</strong><span>Managed Groups</span></div></div>
      <div className="stat-card"><span className="stat-icon">💬</span><div className="stat-body"><strong>{analytics?.totalMessages?.toLocaleString?.() ?? '—'}</strong><span>Tracked Messages</span></div></div>
      <div className="stat-card"><span className="stat-icon">🛡️</span><div className="stat-body"><strong>{readiness}%</strong><span>Selected Readiness</span></div></div>
    </div>

    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-header">
        <div><div className="card-title">Choose a group</div><div className="card-sub">Control Center changes only the selected group.</div></div>
        <select className="form-select" style={{ maxWidth: 340 }} value={selected} onChange={e => setSelected(e.target.value)}>
          {groups.map(g => <option key={g._id} value={g._id}>{g.grpName || g._id}</option>)}
        </select>
      </div>
      {current ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" disabled={!!busy} onClick={() => patch({ isBotOn: true, isWelcomeOn: true, isGoodbyeOn: true, isAntiLinkOn: true, isAntiSpamOn: true, isAntiStatusMentionOn: true }, 'Recommended core controls enabled')}>⚡ Enable Recommended Core</button>
        <button className="btn btn-ghost" disabled={!!busy} onClick={() => patch({ isWelcomeOn: false, isGoodbyeOn: false, isAntiLinkOn: false, isAntiSpamOn: false, isAntiStatusMentionOn: false }, 'Core automations disabled')}>Disable Core Automations</button>
      </div> : <div className="empty-state">No groups are available yet.</div>}
    </div>

    {current && <div className="group-grid" style={{ marginBottom: 18 }}>
      {CORE.map(([key, icon, title, desc]) => <div className="grp-card" key={key}>
        <div className="grp-header"><div><h3>{icon} {title}</h3><div className="grp-desc" style={{ marginTop: 6 }}>{desc}</div></div><Toggle checked={current[key]} disabled={!!busy} onChange={() => patch({ [key]: !current[key] }, `${title} ${current[key] ? 'disabled' : 'enabled'}`)} /></div>
        <span className={`badge ${current[key] ? 'badge-on' : 'badge-off'}`}>{current[key] ? 'Enabled' : 'Disabled'}</span>
      </div>)}
    </div>}

    <div className="charts-row">
      <div className="chart-card"><p className="chart-title">⚡ Scheduled Automation Pack</p><p style={{ color: 'var(--text-soft)', fontSize: '.82rem', lineHeight: 1.7, marginBottom: 14 }}>Alpha now has built-in defaults for welcome, birthdays, moderation, safety, daily greetings, games and activity notices. One admin command activates the recommended full pack for a new group.</p><div className="actions"><button className="btn btn-primary" onClick={() => copy('$automationpack on')}>Copy $automationpack on</button><button className="btn btn-ghost" onClick={() => copy('$automationpack status')}>Copy status command</button></div></div>
      <div className="chart-card"><p className="chart-title">📡 Group Management Pulse</p><p style={{ color: 'var(--text-soft)', fontSize: '.82rem', lineHeight: 1.7, marginBottom: 14 }}>Use the new read-only pulse report for tracking coverage, zero-activity members, warnings, mutes, protection coverage and scheduled automation readiness.</p><button className="btn btn-ghost" onClick={() => copy('$grouppulse')}>Copy $grouppulse</button></div>
    </div>
  </div>
}
