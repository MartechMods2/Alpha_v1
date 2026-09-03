import { createHash, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { domainToASCII } from "node:url";
import { identifyHash, isPublicIp, normalizeDomain } from "./passiveOsint.js";

export const SECURITY_COMMAND_GROUPS = {
	url: ["securlparse", "securlnormalize", "securlscheme", "securlhost", "securlport", "securlpath", "securlquery", "securlfragment", "securlorigin", "securlusercheck", "securlhttps", "securlshortener", "securlredirecthint", "securlencoded", "securliphost", "securlpunycode", "securlsuspicious", "securlrisk", "securlparams", "securltracking", "securlstriptracking", "securlfilename", "securlextension", "secdefang", "secrefang"],
	ioc: ["secipcheck", "secipv4", "secipv6", "seccidrcheck", "secprivateip", "secloopback", "secemailcheck", "secemaildomain", "sechashidentify", "seciocdetect", "secioccount", "secdomaincheck", "secsubdomaincount", "secportname", "secmaccheck", "secuuidcheck", "seccvecheck", "seccwecheck", "seccvsslevel", "secmitreid"],
	auth: ["secpasswordstrength", "secpassphrase", "secentropy", "secjwtdecode", "secjwtheader", "secjwtclaims", "secjwtexpiry", "secbase64check", "secbase64decode", "sechexcheck", "sechexdecode", "securlencode", "securldecode", "sechmacguide", "sechashequality", "secconstanttime", "sectotpcheck", "secapikeymask", "secsecretmask", "seccredentialscan"],
	headers: ["seccspcheck", "sechstscheck", "secframecheck", "secnosniffcheck", "secreferrercheck", "secpermissionscheck", "seccorscheck", "seccookiecheck", "secsecurecookie", "sechttponly", "secsamesite", "seccachecheck", "secserverleak", "secpoweredbyleak", "seccontenttype", "secmixedcontent", "seccspnonce", "seccspunsafe", "secsecurityscore", "secheaderreport"],
	logs: ["seclogsummary", "seclogips", "seclogstatus", "seclogerrors", "seclogauthfail", "secloguseragents", "seclogpaths", "seclogmethods", "seclogtimestamps", "seclogredact", "secpiiredact", "secemailredact", "secphoneredact", "secipredact", "sectokenredact", "secsecretfind", "secsqlisignal", "secxsssignal", "secpathtraversal", "seccmdinjection", "seclog4jsignal", "secbasicauthcheck", "secbearercheck", "secnewlinecheck", "secunicodecheck"],
};

export const SECURITY_COMMANDS = Object.values(SECURITY_COMMAND_GROUPS).flat();
const clean = (value, max = Number(process.env.SECURITY_MAX_INPUT_CHARS) || 6000) => String(value || "").replace(/[\u0000\u0008\u000b\u000c]/g, "").trim().slice(0, Math.min(12000, Math.max(500, max)));
const yes = (value) => value ? "YES ✅" : "NO ❌";
const list = (values, fallback = "None found") => values.length ? values.slice(0, 20).join("\n") : fallback;
const unique = (values) => [...new Set(values.filter(Boolean))];
const count = (text, regex) => (text.match(regex) || []).length;
const decode64url = (value) => Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64url").toString("utf8");
const jsonPart = (token, index) => { try { return JSON.parse(decode64url(token.split(".")[index] || "")); } catch { return null; } };

const parseUrl = (input) => {
	let raw = clean(input, 3000);
	if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `https://${raw}`;
	try { const url = new URL(raw); return [url, null]; } catch { return [null, "Provide a valid URL or domain."]; }
};
const tracking = /^(utm_.+|fbclid|gclid|dclid|msclkid|mc_[ce]id|ref|referrer)$/i;
const shorteners = new Set(["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "cutt.ly", "rebrand.ly", "shorturl.at"]);
const urlRisks = (url) => {
	const risks = [];
	if (url.protocol !== "https:") risks.push("not HTTPS");
	if (url.username || url.password) risks.push("embedded user information");
	if (isIP(url.hostname)) risks.push("IP-literal host");
	if (url.hostname.startsWith("xn--") || url.hostname.includes(".xn--")) risks.push("punycode hostname");
	if (shorteners.has(url.hostname)) risks.push("URL shortener hides destination");
	if (url.href.length > 250) risks.push("unusually long URL");
	if (count(url.href, /%[0-9a-f]{2}/gi) > 8) risks.push("heavy percent encoding");
	if (url.hostname.split(".").length > 5) risks.push("many subdomains");
	return risks;
};

const emails = (text) => unique(text.match(/[\w.+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || []);
const ips = (text) => unique(text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || []).filter((ip) => isIP(ip));
const domains = (text) => unique(text.match(/\b(?:[a-z0-9-]+\.)+[a-z]{2,63}\b/gi) || []).filter(normalizeDomain);
const hashes = (text) => unique(text.match(/\b[a-f0-9]{32,128}\b/gi) || []);
const redact = (text) => text
	.replace(/[\w.+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, "[EMAIL]")
	.replace(/(?:\+?\d[\s().-]*){8,15}/g, "[PHONE]")
	.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[IP]")
	.replace(/\b(?:bearer\s+)?[a-z0-9_-]{24,}\b/gi, "[TOKEN]");

const parseHeaders = (text) => Object.fromEntries(clean(text).split(/\r?\n/).map((line) => {
	const at = line.indexOf(":"); return at > 0 ? [line.slice(0, at).trim().toLowerCase(), line.slice(at + 1).trim()] : null;
}).filter(Boolean));
const headerScore = (h) => ["content-security-policy", "strict-transport-security", "x-content-type-options", "x-frame-options", "referrer-policy", "permissions-policy"].filter((name) => h[name]).length;
const headerLine = (h, name) => `${name}: ${h[name] || "MISSING"}`;

const ports = { 20: "FTP data", 21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP", 53: "DNS", 67: "DHCP", 68: "DHCP", 80: "HTTP", 110: "POP3", 123: "NTP", 143: "IMAP", 161: "SNMP", 389: "LDAP", 443: "HTTPS", 445: "SMB", 465: "SMTPS", 587: "SMTP submission", 636: "LDAPS", 993: "IMAPS", 995: "POP3S", 1433: "MSSQL", 1521: "Oracle", 3306: "MySQL", 3389: "RDP", 5432: "PostgreSQL", 6379: "Redis", 8080: "HTTP alternate", 8443: "HTTPS alternate", 27017: "MongoDB" };

const runUrl = (command, input) => {
	if (command === "secdefang") return clean(input).replace(/https/gi, "hxxps").replace(/http/gi, "hxxp").replace(/\./g, "[.]");
	if (command === "secrefang") return clean(input).replace(/hxxps/gi, "https").replace(/hxxp/gi, "http").replace(/\[\.\]/g, ".");
	const [u, error] = parseUrl(input); if (error) return error;
	const risks = urlRisks(u); const entries = [...u.searchParams]; const params = entries.map(([k, v]) => `${k}=${v}`);
	if (command === "securlparse") return `Scheme: ${u.protocol}\nHost: ${u.hostname}\nPort: ${u.port || "default"}\nPath: ${u.pathname}\nQuery items: ${params.length}\nFragment: ${u.hash || "none"}`;
	if (command === "securlnormalize") { u.hash = ""; u.hostname = u.hostname.toLowerCase(); return u.href; }
	if (command === "securlscheme") return u.protocol.replace(":", "");
	if (command === "securlhost") return u.hostname;
	if (command === "securlport") return u.port || (u.protocol === "https:" ? "443 (default)" : u.protocol === "http:" ? "80 (default)" : "not specified");
	if (command === "securlpath") return u.pathname;
	if (command === "securlquery") return list(params);
	if (command === "securlfragment") return u.hash.slice(1) || "No fragment";
	if (command === "securlorigin") return u.origin;
	if (command === "securlusercheck") return `Embedded username/password: ${yes(Boolean(u.username || u.password))}`;
	if (command === "securlhttps") return `HTTPS: ${yes(u.protocol === "https:")}`;
	if (command === "securlshortener") return `Known shortener: ${yes(shorteners.has(u.hostname))}`;
	if (command === "securlredirecthint") return `Redirect-like parameters: ${list(entries.filter(([k]) => /^(url|uri|redirect|redirect_uri|next|continue|return|dest)/i.test(k)).map(([k, v]) => `${k}=${v}`))}`;
	if (command === "securlencoded") return `Percent-encoded sequences: ${count(u.href, /%[0-9a-f]{2}/gi)}`;
	if (command === "securliphost") return `IP-literal host: ${yes(Boolean(isIP(u.hostname)))}`;
	if (command === "securlpunycode") return `ASCII host: ${domainToASCII(u.hostname)}\nPunycode present: ${yes(u.hostname.includes("xn--"))}`;
	if (command === "securlsuspicious") return list(risks.map((r) => `• ${r}`), "No common URL warning signal found.");
	if (command === "securlrisk") return `Heuristic risk: ${risks.length >= 4 ? "HIGH" : risks.length >= 2 ? "MEDIUM" : risks.length ? "LOW" : "MINIMAL"}\nSignals: ${risks.length}`;
	if (command === "securlparams") return list(params);
	if (command === "securltracking") return list(entries.filter(([k]) => tracking.test(k)).map(([k, v]) => `${k}=${v}`), "No common tracking parameter found.");
	if (command === "securlstriptracking") { for (const key of [...u.searchParams.keys()]) if (tracking.test(key)) u.searchParams.delete(key); return u.href; }
	const filename = u.pathname.split("/").filter(Boolean).at(-1) || "none";
	if (command === "securlfilename") return filename;
	if (command === "securlextension") return filename.includes(".") ? filename.split(".").at(-1).toLowerCase() : "No extension";
	return "Unsupported URL check.";
};

const runIoc = (command, input) => {
	const value = clean(input, 3000);
	if (command === "secipcheck") return `IP version: ${isIP(value) || "invalid"}\nPublic routable: ${yes(isPublicIp(value))}`;
	if (command === "secipv4") return `Valid IPv4: ${yes(isIP(value) === 4)}`;
	if (command === "secipv6") return `Valid IPv6: ${yes(isIP(value) === 6)}`;
	if (command === "seccidrcheck") { const m = value.match(/^([^/]+)\/(\d{1,3})$/); const v = m && isIP(m[1]); return `Valid CIDR shape: ${yes(Boolean(v && Number(m[2]) <= (v === 4 ? 32 : 128)))}`; }
	if (command === "secprivateip") return `Private/reserved: ${yes(Boolean(isIP(value)) && !isPublicIp(value))}`;
	if (command === "secloopback") return `Loopback: ${yes(/^127\./.test(value) || value === "::1")}`;
	if (command === "secemailcheck") return `Valid email shape: ${yes(/^[\w.+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(value))}`;
	if (command === "secemaildomain") return value.split("@")[1]?.toLowerCase() || "No email domain found";
	if (command === "sechashidentify") return list(identifyHash(value));
	if (command === "seciocdetect") return `IPs:\n${list(ips(value))}\n\nDomains:\n${list(domains(value))}\n\nEmails:\n${list(emails(value))}\n\nHashes:\n${list(hashes(value))}`;
	if (command === "secioccount") return `IPs: ${ips(value).length}\nDomains: ${domains(value).length}\nEmails: ${emails(value).length}\nHashes: ${hashes(value).length}`;
	if (command === "secdomaincheck") return `Valid public-domain shape: ${yes(Boolean(normalizeDomain(value)))}`;
	if (command === "secsubdomaincount") { const d = normalizeDomain(value); return d ? `Labels: ${d.split(".").length}\nPossible subdomain labels: ${Math.max(0, d.split(".").length - 2)}` : "Invalid domain"; }
	if (command === "secportname") { const port = Number(value); return Number.isInteger(port) && port > 0 && port < 65536 ? `${port}: ${ports[port] || "unassigned/unknown to this offline list"}` : "Enter port 1–65535."; }
	if (command === "secmaccheck") return `Valid MAC shape: ${yes(/^(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i.test(value))}`;
	if (command === "secuuidcheck") return `Valid UUID shape: ${yes(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))}`;
	if (command === "seccvecheck") return `Valid CVE ID: ${yes(/^CVE-\d{4}-\d{4,}$/i.test(value))}`;
	if (command === "seccwecheck") return `Valid CWE ID: ${yes(/^CWE-\d{1,5}$/i.test(value))}`;
	if (command === "seccvsslevel") { const score = Number(value); return score >= 0 && score <= 10 ? `Severity: ${score === 0 ? "NONE" : score < 4 ? "LOW" : score < 7 ? "MEDIUM" : score < 9 ? "HIGH" : "CRITICAL"}` : "Enter a CVSS score from 0 to 10."; }
	if (command === "secmitreid") return `Valid MITRE ATT&CK technique shape: ${yes(/^T\d{4}(?:\.\d{3})?$/i.test(value))}`;
	return "Unsupported IOC check.";
};

const passwordScore = (value) => [value.length >= 12, value.length >= 16, /[a-z]/.test(value), /[A-Z]/.test(value), /\d/.test(value), /[^\w\s]/.test(value)].filter(Boolean).length;
const mask = (value) => value.length < 9 ? "*".repeat(value.length) : `${value.slice(0, 4)}${"*".repeat(Math.min(24, value.length - 8))}${value.slice(-4)}`;
const runAuth = (command, input) => {
	const value = clean(input);
	if (command === "secpasswordstrength") { const score = passwordScore(value); return `Strength: ${score >= 6 ? "STRONG" : score >= 4 ? "MODERATE" : "WEAK"}\nLength: ${value.length}\nChecks passed: ${score}/6\nThe password was not stored or repeated.`; }
	if (command === "secpassphrase") return `Passphrase guidance: ${value.trim().split(/\s+/).length >= 4 && value.length >= 16 ? "GOOD ✅" : "Use at least four unrelated words and 16+ characters."}`;
	if (command === "secentropy") { const pool = (/[a-z]/.test(value)?26:0)+(/[A-Z]/.test(value)?26:0)+(/\d/.test(value)?10:0)+(/[^\w\s]/.test(value)?32:0); return `Estimated upper-bound entropy: ${pool ? Math.round(value.length * Math.log2(pool)) : 0} bits\nThis is an estimate, not a cracking prediction.`; }
	if (["secjwtdecode", "secjwtheader", "secjwtclaims", "secjwtexpiry"].includes(command)) { const head=jsonPart(value,0), body=jsonPart(value,1); if(!head||!body) return "Invalid JWT shape. Signature is not verified by this offline decoder."; if(command==="secjwtheader") return JSON.stringify(head,null,2); if(command==="secjwtclaims") return JSON.stringify(body,null,2); if(command==="secjwtexpiry") return body.exp ? `${new Date(body.exp*1000).toISOString()} — ${body.exp*1000 > Date.now()?"not expired":"expired"}` : "No exp claim."; return `Header:\n${JSON.stringify(head,null,2)}\nPayload:\n${JSON.stringify(body,null,2)}\nSignature: NOT VERIFIED`; }
	if (command === "secbase64check") return `Valid Base64 shape: ${yes(/^(?:[a-z0-9+/]{4})*(?:[a-z0-9+/]{2}==|[a-z0-9+/]{3}=)?$/i.test(value))}`;
	if (command === "secbase64decode") { try { return Buffer.from(value, "base64").toString("utf8").slice(0, 3500); } catch { return "Invalid Base64."; } }
	if (command === "sechexcheck") return `Valid even-length hex: ${yes(/^(?:[a-f0-9]{2})+$/i.test(value))}`;
	if (command === "sechexdecode") return /^(?:[a-f0-9]{2})+$/i.test(value) ? Buffer.from(value,"hex").toString("utf8").slice(0,3500) : "Invalid hex.";
	if (command === "securlencode") return encodeURIComponent(value);
	if (command === "securldecode") { try { return decodeURIComponent(value); } catch { return "Invalid percent encoding."; } }
	if (command === "sechmacguide") return "HMAC signs data with a secret key. Use HMAC-SHA-256, a random secret, constant-time verification and timestamp/replay protection.";
	if (["sechashequality", "secconstanttime"].includes(command)) { const [a,b]=value.split("|").map(x=>x.trim()); if(!a||!b) return "Usage: value-one | value-two"; const aa=Buffer.from(a),bb=Buffer.from(b); return `Constant-time equal: ${yes(aa.length===bb.length && timingSafeEqual(aa,bb))}`; }
	if (command === "sectotpcheck") return `Six/eight-digit TOTP shape: ${yes(/^(?:\d{6}|\d{8})$/.test(value))}\nNo code was validated against a secret.`;
	if (["secapikeymask", "secsecretmask"].includes(command)) return mask(value);
	if (command === "seccredentialscan") { const signals=[/api[_-]?key\s*[:=]/i,/secret\s*[:=]/i,/password\s*[:=]/i,/authorization\s*:/i,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i]; return `Possible credential patterns: ${signals.filter(r=>r.test(value)).length}\nReview locally; this is pattern matching only.`; }
	return "Unsupported authentication check.";
};

const runHeaders = (command, input) => {
	const h=parseHeaders(input); const csp=h["content-security-policy"]||""; const cookies=(h["set-cookie"]||"").toLowerCase();
	const map={seccspcheck:"content-security-policy",sechstscheck:"strict-transport-security",secframecheck:"x-frame-options",secnosniffcheck:"x-content-type-options",secreferrercheck:"referrer-policy",secpermissionscheck:"permissions-policy",seccorscheck:"access-control-allow-origin",seccachecheck:"cache-control",seccontenttype:"content-type"};
	if(map[command]) return headerLine(h,map[command]);
	if(command==="seccookiecheck") return h["set-cookie"]||"No Set-Cookie header supplied.";
	if(command==="secsecurecookie") return `Secure cookie flag: ${yes(cookies.includes("secure"))}`;
	if(command==="sechttponly") return `HttpOnly cookie flag: ${yes(cookies.includes("httponly"))}`;
	if(command==="secsamesite") return `SameSite cookie flag: ${yes(cookies.includes("samesite="))}`;
	if(command==="secserverleak") return `Server disclosure: ${h.server||"not supplied"}`;
	if(command==="secpoweredbyleak") return `X-Powered-By disclosure: ${h["x-powered-by"]||"not supplied"}`;
	if(command==="secmixedcontent") return `CSP upgrade-insecure-requests: ${yes(csp.includes("upgrade-insecure-requests"))}`;
	if(command==="seccspnonce") return `CSP nonce/hash present: ${yes(/'nonce-|sha(?:256|384|512)-/i.test(csp))}`;
	if(command==="seccspunsafe") return `CSP unsafe-inline/eval present: ${yes(/'unsafe-(?:inline|eval)'/i.test(csp))}`;
	if(command==="secsecurityscore") return `Security-header score: ${headerScore(h)}/6\nThis is a configuration checklist, not a vulnerability verdict.`;
	if(command==="secheaderreport") return ["content-security-policy","strict-transport-security","x-content-type-options","x-frame-options","referrer-policy","permissions-policy","access-control-allow-origin","set-cookie"].map(n=>headerLine(h,n)).join("\n");
	return "Paste HTTP response headers as Name: value lines.";
};

const runLogs = (command, input) => {
	const value=clean(input); const lines=value.split(/\r?\n/).filter(Boolean).slice(0,500); const foundIps=ips(value); const statuses=unique(value.match(/\b[1-5]\d{2}\b/g)||[]); const methods=unique(value.match(/\b(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)||[]); const paths=unique(value.match(/\s\/(?:[^\s?"']*)/g)||[]).map(x=>x.trim());
	if(command==="seclogsummary") return `Lines: ${lines.length}\nIPs: ${foundIps.length}\nHTTP statuses: ${statuses.join(", ")||"none"}\nMethods: ${methods.join(", ")||"none"}\nError-like lines: ${lines.filter(l=>/error|fail|denied|exception/i.test(l)).length}`;
	if(command==="seclogips") return list(foundIps);
	if(command==="seclogstatus") return list(statuses.map(s=>`${s}: ${count(value,new RegExp(`\\b${s}\\b`,"g"))}`));
	if(command==="seclogerrors") return list(lines.filter(l=>/error|exception|fatal|panic/i.test(l)).slice(0,20));
	if(command==="seclogauthfail") return list(lines.filter(l=>/invalid (?:user|password)|authentication fail|login fail|unauthorized|forbidden/i.test(l)).slice(0,20));
	if(command==="secloguseragents") return list(unique(lines.map(l=>l.match(/"([^"]+)"\s*$/)?.[1])));
	if(command==="seclogpaths") return list(paths);
	if(command==="seclogmethods") return list(methods);
	if(command==="seclogtimestamps") return list(unique(value.match(/\b\d{4}-\d{2}-\d{2}[T ][0-9:.+-]+Z?\b/g)||[]));
	if(["seclogredact","secpiiredact"].includes(command)) return redact(value);
	if(command==="secemailredact") return value.replace(/[\w.+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi,"[EMAIL]");
	if(command==="secphoneredact") return value.replace(/(?:\+?\d[\s().-]*){8,15}/g,"[PHONE]");
	if(command==="secipredact") return value.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g,"[IP]");
	if(command==="sectokenredact") return value.replace(/\b(?:bearer\s+)?[a-z0-9_-]{24,}\b/gi,"[TOKEN]");
	const signals={secsecretfind:/api[_-]?key|secret|password|private key|authorization:/gi,secsqlisignal:/(?:union\s+select|or\s+1\s*=\s*1|sleep\s*\(|information_schema)/gi,secxsssignal:/(?:<script|javascript:|onerror\s*=|onload\s*=)/gi,secpathtraversal:/(?:\.\.\/|\.\.\\|%2e%2e)/gi,seccmdinjection:/(?:;|&&|\|\|)\s*(?:sh|bash|cmd|powershell|curl|wget)\b/gi,seclog4jsignal:/\$\{jndi:(?:ldap|rmi|dns):/gi};
	if(signals[command]) return `Defensive pattern matches: ${count(value,signals[command])}\nA match is a review signal, not proof of an attack.`;
	if(command==="secbasicauthcheck") return `Basic Authorization header present: ${yes(/authorization\s*:\s*basic\s+/i.test(value))}`;
	if(command==="secbearercheck") return `Bearer Authorization header present: ${yes(/authorization\s*:\s*bearer\s+/i.test(value))}`;
	if(command==="secnewlinecheck") return `Lines: ${lines.length}\nCRLF: ${count(value,/\r\n/g)}\nBare LF: ${count(value,/(?<!\r)\n/g)}`;
	if(command==="secunicodecheck") return `Non-ASCII characters: ${[...value].filter(c=>c.codePointAt(0)>127).length}\nInvisible-format characters: ${count(value,/[\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g)}`;
	return "Unsupported log check.";
};

export const runDefensiveCheck = (command, input) => {
	if (SECURITY_COMMAND_GROUPS.url.includes(command)) return runUrl(command,input);
	if (SECURITY_COMMAND_GROUPS.ioc.includes(command)) return runIoc(command,input);
	if (SECURITY_COMMAND_GROUPS.auth.includes(command)) return runAuth(command,input);
	if (SECURITY_COMMAND_GROUPS.headers.includes(command)) return runHeaders(command,input);
	if (SECURITY_COMMAND_GROUPS.logs.includes(command)) return runLogs(command,input);
	return "Unknown defensive-security command.";
};

const usage=new Map();
export const claimSecurityQuota=(jid,now=Date.now())=>{ const key=String(jid||"unknown"),limit=Math.min(30,Math.max(5,Number(process.env.SECURITY_RATE_LIMIT)||12)),windowMs=Math.min(3600000,Math.max(60000,Number(process.env.SECURITY_RATE_WINDOW_MS)||600000)); const row=usage.get(key); if(!row||now-row.start>=windowMs){usage.set(key,{start:now,count:1});return {allowed:true,remaining:limit-1};} if(row.count>=limit)return {allowed:false,retryAfterSeconds:Math.ceil((row.start+windowMs-now)/1000)}; row.count++;return {allowed:true,remaining:limit-row.count};};
