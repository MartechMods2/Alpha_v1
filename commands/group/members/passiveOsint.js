import {
	asnRdap,
	certificateNames,
	claimOsintQuota,
	dnsLookup,
	domainRdap,
	emailSecurity,
	httpsHeaders,
	identifyHash,
	ipRdap,
	reverseDns,
	tlsCertificate,
} from "../../../utils/passiveOsint.js";

const safe = (value, limit = 500) => String(value ?? "N/A").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
const date = (value) => {
	if (!value) return "N/A";
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? safe(value, 40) : parsed.toISOString().slice(0, 10);
};
const valueText = (value) => typeof value === "string" ? value : JSON.stringify(value);

const helpText = `🕵️ *Alpha Passive OSINT Lab*

All lookups are public, passive, rate-limited and free. No API key or cookie is required.

• \`dns example.com A\` — DNS records (A, AAAA, MX, NS, TXT, CNAME, SOA, CAA, SRV)
• \`rdap example.com\` — domain registration summary (modern WHOIS)
• \`iprdap 1.1.1.1\` — public IP allocation owner/range
• \`asn AS13335\` — public ASN allocation summary
• \`ptr 1.1.1.1\` — reverse DNS
• \`tls example.com\` — port 443 certificate and TLS summary
• \`headers example.com\` — HTTPS security-header check
• \`emailsecurity example.com\` — MX, SPF and DMARC check
• \`ctsearch example.com\` — certificate-transparency names, maximum 20
• \`hashid <hash>\` — identify likely hash format; never cracks it

Private/reserved IPs, custom ports, bulk targets, exploits, password attacks and personal-account searches are blocked.`;

const handler = async (_sock, msg, from, args, info) => {
	const { command, senderJid, sendMessageWTyping } = info;
	const reply = (text) => sendMessageWTyping(from, { text: String(text).slice(0, 4000) }, { quoted: msg });

	if (command === "osinthelp" || command === "osintstatus") return reply(helpText);
	if (command === "hashid") {
		if (!args[0]) return reply("❌ Usage: `hashid <hash>`.");
		const matches = identifyHash(args[0]);
		return reply(matches.length
			? `🔐 *Hash Identification*\nLikely format${matches.length === 1 ? "" : "s"}: ${matches.join(", ")}\n\nIdentification is based on shape and length, not proof. Alpha does not crack passwords.`
			: "🔐 No common supported hash format matched. Alpha does not crack passwords.");
	}

	const quota = claimOsintQuota(senderJid);
	if (!quota.allowed) return reply(`⏳ Passive lookup limit reached. Try again in about ${Math.ceil(quota.retryAfterSeconds / 60)} minute(s).`);

	try {
		if (["dns", "dig"].includes(command)) {
			const result = await dnsLookup(args[0], args[1]);
			return reply(`🌐 *DNS ${result.type}: ${result.domain}*\n\n${result.records.map((record) => `• ${safe(valueText(record), 600)}`).join("\n") || "No records returned."}`);
		}
		if (["rdap", "whois"].includes(command)) {
			const result = await domainRdap(args[0]);
			return reply(`📘 *Domain RDAP*\nDomain: ${safe(result.domain)}\nRegistrar: ${safe(result.registrar)}\nRegistered: ${date(result.registered)}\nExpires: ${date(result.expires)}\nUpdated: ${date(result.updated)}\nStatus: ${result.status.map((row) => safe(row, 80)).join(", ") || "N/A"}\nNameservers: ${result.nameservers.map((row) => safe(row, 100)).join(", ") || "N/A"}`);
		}
		if (["iprdap", "ipwhois"].includes(command)) {
			const result = await ipRdap(args[0]);
			return reply(`🛰️ *Public IP RDAP*\nIP: ${safe(result.query)}\nNetwork: ${safe(result.name)}\nRange: ${safe(result.range)}\nOwner: ${safe(result.owner)}\nCountry: ${safe(result.country)}\nStatus: ${result.status.map((row) => safe(row, 80)).join(", ") || "N/A"}`);
		}
		if (["asn", "asnlookup"].includes(command)) {
			const result = await asnRdap(args[0]);
			return reply(`📡 *ASN RDAP*\nASN: AS${result.asn}\nName: ${safe(result.name)}\nRange: ${safe(result.range)}\nOwner: ${safe(result.owner)}\nCountry: ${safe(result.country)}\nStatus: ${result.status.map((row) => safe(row, 80)).join(", ") || "N/A"}`);
		}
		if (command === "ptr") {
			const result = await reverseDns(args[0]);
			return reply(`🔁 *Reverse DNS*\nIP: ${safe(result.ip)}\n${result.hostnames.map((row) => `• ${safe(row, 200)}`).join("\n") || "No PTR hostname returned."}`);
		}
		if (["tls", "ssl"].includes(command)) {
			const result = await tlsCertificate(args[0]);
			return reply(`🔒 *TLS Certificate*\nDomain: ${safe(result.domain)}\nTrusted: ${result.authorized ? "YES" : `NO (${safe(result.authorizationError)})`}\nProtocol: ${safe(result.protocol)}\nCipher: ${safe(result.cipher)}\nSubject: ${safe(result.subject)}\nIssuer: ${safe(result.issuer)}\nValid from: ${safe(result.validFrom)}\nValid to: ${safe(result.validTo)}\nSHA-256 fingerprint: ${safe(result.fingerprint256, 150)}`);
		}
		if (["headers", "webheaders"].includes(command)) {
			const result = await httpsHeaders(args[0]);
			const names = ["strict-transport-security", "content-security-policy", "x-content-type-options", "x-frame-options", "referrer-policy", "permissions-policy", "cross-origin-opener-policy"];
			const rows = names.map((name) => `${result.headers[name] ? "✅" : "❌"} ${name}${result.headers[name] ? `: ${safe(result.headers[name], 220)}` : ""}`);
			return reply(`🛡️ *HTTPS Security Headers*\nDomain: ${safe(result.domain)}\nHTTP status: ${result.status || "N/A"}\n\n${rows.join("\n")}\n\nMissing headers are a review signal, not proof that a site is unsafe.`);
		}
		if (["emailsecurity", "emailsec"].includes(command)) {
			const result = await emailSecurity(args[0]);
			return reply(`📧 *Email-Domain Security*\nDomain: ${safe(result.domain)}\nMX: ${result.mx.map((row) => `${row.priority} ${safe(row.exchange, 150)}`).join(", ") || "Missing"}\nSPF: ${safe(result.spf || "Missing", 700)}\nDMARC: ${safe(result.dmarc || "Missing", 700)}\n\nThis checks published DNS policy only; it does not send email.`);
		}
		if (["ctsearch", "certsearch"].includes(command)) {
			const result = await certificateNames(args[0]);
			return reply(`📜 *Certificate Transparency*\nDomain: ${safe(result.domain)}\n\n${result.names.map((row) => `• ${safe(row, 200)}`).join("\n") || "No matching public certificate names returned."}\n\nPublic certificate records can be historical and do not prove that a host is currently online.`);
		}
		return reply(helpText);
	} catch (error) {
		const message = error?.code === "ENOTFOUND" || error?.code === "ENODATA" ? "No public record was found for that target." : safe(error.message, 500);
		return reply(`❌ Passive lookup failed: ${message}`);
	}
};

export default () => ({
	cmd: ["osinthelp", "osintstatus", "dns", "dig", "rdap", "whois", "iprdap", "ipwhois", "asn", "asnlookup", "ptr", "tls", "ssl", "headers", "webheaders", "emailsecurity", "emailsec", "ctsearch", "certsearch", "hashid"],
	desc: "Free, passive and rate-limited domain, DNS, IP, TLS, email and hash-identification tools",
	usage: "osinthelp | dns example.com MX | rdap example.com | tls example.com",
	handler,
});
