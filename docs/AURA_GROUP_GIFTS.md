# Member Aura, named profiles and group gifts

Every verified member can use Aura while the creator has enabled the economy. No moderator/admin role is required to claim daily rewards, do quests, buy stock or packs, change Aura names, collect cards or transfer existing Aura. Only the primary creator can mint gifts or change activation.

## Member commands

- `$aura`: named image/profile and balance; the name also appears in the caption if image decoration fails.
- `$aura name Your Name`: free display nickname (2–40 characters); `$aura name reset` restores the WhatsApp name. Display-only, no authority.
- `$aura goals`: daily status, next Evo quest gap, affordable cosmetics, bag space and free activities.
- `$aura gift @member 1000`: preview a wallet transfer; add `--confirm` to pay. Same rules as `$aura send`: 5% rounded-up fee, 10,000 maximum principal per transfer, 20,000 principal daily. Creator gifts use the minting budget instead.
- `$aura collect` / `$aura album`: shorter routes to the existing daily card and album.
- `$aura history`: recent receipts privately.

Names are sanitized and bounded; normal multilingual text/emoji is preserved. Nicknames and profile art never affect verified phone identity or owner permissions. Anonymous leaderboard rows no longer expose phone-number suffixes.

## Creator group gift

1. Inside a group, send `$aura gift @all 50000`.
2. Alpha refreshes the real group roster and excludes itself and the creator. Duplicate PN/LID records count once. Unknown identities block the gift rather than silently missing members.
3. Read eligible count, per-member amount, total and budget. Nothing is sent yet.
4. Within five minutes send `$aura gift @all 50000 --confirm`.
5. Roster or amount changes require a fresh preview. All wallet credits, receipts, budget and preview consumption commit in one transaction; any capped wallet or database failure rolls everything back.
6. Alpha posts one group summary. Members get receipts in their existing private history; no mass mentions or automatic DM flood.

`$aura gift budget` shows the separate creator **group-gift budget: 512,000,000 Aura per Africa/Lagos day**, enough for 1,024 recipients at 500,000 each. Each recipient can receive up to 500,000 per batch. Earlier group gifts count against this new budget only after this update; existing personal gift/coupon budget rows are preserved. Individual creator gifts and custom coupons still share their original 500,000 daily budget. Member transfer limits are unchanged.

To give every eligible group member 500,000:

```
$aura gift @all 500000
$aura gift @all 500000 --confirm
```

Read the preview before confirming. This credits virtual Aura; it does not transfer money. A new preview permits another batch, subject to remaining daily budget; there is no per-recipient daily cap across batches. Example: 20 recipients × 500,000 = 10,000,000 Aura.
Scheduled drops keep their existing separate rules.

A successful confirmation cannot be replayed to credit twice. Another successful gift requires a new preview. After an ambiguous timeout, check `$aura history` / `$aura gift budget` before starting another preview. Receipts contain a batch ID.

## Engineering and rollout

Mongo batch reads, reservation aggregation and ordered bulk writes run sequentially within the same session, with existing snapshot/majority/20-second transaction limits. Recipient count is capped at WhatsApp's 1,024-member group size. No parallel Mongo operations within a transaction. All recipients' reserved fees count toward their wallet cap.
The preview uses one overwritten private settings row per creator/group; it stores a roster hash, not a second member directory. It expires after five minutes and is consumed atomically. No TTL deletion of economic receipts.
No migration or new secrets required. Deploy normally; Aura remains opt-in and OFF by default.
Rollback application commits without deleting wallet/ledger/budget rows. Existing balances, nicknames, item ownership and receipts must be preserved.
