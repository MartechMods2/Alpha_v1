# Alpha anti-freeze and message-ingestion hardening

Audit date: 19 October 2026. Baseline: `649f026ea203a130dd23ce084e926ce528c3f6a2`.

## Scope and actual architecture

Alpha imports **`baileys` 7.0.0-rc14**, pinned in the manifest and Bun lockfile. The installed library was inspected. This is the WhiskeySockets package, not an assumed v6 API. The reviewed upstream release is https://github.com/WhiskeySockets/Baileys/releases/tag/v7.0.0-rc14 . Authentication uses Alpha's existing MongoDB adapter and Baileys' supported signal-key cache. No authentication migration, secret rotation, automatic logout or session deletion is included.

The receipt path was: Baileys decoding/decryption → socket cache listener → event-buffer callback → parallel poll handlers → parallel passive/game/command handlers → group/member database work → AI/media/providers → outgoing send queue. A single event could start arbitrary numbers of handlers. The new path is: library decoding → bounded cache validation → bounded ingestion admission → chat-serialized poll/passive/game/command processing → existing permissions and features → bounded AI/media/send work. Connection lifecycle events bypass the chat queue.

The application runs an Express dashboard alongside the socket. Docker pins Bun 1.3.14; the user-reported native hosting runtime is Node 22.0.0. The repository already uses a frozen Bun lock in Docker. The build script now also uses a frozen lock. The test command limits test-worker concurrency to two. No production host settings or private environment values were read or changed.

## Prioritized findings and fixes

| Priority | Location / function | Finding and impact | Change |
| --- | --- | --- | --- |
| High | `core/events.js`, `events` | Unbounded `Promise.all` on upserts/updates; expensive work ran before a central validation boundary. Floods could occupy AI, DB and memory concurrently. | Maximum event batch; structural admission before poll/game/command work; bounded fair scheduler, chat serialization and token buckets. |
| High | `core/messages.js`, `getCommand` | Untrusted message serialization and quadratic unknown-command matching accepted arbitrary command lengths. Error handling logged identifiers/stacks and sent a response per failure. | Validate at the callable entry point too; bounded serialization; 64-character command-name cap; aggregate error logging and no automatic exception reply. |
| High | `utils/mediaInput.js`, `downloadResolvedMedia`; legacy media commands | Size checked after complete buffering; several callers repeatedly concatenated buffers; declared types were trusted. | Pre-download announced-size and WhatsApp/CDN-source checks, bounded stream consumption, transfer permits, deadlines, signature checks and image dimension checks. Migrated direct download callers. |
| High | `connection.js`; `core/connectionUpdate.js` | Duplicate timers, overlapping initialization, retry resets before a successful connection, and conflict sessions fighting each other. | Single-flight initialization, generation checks, one reconnect timer, capped exponential delay with jitter, eight-attempt budget, stable-open reset, and manual review for logout/replacement/invalid session. |
| High | `core/auth.js`, buffer flush / cleanup | Buffered writes were cleared before storage succeeded; cleanup did not await its flush. Concurrent updates could be lost. | Serialized snapshots, retain-on-failure, revision identity, awaited cleanup, 500-entry buffer cap, stored-record size guard, and correct null-key deletion. Existing credential storage remains intact. |
| High | `index.js`, process error handlers | Unhandled rejections only logged, uncaught failures could exit zero, shutdown could wait on open dashboard sockets and did not await auth persistence. | Idempotent controlled shutdown, stop admission/reconnects, close sockets, await persistence/HTTP cleanup, ten-second hard limit, and nonzero exit after unsafe failures. |
| High | dependency lock | Audit reported critical entries in legacy multipart and proxy address resolution, plus vulnerable Sharp native dependencies. | Exact resolutions for form-data 4.0.6, proxy-addr 2.0.8, and Sharp 0.35.5. Fresh frozen-install tests verify actual resolved versions. Other advisories remain below. |
| Medium | `queue/messageQueue.js`, `enqueue` / `pump` | Outgoing queues had no capacity bound; every waiting chat spun a timer while global sends were busy. | Global/per-chat bounds, round-robin chat scheduling, a single spacing wake-up, preserved send results, send watchdog and bounded shutdown. |
| Medium | `utils/mediaJobs.js`; `utils/safeAi.js` | Media queue had no bound; AI calls had no common concurrency cap; Gemini raced a timeout without forwarding abort to the SDK request. | Media backpressure, AI admission cap, bounded AI context and streamed response bytes, real Gemini request signal, capped retries and exponential retry delay with jitter. |
| Medium | group metadata / cache | Live and cached metadata was trusted by role helpers and renderers. | Descriptor-based validation, bounded metadata, expected participant and admin types, and a 1,024-member regression test. Role decisions still use existing helpers. |
| Medium | logs / dashboard WebSocket | Raw object serialization could leak data or fail on cyclic objects; slow dashboard clients could buffer output. | Suppress structured/error payloads, redact sensitive environment values/URLs/identifiers, isolate log subscribers, cap dashboard connections/backlog/incoming frames, disable compression, and terminate dead peers. |
| Medium | DB reads / caches | Unbounded chat history reads and settings cache growth; database operations could wait indefinitely for a usable connection. | Recent 1,000-message history cap, 1,000-entry settings cache, bounded pool/selection/socket waits. Persisted game scores and historical membership records are not deleted. |

## Input policy

Validation uses an iterative descriptor-based traversal, not recursive walking or `JSON.stringify` of arbitrary input. It rejects accessors/functions, cyclic/shared object graphs, unsafe prototype field names, oversized strings/binaries, excessive keys/nodes/depth and invalid identifiers. It copies accepted structures before dispatch. Supported message wrappers are unwrapped within the depth budget. Unsupported content is ignored. Quoted content and thumbnails count toward the same budget. Cache insertion also validates first.

Ordinary multilingual text, accents, emoji and zero-width joiners are preserved. Unpaired UTF-16 surrogates are replaced with well-formed text, and non-printing C0 controls are removed from display text. Unicode is **not** classified as malicious. Formatting/bidirectional text is not indiscriminately stripped.

Messages that exceed the event batch, a rate bucket, queue capacity, queue age or memory threshold are dropped without a chat response. This is load shedding, not delivery assurance. Small bursts of native game votes remain supported. Chat serialization prevents two commands in the same chat racing the game state. Duplicate event keys are held for ten minutes, including failures; distinct poll-state changes receive distinct bounded fingerprints. Ordinary deduplication survives socket reconnects within this process, not process restarts. Handler watchdog failures additionally write a 24-hour quarantine containing only a SHA-256 event identity and expiry, using atomic owner-readable file replacement. On a process restart, matching events are ignored. Persistence is attempted for up to two seconds before requesting shutdown; storage failure cannot guarantee quarantine. Existing persistent game-result idempotency remains in force. Generic commands do not gain a distributed exactly-once guarantee.

## Configuration

All numbers are validated; invalid, non-integral or out-of-range values fall back to safe defaults. Limits apply to the owner/admin as infrastructure protection; business permissions and AI subscription/moderator quotas remain separate.

| Variable | Default | Accepted range / meaning |
| --- | --- | --- |
| `ALPHA_INGEST_TEXT_CHARS` | 16384 | 1024–65536 UTF-16 units per display-text field |
| `ALPHA_INGEST_BYTES` | 262144 | 32768–1048576 structural byte budget, including binary fields |
| `ALPHA_INGEST_NODES` | 2048 | 128–8192 fields visited |
| `ALPHA_INGEST_DEPTH` | 12 | 6–24 object nesting levels |
| `ALPHA_INGEST_BATCH` | 128 | 8–512 messages considered per event |
| `ALPHA_INGEST_MEDIA_MB` | 32 | 1–64 MiB; upper bound for announced/downloaded attachments |
| `ALPHA_INGEST_CONCURRENCY` | 4 | 1–16 active handlers globally; one per chat |
| `ALPHA_INGEST_QUEUE` | 128 | 8–512 waiting handlers globally |
| `ALPHA_INGEST_CHAT_QUEUE` | 16 | 2–64 waiting handlers per chat |
| `ALPHA_INGEST_QUEUE_TTL_MS` | 30000 | 1000–120000; discard stale queued work before starting it |
| `ALPHA_INGEST_DEADLINE_MS` | 180000 | 1000–300000; active handler watchdog |
| `ALPHA_INGEST_SENDER_BURST` | 12 | 2–100 sender/chat tokens; sender across all chats has twice this capacity |
| `ALPHA_INGEST_CHAT_BURST` | 60 | 10–500 chat tokens |
| `ALPHA_INGEST_GLOBAL_BURST` | 200 | 20–2000 global tokens |
| `ALPHA_INGEST_WINDOW_MS` | 10000 | 1000–60000; full token refill interval |
| `ALPHA_INGEST_STATE_CAP` | 10000 | 100–50000 entries for quota identities and duplicate keys |
| `ALPHA_INGEST_DEDUP_MS` | 600000 | 60000–3600000; duplicate retention |
| `ALPHA_INGEST_QUARANTINE_FILE` | `temp/ingest-quarantine.json` | Writable regular JSON file; hashed watchdog-failure identities only, max 1,024 entries / 128 KiB. Use a persistent volume path to retain quarantine across redeploys. |
| `ALPHA_HEAP_WARN_MB` | 256 | 64–16384 MiB; warn and shed new message work above threshold |
| `ALPHA_RSS_WARN_MB` | 384 | 128–32768 MiB; resident-memory admission threshold |
| `ALPHA_MEDIA_DOWNLOAD_CONCURRENCY` | 4 | 1–4 transfers, including unresolved timed-out header requests |
| `ALPHA_MEDIA_DOWNLOAD_TIMEOUT_MS` | 30000 | 1000–60000; transfer deadline |
| `ALPHA_MEDIA_QUEUE` | 16 | 1–64 waiting Media Studio jobs |
| `ALPHA_MEDIA_RETRY_TASKS` | 2 | 0–10 retained manual retry tasks; expire after five minutes |
| `ALPHA_AI_MAX_CONCURRENT` | 2 | 1–4 admitted AI conversations; excess requests fail fast |
| `ALPHA_SEND_QUEUE` | 256 | 16–1024 waiting sends |
| `ALPHA_SEND_CHAT_QUEUE` | 32 | 2–128 waiting sends per chat |
| `ALPHA_SEND_DEADLINE_MS` | 120000 | 1000–300000; send watchdog |

Existing `ALPHA_AI_TIMEOUT_MS` / provider timeout settings (5–60 seconds), `ALPHA_AI_RETRIES` (0–2), media quotas and send-spacing settings remain supported. Production should use 15-second provider timeouts and zero retries unless measurements justify increasing them. The active-handler watchdog is deliberately a final safety boundary: it stops admission and requests a controlled restart; it does **not** pretend to cancel arbitrary JavaScript or free a still-running operation's concurrency slot.

Image headers must describe supported PNG/JPEG/GIF/WebP dimensions within 16 million pixels and 16,000 pixels on either axis. Some uncommon formats or unusually large headers are rejected. Documents are not executed or automatically decoded. Media transfer limits alone cannot make every decoder safe.

## Dependency review

`bun audit --json` was executed on the original lockfile and the targeted patched lockfile. Original: **102 advisory entries across 27 package names**: 2 critical, 44 high, 51 moderate, 5 low. Patched: **97 entries across 24 package names**: 0 critical, 41 high, 51 moderate, 5 low. Entries can repeat an advisory across installed version ranges; these are not counts of proven exploitable application paths. The scan includes workspaces/development/transitive packages.

The critical multipart/proxy findings and two Sharp native dependency entries were addressed. The resolved versions are checked from a fresh install, not inferred solely from lockfile text. A legacy multipart stream compatibility test is included. A broad semver update trial did not reduce these advisories and was not copied into the project. Remaining advisory records are in `dependency-audit-2026-10-19.json`. Legacy HTTP/media chains involving old Axios, request, image-size, jpeg-js, Undici and related tooling require further compatibility-reviewed migration; do not advertise this release as dependency-clean. Avoid forcing unrelated major versions across these callers without tests.

Baileys rc14 is newer than the versions patched for **CVE-2026-48063 / GHSA-qvv5-jq5g-4cgg**. That advisory lists patches rc12 / 6.7.22 and includes both npm package names: https://github.com/WhiskeySockets/Baileys/security/advisories/GHSA-qvv5-jq5g-4cgg . rc14 remains the reviewed upstream release. No protocol fork or undocumented protocol change is introduced. Automatic history synchronization was already disabled and remains disabled. Monitor upstream advisories and releases; an application filter cannot repair vulnerabilities in binary decoding, decryption, app-state handling or native code before application event delivery.

## Monitoring and deployment

- `/healthz` is a minimal public liveness/status probe. Draining returns HTTP 503. Resource pressure reports degraded status; it does not create a public detailed diagnostics endpoint.
- `/readyz` checks database and the tracked live connection state rather than treating the mere presence of stored user credentials as a live connection.
- `/api/admin/defense-health` requires existing dashboard administrator authentication. It reports aggregate accepted/dropped/duplicate/failed counts, active/queued work, bounded map sizes, uptime, heap/RSS, p99 event-loop delay and aggregate latency totals/maxima. No message text or participant IDs are included.
- Warnings are aggregate and limited to one resource warning per five minutes. No response is sent for each dropped message.
- Configure Render's health-check path to `/healthz`, a restart policy for nonzero termination, and an external readiness alert. These host settings were not changed through this repository. For Docker use container memory/CPU/PID limits and a restart policy in the hosting configuration; a Dockerfile alone cannot enforce the whole host's memory budget.

For a 512 MiB instance start conservatively: ingestion concurrency 2, queue 32, chat queue 8, attachment cap 8 MiB, media download concurrency 1, AI concurrency 1, sends concurrency 1, heap threshold 192 MiB and RSS threshold 320 MiB. Keep the Media Studio worker limit at one. A larger instance is preferable for heavy native rendering. RSS includes this process, not every subprocess; container-level accounting is necessary for FFmpeg and other tools. Avoid forced GC/cache wipes in the message path.

Deployment sequence:

1. Save the current deployment commit and back up the existing authentication database through the normal secure backup procedure. Do not export secrets into this repository, reports or chat.
2. Build from a **clean** dependency directory with `bun install --frozen-lockfile`. Use the existing Bun 1.3.14 Docker build or the corresponding native build; avoid mixing stale npm/pnpm/Bun installations. A pnpm override mirror is included for native workflows. Clear only the host's dependency/build cache when needed; never clear the auth database to deploy this fix.
3. Run `npm run check`, `npm test`, `npm run test:security-load`, and `npm run build --workspace dashboard`. The synthetic tests never connect to WhatsApp. Use a maintained patched Node 22 runtime rather than relying indefinitely on 22.0.0.
4. Prefer a staging instance with a **separate test account and separate auth namespace**. Never run two processes against the same WhatsApp credentials. Check normal text/multilingual text, permissions, small media, menu, group settings, game votes, turns, scores, reconnect and a graceful stop.
5. Deploy one active production instance with conservative limits. Watch readiness, restart frequency, dropped/failed counts, queue depth, p99 lag, heap/RSS and real user latency. Re-check the remaining dependency advisories before enabling more risky media operations.

Rollback: the baseline is `649f026`. Prefer reverting the relevant application changes while retaining the patched dependency pins. If a full platform rollback to that baseline is necessary, recognize that it restores the old defense and dependency risks. Restore the old deployment commit/image; leave the authentication database intact. No destructive schema migration must be undone. Never run old/new instances simultaneously with shared credentials. Recheck normal game state and sessions after rollback; in-memory duplicate history does not survive a restart; watchdog quarantine survives while its storage file is retained.

## Tests and limitations

Security tests use synthetic events, mocked AI/DB/socket behavior, bounded fake media and local-only rendering. They cover malformed/missing fields, text budgets, legitimate Unicode, getters/cycles/nesting/metadata, oversized and unsupported media, stream failures/timeouts/late delivery, download concurrency, image header limits, sender/chat/global quotas, queue saturation and fairness, duplicate events and distinct poll updates, thrown handlers, deadlines, reconnect single-flight/backoff/exhaustion/manual recovery, auth failure/retry/deletion, controlled shutdown, log redaction, provider failure/retry/abort/response bounds, and actual patched dependency resolution.

`scripts/security-load.mjs` submits 2,000 synthetic messages under a 128 MiB V8 heap limit and checks bounded state, drained queues, heap growth and completion time. It measures p99 loop delay; this short workload is not a production capacity benchmark. The full suite also retains the encrypted-vote Truth or Dare flow, starter enrollment, rounds, turns, scoring, winner, permissions and dashboard regressions. Live WhatsApp floods, live reconnects, actual production resource use and crash payloads were **not** tested. No harmful messages were generated or transmitted.

Residual risks:

1. WhatsApp/Baileys parses and decrypts data before this application layer; large protocol buffers or native/library faults can occur before admission. This cannot protect another person's WhatsApp client from every message exploit.
2. rc14's media fetch helper does not forward abort into its fetch call. Timed-out header requests retain bounded permits until settling; late streams are destroyed. Four stuck transfers can exhaust that service until recovery/restart. No fake cancellation guarantee is made.
3. FFmpeg conversion now has process deadlines; `toimg` uses a bounded external process and temporary-file cleanup. Some existing canvas/native decoders and legacy provider tools still run in-process. Pixel/signature limits and queues reduce risk, but they are not complete native-memory isolation. Full media-worker isolation is follow-up work.
4. Remaining dependency advisories are unresolved, and not every legacy external API call or regular expression was proven safe. Third-party decoders can have flaws unrelated to byte size. Keep platform limits and upstream patch monitoring in place.
5. Admission shedding, a watchdog restart, or a process crash can drop work. Do not automatically replay a failed message; manual retry should use a new command. No cross-process exactly-once command semantics are claimed.
6. Synchronous CPU/native blocking can delay application watchdogs. External health monitoring and host restart/resource limits are necessary. Authentication persistence is attempted within the shutdown bound; a host SIGKILL/OOM cannot guarantee a final flush.

## Changed-file map

- `utils/ingestionDefense.js`, `utils/ingestionQuarantine.js`, `utils/groupMetadataDefense.js`, `core/events.js`, `core/messages.js`: validation, quotas, deduplication, fair bounded admission, deadlines and safe dispatch.
- `utils/connectionManager.js`, `connection.js`, `core/connectionUpdate.js`: one socket initialization/reconnect sequence, generation guards and capped retry behavior.
- `core/socket.js`, `core/auth.js`, `db/client.js`: validated caches/metadata, reviewed library defaults, serialized credential writes, reliable bounded auth cleanup and DB pool/time budgets.
- `utils/boundedMedia.js`, `utils/imageBudget.js`, `utils/mediaInput.js`: source/size/signature/dimension checks, bounded stream reads and honest timeout handling.
- `utils/mediaJobs.js`, `utils/mediaStudio.js`, `commands/group/members/image.js`, `commands/group/members/headerfooter.js`, `commands/group/members/removebg.js`, `commands/public/steal.js`: queue/retry retention limits, FFmpeg deadlines and migration of unbounded legacy downloads. The intended sticker-to-image command retains its aliases.
- `queue/messageQueue.js`: backpressure, fair sends, spacing without per-chat polling loops, result preservation and shutdown.
- `utils/safeAi.js`, `utils/boundedResponse.js`: AI admission, bounded context/response, retries and supported cancellation.
- `utils/defenseHealth.js`, `utils/controlledShutdown.js`, `index.js`, `routes/admin.js`: health metrics, drain state, bounded safe termination and dashboard transport limits.
- `utils/safeLog.js`, `notify/adminEvents.js`, `core/groupEvent.js`, `utils/chatLogger.js`, `db/safePackData.js`: privacy-preserving logs and bounded history/cache retention.
- `package.json`, `bun.lock`, `.github/workflows/ci.yml`, `scripts/check.mjs`: reviewed dependency resolutions, frozen builds, pinned CI runtime, bounded test workers and expanded syntax coverage.
- `tests/ingestionDefense.test.js`, `tests/ingestionQuarantine.test.js`, `tests/defenseMedia.test.js`, `tests/connectionDefense.test.js`, `tests/authDefense.test.js`, `tests/aiDefense.test.js`, `tests/defenseLogging.test.js`, `tests/dependencyDefense.test.js`, `scripts/security-load.mjs`: new synthetic security checks and bounded load measurement.
- `tests/truthDareHost.test.js`: replaces a source-text assertion with a real queue-result regression test. `tests/speedUpgrade.test.js`: materializes Node 22.0's lazy `fetch` before mocking it; no production fetch behavior changes.
- This report and `docs/dependency-audit-2026-10-19.json`: deployment, residual risks and remaining advisory inventory.

## Execution record

The final complete suite ran successfully under Node **22.0.0** with two test workers: **466 passed, zero failed**. The maintained Node **22.23.3** runtime was also tested. Syntax checks covered **330 JavaScript files with zero errors**; the separate dashboard production build completed successfully. The root has no separate lint or application TypeScript-check script; no such check is represented as executed.

The frozen install was checked with Bun **1.3.14**. Its event-loop monitor and health module were exercised locally. A fresh install was important: an earlier reused dependency directory retained an old proxy-addr link despite the new lockfile, so verification was repeated with a clean directory and actual runtime resolution assertions.

One recorded 2,000-message load run under a 128 MiB V8 heap cap accepted 500 messages, shed 1,500, drained the queue and retained 51 quota entries and 500 deduplication entries. Measured heap growth was **842,216 bytes**, p99 event-loop delay **11.7 ms**, and elapsed time **67 ms**. These are synthetic local observations, not peak RSS measurements or production throughput promises. No real WhatsApp users/groups, production payment, authentication records or hostile client-crash payloads were involved.
