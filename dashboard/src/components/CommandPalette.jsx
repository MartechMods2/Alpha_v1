import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DASHBOARD_OPERATIONS } from '../lib/operations.js'
import { useToast } from '../App.jsx'

export default function CommandPalette({ open, onOpenChange }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return DASHBOARD_OPERATIONS.slice(0, 18)
    return DASHBOARD_OPERATIONS.filter((item) =>
      `${item.label} ${item.description} ${item.category} ${item.command || ''}`.toLowerCase().includes(q),
    ).slice(0, 24)
  }, [query])

  async function run(item) {
    if (item.to) {
      navigate(item.to)
      onOpenChange(false)
      return
    }
    if (item.command) {
      try {
        await navigator.clipboard.writeText(item.command)
        toast(`Copied ${item.command}`)
      } catch {
        toast(`Command: ${item.command}`)
      }
      onOpenChange(false)
    }
  }

  if (!open) return null

  return (
    <div className="command-palette-backdrop" role="presentation" onMouseDown={() => onOpenChange(false)}>
      <div className="command-palette" role="dialog" aria-modal="true" aria-label="Alpha command palette" onMouseDown={(event) => event.stopPropagation()}>
        <div className="command-palette-search">
          <span>⌕</span>
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search dashboard, tools or Alpha commands…" />
          <kbd>Esc</kbd>
        </div>
        <div className="command-palette-results">
          {filtered.length ? filtered.map((item) => (
            <button key={item.id} className="command-palette-item" onClick={() => run(item)}>
              <span className="command-palette-icon">{item.icon}</span>
              <span className="command-palette-copy">
                <strong>{item.label}</strong>
                <small>{item.command || item.description}</small>
              </span>
              <span className="command-palette-category">{item.category}</span>
            </button>
          )) : <div className="command-palette-empty">No Alpha tools matched that search.</div>}
        </div>
        <div className="command-palette-footer"><span>Enter a tool by clicking it</span><span>{DASHBOARD_OPERATIONS.length} indexed operations</span></div>
      </div>
    </div>
  )
}
