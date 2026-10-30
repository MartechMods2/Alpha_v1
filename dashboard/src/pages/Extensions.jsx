import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'
export default function Extensions() {
  const [state,setState]=useState(null),[phone,setPhone]=useState(''),[link,setLink]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const refresh=()=>api.get('/api/admin/extensions').then(setState)
  useEffect(()=>{let active=true;const load=()=>api.get('/api/admin/extensions').then(data=>{if(active)setState(data)}).catch(e=>{if(active)setError(e.message)});load();const timer=setInterval(load,5000);return()=>{active=false;clearInterval(timer)}},[])
  async function act(fn){setBusy(true);setError('');try{await fn();await refresh()}catch(e){setError(e.message)}finally{setBusy(false)}}
  return <div style={{maxWidth:960,margin:'0 auto',padding:'clamp(12px,3vw,28px)'}}>
    <h1>Alpha Extensions</h1><p>Pairing happens only on the dashboard. Create a private link for a member; never share your dashboard password.</p>
    {error&&<p role="alert" className="error-box">{error}</p>}
    <section className="card" style={{padding:20,margin:'20px 0'}}><h2>Pairing access</h2><p>{state?.enabled?'Enabled':'Paused'} · Maximum {state?.max??'…'} additional account(s)</p>
      <button className="btn btn-primary" disabled={busy||!state} onClick={()=>act(()=>api.post('/api/admin/extensions/settings',{enabled:!state.enabled}))}>{state?.enabled?'Pause extensions':'Enable extensions'}</button>
    </section>
    <section className="card" style={{padding:20,marginBottom:20}}><h2>Create a member pairing link</h2>
      <form onSubmit={e=>{e.preventDefault();setLink('');act(async()=>{const r=await api.post('/api/admin/extensions/invite',{phone});setLink(new URL(r.path,window.location.origin).href)})}}>
        <label htmlFor="extension-phone">Member’s WhatsApp number</label>
        <input id="extension-phone" type="tel" autoComplete="off" value={phone} disabled={busy} onChange={e=>{setPhone(e.target.value);setLink('')}} placeholder="Country code and number" style={{width:'100%',margin:'8px 0 14px'}} required maxLength={24}/>
        <button className="btn btn-primary" disabled={busy||!state?.enabled}>Create one-use link</button>
      </form>
      <p>Expires in 15 minutes. The member must confirm ownership and enter the code on their own phone. Codes appear only in their pairing page.</p>
      {link&&<div role="status"><label htmlFor="extension-link">Private pairing link — share only with this member</label><input id="extension-link" readOnly value={link} style={{width:'100%',margin:'8px 0'}} onFocus={e=>e.target.select()}/><button className="btn btn-ghost" onClick={()=>navigator.clipboard.writeText(link).catch(()=>setError('Select and copy the link above.'))}>Copy link</button></div>}
    </section>
    <section className="card" style={{padding:20}}><h2>Accounts</h2><p>Separate sessions, balances and group settings. Pairing does not grant creator privileges.</p>
      {state?.accounts?.length ? state.accounts.map(row=><div key={row.phone} style={{display:'flex',gap:12,alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',padding:'14px 0',borderTop:'1px solid var(--border)'}}>
        <div><strong>{row.phone}</strong><div>{row.blocked?'Blocked':row.status}</div></div><div style={{display:'flex',gap:8}}>
          <button className="btn btn-ghost" disabled={busy||!row.active} onClick={()=>act(()=>api.post('/api/admin/extensions/stop',{phone:row.phone}))}>Stop</button>
          <button className="btn btn-ghost" disabled={busy||row.blocked} onClick={()=>{if(window.confirm('Stop and block this extension from pairing again?'))act(()=>api.post('/api/admin/extensions/revoke',{phone:row.phone}))}}>Revoke</button>
        </div></div>):<p>No extension accounts yet.</p>}
    </section>
  </div>
}
export function ExtensionPair() {
  const [token]=useState(()=>new URLSearchParams(window.location.hash.slice(1)).get('invite'))
  const claim=useRef(null),[state,setState]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[consent,setConsent]=useState(false)
  useEffect(()=>{
    let active=true
    if(!claim.current){claim.current=token?api.post('/api/extensions/claim',{token}):Promise.resolve();window.history.replaceState(null,'',window.location.pathname+window.location.search)}
    let timer
    claim.current.then(async()=>{const poll=()=>api.get('/api/extensions/status').then(data=>{if(active){setState(data);setError('')}}).catch(e=>{if(active){setError(e.message);setState(null)}});if(!active)return;await poll();if(active)timer=setInterval(poll,2000)}).catch(e=>{if(active)setError(e.message)})
    return()=>{active=false;clearInterval(timer)}
  },[token])
  async function act(path,body){setBusy(true);setError('');try{await api.post(path,body);setState(await api.get('/api/extensions/status'))}catch(e){setError(e.message)}finally{setBusy(false)}}
  return <main style={{minHeight:'100vh',background:'var(--bg)',padding:'clamp(16px,5vw,48px)',display:'grid',alignItems:'center'}}>
    <section className="card" style={{width:'100%',maxWidth:520,margin:'0 auto',padding:'clamp(18px,5vw,32px)',boxSizing:'border-box'}}>
      <p>ALPHA · SECURE PAIRING</p><h1>Connect your WhatsApp</h1><p>This private link grants pairing access only. It does not open the admin dashboard.</p>
      {error&&<p role="alert" className="error-box">{error}</p>}
      {state&&<><p><strong>Number: {state.phone}</strong></p><p role="status">Status: {state.status}</p>{!state.enabled&&<p>The creator has paused extension pairing.</p>}
        <label style={{display:'flex',alignItems:'flex-start',gap:10,margin:'20px 0'}}><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>I own this number and agree to link it to an Alpha extension.</span></label>
        <button className="btn btn-primary" disabled={busy||!state.enabled||!consent||['starting','pairing','connected','reconnecting'].includes(state.status)} onClick={()=>act('/api/extensions/start',{consent:true})}>{busy?'Working…':'Get pairing code'}</button>
        {state.code&&<div style={{margin:'24px 0',padding:18,background:'var(--bg)',borderRadius:12,textAlign:'center'}}><p>Your private pairing code</p><strong style={{fontSize:'clamp(24px,7vw,36px)',letterSpacing:4,overflowWrap:'anywhere'}}>{state.code}</strong><p>Never share this code.</p></div>}
        <ol style={{paddingLeft:22,lineHeight:1.8}}><li>On your phone, open WhatsApp Settings.</li><li>Choose Linked devices → Link a device → Link with phone number.</li><li>Enter the code shown here.</li></ol>
        <p>After connection, add your number to a group. A group admin can use <strong>$groupalpha on</strong>.</p>
        <button className="btn btn-ghost" disabled={busy||state.status==='stopped'} onClick={()=>act('/api/extensions/stop',{})}>Stop my extension</button>
      </>}
      <p>Links expire after 15 minutes; pairing attempts stop after three minutes. To permanently revoke access, remove Alpha from WhatsApp’s Linked devices.</p>
    </section>
  </main>
}
