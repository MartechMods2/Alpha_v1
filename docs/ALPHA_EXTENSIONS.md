# Alpha extensions and English defaults

## What changed

English is the default for AI calls, including short/ambiguous greetings and prior conversations containing Hinglish. Explicit translation/reply-language requests remain supported. The command router's romanized Hindi permission-denial replies are now English. Voice help no longer promotes a Hindi-specific mode; `say`/`tts` default to English. This does not strip multilingual input, names, quotations or translation results. AI instructions reduce unwanted language switching but cannot guarantee every provider follows them.

Extensions let a member link their own WhatsApp account as another Alpha instance. They do not replace the primary socket, reuse its auth collection, run a second dashboard or grant creator powers. This is a managed multi-account feature, not arbitrary third-party code installation.

## Deployment setup

1. Deploy this update using the existing workflow. Node.js 22+ must be available on PATH even when the main bot uses Bun. The server must permit child processes and persistent outbound WhatsApp connections; static/serverless hosting is unsuitable.
2. Primary MongoDB credentials must permit separate tenant databases. Each tenant uses the original database name plus `_ext_` and a validated 24-character account identifier. Existing primary database names and auth records stay unchanged. Redis is disabled inside workers, so its unscoped keys cannot cross accounts. Quarantine files also have separate tenant paths.
3. Recommended: set `ALPHA_EXTENSION_AUTH_KEY` to a stable randomly generated secret of at least 32 characters. For example, generate it privately with `openssl rand -hex 32`, then put the result in the hosting environment, not source code or chat. If omitted, encryption derives its key from the existing secret `MONGODB_KEY`. Changing the selected secret makes saved extension credentials unreadable; keep it stable and backed up securely. Back up encrypted tenant auth and the key separately. Primary auth format is not migrated.
4. `ALPHA_EXTENSION_MAX` defaults to **1 additional account**. Valid values are integers 1–5; invalid values fall back to 1. Start with one, measure total RSS/CPU and provider usage, then increase only with capacity. Each worker has a 256 MiB JavaScript heap ceiling; native buffers, media subprocesses and the primary bot require additional memory. This is not an OS/container memory quota or a security sandbox.
5. Extensions are **OFF by default**. Log into your existing dashboard, open **Extensions**, and click **Enable extensions**. Chat commands cannot enable, start, stop or revoke extensions, and never display pairing codes. The original single-account dashboard pairing routes remain unchanged.

## Dashboard-only member pairing

1. In **Dashboard → Extensions**, enter the member's WhatsApp number and choose **Create one-use link**.
2. Use the dashboard over HTTPS. Copy the generated link and share it privately with that member. Do not share your dashboard login. The link is bound to the chosen number, expires after 15 minutes and can be claimed once. At most 20 outstanding links are allowed. Server restart invalidates unclaimed links.
3. The member opens the link in a browser. This page requires no admin password and grants no admin access. Its token is in the URL fragment (not the server query string) and is removed from the address bar after claim.
4. The member checks the number, confirms ownership and presses **Get pairing code**. Opening the link alone does not request a code. The code appears only in this private dashboard pairing page—not WhatsApp chat, logs or the extension registry.
5. On their own phone, open **WhatsApp → Settings → Linked devices → Link a device → Link with phone number** and enter the code. Labels vary by platform. Pairing attempts stop after three minutes; WhatsApp may expire codes earlier. No live account is paired by this source update.
6. The page displays connection status and a **Stop my extension** control. Refresh keeps its temporary browser session until the original 15-minute grant expires. After expiry, request a new link from the creator. To revoke the device permanently, remove Alpha in WhatsApp's Linked devices.

A member cannot change the target number through request parameters or obtain another account's code. The original Alpha number is excluded. Mutation requests require the dashboard's own Origin. Claim attempts are rate-limited. Sensitive API responses are not cached. Keep links and codes private: possession of a pairing link grants temporary access for that specific account.

After pairing, add the paired account to a group. A current group admin activates it:

```
$groupalpha on
$menu
$groupalpha off
```

These are group activation commands, not pairing commands. Group admin roles are checked freshly. Use only one active Alpha instance per group to avoid duplicate replies.

## Creator controls

Use **Dashboard → Extensions** to enable/pause service, create member links, stop an account or revoke it. Revoking stops and blocks the account from pairing again; it does not delete its content or encrypted backup. Pausing stops all workers. Enabling resumes previously paired active registrations; user-stopped instances stay stopped. Only authenticated dashboard administrators can access these controls. Pairing visitors get no administrator access.

The chat command `$extension` provides only a dashboard reminder. `$extension pair`, `on`, `stop`, `revoke` and other arguments cannot perform an action. Pairing notifications and codes are not sent through chat.

Paired devices do not gain creator rights. Extension workers do not load `commands/owner/`; their own `fromMe` messages do not confer creator privileges. Moderator configuration is cleared inside workers. Aura's configured creator remains the original creator, so pairing never grants unlimited Aura.

## Data, features and limits

Each extension uses separate auth, group settings, wallets, scores, histories and provider counters. **Aura balances and inventory are not synchronized with the original Alpha**. Aura remains off until its verified creator enables it; do not promise shared balances across these instances.

The existing command router, games, ingestion defense, moderation and media queues run within each worker. Owner tools and extension spawning are unavailable there. The primary deployment's periodic reminder/birthday/Aura-drop schedulers are not started in workers in this initial release; do not promise those scheduled deliveries on extensions. Existing active game recovery still runs on connection-open.

Pairing uses pinned Baileys 7.0.0-rc14's supported `requestPairingCode` and connection APIs. Transient reconnects use Alpha's existing capped backoff. Session-stop conditions terminate the worker; crash loops are not automatically restarted indefinitely. Previously paired active accounts are restored after the primary deployment restarts while extensions are enabled. Pending unpaired attempts are not auto-restored. Registry holds at most 100 saved/blocked accounts; concurrency remains separately bounded.

AI/provider keys and the physical host are shared resources. Per-worker limits are not a shared billing cap. Monitor provider spending, process RSS, CPU, connection failures and media queue depth before increasing capacity. Child-process isolation is not protection from a compromised host or an upstream library vulnerability. Run one primary replica against a registry: this release has no distributed session lease for multi-replica hosting.

## Verification and rollback

Automated tests use synthetic identities, mock workers and mocked providers. They cover consent/opt-in, number-bound dashboard access, capacity races, expired/failed attempts, browser-only code delivery, pause/restart/revoke, real authenticated encryption/tamper rejection, tenant namespaces, English AI instructions and English permission messages. They do not prove that WhatsApp accepts a real pairing code or that a hosting plan has sufficient memory.

Before wider rollout, pair one consenting test account, confirm its number and isolated database, activate only a private test group, exercise `$menu`, one game and moderation with appropriate admin rights, stop/resume the instance and revoke the device on the test phone. Verify primary Alpha continues working throughout. Keep account/session data out of screenshots and logs.

Rollback: pause extensions in the dashboard, verify workers exit, then revert the feature merge. Preserve encrypted tenant databases and the stable encryption secret if a later restore is wanted; do not drop primary auth or wallet databases. WhatsApp device revocation remains a separate action on the account holder's phone.
