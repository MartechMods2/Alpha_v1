import { Link } from 'react-router-dom'
import { useEffect, useState, useMemo } from 'react'
import { getCommands, toggleCommand, getCommandStats } from '../lib/api.js'
import { useToast } from '../App.jsx'

const TYPE_FILTERS = ['all', 'public', 'group', 'admin', 'owner']

const truthDareGuide = [
  ['Start and lobby', '$td start opens a 30-second lobby and automatically joins the person who starts it. Choose 1–100 rounds: $td start 10 funny lobby=2m or $td start rounds=10 funny lobby=2m. Each player gets one turn in each round. The lobby timer accepts lobby=30s through lobby=10m. Alpha waits until that timer ends even after people vote; use $td close to start early.'],
  ['Join or leave', 'Others vote Join game in the poll or type $td join. Decoded votes update the counted player list immediately; check $td status before closing. Type $td leave to leave before the lobby closes. At least two players are needed, including the starter. Maximum: 20 players.'],
  ['Close and resume', 'The starter, a group admin, or the bot owner can use $td close to end the lobby early. $td resume restores a saved session after a restart; $td status shows the current phase.'],
  ['Take a turn', 'Alpha shuffles the players. Only the named player types truth, dare, or skip (or $td truth / $td dare / $td skip). The choice window is 45 seconds. For Truth, send an answer in chat or $td answer <text>. For Dare, perform it and type done. Some matching media dares accept a photo, video, voice note, or sticker. Responses have 90 seconds. Skips and timeouts earn 0.'],
  ['Scores and winner', 'Truth earns 10 points; Dare earns 15. Consecutive completed turns add 2, 4, or 6 points. Completing every round without a skip or timeout adds 5 points. Alpha posts round scoreboards and announces the highest scorer (or tied winners) after the last round. $td score shows live scores; $td board shows saved totals; $td stats shows your profile.'],
  ['Host controls', '$td next skips the active turn; $td stop ends the game and saves points earned so far. The starter participates like any other player, including when they are a group admin. If you are using Alpha’s own WhatsApp account, use the $td commands for your turns. Use $td help and $td rules in chat for a shorter reference.'],
]

const autoGameGuide = [
  ['Choose a game', 'Automatically host Trivia, Maths, Scramble, Emoji Guess, Riddle, Fast Type, Odd One Out, Flag Guess, True/False or Number Guess. Start with $game start trivia tech rounds=10 lobby=2m or $game start mathgame 5 lobby=90s. $game random and $game lobby also start hosted games.'],
  ['Rounds and lobby', 'Choose 1–100 rounds, with one turn for every player in each round. Defaults: two rounds and a 60-second lobby. Lobby duration: 30 seconds to 10 minutes. The starter is automatically enrolled and can participate as an admin.'],
  ['Enrollment', 'Others vote Join game or send $game join. $game leave removes you during the lobby. $game status shows counted players and time remaining. At least two players are required; maximum 20. Alpha starts when the timer ends. The starter, an admin or the owner can use $game close to start early.'],
  ['Turns and scoring', 'Alpha shuffles players each round and gives each player 60 seconds. Only the named player can answer with #your answer, $answer your answer or $game answer your answer. Use #skip to pass. A correct answer earns the displayed points; a wrong answer, skip or timeout earns zero and Alpha advances automatically.'],
  ['Scores and controls', '$game liveboard shows session scores. Alpha posts round results and announces the highest scorer, including tied winners, after the final round. $game board shows permanent totals. Starter/admin controls: $game next skips a turn; $game stop ends the session and keeps earned scores.'],
  ['Recovery', 'Alpha restores saved hosted games when it reconnects. $game resume restores a saved session on demand. If playing from Alpha’s own WhatsApp account, use $game answer or $answer for your answers.'],
]

export default function Commands() {
  const toast = useToast()
  const [all,     setAll]     = useState([])
  const [stats,   setStats]   = useState({})
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('all')
  const [search,  setSearch]  = useState('')

  useEffect(() => {
    Promise.all([getCommands(), getCommandStats().catch(() => ({ stats: {} }))])
      .then(([d, s]) => {
        setStats(s.stats || {})
        setAll([
          ...(d.publicCommands || []).map(c => ({ ...c, type: 'public' })),
          ...(d.groupCommands  || []).map(c => ({ ...c, type: 'group' })),
          ...(d.adminCommands  || []).map(c => ({ ...c, type: 'admin' })),
          ...(d.ownerCommands  || []).map(c => ({ ...c, type: 'owner' })),
        ])
      })
      .catch(() => toast('Failed to load commands', false))
      .finally(() => setLoading(false))
  }, [])

  const rows = useMemo(() => {
    const q = search.toLowerCase()
    return all.filter(c => {
      if (filter !== 'all' && c.type !== filter) return false
      if (q && !c.cmd.join(' ').toLowerCase().includes(q) && !(c.desc || '').toLowerCase().includes(q)) return false
      return true
    })
  }, [all, filter, search])

  async function handleToggle(cmd, aliases, currentlyDisabled) {
    const newDisabled = !currentlyDisabled
    // Optimistic update
    setAll(prev => prev.map(c =>
      c.cmd.some(k => aliases.includes(k)) ? { ...c, disabledGlobally: newDisabled } : c
    ))
    try {
      await toggleCommand(cmd, newDisabled, aliases)
      toast(newDisabled ? `🚫 ${cmd} disabled` : `✅ ${cmd} enabled`)
    } catch (err) {
      // Revert
      setAll(prev => prev.map(c =>
        c.cmd.some(k => aliases.includes(k)) ? { ...c, disabledGlobally: currentlyDisabled } : c
      ))
      toast(err.message, false)
    }
  }

  const enabledCount  = all.filter(c => !c.disabledGlobally).length
  const disabledCount = all.filter(c =>  c.disabledGlobally).length
  const maxUses = Math.max(1, ...Object.values(stats))

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Commands</h2>
          <p className="sub">
            {all.length} total &nbsp;·&nbsp;
            <span style={{ color: 'var(--success)' }}>{enabledCount} enabled</span>
            &nbsp;·&nbsp;
            <span style={{ color: 'var(--danger)' }}>{disabledCount} disabled</span>
          </p>
        </div>
        <div className="page-actions">
          <Link className="btn" to="/command-guide">Full Command Guide</Link>
          <Link className="btn" to="/command-lab">Command Lab</Link>
          <input
            className="search-input"
            placeholder="Search commands…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="chips">
        {TYPE_FILTERS.map(f => (
          <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-state"><span className="spinner" /></div>
      ) : (
        <div className="table-wrap">
          {rows.length ? (
            <table>
              <thead>
                <tr>
                  <th>Command(s)</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Usage</th>
                  <th>Uses</th>
                  <th>Enabled</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(c => {
                  const uses = c.cmd.reduce((acc, k) => acc + (stats[k] || 0), 0)
                  const pct  = Math.round((uses / maxUses) * 100)
                  const isTruthDare = c.cmd.includes('td')
                  const isAutoGame = c.cmd.includes('game')
                  return (
                  <tr key={c.cmd[0]} className={c.disabledGlobally ? 'row-disabled' : ''}>
                    <td><strong style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{c.cmd.join(', ')}</strong></td>
                    <td><span className={`badge badge-${c.type}`}>{c.type}</span></td>
                    <td style={{ color: 'var(--text-soft)', maxWidth: 280 }}>
                      {c.desc || '—'}
                      {isTruthDare && <details style={{ marginTop: 10, maxWidth: 520 }}>
                        <summary style={{ cursor: 'pointer', color: 'var(--accent)', fontWeight: 600 }}>Full Truth or Dare guide</summary>
                        <div style={{ paddingTop: 8, lineHeight: 1.5 }}>
                          {truthDareGuide.map(([title, description]) => <p key={title} style={{ margin: '0 0 12px' }}><strong>{title}</strong><br />{description}</p>)}
                        </div>
                      </details>}
                      {isAutoGame && <details style={{ marginTop: 10, maxWidth: 520 }}>
                        <summary style={{ cursor: 'pointer', color: 'var(--accent)', fontWeight: 600 }}>Full automatic game guide</summary>
                        <div style={{ paddingTop: 8, lineHeight: 1.5 }}>
                          {autoGameGuide.map(([title, description]) => <p key={title} style={{ margin: '0 0 12px' }}><strong>{title}</strong><br />{description}</p>)}
                        </div>
                      </details>}
                    </td>
                    <td><code>{c.usage || c.cmd[0]}</code></td>
                    <td style={{ minWidth: 80 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className="progress-bar" style={{ flex: 1, height: 4 }}>
                          <div className="progress-fill" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', minWidth: 24, textAlign: 'right' }}>{uses || 0}</span>
                      </div>
                    </td>
                    <td>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={!c.disabledGlobally}
                          onChange={() => handleToggle(c.cmd[0], c.cmd, c.disabledGlobally)}
                        />
                        <span className="slider" />
                      </label>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          ) : (
            <p className="empty-state">No commands match your search.</p>
          )}
        </div>
      )}
    </div>
  )
}
