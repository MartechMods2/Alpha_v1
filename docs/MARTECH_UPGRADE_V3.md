# Alpha by Martech — Global Phone, Direct Media and Utility Upgrade

Alpha is created and maintained by **Martech**. The official repository is `MartechMods2/Alpha_v1`. Third-party dependency names and licence notices remain where legally required; they do not represent the bot's public creator identity.

## Truecaller and phone formats

Set this on Render:

```env
TRUECALLER_DEFAULT_COUNTRY=NG
```

Commands:

```text
$true 0808 510 9399
$true +234 808 510 9399
$true 2348085109399
$true +233241234567
$true +919876543210
$true GB 02071838750
$true US 4155552671
$numberformat +234 808 510 9399
$countrycode +233241234567
```

`$true @member` and replying to a member are supported when WhatsApp exposes a PN/LID mapping. If WhatsApp deliberately withholds a tagged member's phone-number alias, type the number directly. Spaces, dashes and brackets are removed safely.

## Direct music and media

Start with:

```text
$mediasources
$mediatest Asake - Forgiveness
```

`$mediasources` shows whether a provider is `LINKED`, `READY — no key required`, `NOT LINKED`, or `RESTRICTED — safely skipped`. `$mediatest` makes a small live request to each usable music provider and reports whether it responds and whether it found the requested track.

### Automatic music routing

```text
$musicdirect Artist - Song
$streammusic Artist - Song
$naijasong Asake - Forgiveness
$afrobeats Rema - Calm Down
$gospelsong Mercy Chinwo - Excess Love
```

Alpha tries safe sources in this order:

1. Audius permitted artist stream
2. Audiomack only when official partner credentials exist
3. Jamendo licensed stream/download
4. Internet Archive open media
5. Apple Music Nigeria official preview
6. Deezer official preview

### Choose one provider

```text
$musicfrom audius Artist - Song
$musicfrom jamendo Artist - Song
$musicfrom apple Artist - Song
$musicfrom deezer Artist - Song
$musicfrom audiomack Artist - Song
```

Audiomack remains unavailable until Audiomack supplies official partner credentials. Alpha never scrapes it.

### Other media commands

```text
$previewaudio Artist - Song
$songlink Artist - Song
$trackinfo Artist - Song
$lyrics Artist - Song
$syncedlyrics Artist - Song
$musicvideo Artist - Song
$stockvideo Lagos city
$albumart Artist - Album
$naijacharts
```

Commercial songs are sent in full only when a provider explicitly permits streaming or downloading. Otherwise Alpha sends a labelled official preview or catalogue link. This avoids copyright abuse and reduces WhatsApp-account risk.

## New Martech utility commands

### Phone tools

```text
$numberformat 08085109399
$phoneformat +234 808 510 9399
$countrycode +14155552671
```

### Text analysis

```text
$textstats Your long text
$readestimate Your article
$linecount First line
Second line
$wordfreq paste your text here
$dedupe apple
apple
orange
$linesort zebra
apple
banana
$reversewords Alpha is very useful
$palindrome Never odd or even
$anagramcheck listen | silent
```

### Text formatting

```text
$smarttitle alpha whatsapp community bot
$sentencecase ALPHA WHATSAPP COMMUNITY BOT
$camelcase alpha whatsapp bot
$snakecase alpha whatsapp bot
$kebabcase alpha whatsapp bot
$webslug My New Community Event
```

### Everyday calculations

```text
$percentchange 200 250
$discountcalc 15000 10
$profitcalc 12000 15000
$vatcalc 25000 7.5
$daysbetween 2026-09-01 2026-12-25
$agecalc 2005-06-15
$weeknumber
$datetime
$datetime 2026-12-25
$unixdate 1798156800
```

### Decisions and group organisation

```text
$choicepick rice | beans | yam
$shufflelist Ada | Musa | Tunde | Chioma
$randomteams 2 Ada | Musa | Tunde | Chioma
$tosscoin
```

### Developer utilities

```text
$newuuid
$jsoncheck {"name":"Alpha"}
$percentencode Alpha bot by Martech
$percentdecode Alpha%20bot%20by%20Martech
$b64encode Alpha
$b64decode QWxwaGE=
$texthash Alpha
$md5text Alpha
```

Inputs are bounded to prevent oversized replies. These tools do not run shell commands, scan devices, recover passwords or transmit content to external AI services.

## Creator branding changes

- Dashboard and legacy web page: `Alpha by Martech`
- `-dev`: creator Martech and official GitHub repository
- Help menu footer: Martech ownership
- Sticker metadata: pack `Alpha`, author `Martech`
- Runtime banner and alive response: Alpha by Martech
- Package and deployment metadata: `MartechMods2/Alpha_v1`
- Previous donation link and unrelated public creator details removed
- Previous legacy-facing names replaced with Alpha by Martech branding

Legacy third-party package references remain only where required to install dependencies or satisfy their licences.
