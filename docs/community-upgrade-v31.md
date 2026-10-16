# Alpha community upgrade: command guide

Use your configured prefix; examples below use `$`. Group administrators control moderation and announcements. Commands added here also appear in Alpha's generated command catalogue and dashboard Command Center.

## Bot menu and command catalogue

`$menu` shows a public bot overview, creator credit, features, available command categories, examples and permission notes. `$menu all` opens a paged catalogue with usage; request the next page with `$menu all 2`. Categories also support pages, for example `$menu public 2`. Use `$help <command>` for aliases and usage or `$help search <task>` to search. Admin and owner categories are shown only to authorized users. The menu omits credentials, owner contact details, internal diagnostics and source paths. Replies use one brand heading; redundant provider labels such as `⚡Alpha⚡` are removed.

## Quick start

1. Make Alpha a group administrator if you want message deletion.
2. Run `$welcome on` and `$goodbye on` to enable the new member cards.
3. Run `$replydesign premium` for framed headings, or `$replydesign plain` for plain text in this group.
4. Try `$everyone Welcome to our community!` for compact mentions.
5. Add a word restriction with `$ban scam phrase`. Review with `$banlist`; undo with `$unban scam phrase`.
6. Turn on sticker reactions with `$stickerreplies on`. Reply to a sticker with `$reactionadd laugh`, then approve pending contributions with `$reactionapprove <id>`.

## Presentation, members and moderation

| Command | Usage and example |
| --- | --- |
| `replydesign` | `$replydesign premium` or `$replydesign plain` — changes this group's text presentation. Headings use restrained text art; command syntax and links stay readable. |
| `welcome` | `$welcome on`, `$welcome off`, `$welcome set Hello {user}, welcome to {group}! We now have {count} members.`, `$welcome reset`. Existing custom messages appear in the new card caption. Reset disables the event. |
| `goodbye` | `$goodbye on`, `$goodbye set Goodbye {user}. Thanks for being part of {group}.`, `$goodbye off`, `$goodbye reset`. |
| `everyone`, `tag`, `hidetag`, `mentionall`, `tagall` | `$everyone Meeting starts at 8 PM` — sends mention metadata for the current member list without printing everyone's number. Group admins only. |
| `tagall list` | `$tagall list Meeting starts now` — optional visible mention list. |
| `ownerhidetag` | Owner-only legacy forwarding command, renamed so group admins can use `hidetag`. |
| `ban` | `$ban scam phrase` — restricts a literal word or phrase and enables the word filter. Alpha must be admin. This command restricts words; it does not ban a person. |
| `unban`, `banlist` | `$unban scam phrase`; `$banlist`. Matching normalizes case, spacing and common invisible characters, and uses word boundaries: `bad` does not match `badminton`. Maximum 100 phrases of 100 characters each. Admins and the owner are exempt from moderation. |
| `antibot` | `$antibot on`, `$antibot off`, `$antibot status` — enables review notices for native bot invocation messages. |
| `antibot block`, `antibot allow` | `$antibot block @account` or reply to an account's message with `$antibot block`. Confirmed blocked accounts' future messages are deleted when Alpha has admin rights. `$antibot allow @account` reverses the restriction. |
| `onboarding` | `$onboarding` — sends a getting-started guide for new group members. |

Welcome and farewell cards show the available profile photo, live member count, group name and Alpha activity rank. New members without recorded activity are Unranked. A private/missing profile photo uses a placeholder; image rendering failure falls back to text. Bursts create at most five individual cards followed by a summary for remaining members. Counts show “Unavailable” when WhatsApp metadata cannot be fetched. Farewell wording also covers members removed by admins.

**Bot detection limits:** WhatsApp provides no reliable flag identifying every third-party bot. Native bot invocation is a review signal, not proof that its sender is a bot. Alpha never mass-removes members based on message IDs, phone prefixes or activity guesses. Silent bots cannot be detected. Confirm accounts manually, remove unwanted accounts through your group controls, or block future messages with the command above. Admins remain exempt; first demote an unwanted bot that was given admin rights. Deletions also respect Alpha's existing moderation circuit limits.

**Mention limits:** all compact aliases use WhatsApp's mention metadata. Whether a member receives a notification depends on WhatsApp, client version and notification settings. This does not guarantee a notification on every device.

## Approved reaction stickers

| Command | Usage and example |
| --- | --- |
| `stickerreplies` | Admin: `$stickerreplies on` or `$stickerreplies off`. Off by default. |
| `reactionadd` | Reply to a sticker with `$reactionadd thanks`, `celebrate`, `comfort`, `laugh` or `greeting`. Submit only stickers you have permission to share. Maximum 512 KB each, 30 per group. |
| `reactionlist` | `$reactionlist` — shows full IDs, categories and approval status. |
| `reactionapprove` | Admin: `$reactionapprove <full-id>` — approves a member's contribution. Admin submissions start approved. |
| `reactiondelete` | `$reactiondelete <full-id>` — admins or the original contributor can remove an entry. |

Alpha uses actual approved stickers, including human reaction stickers you contribute. It does not silently collect everybody's stickers. Libraries stay within their originating group. Matching uses simple phrases such as “thank you”, “congratulations”, “sad”, “lol” and “hello”; it is not an emotion classifier. Eligible messages have a 10% reaction chance with at most one automatic sticker per group per ten minutes. Commands and Alpha's own messages do not trigger stickers. No matching approved sticker means no reply.

## Discovery and creative tools

| Command | Usage and example | Availability |
| --- | --- | --- |
| `githubsearch` | `$githubsearch whatsapp baileys` | Public repository search, up to five results. |
| `gitclone` | `$gitclone MartechMods2/Alpha_v1` | Sends a public repository ZIP; advertised and actual size limits apply (about 20 MB). Never executes its code. |
| `npmsearch` | `$npmsearch express rate limit` | Package search, up to five results. |
| `playstore` | `$playstore Termux` | Official Google Play links; returns a search link if the store's markup cannot be parsed. |
| `animeinfo` | `$animeinfo Naruto` | SFW catalogue search. |
| `manga` | `$manga One Piece` | SFW catalogue search. |
| `book` | `$book The Linux Command Line` | Book titles, authors and catalogue links. |
| `recipe` | `$recipe chicken` | Up to two matching recipes; instructions may be shortened. |
| `movie` | `$movie Interstellar` | Requires owner-configured movie service access. |
| `spotifysearch` | `$spotifysearch Burna Boy` | Requires owner-configured Spotify access. Metadata and official links, not full-track downloads. |
| `currency` | `$currency 100 USD NGN` | Dated indicative conversion, not a guaranteed settlement rate. |
| `football` | `$football today` or `$football Arsenal` | Owner-configured football-data.org access; today's available fixtures, optionally filtered by team name. Coverage depends on the service plan. |
| `worldclock` | `$worldclock Africa/Lagos Europe/London Asia/Tokyo` | Up to five IANA time zones. Aliases: `lagos`, `london`, `tokyo`, `newyork`. |
| `shorten` | `$shorten https://example.com/long/path` | Public HTTPS links only, through an external short-link service. |
| `screenshot` | `$screenshot https://example.com` | Public-page preview through an external screenshot service. No signed-in pages. |
| `brat` | `$brat Alpha is here` | Creates a green text sticker locally. |
| `codeimage` | `$codeimage console.log('Hello Alpha')` | Creates a code-style text image. Can also reply to text. Renders text only; never executes code. |
| `emojimix` | `$emojimix 😂+🔥` | Requires owner-configured Emoji Kitchen service access; not every pair is available. |
| `shazam` | Reply to a short audio/video clip with `$shazam` | Requires owner-configured AudD access; explicitly sends that clip to the recognition service. Limit 8 MB. |
| `audioeffect` | Reply to audio with `$audioeffect bass` | Effects: `bass`, `pitch`, `slow`, `fast`, `reverse`, `echo`. Input up to 8 MB, output limited to 60 seconds. Requires working FFmpeg. |
| `stickerimport` | `$stickerimport https://t.me/addstickers/PACK_NAME 1` | Requires owner-configured Telegram bot access. Imports the selected static WebP sticker, not an entire pack; animated/video stickers are unsupported. |
| `drivefolder` | `$drivefolder https://drive.google.com/drive/folders/FOLDER_ID` | Up to 20 file links readable from a public folder. Dynamic or private folders may not yield links. Does not request private Drive access. |

External services may impose quotas or change their interfaces. Missing credentials produce a configuration message rather than invented results. Public URL fetches reject private/reserved networks, credentials, non-HTTPS URLs and custom ports; downloads and request times are bounded. Media jobs share Alpha's existing queue and quotas. Do not submit confidential URLs or files to external preview, recognition or shortening services.

## Saved solo games

Each person has a separate saved game in each group. These are command-driven solo games, not poll lobbies.

| Game | Usage and examples |
| --- | --- |
| `2048` | `$2048 start`; `$2048 left`, `$2048 right`, `$2048 up`, `$2048 down`; `$2048 status`; `$2048 stop`. Score increases on merges; 2048 wins, an immovable board loses. |
| `minesweeper` | `$minesweeper start`; `$minesweeper open 12`; `$minesweeper status`; `$minesweeper stop`. A 5×5 board with five mines; the first opened cell is safe. Open all 20 safe cells to win. Flagging is not implemented. |
| `dungeon` | `$dungeon start`; `$dungeon explore`; `$dungeon rest`; `$dungeon status`; `$dungeon stop`. Explore ten rooms while managing HP. Gold is game-only, not money or wallet credit. |

Moves use version checks so simultaneous commands cannot silently overwrite one another. If another move wins the race, request status and retry.

## Community integrations

| Command | Usage and example |
| --- | --- |
| `topics` | `$topics join linux`; `$topics mine`; `$topics list`; `$topics leave linux`. Topic names use letters, digits and hyphens, up to 30 characters. |
| `topics notify` | Admin: `$topics notify linux New learning session tonight!` — mentions up to 100 opted-in subscribers, without a visible number list. |
| `calendarics` | `$calendarics Linux study session | 2026-11-01T15:00:00+01:00 | 2026-11-01T16:00:00+01:00` — exports a calendar invitation file. Import it into your calendar. This is not two-way Google Calendar synchronization. |
| `ledger` | `$ledger mine`. Admin: `$ledger add @member 2000 November contribution`; `$ledger all`; `$ledger settle <id>`. NGN repayment records only; marking paid does not move money or verify a transaction. |
| `feed` | Admin: `$feed add https://example.com/feed.xml`; `$feed list`; `$feed remove <id>`. |
| `monitor` | Admin: `$monitor add https://example.com`; `$monitor list`; `$monitor remove <id>`. Reports changes in Alpha's observed HTTP availability, not proof of a global outage. |
| `githubwatch` | Admin: `$githubwatch add owner/repository`; `$githubwatch list`; `$githubwatch remove <id>`. Watches the latest GitHub release, not every commit. |

Watches run every 15 minutes while Alpha is connected. Their first successful check establishes a baseline; existing history is not flooded into the group. RSS sends at most three fresh entries per check. Limits: three watches of each kind per group and 100 active watches across Alpha. Restarting/reconnecting restores polling; downtime does not replay every missed update. Remove old watches to reduce service traffic.

## Optional paid membership records

This feature is disabled until the owner configures live Paystack credentials and a valid price. It is separate from LinuxAid subscriptions. The default configured price is NGN 2,000 for a 30-day record; no automatic renewal.

Use **Alpha's private chat**, not the group:

- `$membership start <group-id> <receipt-email>` opens a Paystack checkout for a current group member.
- `$membership verify <purchase-reference>` checks the transaction server-side. Only the purchasing account can claim it. Verification requires live mode, success status, NGN, the exact server-stored amount and reference, and matching member, group and product metadata. A purchase can be credited once.
- `$membership status <group-id>` shows this account's active record and expiry.

The email is sent to Paystack for the receipt. Do not paste secret keys into WhatsApp. This implementation records membership; it does **not** gate all Alpha commands, promote users, add/remove group members, charge recurring payments or process webhooks. Do not sell access-control promises that are not implemented. Existing membership is checked before checkout/status; a purchase is bound to the sender's WhatsApp identifier.

## Remaining scope

This release does not include multi-account sub-bot hosting, parcel/carrier tracking, an automatic daily digest, a full interactive onboarding wizard or two-way calendar sync. Sub-bot hosting needs isolated authentication stores, resource limits and lifecycle controls. The simple onboarding guide, explicit topic messages, feed notifications and calendar export above are available now; they should not be advertised as those larger systems.

## Verification

Automated checks cover compact PN/LID mentions, admin-only controls, literal word matching, sticker approval/deletion permissions, member-card fallback, 2048 moves and terminal states, Minesweeper safety, strict payment binding, URL validation, and the existing Truth or Dare poll flow. External API success, actual WhatsApp notifications and real payments require deployment smoke tests; local automated tests do not establish those outcomes.
