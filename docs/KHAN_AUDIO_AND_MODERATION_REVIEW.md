# Audio downloader and moderation reliability review

## Source inspection

Reviewed pinned sources without executing their code:

- [JawadTechXD/KHAN-MD](https://github.com/JawadTechXD/KHAN-MD/tree/22cbfa094ade85b96bd9f4c219654af0ecc2abbf): obfuscated entry point; no readable downloader handler. Package declarations alone do not establish provider reliability.
- [JawadTechYT/KHAN-MD](https://github.com/JawadTechYT/KHAN-MD/tree/ca53523994aaac7853c1f69f944e9dd11913ab98): placeholder entry point; README links another deployment repository.
- [Linked KHANXMD source](https://github.com/JawadExtra/KHANXMD/tree/2ac58fa489ea5d64a5076d624f58af191a5d5174): downloader/handler remains obfuscated. Its readable lib/audioediter.js contains additional audio presets.

A direct downloader transplant is not reviewable from these sources. No KHAN runtime, obfuscated code or dependency was imported. Alpha's existing pipeline was improved independently.

### Features worth considering

Verified extra audio presets absent as named Alpha presets: nightcore, robot, radio, smooth, chipmunk and demon/deep. Alpha already offers bass, pitch, slow, fast, reverse and echo, so some effects overlap.

KHAN advertises anti-delete and anti-view-once; linked source also contains an anti-edit module. Alpha has no equivalent found in this review. Their operation was not verified from readable handlers. These features also need clear group consent and retention/privacy rules before implementation.

Alpha already has AI, games, stickers, moderation and social download/discovery tools; those are not missing-feature findings.

## Implemented audio improvements

- `$song artist - title` / `$play artist - title`: existing bounded audio downloader.
- `$yta https://youtu.be/VIDEO_ID`: now shares that pipeline and its queue/quota/cooldown controls.
- `$song artist - title --voice` or `$yta https://youtu.be/VIDEO_ID --voice`: actual mono Opus/Ogg voice-note encoding, not an MP3 mislabeled as a voice note.
- Twelve-minute, 25 MiB limits; reject live/unknown-duration YouTube inputs; require recognized audio signatures. Open providers must identify results as full-length rather than silently substituting previews.
- Preserve case-sensitive video IDs in cache keys. Clean complete per-job temporary directories on success/failure.
- yt-dlp runs without a shell, with a 120-second kill deadline and 2 MiB output cap. FFmpeg voice conversion has a 45-second deadline. Use configured FFMPEG_PATH, installed static binary when present, or system ffmpeg.

## Why warnings sometimes left the content

`utils/automod.js` previously swallowed deletion failures, skipped command-shaped messages, and supported a warning-only link mode. Other filters skipped enforcement when cached admin flags were stale. Status detection did not cover all supported group-status shapes. Removal promises could resolve with a denied status and still be counted as success.

`utils/moderationDelete.js` now centralizes supported Baileys deletion with the original outer group message key and author namespace, bounded fresh permission lookups, single-flight handling, one retry of the same key, bounded actual outstanding operations and the existing deletion circuit. Warnings explain deletion-request/failure/permissions/limits separately. Successful submission is not a guarantee of propagation to every device.

`utils/groupSafety.js` and `utils/ingestionDefense.js` recognize additional supported status shapes. `utils/moderation.js` checks participant action status before clearing strikes. `utils/safeModeration.js` consumes confirmed violations even if deletion fails, preventing forbidden content from earning Aura or triggering later expensive handlers. Moderator mute retains its existing authorized admin override; ordinary automatic moderation protects admins/owners.

### Group setup

Alpha must be a group admin. Existing stored warning-only settings are preserved. To explicitly request deletion:

```
$automod antilink on delete
$antistatus on
$automod status
```

New `$automod antilink on` activations default to deletion; explicit `on warn` remains available. If YouTube links should be allowed while anti-link is active, configure the existing allow list (`$automod allow add youtube.com` and `$automod allow add youtu.be`).

Alpha can remove the offending group mention/copy, not an author's original global WhatsApp Status. WhatsApp permissions, revoke eligibility, network health and upstream library behavior still apply. No real user/group messages were used for tests.

## Verification and rollout

Tests cover original-key safety, stale permissions, retries, duplicate and hung deletions, denied removals, command-contained links, supported status shapes, signature validation, actual FFmpeg conversion, cleanup and bounded child execution. Existing community tests now assert that failed deletion is consumed and reported rather than silently passed to downstream handlers.

Run `npm test`, `npm run check`, `npm run test:security-load` and `npm run build --workspace dashboard`. GitHub CI/CodeQL provide an independent check before merge. Deployment uses the existing workflow; merge does not itself prove that a hosting process restarted. After deployment, test in a private test group with Alpha promoted: one blocked link, one group-status mention, normal multilingual text, one short authorized audio download and one voice note. Monitor queue/timeouts and deletion notices. Roll back this PR's merge commit if needed; no database migration or dependency change is required.
