import { useEffect, useState } from 'react'
import {
  deleteSavedSticker,
  deleteMemeTemplate,
  getMemeTemplates,
  getMediaStudio,
  getSavedStickers,
  retryMediaJob,
  saveMemeTemplate,
  updateMediaStudio,
} from '../lib/api.js'
import { useToast } from '../App.jsx'

const providerLabel = { removeBg: 'remove.bg', nvidia: 'NVIDIA AI', gemini: 'Gemini Media', memeApi: 'Meme API' }

export default function MediaStudio() {
  const toast = useToast()
  const [data, setData] = useState(null)
  const [config, setConfig] = useState(null)
  const [stickers, setStickers] = useState([])
  const [templates, setTemplates] = useState([])
  const [templateName, setTemplateName] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => Promise.all([getMediaStudio(), getSavedStickers(), getMemeTemplates()])
    .then(([status, vault, memeData]) => {
      setData(status)
      setConfig(status.config)
      setStickers(vault.stickers || [])
      setTemplates(memeData.templates || [])
    })
    .catch((error) => toast(error.message || 'Failed to load Media Studio', false))

  useEffect(() => {
    load()
    const timer = setInterval(load, 15_000)
    return () => clearInterval(timer)
  }, [])

  async function save() {
    setSaving(true)
    try {
      const result = await updateMediaStudio(config)
      setConfig(result.config)
      toast('Media Studio settings saved')
      await load()
    } catch (error) {
      toast(error.message || 'Save failed', false)
    } finally {
      setSaving(false)
    }
  }

  async function retry(id) {
    try {
      await retryMediaJob(id)
      toast('Job queued again')
      await load()
    } catch (error) {
      toast(error.message || 'Retry failed', false)
    }
  }

  async function removeSticker(id) {
    try {
      await deleteSavedSticker(id)
      setStickers((rows) => rows.filter((row) => row._id !== id))
      toast('Sticker removed')
    } catch (error) {
      toast(error.message || 'Delete failed', false)
    }
  }

  async function addTemplate() {
    try {
      const result = await saveMemeTemplate(templateName, templateId)
      setTemplates((rows) => [...rows.filter((row) => row._id !== result.template._id), result.template].sort((a, b) => a.name.localeCompare(b.name)))
      setTemplateName('')
      setTemplateId('')
      toast('Meme template saved')
    } catch (error) {
      toast(error.message || 'Template save failed', false)
    }
  }

  async function removeTemplate(id) {
    try {
      await deleteMemeTemplate(id)
      setTemplates((rows) => rows.filter((row) => row._id !== id))
      toast('Meme template removed')
    } catch (error) {
      toast(error.message || 'Template delete failed', false)
    }
  }

  if (!data || !config) return <div style={{ padding: 50, textAlign: 'center' }}><div className="spinner" /></div>

  const set = (key, value) => setConfig((current) => ({ ...current, [key]: value }))
  const numeric = [
    ['maxConcurrentJobs', 'Concurrent jobs', 1, 2],
    ['perUserDailyLimit', 'Daily jobs per member', 1, 100],
    ['perGroupDailyLimit', 'Daily jobs per group', 5, 500],
    ['maxImageMb', 'Maximum image MB', 2, 20],
    ['maxVideoMb', 'Maximum video MB', 5, 50],
    ['maxVideoSeconds', 'Maximum video seconds', 3, 20],
  ]

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Media Studio</h2>
      <p style={{ color: 'var(--muted)', marginBottom: 24, fontSize: 14 }}>
        Jobs, quotas, providers, templates, sticker packs, Alpha settings and safe mode
      </p>

      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card"><span>Queued</span><strong>{data.queue.queued}</strong></div>
        <div className="stat-card"><span>Running</span><strong>{data.queue.active}</strong></div>
        <div className="stat-card"><span>Today’s requests</span><strong>{data.usage.requests}</strong></div>
        <div className="stat-card"><span>Saved stickers</span><strong>{data.collections.stickers}</strong></div>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Safety and quotas</h3>
        <div className="toggle-grid" style={{ marginBottom: 18 }}>
          {[
            ['safeMode', 'Safe mode (disable all media processing)'],
            ['providerFallbacks', 'Automatic provider fallback'],
            ['alphaGlobalEnabled', 'Alpha assistant enabled'],
          ].map(([key, label]) => (
            <div className="toggle-row" key={key}>
              <span>{label}</span>
              <label className="toggle"><input type="checkbox" checked={!!config[key]} onChange={(event) => set(key, event.target.checked)} /><span className="slider" /></label>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
          {numeric.map(([key, label, min, max]) => (
            <label key={key} style={{ fontSize: 13, color: 'var(--muted)' }}>
              {label}
              <input type="number" min={min} max={max} value={config[key]} onChange={(event) => set(key, Number(event.target.value))}
                style={{ width: '100%', marginTop: 6, padding: 9, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--fg)' }} />
            </label>
          ))}
        </div>
        <label style={{ display: 'block', marginTop: 16, fontSize: 13, color: 'var(--muted)' }}>
          Disabled media features (comma separated)
          <input value={(config.disabledFeatures || []).join(', ')} onChange={(event) => set('disabledFeatures', event.target.value.split(',').map((value) => value.trim()).filter(Boolean))}
            placeholder="vocalremove, upscale" style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--fg)' }} />
        </label>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Alpha personality</h3>
        <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)' }}>
          Assistant name
          <input value={config.alphaName || ''} onChange={(event) => set('alphaName', event.target.value)}
            style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--fg)' }} />
        </label>
        <label style={{ display: 'block', marginTop: 14, fontSize: 13, color: 'var(--muted)' }}>
          Additional system instructions
          <textarea value={config.alphaSystemPrompt || ''} onChange={(event) => set('alphaSystemPrompt', event.target.value)} rows={6}
            placeholder="Extra rules for Alpha. Do not paste API keys here."
            style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--fg)', resize: 'vertical' }} />
        </label>
        <button className="btn" onClick={save} disabled={saving} style={{ marginTop: 16 }}>{saving ? 'Saving…' : 'Save Media Settings'}</button>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Provider health</h3>
        <p style={{ fontSize: 13, color: data.ffmpeg.ok ? '#22c55e' : '#ef4444' }}>
          FFmpeg: {data.ffmpeg.ok ? data.ffmpeg.version : data.ffmpeg.error}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
          {Object.entries(data.providers).map(([key, provider]) => (
            <div key={key} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
              <strong>{providerLabel[key] || key}</strong>
              <div style={{ marginTop: 5, color: provider.configured && !provider.disabledUntil ? '#22c55e' : '#f59e0b', fontSize: 12 }}>
                {provider.configured ? provider.disabledUntil ? 'Circuit open' : 'Configured' : 'Not configured'}
              </div>
              {provider.lastError && <div style={{ color: '#ef4444', fontSize: 11, marginTop: 5 }}>{provider.lastError}</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Recent media jobs</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr><th align="left">Feature</th><th align="left">Status</th><th align="left">Duration</th><th align="left">Error</th><th /></tr></thead>
            <tbody>{data.jobs.map((job) => (
              <tr key={job.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '9px 0' }}>{job.feature}</td><td>{job.status}</td><td>{job.durationMs ? `${job.durationMs} ms` : '—'}</td><td style={{ color: '#ef4444' }}>{job.error || '—'}</td>
                <td>{job.status === 'failed' && <button className="btn-sm" onClick={() => retry(job.id)}>Retry</button>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ marginTop: 0 }}>Meme Template Manager</h3>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Add a safe Memegen template ID such as <code>drake</code>, <code>twobuttons</code> or <code>changemymind</code>.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Display name"
            style={{ flex: '1 1 180px', padding: 9, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--fg)' }} />
          <input value={templateId} onChange={(event) => setTemplateId(event.target.value)} placeholder="Memegen template ID"
            style={{ flex: '1 1 180px', padding: 9, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--fg)' }} />
          <button className="btn-sm" onClick={addTemplate}>Add</button>
        </div>
        {templates.map((template) => (
          <div key={template._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border)' }}>
            <span><strong>{template.name}</strong> <small style={{ color: 'var(--muted)' }}>{template.templateId}</small></span>
            <button className="btn-sm" onClick={() => removeTemplate(template._id)} style={{ color: '#ef4444' }}>Delete</button>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 24, marginTop: 20 }}>
        <h3 style={{ marginTop: 0 }}>Sticker Pack Manager</h3>
        {stickers.length ? stickers.slice(0, 100).map((sticker) => (
          <div key={sticker._id} style={{ display: 'flex', gap: 12, justifyContent: 'space-between', padding: '9px 0', borderTop: '1px solid var(--border)' }}>
            <span><strong>{sticker.name}</strong> <small style={{ color: 'var(--muted)' }}>{sticker.groupJid}</small></span>
            <button className="btn-sm" onClick={() => removeSticker(sticker._id)} style={{ color: '#ef4444' }}>Delete</button>
          </div>
        )) : <p style={{ color: 'var(--muted)' }}>No saved group stickers yet.</p>}
      </div>
    </div>
  )
}
