import { useMemo, useState } from 'react'
import { useToast } from '../App.jsx'

const TEMPLATES = [
  ['welcome','community','👋','New-member onboarding and admin guidance'], ['goodbye','community','🚪','Departure notice with re-add guidance'], ['rules','community','📜','Full group rules and escalation expectations'], ['birthday','automation','🎂','Automatic birthday celebration'], ['birthday-confirmation','automation','✅','Birthday registration confirmation'], ['warning','moderation','⚠️','Standard member warning'], ['final-warning','moderation','🚨','Warning-limit notice'], ['anti-link','security','🔗','Anti-Link warning'], ['anti-link-action','security','⛔','Anti-Link final enforcement notice'], ['anti-status','security','📵','Status-mention strike warning'], ['anti-status-final','security','🚫','Status-mention limit notice'], ['anti-spam','security','🚨','Spam/flooding warning'], ['muted','moderation','🔇','Mute notice for member and admins'], ['unmuted','moderation','🔊','Mute-lifted notice'], ['removed','moderation','🚪','Moderation removal notice'], ['inactivity','activity','🪫','Activity review guidance'], ['inactivity-cleanup','activity','🧹','Pre-cleanup admin review'], ['group-locked','moderation','🔒','Admin-only mode notice'], ['group-reopened','moderation','🔓','Normal messaging restored'], ['announcement','community','📢','Structured important announcement'], ['morning','automation','🌅','Scheduled morning greeting + Alpha insight'], ['night','automation','🌙','Scheduled night greeting'], ['game','games','🎮','Game start instructions'], ['game-result','games','🏆','Game result and winner notice'], ['event','automation','📅','Event milestone reminder'], ['poll','community','📊','Group poll guidance'], ['game-join','games','🗳️','Voluntary game opt-in poll'], ['count-report','activity','📈','Activity report explanation'], ['kick-count-confirmation','activity','⚠️','Destructive cleanup confirmation'], ['mute-count-confirmation','activity','🔇','Bulk mute confirmation'], ['security-alert','security','🛡️','General security review alert'], ['member-cleared','moderation','✅','Review complete / no further action'],
]

export default function TemplateLibrary() {
  const toast = useToast(); const [query, setQuery] = useState(''); const [category, setCategory] = useState('all')
  const categories = ['all', ...new Set(TEMPLATES.map(x => x[1]))]
  const rows = useMemo(() => TEMPLATES.filter(([key, cat, , desc]) => (category === 'all' || cat === category) && `${key} ${cat} ${desc}`.toLowerCase().includes(query.toLowerCase())), [query, category])
  const copy = async (key) => { try { await navigator.clipboard.writeText(`$template ${key}`); toast(`Copied $template ${key}`) } catch { toast('Could not copy command', false) } }

  return <div>
    <div className="page-header"><div><h2>Built-In Templates</h2><p className="sub">Alpha’s default communication pack is part of the bot core—new groups do not need manual template setup.</p></div><input className="search-input" placeholder="Search templates…" value={query} onChange={e => setQuery(e.target.value)} /></div>
    <div className="stats-grid">
      <div className="stat-card"><span className="stat-icon">🧩</span><div className="stat-body"><strong>{TEMPLATES.length}</strong><span>Core Templates</span></div></div>
      <div className="stat-card"><span className="stat-icon">⚡</span><div className="stat-body"><strong>Zero</strong><span>Manual Setup Required</span></div></div>
      <div className="stat-card"><span className="stat-icon">🛡️</span><div className="stat-body"><strong>Built-in</strong><span>Safety Messaging</span></div></div>
    </div>
    <div className="chips">{categories.map(cat => <button key={cat} className={`chip ${category === cat ? 'active' : ''}`} onClick={() => setCategory(cat)}>{cat === 'all' ? 'All' : cat[0].toUpperCase() + cat.slice(1)}</button>)}</div>
    <div className="group-grid">{rows.map(([key, cat, icon, desc]) => <div className="grp-card" key={key}><div className="grp-header"><div><h3>{icon} {key}</h3><div className="grp-desc" style={{ marginTop: 6 }}>{desc}</div></div><span className="badge badge-group">{cat}</span></div><div className="jid-sm">$template {key}</div><div className="actions"><button className="btn-sm" onClick={() => copy(key)}>Copy preview command</button></div></div>)}</div>
    {!rows.length && <div className="empty-state">No templates match this filter.</div>}
  </div>
}
