# Safe Complete Feature Pack

This pack adds the useful missing capabilities from the feature audit while
excluding or redesigning behavior that can create WhatsApp account risk. The
default prefix is `-`; replace it if `PREFIX` is different.

## Account-safety rules

- No bulk DMs, unsolicited outreach, status auto-viewing or status reactions.
- No anti-delete or view-once recovery.
- No automatic mass removal. Anti-raid temporarily locks the group and alerts admins.
- Automated posts and polls are opt-in and limited to one active item of each type per group.
- Dashboard broadcasts require 1–3 explicitly selected groups and have a one-hour cooldown; all-group broadcast is disabled.
- Message filters stop after ten deletions per minute in a group and rate-limit notices.
- AI moderation is advisory only. An administrator makes the decision.
- Coins are virtual cosmetics only: no cash-out, paid purchases, betting or gambling.
- Indexed files store message references and metadata, not private document contents.

Use `-safepackhelp` for a short guide inside WhatsApp.

## Moderation and member safety (admin/helper)

| Command | Usage and example |
|---|---|
| `-antiraid` | `-antiraid on 8 60` locks for ten minutes after 8 joins in 60 seconds. `-antiraid off` disables it. It never mass-kicks. |
| `-slowmode` | `-slowmode 30s`, `-slowmode 5m`, `-slowmode off`. Muted/admin/owner protections still apply. |
| `-lockdown` | `-lockdown 10m raid review` temporarily makes the group admin-only. Maximum 24 hours. |
| `-unlock` | Reopens a bot-managed lockdown immediately. |
| `-grouphours` | `-grouphours 22:00 07:00` or `-grouphours off`. Uses `BOT_TIMEZONE`. |
| `-warnexpiry` | `-warnexpiry 30d`, `-warnexpiry off`, or `-warnexpiry status`. |
| `-appeal` | Member: `-appeal I believe warning 2 was a mistake`. One review item is created. |
| `-appeals` | Lists pending appeals for admins. |
| `-resolveappeal` | `-resolveappeal 1 approve warning removed` or `-resolveappeal 1 reject evidence confirmed`. |
| `-modcase` | `-modcase @member repeated disruption` records an auditable manual case. |
| `-modlog` | Shows recent moderation audit events. |
| `-wordfilter` | `-wordfilter on`, `-wordfilter add blocked phrase`, `-wordfilter remove 1`, `-wordfilter off`. |
| `-mentionlimit` | `-mentionlimit 5` or `-mentionlimit off`. Range: 2–20 mentions per message. |
| `-medialimit` | `-medialimit 4` or `-medialimit off`. Range: 2–20 media posts/member/minute. |
| `-probation` | `-probation 24h` blocks new members' commands and risky links during probation; normal chat remains allowed. |
| `-joinrequests` | Lists WhatsApp's pending group join requests. |
| `-approvejoin` | After listing, use `-approvejoin 1`. |
| `-rejectjoin` | After listing, use `-rejectjoin 1`. |
| `-inactive` | `-inactive 30d` reports members with no recorded activity; it does not remove them. |
| `-roleperms` | `-roleperms add @member`, `-roleperms remove @member`, `-roleperms list`. Helpers get safe admin commands, never owner commands. |

The existing `-antistatus`, `-mute`, `-unmute`, `-mutelist` and Alpha access
filter remain available and work before commands, games and AI processing.

## Scheduling and automation (admin/helper)

| Command | Usage and example |
|---|---|
| `-schedulepost` | `-schedulepost add 20:00 once | Meeting starts now`; repeat can be `once`, `daily`, or `weekly`. `-schedulepost list`; `-schedulepost cancel 1`. One active post/group. |
| `-schedulepoll` | `-schedulepoll add 18:00 weekly | Best game?; Quiz; TTT; Connect Four`. One active poll/group. |
| `-eventrepeat` | `-eventrepeat add Friday 20:00 | Weekly Game Night`; `-eventrepeat list`; `-eventrepeat remove 1`. |
| `-dutyrotate` | `-dutyrotate add Clean-up @Ada @Tunde`; `-dutyrotate list`; `-dutyrotate remove 1`. Announces one person weekly. |
| `-attendancesession` | `-attendancesession open Chemistry Class`, `-attendancesession status`, `-attendancesession close`. |
| `-attendanceexport` | `-attendanceexport 1` sends the chosen session as CSV. |
| `-botlang` | `-botlang en`, `yo`, `ig`, `ha`, or `pcm`; `-botlang status`. Stores the group's preferred bot language. |
| `-smartfaqadmin` | `-smartfaqadmin on`, `off`, or `status`. Uses approved FAQ entries only. |
| `-workflow` | `-workflow add suggestion -> admin review queue`; `-workflow list`; `-workflow remove 1`. Informational approval routes never punish automatically. |
| `-gamenight` | `-gamenight Friday 20:00`, `-gamenight status`, `-gamenight off`. One weekly announcement. |

Persistent scheduling uses a MongoDB delivery claim, so restarts and multiple
instances do not intentionally send the same scheduled item twice.

## Productivity and community

| Command | Usage and example |
|---|---|
| `-remindplus` | `-remindplus 30d Renew subscription`; `-remindplus list`. Supports up to one year. |
| `-snooze` | `-snooze 1 2h`. |
| `-reschedule` | `-reschedule 1 7d`. |
| `-taskassign` | Admin: `-taskassign add @member Finish notes | 2026-09-10`; member: `-taskassign done 1`; anyone: `-taskassign list`. |
| `-form` | `-form add Event feedback | What worked? | What should change?`; `-form list`. |
| `-formanswer` | `-formanswer 1 Great venue | Start earlier`. Answers are separated by `|`. |
| `-formresults` | Admin: `-formresults 1`. |
| `-slots` | Admin: `-slots add Friday 14:00`; anyone: `-slots`. |
| `-bookslot` | `-bookslot 1` books an available slot. |
| `-fileindex` | Reply to a document: `-fileindex Project Constitution`. Stores only its reference and metadata. |
| `-filesearch` | `-filesearch constitution`. |
| `-smartfaq` | `-smartfaq What time is the meeting?` searches admin-approved FAQ content locally. |
| `-configexport` | Admin: exports this group's non-secret configuration. No messages, mute lists, warnings or member records. |
| `-privacydata` | `-privacydata status`, `-privacydata export`, `-privacydata delete confirm`. Deletion preserves required moderation audit records. |

## Local document and media studio

Reply to the relevant image, document, audio or video unless stated otherwise.

| Command | Usage and example |
|---|---|
| `-ocr` | Reply to an image to extract text locally with Tesseract. |
| `-qr` | `-qr https://example.com` creates a QR code locally. |
| `-readqr` | Reply to a QR image to decode it locally. |
| `-img2pdf` | Reply to an image to create a PDF. |
| `-pdf2img` | Reply to a PDF; returns the first page as an image. |
| `-pdfmerge` | `-pdfmerge start`; reply to 2–5 PDFs with `-pdfmerge add`; finish with `-pdfmerge done`. |
| `-pdfsplit` | Reply to a PDF with `-pdfsplit 3` to extract page 3. |
| `-pdfcompress` | Reply to a PDF; Ghostscript performs safe local compression. |
| `-fileinfo` | Reports filename, MIME type, size and checksum. |
| `-filescan` | Runs ClamAV when installed; otherwise reports that malware scanning is unavailable instead of claiming a clean result. |
| `-cleanmedia` | Reply to an image to remove EXIF metadata and re-encode it. |
| `-album` | `-album start`; reply to 2–5 images with `-album add`; finish with `-album done Trip photos`. Uses WhatsApp's native album structure. |
| `-transcribe` | Reply to a short voice note. Requires Gemini. |
| `-voicesummary` | Reply to a short voice note for transcript plus concise summary. Requires Gemini. |
| `-voicetranslate` | Reply to audio with `-voicetranslate Yoruba`. Requires Gemini. |
| `-autocaption` | Reply to an image/video for an accessibility caption. Requires Gemini. |
| `-actionstyle` | Admin: `-actionstyle human` uses realistic fictional adult scenes; `-actionstyle anime` uses the original anime art. |

Human action mode includes local premium assets for slap, punch/beat, kick,
hug, laugh and dance. Related action commands reuse the closest appropriate
scene, add the two tagged names and produce a WhatsApp WebP sticker. The people
are fictional adults and the comedic conflict scenes show no injury.

## Strategy games and seasons

| Command | Usage and example |
|---|---|
| `-ttt` | `-ttt @member` starts Tic-Tac-Toe. |
| `-tttmove` | `-tttmove 5` chooses a square from 1–9. |
| `-connect4` | `-connect4 @member` starts Connect Four. |
| `-drop` | `-drop 4` drops into column 1–7. |
| `-tournament` | `-tournament create Friday Cup`; members use `-tournament join`; creator/admin uses `-tournament start`; `-tournament status`. Maximum 16 players. |
| `-familyfeud` | Starts an available Family Feud question. |
| `-feudanswer` | `-feudanswer family`. |
| `-quizbank` | Admin: `-quizbank add Capital of Nigeria? | Abuja`; `-quizbank list`; `-quizbank remove 1`. |
| `-season` | Admin: `-season start August League`, `-season status`, `-season end`. |
| `-seasonhistory` | Shows stored season champions/history. |

## Virtual-only economy

| Command | Usage and example |
|---|---|
| `-wallet` | Shows coins. |
| `-dailycoins` | Claims the daily 50 virtual coins once per Lagos calendar day. |
| `-shop` | Lists cosmetic titles/badges. |
| `-buy` | `-buy 1` purchases a cosmetic with virtual coins. |
| `-inventory` | Lists owned cosmetics. |
| `-giftcoins` | `-giftcoins @member 50`; balance is checked. |
| `-richlist` | Group virtual-coin leaderboard. |

These coins cannot be bought, withdrawn, wagered or exchanged for money.

## AI, privacy and fact checking (admin/helper)

| Command | Usage and example |
|---|---|
| `-aiproviders` | Shows NVIDIA/Gemini availability and provider fallback health. Never prints keys. |
| `-aibudget` | `-aibudget 20`, range 1–100 requests/member/day; `-aibudget status`. |
| `-aiprivacy` | `-aiprivacy on` redacts common emails/phone numbers before Safe AI calls; `-aiprivacy status`. On by default. |
| `-webfactcheck` | `-webfactcheck The claim to verify`. Requires `FACTCHECK_API_URL`; otherwise refuses rather than inventing sources. |
| `-smartminutes` | Summarizes the most recent completed meeting notes using configured AI. |
| `-modassist` | Reply to a message; produces a conservative advisory suggestion only. Never removes, mutes or warns automatically. |

Normal Alpha text calls try NVIDIA first and Gemini second. If neither key is
configured, the command reports that no provider is available.

## Reliability commands (bot owner only)

| Command | Usage and example |
|---|---|
| `-backup` | `-backup now` creates a gzip-compressed AES-256-GCM encrypted MongoDB backup. Optional S3-compatible upload. |
| `-backupstatus` | Shows latest run and whether encryption/off-site storage is configured. |
| `-restorecheck` | `-restorecheck <filename>` decrypts and validates structure without overwriting the database. |
| `-storagehealth` | Checks S3-compatible configuration without exposing credentials. |
| `-webhookadmin` | Reports signed-webhook configuration and allowed operational events. |
| `-queuestatus` | Shows queued chats and active sends. |
| `-errorstatus` | Shows recent persisted send failures. |
| `-migrationstatus` | Shows Safe Pack collection/index readiness. |

The Dashboard's **Safe Pack** page provides the same operational overview in a
read-only interface. GitHub CI runs syntax checks, unit tests and a production
dashboard build; CodeQL and Dependabot provide continuing security maintenance.

The old `-broadcast`/`-bb` all-group command now explains the safer alternatives
instead of sending. The Dashboard has no “all groups” selector. The older +91
country toggle now alerts admins about outside-country joiners without removing
anyone automatically.

## Optional environment variables

```env
BOT_TIMEZONE=Africa/Lagos
NVIDIA_API_KEY=
NVIDIA_AI_MODEL=openai/gpt-oss-20b
GOOGLE_API_KEY=
GEMINI_TEXT_MODEL=gemini-2.0-flash
GEMINI_MEDIA_MODEL=gemini-2.0-flash

BACKUP_ENCRYPTION_KEY=
BACKUP_RETENTION_COUNT=7
AUTO_BACKUP_ENABLED=false

S3_ENDPOINT=
S3_BUCKET=
S3_REGION=auto
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=

OUTBOUND_WEBHOOK_URL=
OUTBOUND_WEBHOOK_SECRET=
FACTCHECK_API_URL=
FACTCHECK_API_KEY=
```

Do not commit real keys. Normal moderation, scheduling, games, QR/PDF tools and
virtual coins work without new external API keys.

## Deliberately excluded

The following were not added because they are privacy-invasive, abuse-prone or
likely to increase account risk:

- bulk DMs, bulk group creation and unsolicited welcome DMs;
- status auto-view, auto-like, status downloading or mass reactions;
- anti-delete, deleted-message reposting and view-once recovery;
- arbitrary chat-installed plugins or remote code execution;
- automatic mass kicks or AI-decided punishment;
- unlimited broadcasts, scheduled promotions or automatic replies to every message;
- real-money betting, lotteries, deposits, withdrawals or paid virtual coins.
