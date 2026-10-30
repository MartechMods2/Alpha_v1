# Alpha extensions and English defaults

## What changed

English is the default for AI calls, including short/ambiguous greetings and prior conversations containing Hinglish. Explicit translation/reply-language requests remain supported. The command router's romanized Hindi permission-denial replies are now English. Voice help no longer promotes a Hindi-specific mode; `say`/`tts` default to English. This does not strip multilingual input, names, quotations or translation results. AI instructions reduce unwanted language switching but cannot guarantee every provider follows them.

Extensions let a member link their own WhatsApp account as another Alpha instance. They do not replace the primary socket, reuse its auth collection, run a second dashboard or grant creator powers. This is a managed multi-account feature, not arbitrary third-party code installation.

## Deployment setup

1. Deploy this update using the existing workflow. Node.js 22+ must be available on PATH even when the main bot uses Bun. The server must permit child processes and persistent outbound WhatsApp connections; static/serverless hosting is unsuitable.
2. Primary MongoDB credentials must permit separate tenant databases. Each tenant uses the original database name plus `_ext_` and a validated 24-character account identifier. Existing primary database names and auth records stay unchanged. Redis is disabled inside workers, so its unscoped keys cannot cross accounts. Quarantine files also have separate tenant paths.
3. Recommended: set `ALPHA_EXTENSION_AUTH_KEY` to a stable randomly generated secret of at least 32 characters. For example, generate it privately with `openssl rand -hex 32`, then put the result in the hosting environment, not source code or chat. If omitted, encryption derives its key from the existing secret `MONGODB_KEY`. Changing the selected secret makes saved extension credentials unreadable; keep it stable and backed up securely. Back up encrypted tenant auth and the key separately. Primary auth format is not migrated.
4. `ALPHA_EXTENSION_MAX` defaults to **1 additional account**. Valid values are integers 1–5; invalid values fall back to 1. Start with one, measure total RSS/CPU and provider usage, then increase only with capacity. Each worker has a 256 MiB JavaScript heap ceiling; native buffers, media subprocesses and the primary bot require additional memory. This is not an OS/container memory quota or a security sandbox.
5. Extensions are **OFF by default**. From the configured creator's verified WhatsApp number (`MY_NUMBER`, first number), privately message the original Alpha: `$extension on`. No change is required to existing single-account `/api/pair` dashboard routes.

No live pairing is performed by tests or deployment. The first live pairing must be completed on the member's phone.

## Member guide

Privately message the ORIGINAL Alpha from the number you want to pair:

```
$extension pair
```

Alpha verifies the actual sender's PN/LID mapping; there is no member-supplied phone parameter. The original Alpha number cannot pair as an extension. Codes are sent only to that verified number, never a group or another requester, and are not persisted in the registry or logged. The underlying library temporarily retains pairing material inside encrypted session state as part of its supported protocol.

On your own WhatsApp, open **Settings → Linked devices → Link a device → Link with phone number**, then enter the private code. WhatsApp labels may vary by platform. Pending attempts stop after three minutes; codes may expire earlier. Only link an account you own.

```
$extension status
$extension stop
```

Run these privately against the original Alpha. Stop pauses your worker and saves encrypted auth for a later `$extension pair` resume. To permanently revoke the device, remove it in WhatsApp's Linked devices. Stopping server-side is not a substitute for revoking the device on your phone.

Add your paired number to a group. A real group admin enables it:

```
$groupalpha on
$menu
$groupalpha off
```

Group activation is off by default and changes only that extension's current group. Group-admin permissions remain necessary for moderation. Use only one active Alpha instance in a group to avoid duplicate replies.

## Creator controls

All commands are private to the original Alpha:

```
$extension on
$extension off
$extension revoke 234XXXXXXXXXX
```

Use international digits without `+` for revoke. Revoke stops the instance and blocks that account from pairing again; it does not erase member content or the saved auth backup. Off stops all workers and pauses pairing; on resumes previously paired active registrations. A user-stopped extension remains stopped. The creator controls who can use the hosting resources. There is no self-service unblock command in this release.

Only the configured creator number can enable/pause/revoke: a supplied `isOwner` flag, paired device's own messages, admin role or display name is insufficient. Extension workers do not load `commands/owner/`; their own `fromMe` messages do not acquire creator privileges. Moderator configuration is cleared inside workers. Aura's configured creator remains the original creator, so pairing never grants unlimited Aura.

## Data, features and limits

Each extension uses separate auth, group settings, wallets, scores, histories and provider counters. **Aura balances and inventory are not synchronized with the original Alpha**. Aura remains off until its verified creator enables it; do not promise shared balances across these instances.

The existing command router, games, ingestion defense, moderation and media queues run within each worker. Owner tools and extension spawning are unavailable there. The primary deployment's periodic reminder/birthday/Aura-drop schedulers are not started in workers in this initial release; do not promise those scheduled deliveries on extensions. Existing active game recovery still runs on connection-open.

Pairing uses pinned Baileys 7.0.0-rc14's supported `requestPairingCode` and connection APIs. Transient reconnects use Alpha's existing capped backoff. Session-stop conditions terminate the worker; crash loops are not automatically restarted indefinitely. Previously paired active accounts are restored after the primary deployment restarts while extensions are enabled. Pending unpaired attempts are not auto-restored. Registry holds at most 100 saved/blocked accounts; concurrency remains separately bounded.

AI/provider keys and the physical host are shared resources. Per-worker limits are not a shared billing cap. Monitor provider spending, process RSS, CPU, connection failures and media queue depth before increasing capacity. Child-process isolation is not protection from a compromised host or an upstream library vulnerability. Run one primary replica against a registry: this release has no distributed session lease for multi-replica hosting.

## Verification and rollback

Automated tests use synthetic identities, mock workers and mocked providers. They cover consent/opt-in, private own-number routing, capacity races, expired/failed attempts, duplicate code delivery, pause/restart/revoke, real authenticated encryption/tamper rejection, tenant namespaces, English AI instructions and English permission messages. They do not prove that WhatsApp accepts a real pairing code or that a hosting plan has sufficient memory.

Before wider rollout, pair one consenting test account, confirm its number and isolated database, activate only a private test group, exercise `$menu`, one game and moderation with appropriate admin rights, stop/resume the instance and revoke the device on the test phone. Verify primary Alpha continues working throughout. Keep account/session data out of screenshots and logs.

Rollback: privately `$extension off`, verify workers exit, then revert the feature merge. Preserve encrypted tenant databases and the stable encryption secret if a later restore is wanted; do not drop primary auth or wallet databases. WhatsApp device revocation remains a separate action on the account holder's phone.
