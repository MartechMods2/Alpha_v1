import { useEffect, useMemo, useState } from 'react'
import { getAnalytics, getGroups, getHealth, getSafePack, updateGroup } from '../lib/api.js'
import { useToast } from '../App.jsx'

const GROUP_CONTROLS = [
  ['isBotOn', 'Alpha core', 'Master group command switch.'],
  ['isChatBotOn', 'AI chat', 'Allow Alpha mention/chat responses.'],
  ['isImgOn', 'Image features', 'Allow group image-generation/image tools where supported.'],
  ['isWelcomeOn', 'Welcome', 'Automatic new-member welcome.'],
  ['isGoodbyeOn', 'Goodbye', 'Automatic departure notice.'],
  ['isAntiLinkOn', 'Anti-Link', 'Protect against unapproved links.'],
  ['isAntiSpamOn', 'Anti-Spam', 'Detect disruptive message flooding.'],
  ['isAntiStatusMentionOn', 'Anti-Status', 'Protect against repeated Status mentions.'],
  ['isAutoStickerOn', 'Auto Sticker', 'Enable the group auto-sticker feature.'],
  ['isRankNotifOn', 'Rank notifications', 'Show rank/progress notifications.'],
  ['alphaImageOn', 'Alpha image replies', 'Allow image context in Alpha responses.'],
  ['alphaVoiceOn', 'Alpha voice replies', 'Allow voice/audio response features.'],
  ['alphaDocOn', 'Alpha document replies', 'Allow document-aware response features.'],
  ['alphaStickerOn', 'Alpha sticker replies', 'Allow Alpha mention sticker responses.'],
]

const QUICK_COMMANDS = [
  ['New group launch', '$automationpack on', 'Enable the recommended automation pack.'],
  ['Automation status', '$automationpack status', 'Review recommended automation state.'],
  ['Group pulse', '$grouppulse', 'Read-only management readiness report.'],
  ['Full activity', '$count', 'Rank the current group membership.'],
  ['Detailed activity', '$count all', 'Show detailed per-member activity.'],
  ['Activity summary', '$count summary', 'Show cleanup-oriented activity buckets.'],
  ['Zero activity', '$count zero', 'Review members with no tracked messages.'],
  ['Below 10', '$count member min 10', 'Review members below 10 tracked messages.'],
  ['Below 20', '$count member min 20', 'Review members below 20 tracked messages.'],
  ['Below 50', '$count member min 50', 'Review members below 50 tracked messages.'],
  ['Inactive 30d', '$countinactive 30d', 'Review proven 30-day inactive members.'],
  ['Inactive 60d', '$countinactive 60d', 'Review proven 60-day inactive members.'],
  ['Inactive 120d', '$countinactive 120d', 'Review proven 120-day inactive members.'],
  ['Kick last review', '$kickcount', 'Preview removal of the exact last count result.'],
  ['Mute last review', '$mutecount', 'Preview a 7-day mute of the last count result.'],
  ['Mute last review 30d', '$mutecount 30d', 'Preview a 30-day mute.'],
  ['Lock group', '$muteall', 'Preview admin-only posting mode.'],
  ['Reopen group', '$unmuteall', 'Restore normal group posting.'],
  ['Danger guide', '$danger', 'Show safeguarded high-impact admin actions.'],
  ['Template library', '$templates', 'List every built-in message template.'],
  ['Welcome template', '$template welcome', 'Preview the built-in welcome message.'],
  ['Rules template', '$template rules', 'Preview the built-in rules message.'],
  ['Warning template', '$template warning', 'Preview the built-in warning message.'],
  ['Anti-Link template', '$template anti-link', 'Preview the Anti-Link warning.'],
  ['Birthday template', '$template birthday', 'Preview the birthday message.'],
  ['Announcement template', '$template announcement', 'Preview the announcement layout.'],
  ['Poll template', '$template poll', 'Preview the poll layout.'],
  ['Game help', '$game help', 'Open Alpha game-engine help.'],
]

function fmt(value) { return Number.isFinite(Number(value)) ? Number(value).toLocaleString() : '—' }

export default function ManagementSuite() {
  const toast = useToast()
  const [groups, setGroups] = useState([])
  const [selected, setSelected] = useState('')
  const [health, setHealth] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [safePack, setSafePack] = useState(null)
  const [busy, setBusy] = useState('')

  async function load() {
    try {
      const [g, h, a, s] = await Promise.all([getGroups(), getHealth(), getAnalytics(), getSafePack()])
      setGroups(g || []); setHealth(h); setAnalytics(a); setSafePack(s)
      setSelected(prev => prev && g?.some(row => row._id === prev) ? prev : (g?.[0]?._id || ''))
    } catch (error) { toast(error.message || 'Could not load Management Suite', false) }
  }

  useEffect(() => { load() }, [])
  const current = useMemo(() => groups.find(row => row._id === selected), [groups, selected])
  const enabledControls = current ? GROUP_CONTROLS.filter(([key]) => !!current[key]).length : 0

  async function patch(key, value) {
    if (!current || busy) return
    setBusy(key)
    try {
      await updateGroup(current._id, { [key]: value })
      setGroups(prev => prev.map(row => row._id === current._id ? { ...row, [key]: value } : row))
      toast(`${GROUP_CONTROLS.find(([k]) => k === key)?.[1] || key} ${value ? 'enabled' : 'disabled'}`)
    } catch (error) { toast(error.message || 'Update failed', false) }
    finally { setBusy('') }
  }

  async function copy(command) {
    try { await navigator.clipboard.writeText(command); toast(`Copied ${command}`) }
    catch { toast('Could not copy command', false) }
  }

  return <div className="premium-page">
    <div className="page-header premium-page-header">
      <div><span className="eyebrow">Administration</span><h2>Management Suite</h2><p className="sub">A consolidated safe control surface with 40+ management modules: group toggles, activity review shortcuts, communication tools, templates, safety and system snapshots.</p></div>
      <button className="btn btn-ghost" onClick={load}>Refresh suite</button>
    </div>

    <div className="management-summary">
      <div className="management-metric"><span>WhatsApp</span><strong>{health?.connected ? 'Online' : 'Offline'}</strong></div>
      <div className="management-metric"><span>Groups</span><strong>{fmt(groups.length)}</strong></div>
      <div className="management-metric"><span>Messages</span><strong>{fmt(analytics?.totalMessages)}</strong></div>
      <div className="management-metric"><span>Safe automations</span><strong>{fmt(Object.values(safePack?.automations || {}).reduce((a,b) => a + Number(b || 0), 0))}</strong></div>
    </div>

    <section className="premium-panel" style={{marginBottom:14}}>
      <div className="studio-heading"><div><h3>Selected group</h3><p>Every switch below changes only this group. High-impact kick/mute actions are not executed from this page.</p></div><span className="badge badge-on">{enabledControls}/{GROUP_CONTROLS.length} enabled</span></div>
      <select className="form-select" value={selected} onChange={e => setSelected(e.target.value)} style={{maxWidth:520}}>{groups.map(group => <option key={group._id} value={group._id}>{group.grpName || group._id}</option>)}</select>
    </section>

    <section className="premium-panel" style={{marginBottom:14}}>
      <div className="studio-heading"><div><h3>Live group controls</h3><p>Fourteen independent controls that previously required moving between multiple dashboard screens or WhatsApp commands.</p></div><span className="badge badge-on">14 controls</span></div>
      {current ? <div className="management-controls">{GROUP_CONTROLS.map(([key, title, text]) => <label className="management-control" key={key}><div className="management-control-head"><div><h4>{title}</h4><p>{text}</p></div><input type="checkbox" checked={!!current[key]} disabled={!!busy} onChange={e => patch(key, e.target.checked)} /></div></label>)}</div> : <div className="empty-state">No managed group is available yet.</div>}
    </section>

    <section className="premium-panel" style={{marginBottom:14}}>
      <div className="studio-heading"><div><h3>Activity & cleanup shortcuts</h3><p>These commands are copied only. Alpha still performs its normal live roster checks, protection checks and confirmation steps before any destructive action.</p></div><span className="badge badge-on">28 shortcuts</span></div>
      <div className="quick-command-grid">{QUICK_COMMANDS.map(([label, command, text]) => <button key={command} className="quick-command-card" onClick={() => copy(command)}><strong>{label}</strong><small>{text}</small><code>{command}</code></button>)}</div>
    </section>

    <div className="studio-grid">
      <section className="premium-panel studio-panel third"><div className="studio-heading"><div><h3>Safety snapshot</h3><p>Read-only Safe Pack status.</p></div></div><div className="management-metric"><span>Configured groups</span><strong>{fmt(safePack?.configuredGroups)}</strong></div><div style={{marginTop:10,color:'var(--text-muted)',fontSize:'.66rem',lineHeight:1.6}}>Queue failures: {fmt(safePack?.queueFailures?.length)}<br />Object storage: {safePack?.integrations?.objectStorage ? 'Configured' : 'Not configured'}<br />Signed webhook: {safePack?.integrations?.signedWebhook ? 'Configured' : 'Not configured'}</div></section>
      <section className="premium-panel studio-panel third"><div className="studio-heading"><div><h3>Runtime snapshot</h3><p>Safe read-only process health.</p></div></div><div className="management-metric"><span>Heap used</span><strong>{health?.memory?.heapUsed ? `${Math.round(health.memory.heapUsed/1024/1024)} MB` : '—'}</strong></div><div style={{marginTop:10,color:'var(--text-muted)',fontSize:'.66rem',lineHeight:1.6}}>Node: {health?.nodeVersion || '—'}<br />Platform: {health?.platform || '—'}<br />PID: {health?.pid || '—'}</div></section>
      <section className="premium-panel studio-panel third"><div className="studio-heading"><div><h3>Community snapshot</h3><p>Overall tracked community totals.</p></div></div><div className="management-metric"><span>Members</span><strong>{fmt(analytics?.totalMembers)}</strong></div><div style={{marginTop:10,color:'var(--text-muted)',fontSize:'.66rem',lineHeight:1.6}}>Active groups: {fmt(analytics?.activeGroups)}<br />Blocked members: {fmt(analytics?.blockedMembers)}<br />Tracked groups: {fmt(analytics?.totalGroups)}</div></section>
    </div>
  </div>
}
