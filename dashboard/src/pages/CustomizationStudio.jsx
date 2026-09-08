import { useMemo, useRef, useState } from 'react'
import { useToast } from '../App.jsx'
import AlphaMark from '../components/AlphaMark.jsx'
import {
  DEFAULT_PERSONALIZATION,
  loadPersonalization,
  notifyPersonalization,
  resetPersonalization,
  sanitizePersonalization,
  savePersonalization,
} from '../lib/personalization.js'

const THEME_PRESETS = [
  ['Royal', { theme: 'royal', accent: 'violet', quietVisuals: false, highContrast: false }],
  ['Electric', { theme: 'electric', accent: 'cyan', quietVisuals: false, highContrast: false }],
  ['Emerald', { theme: 'obsidian', accent: 'emerald', quietVisuals: false, highContrast: false }],
  ['Gold', { theme: 'obsidian', accent: 'gold', quietVisuals: false, highContrast: true }],
  ['Quiet', { theme: 'obsidian', accent: 'violet', quietVisuals: true, highContrast: false }],
]

function cropAvatar(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\/(png|jpeg|webp)$/i.test(file.type)) return reject(new Error('Use a PNG, JPG or WEBP image.'))
    if (file.size > 6 * 1024 * 1024) return reject(new Error('Image is too large. Maximum source size is 6 MB.'))
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the image.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Could not decode the image.'))
      img.onload = () => {
        const size = Math.min(img.width, img.height)
        const sx = Math.max(0, (img.width - size) / 2)
        const sy = Math.max(0, (img.height - size) / 2)
        const canvas = document.createElement('canvas')
        canvas.width = 320; canvas.height = 320
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 320, 320)
        let out = canvas.toDataURL('image/webp', .82)
        if (out.length > 720_000) out = canvas.toDataURL('image/jpeg', .72)
        if (out.length > 750_000) return reject(new Error('Compressed avatar is still too large. Try a simpler image.'))
        resolve(out)
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

function ToggleRow({ title, text, checked, onChange }) {
  return <label className="studio-switch"><span><strong>{title}</strong><small>{text}</small></span><input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} /></label>
}

export default function CustomizationStudio() {
  const toast = useToast()
  const importRef = useRef(null)
  const [prefs, setPrefs] = useState(() => loadPersonalization())
  const [fontInfo] = useState(() => ({
    language: navigator.language || 'unknown',
    platform: navigator.platform || 'browser',
    ua: navigator.userAgent || 'unknown',
  }))

  const update = (key, value) => setPrefs(prev => ({ ...prev, [key]: value }))
  const applyPatch = (patch) => setPrefs(prev => ({ ...prev, ...patch }))

  function save() {
    const safe = savePersonalization(prefs)
    setPrefs(safe)
    notifyPersonalization(safe)
    toast('Alpha dashboard customization saved')
  }

  function reset() {
    if (!window.confirm('Reset all dashboard customization to Alpha defaults?')) return
    const next = resetPersonalization()
    setPrefs(next)
    notifyPersonalization(next)
    toast('Customization reset')
  }

  function exportConfig() {
    const safe = sanitizePersonalization(prefs)
    const blob = new Blob([JSON.stringify(safe, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'alpha-dashboard-personalization.json'; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 500)
  }

  async function importConfig(file) {
    try {
      if (!file || file.size > 1_000_000) throw new Error('Choose a JSON file below 1 MB.')
      const parsed = JSON.parse(await file.text())
      const safe = sanitizePersonalization(parsed)
      setPrefs(safe); savePersonalization(safe); notifyPersonalization(safe)
      toast('Customization imported')
    } catch (error) { toast(error.message || 'Import failed', false) }
    finally { if (importRef.current) importRef.current.value = '' }
  }

  async function chooseAvatar(file) {
    try { update('avatarDataUrl', await cropAvatar(file)); toast('Avatar prepared — save to keep it') }
    catch (error) { toast(error.message || 'Avatar upload failed', false) }
  }

  const sample = useMemo(() => 'Alpha Martech — ABC abc 123 | Welcome • Members • Activity • ⚡ 👑 ✓', [])

  return <div className="premium-page">
    <div className="page-header premium-page-header">
      <div><span className="eyebrow">Personalization</span><h2>Alpha Customization Studio</h2><p className="sub">Personalize the dashboard identity, avatar, typography, layout, accessibility and information density without changing WhatsApp account credentials.</p></div>
      <div className="page-actions"><button className="btn btn-ghost" onClick={exportConfig}>Export JSON</button><button className="btn btn-ghost" onClick={() => importRef.current?.click()}>Import JSON</button><button className="btn btn-danger" onClick={reset}>Reset</button><button className="btn btn-primary" onClick={save}>Save & Apply</button></div>
      <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={e => importConfig(e.target.files?.[0])} />
    </div>

    <div className="studio-grid">
      <section className="premium-panel studio-panel wide brand-preview">
        <div className="alpha-avatar-preview">{prefs.avatarDataUrl ? <img src={prefs.avatarDataUrl} alt="Alpha avatar preview" /> : <AlphaMark size={62} />}</div>
        <div className="brand-preview-copy"><span className="eyebrow">{prefs.workspaceLabel}</span><div className="preview-name">{prefs.displayName}</div><div className="preview-tagline">{prefs.tagline}</div><div className="preview-note">{prefs.dashboardNote} · Owner badge: {prefs.ownerBadge}</div></div>
      </section>

      <section className="premium-panel studio-panel">
        <div className="studio-heading"><div><h3>Identity & avatar</h3><p>Controls the Alpha identity shown inside this administration dashboard.</p></div><span className="badge badge-on">6 tools</span></div>
        <div className="alpha-avatar-editor">
          <div className="alpha-avatar-preview">{prefs.avatarDataUrl ? <img src={prefs.avatarDataUrl} alt="Custom Alpha avatar" /> : <AlphaMark size={62} />}</div>
          <div><strong style={{fontSize:'.78rem'}}>Dashboard avatar</strong><p style={{color:'var(--text-muted)',fontSize:'.66rem',marginTop:4}}>PNG/JPG/WEBP. Alpha crops and compresses the image to a safe local dashboard size.</p><div className="avatar-actions"><label className="btn btn-ghost">Choose image<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => chooseAvatar(e.target.files?.[0])} /></label><button className="btn btn-ghost" onClick={() => update('avatarDataUrl', '')}>Use Alpha mark</button></div></div>
        </div>
        <div className="studio-fields" style={{marginTop:12}}>
          <div className="studio-field"><label>Display name</label><input value={prefs.displayName} maxLength={32} onChange={e => update('displayName', e.target.value)} /></div>
          <div className="studio-field"><label>Owner badge</label><input value={prefs.ownerBadge} maxLength={24} onChange={e => update('ownerBadge', e.target.value)} /></div>
          <div className="studio-field full"><label>Tagline</label><input value={prefs.tagline} maxLength={64} onChange={e => update('tagline', e.target.value)} /></div>
          <div className="studio-field"><label>Workspace label</label><input value={prefs.workspaceLabel} maxLength={18} onChange={e => update('workspaceLabel', e.target.value)} /></div>
          <div className="studio-field"><label>Dashboard note</label><input value={prefs.dashboardNote} maxLength={120} onChange={e => update('dashboardNote', e.target.value)} /></div>
        </div>
      </section>

      <section className="premium-panel studio-panel">
        <div className="studio-heading"><div><h3>Theme & color system</h3><p>Five accents, three base themes and reusable premium presets.</p></div><span className="badge badge-on">9 tools</span></div>
        <div className="preset-row" style={{marginBottom:12}}>{THEME_PRESETS.map(([label, patch]) => <button key={label} className="preset-btn" onClick={() => applyPatch(patch)}>{label}</button>)}</div>
        <div className="studio-fields">
          <div className="studio-field"><label>Base theme</label><select value={prefs.theme} onChange={e => update('theme', e.target.value)}><option value="royal">Royal</option><option value="electric">Electric</option><option value="obsidian">Obsidian</option></select></div>
          <div className="studio-field"><label>Accent</label><select value={prefs.accent} onChange={e => update('accent', e.target.value)}><option value="violet">Violet</option><option value="cyan">Cyan</option><option value="emerald">Emerald</option><option value="gold">Gold</option><option value="rose">Rose</option></select></div>
          <div className="studio-field"><label>Corner style</label><select value={prefs.cornerStyle} onChange={e => update('cornerStyle', e.target.value)}><option value="sharp">Sharp</option><option value="soft">Soft</option><option value="round">Round</option></select></div>
          <div className="studio-field"><label>Density</label><select value={prefs.density} onChange={e => update('density', e.target.value)}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></div>
        </div>
        <div className="studio-toggle-list" style={{marginTop:12}}><ToggleRow title="High contrast" text="Stronger text and borders." checked={prefs.highContrast} onChange={v => update('highContrast', v)} /><ToggleRow title="Quiet visuals" text="Removes decorative gradients and shadows." checked={prefs.quietVisuals} onChange={v => update('quietVisuals', v)} /></div>
      </section>

      <section className="premium-panel studio-panel">
        <div className="studio-heading"><div><h3>Typography repair & accessibility</h3><p>The dashboard now forces a safe Arial/Segoe UI stack instead of relying on a possibly corrupted local Inter font.</p></div><span className="badge badge-on">5 tools</span></div>
        <div className="font-diagnostic"><div className="glyph-sample">{sample}</div><span className="badge badge-on">Safe UI font</span></div>
        <div className="studio-fields" style={{marginTop:12}}><div className="studio-field"><label>Font scale</label><select value={prefs.fontScale} onChange={e => update('fontScale', e.target.value)}><option value="compact">Compact</option><option value="normal">Normal</option><option value="large">Large</option></select></div><div className="studio-field"><label>Motion</label><select value={prefs.motion} onChange={e => update('motion', e.target.value)}><option value="full">Full</option><option value="reduced">Reduced</option></select></div></div>
        <div style={{marginTop:12,color:'var(--text-muted)',fontSize:'.66rem',lineHeight:1.6}}>Browser: {fontInfo.platform} · Language: {fontInfo.language}<br />If the sample above is readable, the glyph/font repair is active.</div>
      </section>

      <section className="premium-panel studio-panel">
        <div className="studio-heading"><div><h3>Workspace behaviour</h3><p>Choose how Alpha opens, refreshes and presents live information.</p></div><span className="badge badge-on">8 tools</span></div>
        <div className="studio-fields">
          <div className="studio-field"><label>Startup page</label><select value={prefs.startupPage} onChange={e => update('startupPage', e.target.value)}><option value="/">Overview</option><option value="/management">Management Suite</option><option value="/operations">Operations Hub</option><option value="/customize">Customization</option><option value="/control-center">Control Center</option><option value="/groups">Groups</option><option value="/analytics">Analytics</option><option value="/health">Health</option></select></div>
          <div className="studio-field"><label>Sidebar default</label><select value={prefs.sidebarDefault} onChange={e => update('sidebarDefault', e.target.value)}><option value="expanded">Expanded</option><option value="collapsed">Collapsed</option></select></div>
          <div className="studio-field"><label>Refresh interval</label><select value={prefs.refreshSeconds} onChange={e => update('refreshSeconds', Number(e.target.value))}><option value={15}>15 seconds</option><option value={30}>30 seconds</option><option value={60}>60 seconds</option><option value={120}>120 seconds</option></select></div>
          <div className="studio-field"><label>Activity rows</label><select value={prefs.activityRows} onChange={e => update('activityRows', Number(e.target.value))}><option value={10}>10</option><option value={20}>20</option><option value={30}>30</option><option value={50}>50</option></select></div>
          <div className="studio-field"><label>Time display</label><select value={prefs.timeStyle} onChange={e => update('timeStyle', e.target.value)}><option value="relative">Relative</option><option value="clock">Clock</option></select></div>
          <div className="studio-field"><label>Number display</label><select value={prefs.numberStyle} onChange={e => update('numberStyle', e.target.value)}><option value="compact">Compact</option><option value="full">Full</option></select></div>
        </div>
      </section>

      <section className="premium-panel studio-panel wide">
        <div className="studio-heading"><div><h3>Visibility controls</h3><p>Keep the console clean by showing only the status information you actually use.</p></div><span className="badge badge-on">10 tools</span></div>
        <div className="studio-toggle-list">
          <ToggleRow title="Bot number" text="Show the connected WhatsApp number." checked={prefs.showBotNumber} onChange={v => update('showBotNumber', v)} />
          <ToggleRow title="Group count" text="Show managed group totals." checked={prefs.showGroupCount} onChange={v => update('showGroupCount', v)} />
          <ToggleRow title="Member count" text="Show tracked member totals." checked={prefs.showMemberCount} onChange={v => update('showMemberCount', v)} />
          <ToggleRow title="Uptime" text="Show current process uptime." checked={prefs.showUptime} onChange={v => update('showUptime', v)} />
          <ToggleRow title="Connection pill" text="Show live/offline state in the top bar." checked={prefs.showConnection} onChange={v => update('showConnection', v)} />
          <ToggleRow title="Quick search" text="Show Ctrl/Cmd+K search control." checked={prefs.showQuickSearch} onChange={v => update('showQuickSearch', v)} />
          <ToggleRow title="Sidebar metrics" text="Show group/member/uptime mini metrics." checked={prefs.showSidebarMetrics} onChange={v => update('showSidebarMetrics', v)} />
          <ToggleRow title="Page kicker" text="Show the ALPHA workspace label." checked={prefs.showPageKicker} onChange={v => update('showPageKicker', v)} />
          <ToggleRow title="Compact top bar" text="Reduce top-bar height." checked={prefs.compactTopbar} onChange={v => update('compactTopbar', v)} />
          <ToggleRow title="Chart animations" text="Allow animated dashboard charts." checked={prefs.chartAnimations} onChange={v => update('chartAnimations', v)} />
        </div>
      </section>

      <section className="premium-panel studio-panel wide">
        <div className="studio-heading"><div><h3>Recovery & portability</h3><p>Export the complete safe dashboard profile, import it on another browser, or return to Alpha defaults.</p></div><span className="badge badge-on">3 tools</span></div>
        <div className="page-actions"><button className="btn btn-ghost" onClick={exportConfig}>Export personalization</button><button className="btn btn-ghost" onClick={() => importRef.current?.click()}>Import personalization</button><button className="btn btn-danger" onClick={reset}>Reset dashboard profile</button></div>
        <div style={{marginTop:12,color:'var(--text-muted)',fontSize:'.66rem'}}>Current configuration is sanitized before storage. Arbitrary CSS, scripts and remote image URLs are never imported.</div>
      </section>
    </div>
  </div>
}
