# Alpha Media Search V2

These commands work in activated groups and private one-to-one chats. They do not use YouTube, cookies, public proxies or rotating accounts.

## Commands

```text
$music Asake - Forgiveness
$musicfile Artist - Song name
$video Artist - Video name
$videofile Search words
$lyrics Asake - Forgiveness
$file African drums
$mediahelp
$mediasources
```

- `$music` sends playable audio. Alpha tries a licensed full track first and may fall back to an official limited preview for commercial music.
- `$musicfile` sends the same result as a WhatsApp document.
- `$video` sends a public/licensed video or official video preview.
- `$videofile` sends it as a document.
- `$lyrics` searches by `Artist - Song name` and does not require the Genius key.
- `$file` searches Wikimedia Commons for openly licensed images, audio, video or PDF files.
- `$mediahelp` and `$mediasources` show the media command guide.

## Optional environment variable

```env
JAMENDO_CLIENT_ID=your_free_jamendo_client_id
PEXELS_API_KEY=your_free_pexels_api_key
```

Without these keys, Alpha still tries Internet Archive, Wikimedia Commons and official Apple previews. The Jamendo key enables its licensed music catalogue; the Pexels key enables licensed stock-video search.

## Private chats

Save the bot number and message it directly. Public commands already work in DMs. To also enable conversational Alpha AI for non-owner private chats, configure:

```env
ALPHA_PRIVATE_CHAT=true
```

Media searches are limited to one request per member every 45 seconds and files larger than 25 MB are rejected.
