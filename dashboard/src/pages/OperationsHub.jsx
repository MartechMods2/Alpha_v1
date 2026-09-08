import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  clearAuth,
  createPairInvite,
  logoutBot,
  reconnectBot,
  restartBot,
} from '../lib/api.js'
import { DASHBOARD_OPERATIONS, OPERATION_CATEGORIES } from '../lib/operations.js'
import { useToast } from '../App.jsx'

const RUNTIME_ACTIONS = [
  { id: 'pair', icon: '🔗', label: 'Secure Pair Invite', description: 'Generate a one-use customer pairing link.', tone: 'violet' },
  { id: 'reconnect', icon: '↻', label: 'Reconnect Socket', description: 'Start a fresh WhatsApp socket without restarting Node.', tone: 'cyan' },
  { id: 'restart', icon: '⟳', label: 'Restart Process', description: 'Restart Alpha’s Node process when a socket reconnect is not enough.', tone: 'amber', danger: true },
  { id: 'logout', icon: '⇥', label: 'Logout WhatsApp', description: 'Log Alpha out of the currently paired WhatsApp account.', tone: 'rose', danger: true },
  { id: 'clear-auth', icon: '⌫', label: 'Clear Auth State', description: 'Delete stored WhatsApp auth so the deployment can be paired again.', tone: 'rose', danger: true },
]

export default function OperationsHub() {
  const navigate = useNavigate()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [busy, setBusy] = useState('')
  const [pairUrl, setPairUrl] = useState('')

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    return DASHBOARD_OPERATIONS.filter((item) => {
      const matchesCategory = category === 'All' || item.category === category
      const matchesQuery = !q || `${item.label} ${item.description} ${item.command || ''}`.toLowerCase().includes(q)
      return matchesCategory && matchesQuery
    })
  }, [query, category])

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text)
      toast(`Copied ${text}`)
    } catch {
      toast(`Command: ${text}`)
    }
  }

  function openOperation(item) {
    if (item.to) return navigate(item.to)
    if (item.command) return copy(item.command)
  }

  async function runRuntime(id) {
    if (busy) return
    const action = RUNTIME_ACTIONS.find((item) => item.id === id)
    if (!action) return
    if (action.danger && !window.confirm(`${action.label}\n\n${action.description}\n\nContinue?`)) return
    setBusy(id)
    try {
      if (id === 'pair') {
        const result = await createPairInvite()
        setPairUrl(result.url || '')
        if (result.url) await copy(result.url)
        else toast('Pair invite generated')
      } else if (id === 'reconnect') {
        await reconnectBot(); toast('Reconnect started')
      } else if (id === 'restart') {
        await restartBot(); toast('Restart requested')
      } else if (id === 'logout') {
        await logoutBot(); toast('Alpha logged out of WhatsApp')
      } else if (id === 'clear-auth') {
        const result = await clearAuth(); toast(result.message || 'Auth state cleared')
      }
    } catch (error) {
      toast(error.message || 'Operation failed', false)
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="premium-page operations-page">
      <div className="page-header premium-page-header">
        <div>
          <span className="eyebrow">ALPHA OPERATIONS</span>
          <h2>Operations Hub</h2>
          <p className="sub">One premium workspace for navigation, group automations, activity reviews, moderation and runtime controls.</p>
        </div>
        <div className="operations-count"><strong>{DASHBOARD_OPERATIONS.length + RUNTIME_ACTIONS.length}</strong><span>functions</span></div>
      </div>

      <section className="runtime-strip premium-panel">
        <div className="section-heading"><div><span className="eyebrow">DEPLOYMENT</span><h3>Runtime actions</h3></div><span className="section-note">Dangerous actions always ask for confirmation.</span></div>
        <div className="runtime-grid">
          {RUNTIME_ACTIONS.map((item) => (
            <button key={item.id} className={`runtime-action tone-${item.tone}`} disabled={!!busy} onClick={() => runRuntime(item.id)}>
              <span className="runtime-icon">{busy === item.id ? '…' : item.icon}</span>
              <span><strong>{item.label}</strong><small>{item.description}</small></span>
            </button>
          ))}
        </div>
        {pairUrl && <div className="pair-result"><span>Latest secure pair invite</span><button onClick={() => copy(pairUrl)}>{pairUrl}</button></div>}
      </section>

      <section className="operations-library premium-panel">
        <div className="section-heading"><div><span className="eyebrow">TOOL LIBRARY</span><h3>Dashboard + bot functions</h3></div><span className="section-note">Route tools open instantly; command tools copy the exact WhatsApp command.</span></div>
        <div className="operations-toolbar">
          <div className="premium-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search functions…" /></div>
          <div className="operations-filters">
            {['All', ...OPERATION_CATEGORIES].map((name) => <button key={name} className={category === name ? 'active' : ''} onClick={() => setCategory(name)}>{name}</button>)}
          </div>
        </div>

        <div className="operation-grid">
          {items.map((item, index) => (
            <button key={item.id} className="operation-card" style={{ '--delay': `${Math.min(index, 14) * 24}ms` }} onClick={() => openOperation(item)}>
              <span className="operation-card-icon">{item.icon}</span>
              <span className="operation-card-copy"><strong>{item.label}</strong><small>{item.description}</small>{item.command && <code>{item.command}</code>}</span>
              <span className="operation-card-arrow">↗</span>
            </button>
          ))}
        </div>
        {!items.length && <div className="empty-state">No functions matched this filter.</div>}
      </section>
    </div>
  )
}
