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
} from "../../utils/passiveOsint.js";

export const PASSIVE_OSINT_COMMANDS = [
	"osintdomain", "osintip", "osintasn", "osintdns", "osintreverse",
	"osintemailsec", "osinttls", "osintheaders", "osintcertnames", "osinthash",
	"osinta", "osintaaaa", "osintmx", "osintns", "osinttxt",
	"osintcname", "osintsoa", "osintcaa", "osintspf", "osintdmarc",
];

const recordText = (record) => typeof record === "string" ? record : JSON.stringify(record);
const list = (values, fallback = "None found") => Array.isArray(values) && values.length
	? values.slice(0, 20).map((value) => `• ${recordText(value)}`).join("\n")
	: fallback;
const value = (input) => input === null || input === undefined || input === "" ? "Unknown" : String(input);

const help = (prefix) => `🔎 *Alpha Passive OSINT — 20 Tools*\n\nPublic-data and defensive infrastructure lookups only. No port scanning, exploitation, credential attacks, device intrusion or private-network probing.\n\n*Registration / ownership*\n${prefix}osintdomain example.com\n${prefix}osintip 8.8.8.8\n${prefix}osintasn AS13335\n\n*DNS*\n${prefix}osintdns example.com MX\n${prefix}osinta example.com\n${prefix}osintaaaa example.com\n${prefix}osintmx example.com\n${prefix}osintns example.com\n${prefix}osinttxt example.com\n${prefix}osintcname www.example.com\n${prefix}osintsoa example.com\n${prefix}osintcaa example.com\n${prefix}osintreverse 8.8.8.8\n\n*Security posture*\n${prefix}osintemailsec example.com\n${prefix}osintspf example.com\n${prefix}osintdmarc example.com\n${prefix}osinttls example.com\n${prefix}osintheaders example.com\n${prefix}osintcertnames example.com\n${prefix}osinthash <hash>\n\nUse only for systems, domains and information you are allowed to investigate.`;

const dnsShortcut = {
	osinta: "A",
	osintaaaa: "AAAA",
	osintmx: "MX",
	osintns: "NS",
	osinttxt: "TXT",
	osintcname: "CNAME",
	osintsoa: "SOA",
	osintcaa: "CAA",
};

const handler = async (_sock, msg, from, args, info) => {
	const { command, prefix = "$", senderJid, sendMessageWTyping } = info;
	const reply = (text) => sendMessageWTyping(from, { text: String(text).slice(0, 6500) }, { quoted: msg });
	if (["osinthelp", "osint", "osinttools"].includes(command)) return reply(help(prefix));
	if (String(process.env.PASSIVE_OSINT_ENABLED || "true").toLowerCase() === "false") {
		return reply("🔒 Passive OSINT tools are disabled by the owner.");
	}
	const quota = claimOsintQuota(senderJid);
	if (!quota.allowed) return reply(`⏳ OSINT lookup limit reached. Try again in about ${Math.ceil(quota.retryAfterSeconds / 60)} minute(s).`);
	const target = String(args[0] || "").trim();
	if (!target) return reply(`❌ Usage: ${prefix}${command} <public domain, IP, ASN or hash>`);

	try {
		if (command === "osintdomain") {
			const r = await domainRdap(target);
			return reply(`🔎 *Domain RDAP*\nDomain: ${value(r.domain)}\nRegistrar: ${value(r.registrar)}\nRegistered: ${value(r.registered)}\nExpires: ${value(r.expires)}\nUpdated: ${value(r.updated)}\nStatus: ${(r.status || []).join(", ") || "Unknown"}\nNameservers:\n${list(r.nameservers)}`);
		}
		if (command === "osintip") {
			const r = await ipRdap(target);
			return reply(`🔎 *IP RDAP*\nIP: ${r.query}\nName: ${value(r.name)}\nRange: ${value(r.range)}\nCountry: ${value(r.country)}\nOwner: ${value(r.owner)}\nStatus: ${(r.status || []).join(", ") || "Unknown"}`);
		}
		if (command === "osintasn") {
			const r = await asnRdap(target);
			return reply(`🔎 *ASN RDAP*\nASN: AS${r.asn}\nName: ${value(r.name)}\nRange: ${value(r.range)}\nCountry: ${value(r.country)}\nOwner: ${value(r.owner)}\nStatus: ${(r.status || []).join(", ") || "Unknown"}`);
		}
		if (command === "osintreverse") {
			const r = await reverseDns(target);
			return reply(`🔎 *Reverse DNS*\nIP: ${r.ip}\nHostnames:\n${list(r.hostnames)}`);
		}
		if (command === "osintemailsec" || command === "osintspf" || command === "osintdmarc") {
			const r = await emailSecurity(target);
			if (command === "osintspf") return reply(`📧 *SPF*\nDomain: ${r.domain}\n${r.spf || "No SPF record found."}`);
			if (command === "osintdmarc") return reply(`📧 *DMARC*\nDomain: ${r.domain}\n${r.dmarc || "No DMARC record found."}`);
			return reply(`📧 *Email Security*\nDomain: ${r.domain}\nMX:\n${list((r.mx || []).map((x) => `${x.priority} ${x.exchange}`))}\n\nSPF: ${r.spf || "Not found"}\nDMARC: ${r.dmarc || "Not found"}`);
		}
		if (command === "osinttls") {
			const r = await tlsCertificate(target);
			return reply(`🔐 *TLS Certificate*\nDomain: ${r.domain}\nAuthorized: ${r.authorized ? "YES ✅" : "NO ❌"}\nProtocol: ${value(r.protocol)}\nCipher: ${value(r.cipher)}\nSubject: ${value(r.subject)}\nIssuer: ${value(r.issuer)}\nValid from: ${value(r.validFrom)}\nValid to: ${value(r.validTo)}\nSHA-256 fingerprint: ${value(r.fingerprint256)}${r.authorizationError ? `\nTLS error: ${r.authorizationError}` : ""}`);
		}
		if (command === "osintheaders") {
			const r = await httpsHeaders(target);
			const h = r.headers || {};
			const selected = [
				"server", "content-type", "content-security-policy", "strict-transport-security",
				"x-content-type-options", "x-frame-options", "referrer-policy", "permissions-policy",
			].map((name) => `${name}: ${h[name] || "MISSING"}`);
			return reply(`🌐 *HTTPS Headers*\nDomain: ${r.domain}\nHTTP status: ${value(r.status)}\n\n${selected.join("\n")}`);
		}
		if (command === "osintcertnames") {
			const r = await certificateNames(target);
			return reply(`📜 *Public Certificate Names*\nDomain: ${r.domain}\n\n${list(r.names)}\n\nCertificate-transparency data is historical/public and does not prove a hostname is currently live.`);
		}
		if (command === "osinthash") {
			const types = identifyHash(target);
			return reply(`🧩 *Hash Identification*\nPossible type(s): ${types.length ? types.join(", ") : "Unknown from length/prefix alone"}\n\nThis identifies format only; Alpha does not crack passwords or hashes.`);
		}
		if (command === "osintdns") {
			const type = String(args[1] || "A").toUpperCase();
			const r = await dnsLookup(target, type);
			return reply(`🌐 *DNS ${r.type}*\nDomain: ${r.domain}\n\n${list(r.records)}`);
		}
		if (dnsShortcut[command]) {
			const r = await dnsLookup(target, dnsShortcut[command]);
			return reply(`🌐 *DNS ${r.type}*\nDomain: ${r.domain}\n\n${list(r.records)}`);
		}
		return reply(help(prefix));
	} catch (error) {
		console.error(`[PASSIVE_OSINT:${command}]`, error.message);
		return reply(`❌ Passive lookup failed: ${error.message}`);
	}
};

export default () => ({
	cmd: ["osinthelp", "osint", "osinttools", ...PASSIVE_OSINT_COMMANDS],
	desc: "20 passive OSINT and defensive infrastructure lookups using public DNS, RDAP, TLS and certificate data",
	usage: "osinthelp | osintdomain example.com | osintip 8.8.8.8 | osinttls example.com",
	handler,
});
