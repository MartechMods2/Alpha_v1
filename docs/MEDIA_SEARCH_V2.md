# Alpha Media Search V2

These commands work in activated groups and private one-to-one chats. They do not use YouTube, cookies, public proxies or rotating accounts.

## Commands

```text
$music Asake - Forgiveness
$naijasong Asake - Forgiveness
$afrobeats Rema - Calm Down
$gospelsong Mercy Chinwo - Excess Love
$songpreview Burna Boy - Anybody
$songlink Davido - Feel
$musicfile Artist - Song name
$musicvideo Artist - Video name
$video Search words
$videofile Search words
$lyrics Asake - Forgiveness
$syncedlyrics Tems - Free Mind
$albumart Wizkid - Essence
$musicartist Ayra Starr
$naijacharts
$trendingnaija
$newnaija
$file African drums
$mediahelp
$mediasources
```

- `$music` sends playable audio. Alpha tries a licensed full track first and may fall back to an official limited preview for commercial music.
- `$musicfile` sends the same result as a WhatsApp document.
- `$video` sends a public/licensed video or official video preview.
- `$videofile` sends it as a document.
- `$lyrics` searches by `Artist - Song name` and does not require the Genius key.
- `$syncedlyrics` returns timestamped lyrics when LRCLIB has them and safely falls back to plain lyrics.
- `$songlink` and `$musicartist` return verified catalogue/reference links without copying protected audio.
- `$albumart` uses MusicBrainz matching and Cover Art Archive.
- `$naijacharts`, `$trendingnaija` and `$newnaija` use Last.fm Nigeria discovery data.
- `$file` searches Wikimedia Commons for openly licensed images, audio, video or PDF files.
- `$mediahelp` and `$mediasources` show the media command guide.

## Optional environment variable

```env
JAMENDO_CLIENT_ID=your_free_jamendo_client_id
PEXELS_API_KEY=your_free_pexels_api_key
AUDIUS_API_KEY=your_optional_audius_api_key
AUDIUS_API_SECRET=your_optional_audius_secret
AUDIOMACK_CONSUMER_KEY=your_official_audiomack_consumer_key
AUDIOMACK_CONSUMER_SECRET=your_official_audiomack_consumer_secret
LASTFM_API_KEY=your_free_lastfm_api_key
LASTFM_SHARED_SECRET=your_lastfm_shared_secret
GENIUS_ACCESS_TOKEN=your_genius_access_token
DISCOGS_TOKEN=your_discogs_token
MUSICBRAINZ_USER_AGENT=AlphaWhatsAppBot/3.0 (https://github.com/MartechMods2/Alpha_v1)
```

Without optional keys, Alpha still uses Apple Nigeria previews, Deezer previews, LRCLIB, MusicBrainz, Cover Art Archive, Internet Archive and Wikimedia Commons. The Nigerian-first audio order is Audius, official Audiomack access, Jamendo, Internet Archive, Apple and Deezer. A complete file is sent only when the provider explicitly permits streaming or downloading; otherwise Alpha labels and sends an official preview or listening link.

## Natural requests

With smart intents enabled, members can write:

```text
Send me Nigerian song Asake - Forgiveness
Play the song Essence by Wizkid
Get lyrics for Omah Lay - Soso
Show me Burna Boy music video
```

In groups, natural requests require an explicit Alpha mention. In private chats they require `SMART_DM_INTENTS=true`.

## Provider safety

- No provider secret is displayed in chat or committed to GitHub.
- Spotify, Boomplay, Mdundo and Bandcamp pages are not scraped.
- YouTube, cookies, rotating proxies and IP-bypass services are not used by this command pack.
- Downloads remain capped at 25 MB with a per-member cooldown.
- Provider terms and artist restrictions take priority over a requested full download.

## Private chats

Save the bot number and message it directly. Public commands already work in DMs. To also enable conversational Alpha AI for non-owner private chats, configure:

```env
ALPHA_PRIVATE_CHAT=true
```

Media searches are limited to one request per member every 45 seconds and files larger than 25 MB are rejected.
