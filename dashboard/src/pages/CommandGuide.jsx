import Select from '../components/Select.jsx'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCommandGuide } from '../lib/api.js'
import { useToast } from '../App.jsx'

export default function CommandGuide() {
  const toast = useToast()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const categories = useMemo(() => [...new Set((data?.commands || []).map(row => row.category))].sort(), [data])
  const [type, setType] = useState('all')
  const [page, setPage] = useState(1)
  async function load() {
    setError('')
    try { setData(await getCommandGuide()) } catch (err) { setError(err.message) }
  }
  useEffect(() => { load() }, [])
  useEffect(() => { setPage(1) }, [query, type, category])
  const rows = useMemo(() => (data?.commands || []).filter(row =>
    (type === 'all' || row.type === type) && (category === 'all' || row.category === category) && `${row.name} ${row.description} ${row.category} ${row.reference} ${row.syntax.join(' ')}`.toLowerCase().includes(query.toLowerCase().trim())), [data, query, type, category])
  const maxPage = Math.max(1, Math.ceil(rows.length / 30))
  const currentPage = Math.min(page, maxPage)
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('Command copied') } catch { toast('Copy unavailable. Select the command text to copy it.', false) }
  }
  return <div>
    <div className="page-header"><div><h2>Command Guide</h2><p className="sub">{data ? `${data.commands.length} registered command names · Prefix: ${data.prefix}` : 'Loading registered commands…'}</p></div><Link className="btn btn-primary" to="/command-lab">Open Command Lab</Link></div>
    <div className="card" style={{ padding: 20, marginBottom: 18 }}>
      <h3>How to use Alpha</h3>
      <p>Type the prefix and command in WhatsApp. Replace &lt;required&gt; values and optionally supply [optional] values. For replies, select a message and send the command as your reply; for media, attach it with the command as the caption where supported.</p>
      <p>Public commands work in direct messages and groups. Member commands usually need a group. Admin and owner tools need the permissions shown below. Commands can also be disabled globally or blocked in a group.</p>
      <details><summary>Full automatic games and Truth or Dare walkthrough</summary>{data?.games.map((line, index) => <p key={index}>{line}</p>)}</details>
    </div>
    {error && <div className="card" role="alert" style={{ padding: 20 }}><p>{error}</p><button className="btn" onClick={load}>Retry</button></div>}
    {!!data?.loadErrors?.length && <p role="alert">{data.loadErrors.length} modules failed to load: {data.loadErrors.map(row => row.file).join(', ')}. Check Bot Logs; their commands are unavailable.</p>}
    <label className="form-label" htmlFor="guide-search">Search every command, purpose and usage</label>
    <input id="guide-search" className="search-input" style={{ width: '100%', marginBottom: 12 }} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search tools, games, text, planning or moderation…" />
    <div style={{ maxWidth: 360, marginBottom: 12 }}><label className="form-label" htmlFor="guide-category">Feature category</label><Select id="guide-category" aria-label="Feature category" value={category} onChange={event => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}</Select></div>
    <div className="chips">{['all', 'public', 'group', 'admin', 'owner'].map(value => <button key={value} className={`chip ${type === value ? 'active' : ''}`} onClick={() => setType(value)}>{value}</button>)}</div>
    <p className="sub">{rows.length} matching commands · Page {currentPage} of {maxPage}</p>
    {rows.slice((currentPage - 1) * 30, currentPage * 30).map(row => <details className="card" key={row.name} style={{ padding: 18, marginBottom: 10 }}>
      <summary style={{ cursor: 'pointer' }}><strong><code>{data.prefix}{row.name}</code></strong> <span className={`badge badge-${row.type}`}>{row.type}</span> {row.disabled && <span className="badge">Disabled</span>}<span style={{ display: 'block', marginTop: 6 }}>{row.description}</span></summary>
      <p><strong>Access:</strong> {row.access}</p>
      <p><strong>Category:</strong> {row.category}</p>
      <h4>Syntax</h4>{row.syntax.map((line, index) => <pre key={index} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{line}</pre>)}
      <h4>Example usage</h4>{row.examples.map((line, index) => <div key={index} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}><code style={{ overflowWrap: 'anywhere' }}>{line}</code><button className="btn btn-sm" onClick={() => copy(line)}>Copy</button><Link className="btn btn-sm" to={`/command-lab?command=${encodeURIComponent(line)}`}>Test</Link></div>)}
      {row.notes.map((line, index) => <p key={index} className="sub">{line}</p>)}
      <p><strong>Shared module reference:</strong> <code>{row.reference}</code></p>
      {!!row.related.length && <details><summary>Other names in this module ({row.related.length})</summary><p>{row.related.join(', ')}</p></details>}
      <p className="sub">Implementation: {row.source}</p>
    </details>)}
    {data && !rows.length && <p>No commands match your search.</p>}
    <div className="page-actions"><button className="btn" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</button><button className="btn" disabled={currentPage >= maxPage} onClick={() => setPage(currentPage + 1)}>Next</button></div>
  </div>
}
