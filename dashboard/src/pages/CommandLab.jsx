import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getCommandGuide, testCommand } from '../lib/api.js'

export default function CommandLab() {
  const location = useLocation()
  const [text, setText] = useState('')
  const [context, setContext] = useState('group')
  const [role, setRole] = useState('member')
  const [data, setData] = useState(null)
  const [history, setHistory] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    getCommandGuide().then(setData).catch(err => setError(err.message))
  }, [])
  useEffect(() => { setText(new URLSearchParams(location.search).get('command') || '') }, [location.search])
  async function run(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try {
      const result = await testCommand({ text, context, role })
      setHistory(previous => [{ text, result, context, role }, ...previous].slice(0, 20))
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }
  return <div className="command-lab-page">
    <div className="page-header"><div><h2>Command Lab</h2><p className="sub">A sandbox terminal for Alpha commands.</p></div><Link className="btn" to="/command-guide">Full Command Guide</Link></div>
    <div className="card" style={{ padding: 20, marginBottom: 18 }}>
      <p><strong>Offline tests:</strong> Calculator and Text Lab commands execute their real handlers and display replies here. Game starts validate the real rounds, theme and lobby parsers. Every other command checks registration, global enablement and simulated permissions.</p>
      <p>These tests send no WhatsApp messages and change no saved data. They do not verify live group settings, AI providers, media downloads or game votes. Use a WhatsApp test group for those flows.</p>
      <details><summary>Commands that execute offline</summary><p>{data?.offlineCommands?.join(', ') || 'Loading…'}</p></details>
    </div>
    <form onSubmit={run} className="card command-lab-form">
      <div className="command-lab-controls">
        <div className="form-field"><label className="form-label" htmlFor="lab-context">Chat context</label><select id="lab-context" className="form-select" value={context} onChange={event => setContext(event.target.value)}><option value="group">Group</option><option value="direct">Direct message</option></select></div>
        <div className="form-field"><label className="form-label" htmlFor="lab-role">Simulated role</label><select id="lab-role" className="form-select" value={role} onChange={event => setRole(event.target.value)}><option value="member">Member</option><option value="admin">Admin</option><option value="owner">Owner / Alpha account</option></select></div>
      </div>
      <label className="form-label" htmlFor="lab-command">Command input</label>
      <textarea className="form-textarea code-input" id="lab-command" value={text} onChange={event => setText(event.target.value)} maxLength={4000} rows={4} placeholder={`${data?.prefix || '$'}calc 25 * 4 + 10`} aria-describedby="lab-input-help" />
      <p id="lab-input-help" className="sub">Use the configured prefix ({data?.prefix || '$'}). Separate up to six commands with semicolons, commas or new lines followed by the prefix.</p>
      <div className="command-lab-actions">
      <button className="btn btn-primary" type="submit" disabled={busy || !text.trim() || !data}>{busy ? 'Testing…' : 'Run sandbox test'}</button>
      <button className="btn" type="button" disabled={busy} onClick={() => setHistory([])} >Clear results</button>
      </div>
    </form>
    {error && <p role="alert">{error}</p>}
    <div className="command-lab-results" aria-live="polite">{history.map((item, index) => <div className="card" key={index} style={{ padding: 20, marginTop: 16 }}>
      <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{`> ${item.text}`}</pre><p className="sub">{item.context} · {item.role}</p>
      {item.result.results.map((row, rowIndex) => <div key={rowIndex} style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}><strong>{row.ok ? '✓' : '✗'} {row.command} · {row.mode}</strong>{row.output.map((line, lineIndex) => <pre key={lineIndex} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{line}</pre>)}{row.options && <pre>{JSON.stringify(row.options, null, 2)}</pre>}{row.syntax && <p className="sub">Syntax: {row.syntax.join(' · ')}</p>}</div>)}
      {item.result.truncated && <p>Only the first six commands were tested.</p>}<p className="sub">{item.result.notice}</p>
    </div>)}</div>
  </div>
}
