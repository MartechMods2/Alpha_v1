import { useEffect, useState } from 'react'
import { getSafePack } from '../lib/api.js'
import { useToast } from '../App.jsx'

const State = ({ ok, yes = 'Configured', no = 'Not configured' }) => (
  <strong style={{ color: ok ? '#22c55e' : '#f59e0b' }}>{ok ? yes : no}</strong>
)

export default function SafePack() {
  const toast = useToast()
  const [data, setData] = useState(null)

  const load = () => getSafePack().then(setData).catch((error) => toast(error.message || 'Failed to load Safe Pack', false))
  useEffect(() => {
    load()
    const timer = setInterval(load, 20_000)
    return () => clearInterval(timer)
  }, [])

  if (!data) return <div style={{ padding: 50, textAlign: 'center' }}><div className="spinner" /></div>
  const providers = Object.entries(data.ai.providers || {})
  const automations = Object.entries(data.automations || {})

  return <div>
    <h2 style={{ marginBottom: 4 }}>Safe Feature Pack</h2>
    <p style={{ color: 'var(--muted)', marginBottom: 24, fontSize: 14 }}>
      Read-only reliability, moderation, automation and provider status. No API secrets or private message content is shown.
    </p>

    <div className="stats-grid" style={{ marginBottom: 20 }}>
      <div className="stat-card"><span>Configured groups</span><strong>{data.configuredGroups}</strong></div>
      <div className="stat-card"><span>Queued sends</span><strong>{data.queue.totalQueued}</strong></div>
      <div className="stat-card"><span>Active sends</span><strong>{data.queue.activeSends}</strong></div>
      <div className="stat-card"><span>Recent failures</span><strong>{data.queueFailures.length}</strong></div>
    </div>

    <div className="card" style={{ padding: 24, marginBottom: 20 }}>
      <h3 style={{ marginTop: 0 }}>Safety integrations</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
        <div>Encrypted backup<br /><State ok={data.backup.configured} /></div>
        <div>Off-site storage<br /><State ok={data.integrations.objectStorage} /></div>
        <div>Signed webhook<br /><State ok={data.integrations.signedWebhook} /></div>
        <div>Fact-check service<br /><State ok={data.integrations.factCheck} /></div>
      </div>
      {data.backup.latest && <p style={{ color: 'var(--muted)', marginBottom: 0, fontSize: 13 }}>
        Latest backup: {new Date(data.backup.latest.createdAt).toLocaleString()} · {data.backup.latest.status}
      </p>}
    </div>

    <div className="card" style={{ padding: 24, marginBottom: 20 }}>
      <h3 style={{ marginTop: 0 }}>AI providers and privacy</h3>
      <p style={{ color: 'var(--muted)', fontSize: 13 }}>PII redaction is enforced by the Safe AI gateway. Moderation suggestions remain advisory.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
        {providers.map(([name, provider]) => <div key={name} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
          <strong>{name}</strong><br /><State ok={provider.configured && !provider.disabledUntil} yes="Available" no={provider.configured ? 'Cooling down' : 'Not configured'} />
          {provider.lastError && <div style={{ color: '#ef4444', fontSize: 11, marginTop: 5 }}>{provider.lastError}</div>}
        </div>)}
      </div>
    </div>

    <div className="card" style={{ padding: 24, marginBottom: 20 }}>
      <h3 style={{ marginTop: 0 }}>Active automations</h3>
      {automations.length ? automations.map(([name, count]) => <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border)' }}><span>{name}</span><strong>{count}</strong></div>) : <p style={{ color: 'var(--muted)' }}>No scheduled group automations are active.</p>}
    </div>

    <div className="card" style={{ padding: 24 }}>
      <h3 style={{ marginTop: 0 }}>Recent send failures</h3>
      {data.queueFailures.length ? data.queueFailures.map((row) => <div key={row._id} style={{ padding: '9px 0', borderTop: '1px solid var(--border)', fontSize: 13 }}>
        <strong>{row.chatId}</strong> · {new Date(row.createdAt).toLocaleString()}<div style={{ color: '#ef4444' }}>{row.error}</div>
      </div>) : <p style={{ color: 'var(--muted)' }}>No recent queued-send failures.</p>}
    </div>
  </div>
}
