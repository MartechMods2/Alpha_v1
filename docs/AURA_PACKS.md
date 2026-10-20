# Aura one-time packs

| Pack ID | Price (Aura) | Contents | Evo | Storage |
| --- | ---: | --- | --- | ---: |
| infinity | 9,999,999 | All current shop items; tools topped up to their caps | Evo-Legendary+ | 9,999,999 |
| legendary-pro-plus | 5,999,999 | All current shop items; tools topped up to their caps | Evo-Legendary+ | 10,000 |
| pro | 1,999,999 | All normal shop items; tools topped up to their caps | Apex | 128 |

Available to every verified member, not only the creator. One payment per pack; no recurring fee.
These deliberately discounted bundles are an alternative to individual progression: their Evo and stock grants bypass individual XP and completed-quest requirements. Infinity is much cheaper than buying top-tier Evo/storage separately.

## Commands

- `$aura shop packs`: compare packs (also available while Aura is OFF).
- `$aura shop pack infinity`: full preview.
- `$aura shop pack infinity --confirm`: buy once while Aura is ON.
- Substitute `pro` or `legendary-pro-plus` for another pack.
- `$aura`: shows purchased packs and Evo.
- `$aura inventory`: inspect contents.
- `$aura shop equip legendary-infinity-frame`: choose the included top prestige frame.

No new top-level commands. Existing shop image pages remain available; pack comparisons and previews use Alpha's text panel.

## Rules and accounting

A single wallet transaction spends Aura, grants stock/Evo/storage, saves pack ownership and records a receipt. Replayed messages cannot charge again. A different message cannot reclaim a purchased pack, even after tools are consumed or items gifted.
Existing cosmetics are skipped without a discount. Existing tools top up to their caps; existing paid cost basis is preserved. New bundled units have zero salvage refund, including after gifting, so a cheap bundle cannot mint Aura by salvaging expensive stock.
Buying another pack charges its full displayed price; no trade-in credit. Ranks/storage never decrease. Inventory space is numeric, never an allocated array of millions of slots.

The current catalog is granted at purchase time. New future catalog items are not automatically granted. Purchased stock follows normal item gifting rules; packs, Evo and storage are not transferable.
Earned XP, quest counts, ranked RP and collectible cards are unchanged. Prestige frames/titles follow the granted Evo entitlement. Packs do not grant moderation, creator privileges, infinite Aura, real money or free paid commands.

## Pricing and rollout

Edit the `packs` object in `config/aura-prices.json`; IDs are `infinity`, `legendary-pro-plus`, `pro`. Restart/redeploy after changes. Prices validate as positive safe whole numbers, up to 10 billion. Keep Infinity at 9,999,999 to retain the requested offer.
Aura remains OFF by default; only the verified primary creator can enable it.
No database migration is required; pack ownership is a small wallet field initialized on purchase.
Rollback the application commit if required, but preserve wallet balances, inventory, cost basis and ledger records. Never erase pack ownership or receipts to retry a purchase.
