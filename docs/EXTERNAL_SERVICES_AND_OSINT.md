# Alpha external-service setup and passive OSINT guide

This guide separates features that work locally from features that need an API
key, account ID, cookie, database or server program. Never paste a secret into a
WhatsApp group. Store secrets in Render Environment or the protected admin
dashboard, then restart the service.

## One-command setup audit

Bot-owner commands:

```text
-setupcheck
-featurecheck
-keycheck
-cookiestatus
-downloadhealth
-ythealth
-yttest
```

These commands display only `READY`, `OPTIONAL`, `MISSING` or an invalid-cookie
reason. They never print a secret value. `-downloadhealth` and `-ythealth` are
aliases for the focused YouTube runtime report.

Use `-downloadhealth test` or `-yttest` for a live metadata-only YouTube probe.
The normal health report validates cookie syntax only; the live probe verifies
whether a safe public client or the cookie workaround is actually accepted by
YouTube. A passing probe names the successful client profile.

## Required for the bot itself

| Setting | Used by | What to provide |
|---|---|---|
| `MONGODB_KEY` | Login/session data, group settings, games and automation | MongoDB connection URI |
| `SESSION_SECRET` | Admin dashboard session protection | Long random value, preferably 32+ characters |
| `MY_NUMBER` | Owner authorization | Owner WhatsApp number with country code, digits only |
| `BOT_NUMBER` | Self-message filtering | Bot WhatsApp number with country code, digits only |
| `PREFIX` | Every command | Usually `-` |
| `ADMIN_PASSWORD` | Admin dashboard | Strong unique password |

## Optional keys, IDs and cookies

| Feature | Commands/capability | Required setting | Notes |
|---|---|---|---|
| Alpha text AI | `-alpha`, tagged Alpha replies, AI tools | `NVIDIA_API_KEY` **or** `GOOGLE_API_KEY` | Both may be configured for failover |
| Gemini media understanding | Alpha image/voice/document replies, `-transcribe`, `-voicesummary`, `-voicetranslate`, `-autocaption` | `GOOGLE_API_KEY` | Uses `GEMINI_TEXT_MODEL` and `GEMINI_MEDIA_MODEL` when set |
| Google web/image search | `-search`, `-gs`, `-img` | `GOOGLE_API_KEY_SEARCH` + `SEARCH_ENGINE_KEY` | The search API key is not the same variable as the Gemini key |
| Background removal | `-removebg`, `-bg`, `-cutoutsticker`, `-replacebg`, `-passport` | `REMOVE_BG_KEY` | Normal stickers do not need this key |
| Lyrics | `-lyric`, `-l` | `GENIUS_ACCESS_SECRET` | Genius API access token |
| Twitter/X video | `-twitter`, `-tw`, `-x` | `TWITTER_BEARER_TOKEN` | X developer bearer token; API availability may depend on X's current plan |
| Truecaller | `-true`, `-truecaller` | `TRUECALLER_ID` | Legacy India-only command; privacy-sensitive and intentionally not recommended |
| Telegram owner alerts | Runtime/error alerts | `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | Optional; not needed for WhatsApp replies |
| Google dashboard login | Dashboard OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_ALLOWED_EMAILS`, `HOST_URL` | Callback URL is `<HOST_URL>/auth/google/callback` |
| Redis | Shared cache | `REDIS_URL`, or host/password fields | Optional for one bot instance |
| Encrypted backups | `-backup`, `-backupstatus` | `BACKUP_ENCRYPTION_KEY` | Use a long unique value and keep it permanently |
| Off-site backup storage | `-storagehealth`, off-site backup copy | S3 endpoint, bucket, access key and secret | Works with S3-compatible services |
| Signed outbound webhook | `-webhookadmin` | `OUTBOUND_WEBHOOK_URL` + `OUTBOUND_WEBHOOK_SECRET` | Keep disabled unless you operate the receiver |
| External fact-check service | `-webfactcheck` | `FACTCHECK_API_URL`; optional `FACTCHECK_API_KEY` | Disabled when blank so Alpha does not invent citations |

`PIN_KEY` appears in an older README example but no current command reads it.
It is not required.

## YouTube cookies

The following commands use `yt-dlp`:

```text
-song <title>
-play <title>
-songdoc <title>
-yt <YouTube URL>
-yta <YouTube URL>
-vs <search words>
```

Many public videos work with no cookie. A cookie may be required if YouTube asks
the server to sign in, applies an age check, or presents an automated challenge.
Alpha first tries a bounded set of public yt-dlp clients. This includes the
default client, an on-demand local PO-token client, Android VR, Safari HLS and
embedded clients; these are used only as compatibility fallbacks and never as
rapid or endless retries. The repository vendors the pinned BgUtils provider
1.3.2 runtime and yt-dlp plugin as a private Bun workspace, so it is available
to both native Render and Docker deployments. It launches the provider only
when a token is needed, avoiding the memory cost of a permanent sidecar
service. If all public profiles receive
an authentication challenge, the saved cookie is tried once
with the `mweb` client and a new PO token bound to that logged-in session. If the
local provider is unavailable, Alpha uses yt-dlp's `default,web_embedded`
logged-in workaround instead. Alpha never retries a rate-limited request with
another client or an account cookie.

Safest setup:

1. Use a dedicated, non-primary YouTube account with no payment information.
2. Export a Netscape-format `cookies.txt` from your own logged-in browser.
3. Confirm that the first line is exactly `# Netscape HTTP Cookie File`.
4. Open the protected Alpha dashboard and upload/paste it in **YouTube Cookies**.
5. The dashboard validates the file and retains only YouTube/Google cookie rows.
   It never displays stored cookie values again after saving.
6. Run `-downloadhealth` as the bot owner.

Do not post the file in WhatsApp, commit it to GitHub, or use another person's
cookie. Cookies grant account access and expire; refresh them only when the bot
reports that YouTube challenged the server. `YTDLP_COOKIES` may alternatively
point to a protected cookie file on a self-hosted server.

## Server programs used by local features

| Program | Features |
|---|---|
| FFmpeg | Stickers, audio and video conversion/editing |
| yt-dlp | YouTube audio/video retrieval |
| Tesseract | `-ocr` |
| qrencode | `-qr` |
| zbarimg | `-readqr` |
| img2pdf | `-img2pdf` |
| Poppler (`pdftoppm`, `pdfunite`, `pdfseparate`) | PDF image, merge and split tools |
| Ghostscript | `-pdfcompress` |
| ClamAV (`clamscan`) | Optional malware-signature stage in `-filescan` |

The project Dockerfile already installs every required program above except
ClamAV. The bot also checks configured, bundled and system `yt-dlp` locations at
startup. If all are missing, it downloads the official standalone executable to
a private temporary tools directory. Without ClamAV, `-filescan` still reports
the file type and SHA-256 but clearly says signature scanning is unavailable.

## Free passive OSINT commands

No new environment variable, paid API or browser cookie is needed.

| Command | Usage | Example |
|---|---|---|
| `-osinthelp` | Show the safe OSINT menu | `-osinthelp` |
| `-dns` / `-dig` | Query one DNS record type | `-dns example.com MX` |
| `-rdap` / `-whois` | Domain registration summary through RDAP | `-rdap example.com` |
| `-iprdap` / `-ipwhois` | Public IP allocation summary | `-iprdap 1.1.1.1` |
| `-asn` / `-asnlookup` | ASN allocation summary | `-asn AS13335` |
| `-ptr` | Reverse DNS for one public IP | `-ptr 1.1.1.1` |
| `-tls` / `-ssl` | Port 443 certificate, protocol and cipher summary | `-tls example.com` |
| `-headers` / `-webheaders` | Check common HTTPS security headers | `-headers example.com` |
| `-emailsecurity` / `-emailsec` | Check MX, SPF and DMARC records | `-emailsecurity example.com` |
| `-ctsearch` / `-certsearch` | Up to 20 names from public certificate transparency | `-ctsearch example.com` |
| `-hashid` | Identify a likely hash family without cracking it | `-hashid 5d41402abc4b2a76b9719d911017c592` |

The DNS commands provide the useful, read-only part of Kali's `dig`; RDAP is the
modern replacement for WHOIS; the TLS command provides a deliberately narrow
certificate check inspired by `sslscan`; and `hashid` performs identification
only. The bot does not shell out to Kali commands for these lookups.

## Built-in safeguards

- Eight network lookups per member per ten minutes.
- One target and one WhatsApp response per command.
- Public domains and public IP addresses only.
- Private, loopback, link-local, multicast and documentation networks blocked.
- HTTPS inspection restricted to port 443 and `/`; custom ports and paths blocked.
- Maximum 20 certificate-transparency names.
- No usernames, breach databases, phone enrichment or social-account correlation.
- No port scanning, directory brute force, vulnerability exploitation, payloads,
  credential testing, password cracking, Wi-Fi attacks or denial-of-service tools.

These controls reduce both abuse and WhatsApp traffic. They cannot remove the
general account risk of running an unofficial WhatsApp client, so keep the bot
on-demand, avoid bulk messaging and retain the existing send queue/cooldowns.

## Standards and tool references

- [ICANN: Registration Data Access Protocol](https://www.icann.org/resources/pages/rdap-operational-profile-2016-07-26-en)
- [IANA RDAP DNS bootstrap registry](https://www.iana.org/assignments/rdap-dns/rdap-dns.xhtml)
- [Node.js DNS promise API](https://nodejs.org/api/dns.html#dns-promises-api)
- [Kali `whois`](https://www.kali.org/tools/whois/)
- [Kali BIND/dig tools](https://www.kali.org/tools/bind9/)
- [Kali `sslscan`](https://www.kali.org/tools/sslscan/)
