# Aura member-flow audit — 21 October 2026

Reviewed baseline: `39bcbcd1a6b3d05ddf6c52dfa83dc4882f360d01`.

## Concrete findings and fixes

| Finding | Member impact | Fix / functions |
| --- | --- | --- |
| LID resolution ignored valid paired phone aliases | Some members could not view/spend Aura or receive chat rewards without a populated group metadata/mapping cache | `identity.js`: `withAuraSenderAliases`, `auraIdentity`; integrated into `charging.js`, `groupTextRewards.js`, command handler and `core/messages.js`. Only aliases paired to the actual author are accepted; they cannot resolve another recipient. |
| Mapping lookups could wait indefinitely and the old fallback logged raw failures | Slow/missing responses and avoidable diagnostic exposure | `identity.js`: bounded `mappedPhone`, two-second deadline, at most four outstanding calls, no raw-error logging. Core author lookup uses the same boundary. Unknown identities still fail closed. |
| Chat reward receipts dominated recent history | Purchases/refunds were difficult to find after active conversation | `$aura history` now requests important receipts. `history chat` and `history all` remain private alternatives. `engine.history` filters in Mongo before limiting. `mongoStore.find` has a five-second server deadline; an additional actor/kind/time index supports filtered history. |
| Base daily/quiz/collection rewards could overflow a nearly full wallet even though XP-rank bonuses were already capped | Entire transactions rolled back, blocking streak/quiz/collection progress | `engine.daily`, `quest`, `collect` use available reward headroom including reserved fees. XP, conduct, quest counts, cards and badges can progress at the cap. Responses explain limited bonuses. No deferred bonus is promised. |
| Full-wallet coupon/salvage failures gave an opaque safety error | Members could not tell whether a code/item had been consumed | `engine.redeem` and `salvage` check room for the full payout and return a clear error. No coupon or item is consumed on failure. These transactions are never silently truncated. |
| Single-item purchases accepted extra unrecognised arguments | A mistyped multi-item request could charge for only its first item | Command handler rejects ambiguous buy/salvage/bag confirmation arguments before mutation. |
| Successful replays looked like new purchases/consumption; a final bag-upgrade replay could say the bag was already maximum | Members could think they were charged again or that the original operation failed | Explicit replay notices for buy, bag, salvage, tools, Evo and quest answers. Maximum-bag precheck no longer masks a saved successful receipt. Historical balances are labelled as receipt snapshots. |

## Checks

Synthetic tests cover full/near-full wallets with reserved fees, daily/quiz/collection progression, coupon/item preservation, history separation/privacy, ambiguous requests, duplicate purchases, final-bag replay, paired LID aliases, recipient isolation, missing identities and hung mapping calls.

Local Node tests, syntax checks, a bounded 2,000-event ingestion load and dashboard production build were exercised. GitHub CI on Node 22 is required before merging; its run is linked from the pull request. No real WhatsApp payloads or financial transactions were sent.

## Remaining operational limits

- Actual WhatsApp delivery, current Render deployment, Mongo replica-set availability and real-account PN/LID metadata still require a live smoke check. Synthetic tests do not verify those services.
- Every accepted eligible group text still earns 20 Aura, as requested. There is no new daily cap or artificial cooldown. This can inflate the economy; anti-spam filtering/rate limits cannot identify every automated client. The owner gift/coupon budget is unchanged.
- Reward ledger entries are durable for replay safety and will grow with group activity. Monitor database storage, history query timeouts, transaction latency and aggregate reward-failure warnings. No receipts are deleted by this change.
- Failed passive reward transactions are not automatically queued for catch-up. Normal processing continues; never promise a credit that did not commit.
- Wallet-cap clipping applies only to earned bonuses; transferred funds, coupon rewards and salvage payouts remain all-or-nothing. Members should spend/send Aura before reaching the cap.

## Deploy and rollback

Deploy normally. The new history index is created through the existing index initializer; no secrets or manual data migration are needed. Aura stays opt-in. Check a regular member's group text credit, named wallet, a small purchase, duplicate delivery, private history views and a known LID member. Use synthetic accounts/groups where available.

Rollback application commits if needed, preserving wallets, cost bases, held fees, budgets, coupons and receipts. The additive history index can remain. Do not reset balances or remove replay receipts to retry an operation.
