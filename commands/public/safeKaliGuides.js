import { parsePhoneNumber } from "awesome-phonenumber";
import { ipRdap, claimOsintQuota } from "../../utils/passiveOsint.js";
import { runDefensiveCheck } from "../../utils/defensiveSecurityLab.js";

const GUIDES = {
	kaliguide: "Kali Linux is a security-testing workstation, not a permission system. Define written scope, use an isolated lab, preserve evidence and report findings responsibly.",
	legalcheck: "Before testing: identify the asset owner, obtain written permission, list exact targets, permitted techniques, dates, data-handling rules, emergency contacts and stop conditions.",
	scopetemplate: "Scope template: Owner | Tester | Approved domains/IPs | Excluded assets | Start/end time | Allowed tests | Prohibited tests | Data retention | Emergency contact | Signatures.",
	roetemplate: "Rules of engagement: authorised targets only; no social engineering, persistence, destructive tests, service disruption or third-party data; stop and notify the owner if sensitive data is exposed.",
	evidencechecklist: "Evidence checklist: UTC timestamp, authorised target, observation, reproduction steps, sanitized screenshot/log, affected version, risk, remediation and retest result.",
	incidentplan: "Incident plan: contain safely, preserve evidence, rotate exposed credentials, patch the cause, notify authorised stakeholders, monitor for recurrence and document lessons learned.",
	breachresponse: "Suspected breach: disconnect only when safe, do not wipe evidence, preserve logs, revoke sessions, rotate secrets from a clean device, contact the service owner and follow the incident plan.",
	phishlesson: "Phishing warning signs: urgency, unusual sender domain, hidden/shortened links, unexpected attachments, credential requests, payment pressure and attempts to bypass normal procedures.",
	phishquiz: "Phishing quiz: A message says your account closes in 10 minutes and links to a misspelled domain. Best action? A) Sign in B) Forward it C) Verify through the official app/site and report it. Correct: C.",
	phishreport: "Phishing report template: Date/time | Channel | Claimed sender | Sender address/number | Defanged URL | Attachment name/hash | Warning signs | Actions taken. Never forward live credentials.",
	phishtraining: "SECURITY AWARENESS SIMULATION — NO PASSWORDS OR PERSONAL DATA. Scenario: an urgent message asks you to sign in through an unfamiliar link. Pause, verify through the official channel, report it, then delete it.",
	reportphish: "Report suspected phishing to the organisation being impersonated, your email/hosting provider, and your internal security contact. Submit a defanged URL and sanitized evidence—never another person's credentials.",
	phoneprivacy: "Phone privacy: do not publish another person's number, attempt account recovery, enumerate linked services or infer identity without consent. Use formatting/carrier metadata only for legitimate support or fraud prevention.",
	phoneconsent: "Consent checklist: explain the lookup purpose, request permission, collect the minimum number data, restrict access, set a deletion date and provide a way to withdraw consent.",
	phonesafety: "If a number is suspicious: do not call back automatically, do not share OTPs, verify through an official channel, block/report abusive contacts and preserve evidence without public doxxing.",
	linuxperms: "Linux permissions use read=4, write=2, execute=1 for owner/group/others. Prefer least privilege; avoid chmod 777 on applications or secrets.",
	chmodexplain: "Example: 750 means owner rwx, group r-x, others ---. 640 means owner rw-, group r--, others ---.",
	hashguide: "Use Argon2id, scrypt or bcrypt for passwords with unique salts. Use SHA-256/SHA-512 for integrity. MD5 and SHA-1 are unsuitable for password storage.",
	tlsversions: "Prefer TLS 1.3 and TLS 1.2. Disable SSLv2/v3 and TLS 1.0/1.1. Use trusted certificates, HSTS and tested modern cipher suites.",
	cipherguide: "Prefer authenticated encryption such as AES-GCM or ChaCha20-Poly1305. Do not invent encryption schemes or reuse nonces/IVs.",
	firewallguide: "Default-deny inbound access, expose only required services, restrict administration by identity/network, log denied traffic and review rules regularly.",
	sshhardening: "Use key-based SSH, disable root/password login where practical, restrict allowed users, apply updates, rate-limit attempts and protect private keys.",
	webhardening: "Web baseline: HTTPS/HSTS, secure cookies, CSP, input validation, output encoding, CSRF protection, least privilege, dependency updates and centralized logging.",
	apihardening: "API baseline: authenticated endpoints, object-level authorization, schema validation, rate limits, bounded payloads, secret rotation, audit logs and nonverbose errors.",
	databasehardening: "Database baseline: private network, least-privileged users, TLS, encrypted backups, patched versions, query parameterization and tested restoration.",
	dockerhardening: "Container baseline: small pinned images, non-root user, read-only filesystem where possible, no privileged mode, secret manager, resource limits and image scanning.",
	kubernetesguide: "Kubernetes baseline: RBAC least privilege, network policies, restricted pod security, encrypted secrets, admission controls, audit logging and patched clusters.",
	logguide: "Security logs should record UTC time, actor, action, target and result without passwords, OTPs, full tokens or unnecessary personal information.",
	yaraexplain: "YARA matches file/content patterns for defensive detection. Test rules against known-good samples and never treat one match as final malware proof.",
	sigmaexplain: "Sigma is a portable detection-rule format for event logs. Map fields to your SIEM, test for false positives and version-control approved rules.",
	wiresharkguide: "Wireshark analyses authorised packet captures. Capture only networks you own or administer; minimise personal data and use display filters to reduce exposure.",
	nmapguide: "Nmap discovers hosts/services, but active scanning can disrupt systems and trigger alerts. This bot does not run scans. Use it only in a written, authorised lab scope.",
	burpguide: "Burp Suite is a web-testing proxy. Use a dedicated test account and authorised staging target; avoid collecting other users' sessions or production data.",
	zapguide: "OWASP ZAP supports defensive web testing. Start with passive scanning in an authorised test environment; active scanning requires explicit scope and maintenance approval.",
	metasploitguide: "Metasploit can execute exploits and is intentionally not connected to Alpha. Use isolated training labs only, with written authorisation and snapshots for recovery.",
	kaliinstallguide: "Install Kali only on a dedicated VM from the official image, verify its checksum, keep snapshots, update packages and isolate vulnerable practice machines from real networks.",
	labguide: "Safe lab: Kali VM + intentionally vulnerable VM on a host-only network, no bridged exposure, disposable test accounts, snapshots and no real personal data.",
	disclosureguide: "Responsible disclosure: verify minimally, stop before accessing data, document impact, contact the owner privately, allow remediation time and publish only with agreement.",
	riskrating: "Rate findings by likelihood and impact, then include evidence, affected assets and practical remediation. A scanner severity alone is not a final business-risk decision.",
	remediationplan: "Remediation format: finding | affected asset | owner | immediate containment | permanent fix | deadline | verification method | retest status.",
};

const safe = (value, max=3000) => String(value||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);
const phoneInfo = (raw) => {
	const parsed=parsePhoneNumber(String(raw||""), { regionCode: "NG" });
	if(!parsed?.valid) return "Invalid phone-number format. Use a local Nigerian number or +country-code format.";
	return `International: ${parsed.number.e164}\nCountry: ${parsed.regionCode}\nNational: ${parsed.number.significant}\nType: ${parsed.type || "unknown"}\nThis does not identify the owner or linked accounts.`;
};

const phishingReview = (input) => {
	const text=safe(input); const link=text.match(/https?:\/\/[^\s<>]+/i)?.[0] || (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(text) ? text.split(/\s/)[0] : "");
	const signals=[];
	if(/urgent|immediately|account (?:closed|blocked|suspended)|within \d+ (?:minute|hour)/i.test(text)) signals.push("urgency or account-pressure language");
	if(/password|otp|pin|verification code|card number|bank detail/i.test(text)) signals.push("request for sensitive information");
	if(/pay now|send money|transfer|gift card|crypto/i.test(text)) signals.push("unexpected payment pressure");
	if(/do not call|keep (?:this|it) secret|don't tell/i.test(text)) signals.push("attempt to prevent independent verification");
	if(link){const review=runDefensiveCheck("securlsuspicious",link);if(!review.startsWith("No common"))signals.push(...review.split("\n").map(x=>x.replace(/^•\s*/,"")));}
	const score=Math.min(100,signals.length*20); return `Risk score: ${score}/100\nSignals:\n${signals.length?signals.map(x=>`• ${x}`).join("\n"):"No common phishing signal found."}\n\nDo not open the link from this result; verify through the organisation's official app or manually typed website.`;
};

const handler=async(_sock,msg,from,args,info)=>{
	const {command,prefix,senderJid,sendMessageWTyping}=info; const reply=(text)=>sendMessageWTyping(from,{text:String(text).slice(0,4000)},{quoted:msg});
	if(command==="safekalihelp") return reply(`🛡️ *Safe Kali-Inspired Lab*\n\n${Object.keys(GUIDES).map(x=>`${prefix}${x}`).join(" · ")}\n\nDynamic checks: ${prefix}phishcheck <message/url> · ${prefix}phishscore <message/url> · ${prefix}linkextract <text> · ${prefix}ipregion <public IP> · ${prefix}phonemeta <number>.`);
	if(GUIDES[command]) return reply(`🛡️ *${command}*\n\n${GUIDES[command]}`);
	const input=safe(args.join(" "));
	if(["phishcheck","phishscore","phishemailcheck","phishsmscheck","safelinkpreview"].includes(command)) return reply(`🎣 *Defensive phishing review*\n\n${phishingReview(input)}`);
	if(command==="unicodehostcheck") return reply(`🎣 *Unicode-host review*\n\n${runDefensiveCheck("securlpunycode",input)}`);
	if(command==="lookalikecheck") {const [left,right]=input.split("|").map(x=>x.trim().toLowerCase());if(!left||!right)return reply(`❌ Usage: ${prefix}lookalikecheck official.com | suspicious.com`);const normalize=x=>x.replace(/^www\./,"").replace(/[-_.]/g,"").replace(/[013457]/g,c=>({0:"o",1:"i",3:"e",4:"a",5:"s",7:"t"}[c]));return reply(`🎣 *Lookalike review*\nFirst: ${left}\nSecond: ${right}\nVisually normalized match: ${normalize(left)===normalize(right)?"YES — investigate carefully":"NO exact heuristic match"}\nThis is a basic offline check, not a reputation verdict.`);}
	if(command==="linkextract") {const links=input.match(/https?:\/\/[^\s<>]+/gi)||[];return reply(links.length?links.slice(0,15).map(x=>runDefensiveCheck("secdefang",x)).join("\n"):"No HTTP/HTTPS link found.");}
	if(["phonemeta","phonecountry","phonetype","phonee164"].includes(command)) return reply(`📱 *Consent-based phone metadata*\n\n${phoneInfo(input)}`);
	if(command==="ipregion") {const quota=claimOsintQuota(senderJid);if(!quota.allowed)return reply("⏳ Passive lookup limit reached; try later.");try{const r=await ipRdap(input);return reply(`🌍 *Public network region*\nIP: ${r.query}\nNetwork: ${r.name||"N/A"}\nRange: ${r.range||"N/A"}\nRegistry country: ${r.country||"N/A"}\nOwner: ${r.owner||"N/A"}\n\nThis is network-registration data, not a person's precise location.`);}catch(e){return reply(`❌ ${e.message}`);}}
	return reply(`❌ Usage: ${prefix}${command} <value>`);
};

export default()=>({cmd:["safekalihelp",...Object.keys(GUIDES),"phishcheck","phishscore","phishemailcheck","phishsmscheck","lookalikecheck","unicodehostcheck","safelinkpreview","linkextract","phonemeta","phonecountry","phonetype","phonee164","ipregion"],desc:"Safe Kali-inspired education, phishing defence, coarse network registration and consent-based phone metadata",usage:"safekalihelp | phishcheck <message/url> | ipregion <public IP> | phonemeta <number>",handler});
