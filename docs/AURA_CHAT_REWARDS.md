# Automatic group text rewards

Members earn **20 Aura for each eligible group text message** while the Aura economy and Alpha are ON. This includes text commands; no minimum word count, artificial cooldown or separate daily reward cap was added. The existing ingestion rate limits and group moderation still apply. Owner balances remain unlimited and do not receive extra minted rewards.

Only fresh incoming text/extended-text messages processed by the normal validated/moderated command pipeline qualify. Alpha's own outgoing messages, known bot identities, private messages, blank/control-only text, media-only posts, edits/service events and messages over two minutes old are excluded. The live notify-event path is used; history append events do not reach this hook. Community automation is dispatched after the same moderation/reward boundary, so its text messages qualify too.

Rewards are silent: no per-message reply or DM. Existing wallet and private history show the credit. Each receipt uses the verified phone identity, group and WhatsApp message ID, so duplicate deliveries and concurrent events cannot pay twice. No message body is stored in the reward ledger. Normal repeated words in distinct real messages are not automatically considered abuse; existing anti-spam policies decide whether messages pass moderation.

No XP, ranked RP, quest completions or creator gift/coupon budget is changed. The existing wallet cap includes reserved fees; near the cap only available space is credited and the receipt records this. Aura OFF writes no new reward wallet or ledger record.

The reward is awaited within the bounded ingestion handler, without creating an unbounded background queue. Database/identity failures skip that reward and allow normal processing to continue, with one content-free aggregate warning per minute. Failed rewards are not queued for automatic catch-up. Economic receipts remain durable for replay protection; monitor ledger growth and transaction latency as message volume increases.

No new command or secret is required. Enable the existing system with `$aurasystem on`. Deploy normally, then verify one live group message increases a regular member's wallet by 20. Automated tests use synthetic events only.
