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

## Stock and prices — 47 items

| Item ID        | Name                   | Type   |  Aura | XP required |
| -------------- | ---------------------- | ------ | ----: | ----------: |
| gold-title     | Golden Voice           | title  |  5000 |           0 |
| aurora-frame   | Aurora frame           | frame  | 15000 |           0 |
| midnight-theme | Midnight theme         | theme  | 10000 |           0 |
| ruby-frame     | Ruby frame             | frame  |  8000 |           0 |
| ocean-frame    | Ocean frame            | frame  |  8000 |           0 |
| emerald-frame  | Emerald frame          | frame  |  8000 |           0 |
| royal-frame    | Royal frame            | frame  | 20000 |        2000 |
| legend-frame   | Legend frame           | frame  | 30000 |        5000 |
| tech-title     | Terminal Explorer      | title  |  6000 |         500 |
| veteran-title  | Community Veteran      | title  | 12000 |        2000 |
| streak-shield  | Daily streak shield    | tool   |  2000 |           0 |
| tagline-ticket | Profile tagline ticket | tool   |  1000 |           0 |
| neon-frame     | Neon Circuit           | frame  |  9000 |           0 |
| solar-frame    | Solar Flare            | frame  | 10000 |           0 |
| lunar-frame    | Lunar Halo             | frame  | 10000 |           0 |
| rose-frame     | Rose Quartz            | frame  |  9000 |           0 |
| ice-frame      | Ice Crystal            | frame  | 11000 |           0 |
| obsidian-frame | Obsidian Edge          | frame  | 14000 |           0 |
| firefly-frame  | Firefly Glow           | frame  | 12000 |           0 |
| sapphire-frame | Sapphire Crown         | frame  | 18000 |           0 |
| forest-theme   | Forest Retreat         | theme  |  7000 |           0 |
| sunset-theme   | Lagos Sunset           | theme  |  8000 |           0 |
| cyber-theme    | Cyber Night            | theme  | 11000 |           0 |
| lavender-theme | Lavender Lounge        | theme  |  7000 |           0 |
| coffee-theme   | Coffee Corner          | theme  |  6000 |           0 |
| arctic-theme   | Arctic Blue            | theme  |  8000 |           0 |
| quiz-title     | Quiz Captain           | title  |  7500 |         500 |
| creative-title | Creative Spark         | title  |  5000 |           0 |
| night-title    | Night Owl              | title  |  4500 |           0 |
| sunrise-title  | Early Bird             | title  |  4500 |           0 |
| linux-title    | Linux Voyager          | title  |  9000 |        1000 |
| peace-title    | Peace Keeper           | title  |  6000 |         500 |
| legend-title   | Living Legend          | title  | 25000 |        5000 |
| curator-title  | Digital Curator        | title  |  8000 |        1000 |
| byte-fox       | Byte Fox               | pet    |  8000 |           0 |
| cloud-cat      | Cloud Cat              | pet    |  8000 |           0 |
| pixel-owl      | Pixel Owl              | pet    | 10000 |           0 |
| cyber-penguin  | Cyber Penguin          | pet    | 12000 |           0 |
| circuit-dragon | Circuit Dragon         | pet    | 20000 |           0 |
| comet-bunny    | Comet Bunny            | pet    |  9000 |           0 |
| star-emblem    | Starlight              | emblem |  4000 |           0 |
| leaf-emblem    | Green Leaf             | emblem |  3000 |           0 |
| bolt-emblem    | Lightning Bolt         | emblem |  4500 |           0 |
| moon-emblem    | Crescent Moon          | emblem |  4000 |           0 |
| shield-emblem  | Guardian Shield        | emblem |  5000 |           0 |
| heart-emblem   | Community Heart        | emblem |  3500 |           0 |
| pet-treat      | Companion treat        | tool   |   300 |           0 |

Permanent cosmetics are purchased once and never lower XP. There is one equipped cosmetic slot plus a separate companion slot; changing it preserves previously purchased items. Colours and titles appear on Alpha's generated Aura card, not the person's actual WhatsApp account or application theme. The primary creator can buy locked cosmetics with unlimited Aura; all other members must meet the XP and balance requirements.

A streak shield is used automatically only when a member returns after missing exactly one Lagos calendar day of daily claims. It preserves the ongoing claim streak but does NOT pay a reward for the missed day. Longer gaps reset the streak without wasting a shield. A replay of the same daily claim never consumes another shield.

A tagline ticket is consumed transactionally only after a valid short plain message is supplied. Formatting, control characters, mentions and web-link prefixes are rejected. The tagline stays on the Aura card until replaced using another ticket. Invalid input or replayed events do not consume an extra ticket.

## Free collection

Eight cards: Byte Bot, Linux Penguin, Neon Terminal, Lagos Sunset, Cyber Shield, Circuit Heart, Pixel Crown and Alpha Comet. Each eligible daily claim chooses a card the member does not already own; there are no paid mystery boxes or random wallet losses. Cards are saved globally with the wallet. Once all eight are collected, the member receives 2,500 Aura and the permanent Collection Curator badge exactly once. No further completion rewards can be claimed. This requires at least eight different claim days while Aura is active.

Illustrated card messages use a local bounded canvas and fall back to text if rendering fails. They do not download new media or call an image-generation provider.

## Safety, compatibility and deployment

Existing inventory arrays are retained. Consumable quantities and card collections are initialized lazily when a wallet mutates; no destructive migration is needed. All purchases, consumption, collection rewards and daily shield consumption use the existing MongoDB transaction and idempotency ledger. Concurrent purchases cannot overdraw a balance or exceed tool limits.

Deploy the commit using the normal Render workflow. Verify `$aurashop`, a free preview, one permitted purchase and inventory. No environment variables or dependencies are added. Use `$aurasystem off` to pause economic changes. For rollback, turn Aura off, revert this shop commit and restart; preserve all Aura collections for reconciliation. Previous code will retain unknown cosmetic IDs in saved inventories, although its old shop will not display their details.

## Inventory slots and expansion

New bags have eight slots. Each permanent shop item and each unit of a consumable takes one slot. Collection cards, badges, unlocked Evo stages and the already-applied tagline do not use bag slots. Existing larger inventories receive a permanent grandfathered floor equal to their pre-limit usage; no existing item is deleted. This floor is initialized only once, not raised by new purchases.

Use `$aurabag` to see used/free slots. `$aurabag expand --confirm` buys the next tier that actually adds space: 16 slots costs 5,000 Aura; 24 costs 12,000; 40 costs 25,000; 64 costs 50,000. Prices are per upgrade, not cumulative totals. Maximum normal capacity is 64. Upgrades do not occupy slots. Existing grandfathered bags larger than 64 remain safe. The creator spends no Aura but still follows bag and per-item quantity limits.

Full bags reject purchases before charging. Consume a tool or use `$aurasalvage ITEM` to preview removing one owned item for 25% of its current listed price. Add `--confirm` to proceed. Salvaging removes equipped state if needed, frees a slot, and pays no XP. Cards and badges cannot be salvaged. Creator salvage returns zero Aura. There is no resale profit loop: buying and salvaging an ordinary item loses 75% of its price.

## Companions

Browse `$aurashop pets`; buy a pet, then `$aurapet equip byte-fox` (or another owned pet ID). `$aurapet equip none` removes it from the profile without losing ownership. Companions are cosmetic names/bond displays, not autonomous AI, animated stickers or money generators.

Buy a pet-treat for 300 Aura, then `$aurause pet-treat`. It consumes one treat, frees a slot and adds one bond point to the active pet, capped at 100. At most three interactions per member per Lagos day across all pets. Bond is tracked separately for each pet. At ten bond points, unlock the permanent Companion Friend badge. Maximum-bond pets do not consume more treats. Pet treats stack to ten units; existing shields and tagline tickets still stack to three each.

The shop is paginated in eight-item pages: `$aurashop all 2`, or categories frames/titles/themes/tools/pets/emblems. Prices and XP requirements appear before purchase. Shop previews do not grant ownership.
