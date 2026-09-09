import { useEffect, useMemo, useState } from 'react'
import { getGroups } from '../lib/api.js'
import { useToast } from '../App.jsx'

const SHORTCUTS = [
  ['$humanmode on', 'Enable Human Mode'],
  ['$humanmode off', 'Disable Human Mode'],
  ['$humanmode level chill', 'Low-frequency, calm engagement'],
  ['$humanmode level balanced', 'Balanced engagement'],
  ['$humanmode level lively', 'More playful, still rate-limited'],
  ['$humanmode silence 45m', 'Revive after 45 minutes'],
  ['$humanmode silence 75m', 'Recommended silence trigger'],
  ['$humanmode silence 120m', 'Very conservative silence trigger'],
  ['$humanmode limit 2', 'Maximum two Alpha engagement posts/day'],
  ['$humanmode limit 3', 'Maximum three/day'],
  ['$humanmode active on', 'Allow intelligent conversation joining'],
  ['$humanmode active off', 'Only revive silent groups'],
  ['$eventadmin on', 'Enable daily admin event reminder'],
  ['$eventadmin off', 'Disable admin event reminder'],
  ['$eventadmin time 21:30', 'Set reminder to 9:30PM'],
  ['$doorauto on', 'Enable scheduled group open/close'],
  ['$doorauto off', 'Disable scheduled group open/close'],
  ['$doorauto open 08:00', 'Open group at 8AM'],
  ['$doorauto close 00:00', 'Close group at midnight'],
  ['$groupauto status', 'See all scheduled automations'],
]

const EXAMPLES = [
  ['Quiet group', 'This silence is suspicious. 🌚'],
  ['Active vibe', 'This conversation needs supervision. 🌚'],
  ['Welcome', 'New blood has entered. 🌚 Welcome, @Name.'],
  ['Goodbye', '@Name chose freedom. We respect it. 🫡'],
  ['Birthday', '@Name added another year of trouble. 😂 Happy birthday!'],
  ['Warning', 'Easy, @Name. 🌚 Let’s keep it respectful.'],
  ['Anti-Link', 'That link failed the vibe check. 😂'],
  ['After dark', 'Night crew, report for duty. 🌚🔥'],
]

export default function EngagementCenter() {
  const toast = useToast()
  const [groups, setGroups] = useState([])
  const [selected, setSelected] = useState('')

  useEffect(() => {
    getGroups().then((rows) => {
      setGroups(rows || [])
      setSelected((rows || [])[0]?._id || '')
    }).catch(() => toast('Could not load groups', false))
  }, [])

  const group = useMemo(() => groups.find((item) => item._id === selected), [groups, selected])
  const enabled = group?.humanEngagementEnabled == null ? Boolean(group?.isChatBotOn) : Boolean(group?.humanEngagementEnabled)

  const copy = async (command) => {
    try { await navigator.clipboard.writeText(command); toast(`${command} copied`) }
    catch { toast('Copy failed', false) }
  }

  return <div className="premium-page">
    <div className="page-header premium-page-header">
      <div><span className="eyebrow">HUMAN MODE</span><h2>Engagement Center</h2><p className="sub">Short, contextual, rate-limited group engagement — without turning Alpha into a notification machine.</p></div>
    </div>

    <div className="premium-panel" style={{ marginBottom: 16 }}>
      <div className="section-heading"><div><span className="eyebrow">GROUP PROFILE</span><h3>Current engagement setup</h3></div></div>
      <select value={selected} onChange={(e) => setSelected(e.target.value)} style={{ width: '100%', marginBottom: 14 }}>
        {groups.map((item) => <option key={item._id} value={item._id}>{item.grpName || item._id}</option>)}
      </select>
      <div className="premium-metric-grid">
        <div className="premium-metric"><span className="premium-metric-icon">🌚</span><div><strong>{enabled ? 'ON' : 'OFF'}</strong><span>Human Mode</span></div></div>
        <div className="premium-metric"><span className="premium-metric-icon">🎚</span><div><strong>{group?.humanEngagementLevel || 'balanced'}</strong><span>Vibe level</span></div></div>
        <div className="premium-metric"><span className="premium-metric-icon">🤫</span><div><strong>{group?.humanSilenceMinutes || 75}m</strong><span>Silence trigger</span></div></div>
        <div className="premium-metric"><span className="premium-metric-icon">🧠</span><div><strong>{group?.humanDailyLimit || 3}</strong><span>Daily post cap</span></div></div>
        <div className="premium-metric"><span className="premium-metric-icon">👀</span><div><strong>{group?.humanActiveJoinEnabled === false ? 'OFF' : 'ON'}</strong><span>Conversation joining</span></div></div>
        <div className="premium-metric"><span className="premium-metric-icon">📅</span><div><strong>{group?.humanAdminReminderTime || '21:30'}</strong><span>Admin event reminder</span></div></div>
      </div>
    </div>

    <div className="dashboard-bento">
      <section className="premium-panel bento-wide">
        <div className="section-heading"><div><span className="eyebrow">SAFE CONTROLS</span><h3>20 useful engagement actions</h3></div></div>
        <div className="premium-quick-grid">
          {SHORTCUTS.map(([command, label]) => <button key={command} className="premium-quick-card" onClick={() => copy(command)} style={{ textAlign: 'left', width: '100%' }}>
            <span>⌘</span><div><strong>{label}</strong><small>{command}</small></div><em>Copy</em>
          </button>)}
        </div>
      </section>

      <section className="premium-panel bento-small">
        <div className="section-heading"><div><span className="eyebrow">VOICE CHECK</span><h3>How Alpha should sound</h3></div></div>
        <div className="leaderboard-list">
          {EXAMPLES.map(([label, text], index) => <div key={label}><span>{String(index + 1).padStart(2, '0')}</span><code>{label}</code><strong style={{ fontWeight: 500 }}>{text}</strong></div>)}
        </div>
      </section>
    </div>

    <div className="premium-panel" style={{ marginTop: 16 }}>
      <span className="eyebrow">BAN-SAFE DESIGN</span>
      <h3>What Alpha deliberately does not do</h3>
      <p className="sub" style={{ marginTop: 8 }}>No bulk unsolicited DMs, no tagging random members to force replies, no engagement loops, no AI call on every message, no fake typing storms, and no endless memory history. Silence prompts are capped, conversation joins are probabilistic and cooldown-protected, and admin event tags happen at most once per day when an event actually exists.</p>
    </div>
  </div>
}
