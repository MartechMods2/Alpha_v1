import dns from 'node:dns/promises';
import {normalizeDomain} from './passiveOsint.js';
import { X509Certificate } from 'node:crypto';
const lines = text => text.split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!s.startsWith('#'));
const tags = text => Object.fromEntries(text.split(';').map(s=>s.trim()).filter(Boolean).map(s=>{const i=s.indexOf('=');return i<0?[s.toLowerCase(),'']:[s.slice(0,i).trim().toLowerCase(),s.slice(i+1).trim()];}));
const report = (title, findings) => `${title}\n\n${findings.length?findings.map(s=>`• ${s}`).join('\n'):'No supported warning pattern found.'}\n\nHeuristic review of supplied text, not a complete security assessment.`;
export const TECHNICAL_TOOLS = {
  spfreview:{description:'Review a pasted SPF policy',example:'v=spf1 include:_spf.example.com ~all',run:text=>{
    if(!/^v=spf1\b/i.test(text))throw Error('Paste one SPF record beginning v=spf1.');
    const terms=text.split(/\s+/),all=terms.filter(t=>/^[+?~-]?all$/i.test(t));
    const findings=[];
    if(all.length!==1)findings.push('Expected one all mechanism; inspect missing or repeated all terms.');
    if(all.some(t=>/^\+?all$/i.test(t)))findings.push('+all permits every sender.');
    if(all.some(t=>/^\?all$/i.test(t)))findings.push('?all is neutral.');
    if(all.some(t=>/^~all$/i.test(t)))findings.push('~all is softfail; assess whether your legitimate senders are ready for stricter policy.');
    if(all.some(t=>/^-all$/i.test(t)))findings.push('-all requests hardfail for unmatched senders.');
    if(terms.some(t=>/^[+?~-]?ptr(?::|$)/i.test(t)))findings.push('ptr mechanism is discouraged.');
    const lookups=terms.filter(t=>/^[+?~-]?(include:|a(?::|\/|$)|mx(?::|\/|$)|exists:|ptr(?::|$))|^redirect=/i.test(t)).length;
    findings.push(`${lookups} direct DNS-dependent terms; recursive includes are not expanded, so this is not the full lookup count.`);
    return report('SPF policy review',findings);
  }},
  dmarcreview:{description:'Review a pasted DMARC policy',example:'v=DMARC1; p=none; pct=100',run:text=>{
    const t=tags(text);if(t.v?.toUpperCase()!=='DMARC1')throw Error('Paste a DMARC record beginning v=DMARC1.');
    const f=[];if(!['none','quarantine','reject'].includes(t.p))f.push('Missing or invalid p policy.');else f.push(`Policy: ${t.p}${t.p==='none'?' (monitoring only)':''}.`);
    if(t.pct!==undefined&&(!/^\d+$/.test(t.pct)||Number(t.pct)>100))f.push('pct must be an integer from 0 to 100.');
    if(t.pct!==undefined&&Number(t.pct)<100)f.push(`Policy is applied to ${t.pct}% of messages.`);
    for(const key of ['adkim','aspf'])if(t[key]&&!['r','s'].includes(t[key]))f.push(`${key} must be r or s.`);
    f.push(t.rua?'Aggregate report destination is configured.':'No aggregate report destination configured.');
    f.push('External reporting authorization and actual SPF/DKIM alignment are not checked.');return report('DMARC policy review',f);
  }},
  mailheaderreview:{description:'Summarize pasted email authentication and routing headers',example:'From: Alice <alice@example.com>\nAuthentication-Results: mail.example.com; spf=pass; dkim=pass; dmarc=pass',run:text=>{
    const headers=text.replace(/\r?\n[ \t]+/g,' ').split(/\r?\n/);const auth=headers.filter(l=>/^Authentication-Results:/i.test(l));
    const received=headers.filter(l=>/^Received:/i.test(l));const from=headers.find(l=>/^From:/i.test(l));
    const results=auth.flatMap(l=>[...l.matchAll(/\b(spf|dkim|dmarc)=(pass|fail|softfail|neutral|none|temperror|permerror)\b/gi)].map(m=>`${m[1].toUpperCase()}: ${m[2].toLowerCase()}`));
    return report('Email header review',[from||'No From header found.',`${received.length} Received hop(s).`,...results,auth.length?'Authentication-Results is present; it can be forged. Trust only headers inserted by your receiving mail system.':'No Authentication-Results header found.','No message is sent and no sender identity is verified.']);
  }},
  sshaudit:{description:'Review a pasted sshd_config excerpt',example:'PermitRootLogin yes\nPasswordAuthentication yes\nPermitEmptyPasswords no',run:text=>{
    const global=[];let conditional=false;const f=[];
    for(const line of lines(text)){if(/^Match\s/i.test(line)){conditional=true;continue;}if(!conditional)global.push(line);}
    const values=new Map();for(const l of global){const [key,...rest]=l.split(/\s+/);if(!values.has(key.toLowerCase()))values.set(key.toLowerCase(),rest.join(' ').toLowerCase());}
    if(values.get('permitrootlogin')==='yes')f.push('Root login is explicitly enabled.');
    if(values.get('passwordauthentication')==='yes')f.push('Password authentication is enabled; review exposure and key-based access.');
    if(values.get('permitemptypasswords')==='yes')f.push('Empty passwords are explicitly allowed.');
    if(values.get('x11forwarding')==='yes')f.push('X11 forwarding is enabled; disable it if unnecessary.');
    f.push('Includes, defaults, command-line overrides and Match blocks require review. Verify effective settings locally with sshd -T.');return report('SSH configuration review',f);
  }},
  dockeraudit:{description:'Review a Dockerfile or Compose excerpt for risky settings',example:'FROM node:latest\nUSER root\nEXPOSE 3000',run:text=>{
    const t=lines(text).join('\n'),f=[];
    if(/privileged:\s*true/i.test(t))f.push('Privileged container enabled.');
    if(/\/var\/run\/docker\.sock/.test(t))f.push('Docker daemon socket mounted; this can grant host-level control.');
    if(/(?:network_mode|pid):\s*["']?host/i.test(t))f.push('Host network or PID namespace requested.');
    if(/cap_add:[\s\S]*?(SYS_ADMIN|ALL)\b/i.test(t))f.push('Broad capabilities requested.');
    if(/^FROM\s+[^\s]+:latest\b/im.test(t))f.push('Floating latest base tag; pin a reviewed version or digest.');
    if(/^USER\s+(root|0)\b/im.test(t)||/^\s*user:\s*["']?(root|0)(?:["']?\s*)$/im.test(t))f.push('Root user explicitly configured.');
    if(/^(ARG|ENV)\s+\w*(PASSWORD|SECRET|TOKEN|API_KEY)\b/im.test(t))f.push('Potential build-time secret variable; inspect use of dedicated secret mounts.');
    return report('Container configuration review',f);
  }},
  gitignoreaudit:{description:'Check ignore rules for common local secret files',example:'.env\n.env.*\n*.pem\nnode_modules/',run:text=>{
    const rules=lines(text);const f=[];for(const [label,patterns] of [['environment files',['.env','.env*','.env.*']],['private key files',['*.pem','*.key']],['dependency folder',['node_modules/','node_modules']]])f.push(`${patterns.some(p=>rules.includes(p))?'Found common rule for':'Review missing common rule for'} ${label}.`);
    if(rules.some(l=>/^!.*(?:env|pem|key)/i.test(l)))f.push('Negated rules may re-include sensitive files.');
    f.push('Ignore rules do not remove already tracked files. Check git ls-files locally; pattern presence is not proof a file is ignored.');return report('Git ignore review',f);
  }},
  pemaudit:{description:'Inspect a pasted public PEM certificate locally',example:'<paste a public BEGIN CERTIFICATE PEM block>',run:text=>{
    if(/PRIVATE KEY/.test(text))throw Error('Supply a public certificate, not a private key.');
    let cert;try{cert=new X509Certificate(text);}catch{throw Error('Supply a valid public PEM certificate.');}
    const now=Date.now();return report('Public certificate inspection',[`Subject: ${cert.subject}`,`Issuer: ${cert.issuer}`,`Valid from: ${cert.validFrom}`,`Valid until: ${cert.validTo}`,`Current validity window: ${now>=Date.parse(cert.validFrom)&&now<=Date.parse(cert.validTo)?'inside':'outside'}`,`SHA-256 fingerprint: ${cert.fingerprint256}`,'This does not validate a trust chain, revocation status or hostname.']);
  }},
  ioccompare:{description:'Compare two indicator lists: first list | second list',example:'example.com\n1.1.1.1 | example.com\n8.8.8.8',run:text=>{
    const parts=text.split('|');if(parts.length!==2)throw Error('Use first list | second list; put one indicator on each line.');
    const a=new Set(lines(parts[0])),b=new Set(lines(parts[1]));return JSON.stringify({shared:[...a].filter(x=>b.has(x)),onlyFirst:[...a].filter(x=>!b.has(x)),onlySecond:[...b].filter(x=>!a.has(x))},null,2);
  }},
  pentestscope:{description:'Draft an authorized assessment scope from supplied targets',example:'example.com | staging.example.com',run:text=>{
    const targets=text.split('|').map(s=>s.trim());if(targets.some(t=>!t)||targets.length>10)throw Error('Supply 1–10 targets separated with |.');
    return `Authorized assessment scope draft\n\nTargets supplied: ${targets.join(', ')}\nOwner/approver: [fill in]\nWritten authorization reference: [fill in]\nTesting window and timezone: [fill in]\nAllowed techniques: [agree before testing]\nExcluded assets and third parties: [fill in]\nRate limits: [agree]\nEmergency stop contact: [fill in]\nEvidence handling and deletion date: [fill in]\nReporting channel and deadline: [fill in]\n\nThis template does not grant authorization or run a scan.`;
  }},
};
export const runTechnicalTool=(name,input)=>{
  if(!TECHNICAL_TOOLS[name])throw Error('Unknown technical tool.');
  if(typeof input!=='string'||!input.trim()||input.length>6000)throw Error('Supply 1–6000 characters.');
  return TECHNICAL_TOOLS[name].run(input.trim()).slice(0,12000);
};

export const lookupDkim=async(rawDomain,selector)=>{
  const domain=normalizeDomain(rawDomain);
  if(!domain||!selector||selector.length>63||!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(selector))throw Error('Use dkimlookup example.com selector.');
  let timer;
  try{
    const rows=await Promise.race([dns.resolveTxt(`${selector}._domainkey.${domain}`),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('DNS lookup timed out.')),8000);timer.unref?.();})]);
    return rows.slice(0,20).map(row=>row.join('')).join('\n').slice(0,4000);
  }finally{clearTimeout(timer);}
};
