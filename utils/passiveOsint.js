import { BlockList, isIP } from "node:net";
import dns from "node:dns/promises";
import tls from "node:tls";
import https from "node:https";
import { domainToASCII } from "node:url";

const TIMEOUT_MS = 8_000;
const USER_AGENT = "AlphaBot-Passive-OSINT/1.0 (+https://github.com/MartechMods2/Alpha_v1)";
const blockedIpv4 = new BlockList();
const blockedIpv6 = new BlockList();

for (const [network, prefix, family] of [
	["0.0.0.0", 8, "ipv4"], ["10.0.0.0", 8, "ipv4"], ["100.64.0.0", 10, "ipv4"],
	["127.0.0.0", 8, "ipv4"], ["169.254.0.0", 16, "ipv4"], ["172.16.0.0", 12, "ipv4"],
	["192.0.0.0", 24, "ipv4"], ["192.0.2.0", 24, "ipv4"], ["192.168.0.0", 16, "ipv4"],
	["198.18.0.0", 15, "ipv4"], ["198.51.100.0", 24, "ipv4"], ["203.0.113.0", 24, "ipv4"],
	["224.0.0.0", 4, "ipv4"], ["240.0.0.0", 4, "ipv4"],
	["::", 128, "ipv6"], ["::1", 128, "ipv6"], ["fc00::", 7, "ipv6"],
	["fe80::", 10, "ipv6"], ["ff00::", 8, "ipv6"], ["2001:db8::", 32, "ipv6"], ["::ffff:0:0", 96, "ipv6"],
]) (family === "ipv4" ? blockedIpv4 : blockedIpv6).addSubnet(network, prefix, family);

export const isPublicIp = (value) => {
	const version = isIP(String(value || "").trim());
	if (!version) return false;
	return !(version === 4 ? blockedIpv4.check(String(value).trim(), "ipv4") : blockedIpv6.check(String(value).trim(), "ipv6"));
};

export const normalizeDomain = (value) => {
	let raw = String(value || "").trim().toLowerCase();
	if (!raw) return null;
	if (/^https?:\/\//i.test(raw)) {
		try { raw = new URL(raw).hostname; } catch { return null; }
	}
	raw = raw.replace(/^\*\./, "").replace(/\.$/, "");
	const ascii = domainToASCII(raw);
	if (!ascii || ascii.length > 253 || isIP(ascii)) return null;
	const labels = ascii.split(".");
	if (labels.length < 2 || labels.some((label) => !label || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label))) return null;
	return ascii;
};

const fetchJson = async (url) => {
	const response = await fetch(url, {
		headers: { Accept: "application/rdap+json, application/json", "User-Agent": USER_AGENT },
		signal: AbortSignal.timeout(TIMEOUT_MS),
	});
	if (!response.ok) throw new Error(`lookup service returned HTTP ${response.status}`);
	const announced = Number(response.headers.get("content-length") || 0);
	if (announced > 2 * 1024 * 1024) throw new Error("lookup result is too large; use a more specific target");
	const chunks = []; let total = 0; const reader = response.body?.getReader();
	if (!reader) return response.json();
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > 2 * 1024 * 1024) { await reader.cancel(); throw new Error("lookup result is too large; use a more specific target"); }
		chunks.push(Buffer.from(value));
	}
	return JSON.parse(Buffer.concat(chunks).toString("utf8"));
};

const eventDate = (data, names) => data?.events?.find((event) => names.includes(event.eventAction))?.eventDate || null;
const entityName = (data, role) => {
	const entity = data?.entities?.find((entry) => entry.roles?.includes(role));
	const card = entity?.vcardArray?.[1];
	return card?.find((row) => row[0] === "fn")?.[3] || entity?.handle || null;
};

export const domainRdap = async (rawDomain) => {
	const domain = normalizeDomain(rawDomain);
	if (!domain) throw new Error("enter a valid public domain, for example example.com");
	const data = await fetchJson(`https://rdap.org/domain/${encodeURIComponent(domain)}`);
	return {
		domain: data.ldhName || domain,
		registrar: entityName(data, "registrar"),
		registered: eventDate(data, ["registration"]),
		expires: eventDate(data, ["expiration"]),
		updated: eventDate(data, ["last changed", "last update of RDAP database"]),
		status: (data.status || []).slice(0, 8),
		nameservers: (data.nameservers || []).map((entry) => entry.ldhName).filter(Boolean).slice(0, 8),
	};
};

export const ipRdap = async (rawIp) => {
	const ip = String(rawIp || "").trim();
	if (!isPublicIp(ip)) throw new Error("enter a public IPv4 or IPv6 address; private and reserved ranges are blocked");
	const data = await fetchJson(`https://rdap.org/ip/${encodeURIComponent(ip)}`);
	return {
		query: ip,
		name: data.name || data.handle || null,
		range: [data.startAddress, data.endAddress].filter(Boolean).join(" – "),
		country: data.country || null,
		owner: entityName(data, "registrant") || entityName(data, "administrative") || null,
		status: (data.status || []).slice(0, 6),
	};
};

export const asnRdap = async (rawAsn) => {
	const match = String(rawAsn || "").trim().match(/^(?:AS)?(\d{1,10})$/i);
	const asn = match ? Number(match[1]) : 0;
	if (!Number.isSafeInteger(asn) || asn < 1 || asn > 4_294_967_295) throw new Error("enter a valid ASN, for example AS13335");
	const data = await fetchJson(`https://rdap.org/autnum/${asn}`);
	return {
		asn,
		name: data.name || data.handle || null,
		range: [data.startAutnum, data.endAutnum].filter((value) => value !== undefined).join(" – "),
		country: data.country || null,
		owner: entityName(data, "registrant") || entityName(data, "administrative") || null,
		status: (data.status || []).slice(0, 6),
	};
};

const DNS_TYPES = new Set(["A", "AAAA", "CNAME", "MX", "NS", "TXT", "SOA", "CAA", "SRV"]);

export const dnsLookup = async (rawDomain, rawType = "A") => {
	const domain = normalizeDomain(rawDomain);
	const type = String(rawType || "A").toUpperCase();
	if (!domain) throw new Error("enter a valid public domain");
	if (!DNS_TYPES.has(type)) throw new Error(`supported DNS types: ${[...DNS_TYPES].join(", ")}`);
	const records = await dns.resolve(domain, type);
	return { domain, type, records: records.slice(0, 20) };
};

export const reverseDns = async (rawIp) => {
	const ip = String(rawIp || "").trim();
	if (!isPublicIp(ip)) throw new Error("enter a public IP address; private and reserved ranges are blocked");
	return { ip, hostnames: (await dns.reverse(ip)).slice(0, 12) };
};

export const emailSecurity = async (rawDomain) => {
	const domain = normalizeDomain(rawDomain);
	if (!domain) throw new Error("enter a valid email domain, for example example.com");
	const settle = (promise) => promise.catch(() => []);
	const [mx, txt, dmarc] = await Promise.all([
		settle(dns.resolveMx(domain)),
		settle(dns.resolveTxt(domain)),
		settle(dns.resolveTxt(`_dmarc.${domain}`)),
	]);
	const flat = (rows) => rows.map((row) => Array.isArray(row) ? row.join("") : String(row));
	return {
		domain,
		mx: mx.sort((a, b) => a.priority - b.priority).slice(0, 8),
		spf: flat(txt).find((row) => /^v=spf1\b/i.test(row)) || null,
		dmarc: flat(dmarc).find((row) => /^v=dmarc1\b/i.test(row)) || null,
	};
};

const resolvePublicHost = async (domain) => {
	const addresses = await dns.lookup(domain, { all: true, verbatim: true });
	if (!addresses.length || addresses.some(({ address }) => !isPublicIp(address))) throw new Error("the host resolves to a private, reserved or unavailable address");
	return addresses[0];
};

export const tlsCertificate = async (rawDomain) => {
	const domain = normalizeDomain(rawDomain);
	if (!domain) throw new Error("enter a valid public domain");
	const { address } = await resolvePublicHost(domain);
	return new Promise((resolve, reject) => {
		const socket = tls.connect({ host: address, port: 443, servername: domain, rejectUnauthorized: false });
		const timer = setTimeout(() => socket.destroy(new Error("TLS lookup timed out")), TIMEOUT_MS);
		socket.once("secureConnect", () => {
			const certificate = socket.getPeerCertificate();
			const result = {
				domain, authorized: socket.authorized, authorizationError: socket.authorizationError || null,
				protocol: socket.getProtocol(), cipher: socket.getCipher()?.name || null,
				subject: certificate.subject?.CN || null, issuer: certificate.issuer?.CN || null,
				validFrom: certificate.valid_from || null, validTo: certificate.valid_to || null,
				fingerprint256: certificate.fingerprint256 || null,
			};
			clearTimeout(timer); socket.end(); resolve(result);
		});
		socket.once("error", (error) => { clearTimeout(timer); reject(error); });
	});
};

export const httpsHeaders = async (rawDomain) => {
	const domain = normalizeDomain(rawDomain);
	if (!domain) throw new Error("enter a valid public domain");
	const { address } = await resolvePublicHost(domain);
	return new Promise((resolve, reject) => {
		const request = https.request({
			host: address, port: 443, path: "/", method: "HEAD", servername: domain,
			headers: { Host: domain, "User-Agent": USER_AGENT, Accept: "*/*" },
			rejectUnauthorized: true, timeout: TIMEOUT_MS,
		}, (response) => {
			response.resume();
			resolve({ domain, status: response.statusCode, headers: response.headers });
		});
		request.once("timeout", () => request.destroy(new Error("HTTPS header lookup timed out")));
		request.once("error", reject);
		request.end();
	});
};

export const certificateNames = async (rawDomain) => {
	const domain = normalizeDomain(rawDomain);
	if (!domain) throw new Error("enter a valid public domain");
	const data = await fetchJson(`https://crt.sh/?q=${encodeURIComponent(`%.${domain}`)}&output=json`);
	const names = new Set();
	for (const entry of Array.isArray(data) ? data : []) {
		for (let name of String(entry.name_value || "").split(/\s+/)) {
			name = name.toLowerCase().replace(/^\*\./, "").replace(/\.$/, "");
			if ((name === domain || name.endsWith(`.${domain}`)) && normalizeDomain(name)) names.add(name);
			if (names.size >= 20) break;
		}
		if (names.size >= 20) break;
	}
	return { domain, names: [...names].sort() };
};

export const identifyHash = (rawValue) => {
	const value = String(rawValue || "").trim();
	if (/^[a-f0-9]{32}$/i.test(value)) return ["MD5", "MD4", "NTLM (length-compatible only)"];
	if (/^[a-f0-9]{40}$/i.test(value)) return ["SHA-1", "RIPEMD-160"];
	if (/^[a-f0-9]{56}$/i.test(value)) return ["SHA-224"];
	if (/^[a-f0-9]{64}$/i.test(value)) return ["SHA-256", "BLAKE2s"];
	if (/^[a-f0-9]{96}$/i.test(value)) return ["SHA-384"];
	if (/^[a-f0-9]{128}$/i.test(value)) return ["SHA-512", "BLAKE2b"];
	if (/^\$2[aby]\$\d{2}\$/.test(value)) return ["bcrypt"];
	if (/^\$argon2(?:id|i|d)\$/.test(value)) return ["Argon2"];
	if (/^\$[156]\$/.test(value)) return [value.startsWith("$1$") ? "md5crypt" : value.startsWith("$5$") ? "sha256crypt" : "sha512crypt"];
	return [];
};

const lookupUsage = new Map();
export const claimOsintQuota = (memberJid, now = Date.now()) => {
	const key = String(memberJid || "unknown");
	const current = lookupUsage.get(key);
	if (!current || now - current.startedAt >= 10 * 60_000) {
		lookupUsage.set(key, { startedAt: now, count: 1 });
		return { allowed: true, remaining: 7 };
	}
	if (current.count >= 8) return { allowed: false, retryAfterSeconds: Math.ceil((current.startedAt + 10 * 60_000 - now) / 1000) };
	current.count += 1;
	return { allowed: true, remaining: 8 - current.count };
};
