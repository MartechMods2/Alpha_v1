# Alpha Remote Customer Pairing and Media Guide

## Architecture decision

Use one deployment, MongoDB database and WhatsApp number per customer. Alpha intentionally does not run unrelated customer sessions inside Martech's existing process. This prevents one customer's logout, abuse, session corruption or database access from affecting everyone else.

The public pairing endpoint now requires a one-time invitation. The token is held only as a SHA-256 digest in process memory, expires after 15 minutes, works once and cannot be created unless the administrator is authenticated. The dashboard password and MongoDB credentials are never shared with the customer.

## Martech: prepare a customer deployment

1. Create a separate MongoDB database/user for the customer.
2. Create a new Render web service from `MartechMods2/Alpha_v1`.
3. Add a unique `ADMIN_PASSWORD` and `SESSION_SECRET`.
4. Set `MY_NUMBER` and `MARTECH_OWNER_NUMBER` to Martech if you will manage the service, or to the customer only if the contract transfers administrative control.
5. Set `BOT_NUMBER` to the number the customer will pair.
6. Set `HOST_URL` to the exact public HTTPS Render URL.
7. Deploy and open `/admin`.
8. Log in and open **Health → Remote Pairing Invitation**.
9. Click **Create One-Time Pairing Link** and send only that link to the customer privately.

Never give the customer the admin password, database URI, session collection, API secrets or another customer's pairing link.

## Customer: link WhatsApp remotely

1. Open the private invitation link within 15 minutes.
2. Enter the intended WhatsApp number. Nigerian formats such as `08031234567`, `2348031234567` and `+234 803 123 4567` are accepted. Other countries should use `+country-code`.
3. Copy the displayed pairing code.
4. In WhatsApp, open **Settings → Linked devices → Link a device → Link with phone number instead**.
5. Enter the pairing code.
6. Wait for Martech to confirm that `/api/status` reports connected.

If the link expires or is used once, Martech must create another. Do not send pairing codes, session IDs or OTPs in a WhatsApp group.

## Important limitation

A linked-device session gives the deployment the ability to act as that WhatsApp account. It is not a normal low-privilege customer login. Pair only a dedicated bot number whose owner has explicitly consented. Baileys is unofficial, so account restrictions and protocol changes remain possible. Never promise an unbannable or permanent connection.

## Direct music and media

`song` and `play` now search Alpha's provider-authorized/open sources before attempting YouTube:

1. Audius artist-authorized streams
2. Audiomack official partner streams, when credentials exist
3. Jamendo licensed downloads, when configured
4. Internet Archive files with licence metadata
5. Apple Music official previews
6. Deezer official previews
7. YouTube only as a last-resort fallback

Examples:

```text
$song Asake - Forgiveness
$play Burna Boy - City Boys
$songdoc Tems - Free Mind
$naijasong Davido - Feel
$musicfrom audius Artist - Title
$songpreview Wizkid - Essence
$musicvideo Nigerian Afrobeats
$lyrics Asake - Lonely At The Top
$mediasources
$mediatest Asake - Forgiveness
```

Only sources that provide an authorized stream, licensed file or official preview are sent. Spotify/Audiomack/Apple/Deezer catalogue links are not silently converted into pirated MP3 files. Unofficial rotating downloader proxies are not trusted because they frequently disappear, inject bot-protection pages, lack stable terms and still depend on YouTube behind the scenes.

## Minimum customer environment

```env
PREFIX=$
MY_NUMBER=2348140893169
MARTECH_OWNER_NUMBER=2348140893169
BOT_NUMBER=2348XXXXXXXXX
MONGODB_KEY=mongodb+srv://CUSTOMER_USER:CUSTOMER_PASSWORD@cluster/customer_db
ADMIN_PASSWORD=unique-long-random-password
SESSION_SECRET=another-unique-long-random-secret
HOST_URL=https://customer-alpha.onrender.com
BOT_TIMEZONE=Africa/Lagos

# Optional licensed/open media providers
AUDIUS_API_KEY=
AUDIOMACK_CONSUMER_KEY=
AUDIOMACK_CONSUMER_SECRET=
JAMENDO_CLIENT_ID=
LASTFM_API_KEY=
GENIUS_ACCESS_TOKEN=
PEXELS_API_KEY=
```

Start with Audius and the keyless Apple, Deezer, Internet Archive, LRCLIB, MusicBrainz and Wikimedia providers. Add Audiomack only after official partner credentials are issued.
