# Alpha by Martech — Complete Environment Variable Guide

Configure secrets only in Render **Environment** or the protected dashboard. Never paste API keys, cookies, database URLs or session tokens into WhatsApp.

## Minimum required deployment

| Variable | Required | Purpose / example |
|---|---:|---|
| `PREFIX` | Yes | Command prefix, for example `$` or `-` |
| `MY_NUMBER` | Yes | Owner WhatsApp number without `+`; comma-separate multiple owners |
| `BOT_NUMBER` | Yes | Connected bot number without `+` |
| `MONGODB_KEY` | Yes | MongoDB connection string |
| `ADMIN_PASSWORD` | Yes for dashboard | Strong dashboard password |
| `SESSION_SECRET` | Yes for dashboard | Random secret of at least 32 characters |
| `HOST_URL` | Recommended | Public service URL, such as `https://alpha.example.com` |
| `PORT` | Usually automatic | Render supplies this; local default is `8000` |
| `NODE_ENV` | Recommended | Use `production` on Render |

Generate strong secrets locally with `openssl rand -hex 32`.

## Bot behaviour

| Variable | Default | Purpose |
|---|---|---|
| `MODERATORS` | blank | Comma-separated trusted numbers without `+` |
| `SMART_DM_INTENTS` | `true` | Natural-language command recognition in private chats |
| `ALPHA_PRIVATE_CHAT` | `true` | Permit bot features in private chats |
| `ALPHA_ALLOWED_CALLERS` | blank | Optional comma-separated caller allowlist |
| `ALPHA_NOTIFY_CALLS` | `true` | Notify about incoming calls |
| `ALPHA_AUTO_REJECT_CALLS` | `false` | Automatically reject calls; keep off unless needed |
| `ALPHA_REJECT_UNKNOWN_CALLERS` | `false` | Reject callers outside allowlist; keep off by default |
| `BOT_TIMEZONE` | `Africa/Lagos` | Scheduling timezone |
| `MESSAGE_DELAY_MS` | `500` | Minimum ordinary send spacing |
| `GROUP_MESSAGE_DELAY_MS` | `900` | Group send spacing |
| `MAX_CONCURRENT_SENDS` | `2` | Bounded concurrent sends |

## AI, search and dashboard

| Variable | Purpose |
|---|---|
| `GOOGLE_API_KEY` | Gemini text/media features |
| `GEMINI_TEXT_MODEL`, `GEMINI_MEDIA_MODEL` | Optional Gemini model overrides |
| `NVIDIA_API_KEY`, `NVIDIA_AI_MODEL` | NVIDIA-hosted Alpha responses/model |
| `GOOGLE_API_KEY_SEARCH`, `SEARCH_ENGINE_KEY` | Google Custom Search API key and engine/CX |
| `FACTCHECK_API_URL`, `FACTCHECK_API_KEY` | Optional approved fact-check service |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional dashboard Google OAuth |
| `GOOGLE_ALLOWED_EMAILS` | Comma-separated OAuth email allowlist |
| `TOKEN_TTL` | Dashboard token lifetime, for example `12h` |

## Media providers

| Variable | Provider / note |
|---|---|
| `JAMENDO_CLIENT_ID` | Jamendo licensed catalogue |
| `PEXELS_API_KEY` | Pexels stock video/images |
| `AUDIUS_API_KEY`, `AUDIUS_API_SECRET` | Optional Audius application credentials |
| `AUDIOMACK_CONSUMER_KEY`, `AUDIOMACK_CONSUMER_SECRET` | Restricted official partner credentials only |
| `DEEZER_APP_ID`, `DEEZER_APP_SECRET` | Optional Deezer application |
| `LASTFM_API_KEY`, `LASTFM_SHARED_SECRET` | Last.fm metadata integration |
| `GENIUS_ACCESS_TOKEN`, `GENIUS_ACCESS_SECRET` | Genius catalogue/legacy credential |
| `DISCOGS_TOKEN` | Discogs metadata |
| `MUSICBRAINZ_USER_AGENT` | Responsible MusicBrainz application identification |
| `GIPHY_API_KEY` | Giphy search |
| `PIXABAY_API_KEY` | Pixabay media |
| `FREESOUND_API_KEY` | Freesound licensed audio |
| `REMOVE_BG_KEY` | Background removal |
| `TWITTER_BEARER_TOKEN` | X/Twitter API commands where permitted |

Apple Music previews, Deezer public previews, LRCLIB, MusicBrainz, Cover Art Archive, Wikimedia Commons, Internet Archive and some Audius searches need no private key. Full copyrighted music is not guaranteed by any free integration.

## Truecaller

| Variable | Purpose |
|---|---|
| `TRUECALLER_ID` | Truecaller installation/authorisation ID used by the current library |
| `TRUECALLER_DEFAULT_COUNTRY` | Local-number region; use `NG` for Nigeria |

`Number not found` means the format was accepted but Truecaller supplied no accessible record. It does not prove that the number is invalid. Use `$truestatus` to distinguish missing configuration from a catalogue miss.

## YouTube compatibility

| Variable | Purpose |
|---|---|
| `YTDLP_PATH` | Optional explicit `yt-dlp` executable |
| `YTDLP_AUTO_INSTALL` | Official bootstrap when allowed; default `true` |
| `YTDLP_BOOTSTRAP_DIR` | Optional writable install directory |
| `YTDLP_COOKIES` | Optional Netscape cookie path; dashboard upload is safer |
| `YTDLP_POT_PLUGIN_PATH` | Optional PO-token plugin directory |
| `YTDLP_POT_PROVIDER_HOME` | Optional provider runtime directory |
| `YTDLP_POT_PROVIDER_VERSION` | Pinned provider version, currently `1.3.2` |

Cookies and PO tokens cannot guarantee success when a deployment IP is challenged. Do not rotate accounts, evade blocks or use untrusted proxies.

## Reliability, cache, backups and storage

| Variable | Purpose |
|---|---|
| `FFMPEG_PATH` | Optional explicit FFmpeg path |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Private owner-only operational alerts |
| `USE_REDIS` | `false` for memory cache or `true` for Redis |
| `REDIS_URL` | Preferred Redis/TLS URL |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`, `REDIS_PASSWORD`, `REDIS_TLS` | Split Redis configuration |
| `BACKUP_ENCRYPTION_KEY` | Long random backup-encryption secret |
| `BACKUP_RETENTION_COUNT` | Default `7` |
| `BACKUP_INTERVAL_HOURS` | Default `24` |
| `AUTO_BACKUP_ENABLED` | Default `false` |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION` | S3/R2/MinIO/Backblaze destination |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Storage credentials |
| `OUTBOUND_WEBHOOK_URL`, `OUTBOUND_WEBHOOK_SECRET` | Allowlisted signed operational webhook |

Legacy aliases `S3_ACCESS_KEY` and `S3_SECRET_KEY` are recognised; prefer the standard names.

## Defensive Security Lab

No API key is required. All 110 commands analyse supplied input locally.

| Variable | Default | Purpose |
|---|---:|---|
| `SECURITY_TOOLS_ENABLED` | `true` | Master switch |
| `SECURITY_MAX_INPUT_CHARS` | `6000` | Input maximum, hard-capped at 12,000 |
| `SECURITY_RATE_LIMIT` | `12` | Per-member checks per window |
| `SECURITY_RATE_WINDOW_MS` | `600000` | Ten-minute window |

## Platform variables

`HOME`, `USERPROFILE`, `HTTP_PROXY`, `HTTPS_PROXY` and `ALL_PROXY` are runtime variables. Do not configure proxies to bypass provider restrictions.

## Recommended Render starter set

```env
PREFIX=$
MY_NUMBER=2348XXXXXXXXX
BOT_NUMBER=2348XXXXXXXXX
MODERATORS=2348XXXXXXXXX
MONGODB_KEY=mongodb+srv://...
NODE_ENV=production
HOST_URL=https://your-service.onrender.com
ADMIN_PASSWORD=use-a-long-unique-password
SESSION_SECRET=generate-at-least-32-random-characters
BOT_TIMEZONE=Africa/Lagos
ALPHA_PRIVATE_CHAT=true
SMART_DM_INTENTS=true
SECURITY_TOOLS_ENABLED=true
SECURITY_MAX_INPUT_CHARS=6000
SECURITY_RATE_LIMIT=12
SECURITY_RATE_WINDOW_MS=600000
```

Add optional API variables only for features you use. Blank optional values disable their integrations cleanly.
