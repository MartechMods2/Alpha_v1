# Aura deep audit — 20 October 2026

## Scope and method

Reviewed grouped command routing, primary-owner authorization, PN/LID identity resolution, engine mutations, currency and item transfers, provenance-aware salvage, coupons, daily quests, Evo/storage, RP matches, paid-command reservation/settlement, scheduler dispatch/recovery, price validation, Mongo persistence/indexes, and local image resource bounds.

Trace: the existing command loader wraps priced commands with `utils/aura/runtime.js` / `charging.js`; public/group handlers resolve a canonical member identity; `engine.js` applies atomic wallet and ledger changes through `mongoStore.js`; responses go through the existing outbound helper/queue. Social and financial replies retain their existing public/private destinations. No session files, credentials or real private messages were inspected or published.

Verification used synthetic accounts, mocked stores/transports and the installed application code. No payloads were sent to WhatsApp. Installed verification runtime: Node 22.23.3; MongoDB driver 6.21.0; sharp 0.35.5; canvas 1.0.2. This is an application/state-flow audit, not a claim that these dependency versions have no upstream advisories.

## Concrete issues fixed

Priorities reflect the impact on this application, not a CVSS rating or proof of remote exploitation.

| Priority | Finding and failure path | Fix and code reference |
| --- | --- | --- |
| P1 | Wallet limits counted spendable balance but excluded refundable reservations. Incoming Aura could fill the cap and make a later failed-command refund overflow. | `walletSafety.js:assertAuraWallet`, `engine.js:prepareWallet/charge/settle/gift/transfer`: enforce balance + active reserved fees within the existing cap. Reconcile holds from authoritative charge records inside the same transaction, including missing/null/stale legacy counters. No balance is truncated. |
| P1 | Ranked invites/accepts/answers/declines lacked their own durable message-event receipts. A replayed old invite or answer could affect a later match in the same group. | `commands/group/members/auraArena.js:transition`: transactional event receipts bind actor, chat, command and message ID; duplicates cannot mutate a later match. Missing IDs and ambiguous challenge recipients are rejected. |
| P1 | Some native database errors missed the message-text regex and could expose collection/index/duplicate-key details to a group. | `errors.js:AuraUserError/publicAuraError`: only explicitly authored safe errors cross chat boundaries. The Aura, arena and paid-command handlers replace operational errors with recovery guidance, including unknown commit outcomes. |
| P2 | Paid output could be sent after a stale reservation had already been recovered. | `engine.js:activeReservation`, `charging.js`: verify ownership, reserved status and valid expiry before forwarding a final paid result. Known expired/refunded work cannot send a new result. |
| P2 | The paid-command receipt assumed its local delivery flag matched the final database outcome. A concurrent refund could still produce a false “Spent” message. | Settlement returns actual stored status and amounts; charging receipts report that result. Settlement idempotency is scoped to actor and reservation. |
| P2 | One failed stale-reservation recovery aborted the scheduler before later recoveries, ranked settlements and drops. | `scheduler.js:checkAuraSchedules`: isolate each recovery failure and continue the bounded batch; logs contain no member IDs or exception details. |
| P2 | A queued drop could be sent after its code was claimed/expired, Aura was disabled, or the group opted out. | The queued callback re-reads coupon, activation and current group eligibility immediately before sending. |
| P2 | An unanswered quest that expired remained permanently unusable for that daily slot. Re-opening displayed the same expired record. | `commands/public/aura.js:quests`: transactionally renew an expired unanswered question; preserve question/answer and never reset a used attempt. |
| P2 | The free first daily ranked-loss protection consumed an existing promotion shield unnecessarily. | `engine.js:ranked`: spend a shield only on a later loss that actually requires one. |
| P2 | A verified ranked win at wallet capacity could fail its reward write and leave the group stuck with a pending result. | Ranked win and XP-milestone Aura rewards respect available capacity; RP/XP and final match state still settle. The result discloses that wallet capacity was reached. No existing money is removed. |
| P2 | Invalid stored expiry values compare as NaN, allowing malformed coupon/quest/duel records to evade simple “<= now” checks. | `walletSafety.js:isUnexpired` requires a finite future date. Coupon reward values are also validated before redemption. |
| P3 | A null price section silently fell back to built-in prices, despite being malformed configuration. | `pricing.js:applyPrices`: only an absent section uses defaults; a present null section is rejected. |
| P3 | Reservation migration and pending-duel queries lacked matching indexes. | `mongoStore.js`: add actor/status for charges and state/expiry for duels; existing indexes remain. Legacy hold aggregation uses the transaction session and a 5-second server-operation limit. |

## Verification executed

- Full Node 22 suite: **571 tests passed, zero failures**, including the existing commands/games and previous Aura regressions.
- **18 new tests** cover the failure paths above, including a 300-operation deterministic workload. The workload checks conservation of spendable + held Aura, item supply, integer/nonnegative balances, inventory capacity and duplicate-event behavior after every operation.
- The workload was also run separately with `--max-old-space-size=128`: passed. This bounds V8 heap for that synthetic workload; it does not measure total production RSS, native image allocations or every deployed workload.
- Syntax validation: **358 JavaScript files, zero errors**. Whitespace validation: `git diff --check` passed.
- Mongo adapter tests verify shared transaction sessions, snapshot/majority settings, aggregate use, index initialization and no unsafe nontransactional fallback. They do not replace a live replica-set integration test.
- No standalone lint/type-check script is configured for the root JavaScript application. The dashboard was not changed, so no dashboard build is claimed.

## Preserved behavior

Prices, earning rates, owner identity, the 500,000 daily owner gift/coupon budget, ordinary transfer limits/fees, item gift limits, inventory ownership, cosmetic entitlements, existing badges, seven-stage Evo progression and opt-in activation remain. Owner recognition still depends on the primary configured phone identity, not moderator flags. Images remain local and bounded; no image provider or payment integration was added.

## Residual risks and operational limits

1. WhatsApp sending and Mongo commits are separate systems. A process/network failure between accepted send and settlement cannot provide perfect distributed exactly-once delivery/billing. The pre-send check reduces stale output; settlement receipts are now truthful. Check private history before creating a new financial request after an uncertain acknowledgement. An accepted send is not proof that a person read the result.
2. Recovery depends on database availability. A malformed or failing reservation is retained for review and retried; it is not silently deleted. The scheduler batch is bounded at 50 reservations and 20 ranked results, and each transaction has a 20-second deadline. There is no separate hard wall-clock deadline for the whole batch, so a prolonged database outage can delay dispatch. Existing queue limits/deadlines still apply.
3. A legacy wallet already above the combined balance-plus-held cap needs reconciliation or sufficient spending before blocked credits/refunds can complete. The update deliberately fails closed rather than deleting or manufacturing Aura. No such live wallet was observed or queried during this audit.
4. Pause and drain old workers during deployment. Authoritative reservation reconciliation tolerates stale cached hold fields, but an old process still running old cap checks can create the old edge case until stopped. Do not mix implementations intentionally.
5. Distinct WhatsApp accounts are not proof of distinct humans. Cosmetic community badges do not confer trust, currency, XP or permissions.
6. Database/repository credential compromise, upstream WhatsApp/library vulnerabilities and malicious changes by an authorized repository operator are outside the protection offered by these application controls. Financial ledgers must not be casually TTL-deleted: deleting deduplication records can permit old event replays.
7. The running deployment, live database, network reconnect behavior and actual WhatsApp delivery were not tested in this audit. No automated tool was used to notify real members or to run exploit traffic.

## Deployment and rollback

1. Use `$aurasystem off`, stop new work on older workers, and allow in-flight paid handlers to finish or existing reservations to recover. Preserve a normal database backup. Do not erase ledgers or reservations.
2. Deploy all bot workers at the same commit and stop old instances. The existing Mongo principal needs the index permissions already used by Alpha; two additional indexes initialize automatically. No new environment variables or dependencies are required.
3. Existing wallet hold counters reconcile from reserved charge records transactionally. If a wallet fails the safety check, preserve its records and reconcile its balance/charges; never bypass the check with a direct forced write.
4. Verify `$aura`, `$aura help`, `$aura shop`, one small confirmed transfer, and private history using consenting test accounts. Confirm one failed paid feature restores the reserved amount, and one successful feature clears its hold. Check logs for the constant scheduler-recovery warning, not private message contents. These are proposed live checks, not checks already executed.
5. Re-enable Aura only after all instances use the new code. For rollback, pause again and settle/drain reservations first, then restore the immediately preceding seven-stage-Evo-compatible commit. Preserve all database records. Rolling back restores the audited old flaws, so prefer a forward fix for any new issue.
