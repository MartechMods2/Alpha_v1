# Aura shop, inventory and collections

The existing Aura activation switch still applies: everything starts OFF unless the primary creator explicitly enabled it with `$aurasystem on`. Browsing, item details, previews and inventory remain available while OFF. Purchases, equipping, item use and collectible claims require Aura to be ON. No changes to owner authority, daily gift limits, legacy coin wallets or existing balances are made.

## Commands

| Command          | Example                                   | Purpose                                                        |
| ---------------- | ----------------------------------------- | -------------------------------------------------------------- |
| `aurashop`       | `$aurashop frames`                        | Browse all / frames / titles / themes / tools                  |
| `auraitem`       | `$auraitem streak-shield`                 | See price, effect and unlock requirement                       |
| `aurapreview`    | `$aurapreview ruby-frame`                 | Free photo-card preview; does not buy or equip                 |
| `aurabuy`        | `$aurabuy ruby-frame`                     | Buy a known item ID at its displayed price                     |
| `aurainventory`  | `$aurainventory`                          | Owned cosmetics, tool quantities, card count and equipped item |
| `auraequip`      | `$auraequip ruby-frame`                   | Equip an owned cosmetic; `$auraequip none` restores default    |
| `aurause`        | `$aurause tagline-ticket Hello community` | Consume a ticket to set a plain 1–40-character tagline         |
| `auracollect`    | `$auracollect`                            | Claim one free new illustrated collection card per Lagos day   |
| `auracollection` | `$auracollection`                         | Show all eight cards and collection progress                   |

## Stock and prices

| Item ID        |  Price | Requirement / use                          |
| -------------- | -----: | ------------------------------------------ |
| gold-title     |  5,000 | Golden Voice title and gold border         |
| aurora-frame   | 15,000 | Mint border                                |
| midnight-theme | 10,000 | Midnight blue border                       |
| ruby-frame     |  8,000 | Red border                                 |
| ocean-frame    |  8,000 | Blue border                                |
| emerald-frame  |  8,000 | Green border                               |
| royal-frame    | 20,000 | 2,000 lifetime XP; purple border           |
| legend-frame   | 30,000 | 5,000 lifetime XP; gold border             |
| tech-title     |  6,000 | 500 lifetime XP; Terminal Explorer title   |
| veteran-title  | 12,000 | 2,000 lifetime XP; Community Veteran title |
| streak-shield  |  2,000 | Consumable; maximum three in inventory     |
| tagline-ticket |  1,000 | Consumable; maximum three in inventory     |

Permanent cosmetics are purchased once and never lower XP. There is one equipped cosmetic slot; changing it preserves previously purchased items. Colours and titles appear on Alpha's generated Aura card, not the person's actual WhatsApp account or application theme. The primary creator can buy locked cosmetics with unlimited Aura; all other members must meet the XP and balance requirements.

A streak shield is used automatically only when a member returns after missing exactly one Lagos calendar day of daily claims. It preserves the ongoing claim streak but does NOT pay a reward for the missed day. Longer gaps reset the streak without wasting a shield. A replay of the same daily claim never consumes another shield.

A tagline ticket is consumed transactionally only after a valid short plain message is supplied. Formatting, control characters, mentions and web-link prefixes are rejected. The tagline stays on the Aura card until replaced using another ticket. Invalid input or replayed events do not consume an extra ticket.

## Free collection

Eight cards: Byte Bot, Linux Penguin, Neon Terminal, Lagos Sunset, Cyber Shield, Circuit Heart, Pixel Crown and Alpha Comet. Each eligible daily claim chooses a card the member does not already own; there are no paid mystery boxes or random wallet losses. Cards are saved globally with the wallet. Once all eight are collected, the member receives 2,500 Aura and the permanent Collection Curator badge exactly once. No further completion rewards can be claimed. This requires at least eight different claim days while Aura is active.

Illustrated card messages use a local bounded canvas and fall back to text if rendering fails. They do not download new media or call an image-generation provider.

## Safety, compatibility and deployment

Existing inventory arrays are retained. Consumable quantities and card collections are initialized lazily when a wallet mutates; no destructive migration is needed. All purchases, consumption, collection rewards and daily shield consumption use the existing MongoDB transaction and idempotency ledger. Concurrent purchases cannot overdraw a balance or exceed tool limits.

Deploy the commit using the normal Render workflow. Verify `$aurashop`, a free preview, one permitted purchase and inventory. No environment variables or dependencies are added. Use `$aurasystem off` to pause economic changes. For rollback, turn Aura off, revert this shop commit and restart; preserve all Aura collections for reconciliation. Previous code will retain unknown cosmetic IDs in saved inventories, although its old shop will not display their details.
