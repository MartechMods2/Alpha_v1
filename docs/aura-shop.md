# Aura shop, inventory and collections

The existing Aura activation switch still applies: everything starts OFF unless the primary creator explicitly enabled it with `$aurasystem on`. Browsing, item details, previews and inventory remain available while OFF. Purchases, equipping, item use and collectible claims require Aura to be ON. No changes to owner authority, daily gift limits, legacy coin wallets or existing balances are made.

## Commands

| Command          | Example                                   | Purpose                                                        |
| ---------------- | ----------------------------------------- | -------------------------------------------------------------- |
| `aurashop`       | `$aura shop frames`                        | Browse all / frames / titles / themes / tools / pets / emblems                  |
| `auraitem`       | `$auraitem streak-shield`                 | See price, effect and unlock requirement                       |
| `aurapreview`    | `$aurapreview ruby-frame`                 | Free photo-card preview; does not buy or equip                 |
| `aurabuy`        | `$aurabuy ruby-frame`                     | Buy a known item ID at its displayed price                     |
| `aurainventory`  | `$aurainventory`                          | Owned cosmetics, tool quantities, card count and equipped item |
| `auraequip`      | `$auraequip ruby-frame`                   | Equip an owned cosmetic; `$auraequip none` restores default    |
| `aurause`        | `$aurause tagline-ticket Hello community` | Consume a ticket to set a plain 1–40-character tagline         |
| `auracollect`    | `$auracollect`                            | Claim one free new illustrated collection card per Lagos day   |
| `auracollection` | `$auracollection`                         | Show all eight cards and collection progress                   |

## Stock and prices — 53 items (creator draft prices)

Sorted highest to lowest. The bot reads editable JSON at startup; the live catalogue is authoritative after later edits.

| Item ID | Name | Type | Aura | Unlock |
| --- | --- | --- | ---: | --- |
| legendary-celestial-dragon | Legendary+ Celestial Dragon | pet | 800,000,000 | Evo-Legendary+ |
| legendary-crown | Legendary+ Sovereign Crown | emblem | 600,000,000 | Evo-Legendary+ |
| legendary-cosmos-theme | Legendary+ Cosmos | theme | 500,000,000 | Evo-Legendary+ |
| evo-phoenix | Evo Phoenix | pet | 80,000,000 | Evo |
| evo-crest | Evo Crest | emblem | 60,000,000 | Evo |
| evo-nebula-theme | Evo Nebula | theme | 50,000,000 | Evo |
| tech-title | Terminal Explorer | title | 40,000,000 | 500 XP |
| legend-frame | Legend frame | frame | 1,500,000 | 5000 XP |
| veteran-title | Community Veteran | title | 1,200,000 | 2000 XP |
| linux-title | Linux Voyager | title | 900,000 | 1000 XP |
| royal-frame | Royal frame | frame | 900,000 | 2000 XP |
| emerald-frame | Emerald frame | frame | 800,000 | None |
| ocean-frame | Ocean frame | frame | 700,000 | None |
| ruby-frame | Ruby frame | frame | 600,000 | None |
| quiz-title | Quiz Captain | title | 500,000 | 500 XP |
| midnight-theme | Midnight theme | theme | 300,000 | None |
| circuit-dragon | Circuit Dragon | pet | 200,000 | None |
| aurora-frame | Aurora frame | frame | 150,000 | None |
| ice-frame | Ice Crystal | frame | 150,000 | None |
| rose-frame | Rose Quartz | frame | 140,000 | None |
| lunar-frame | Lunar Halo | frame | 120,000 | None |
| solar-frame | Solar Flare | frame | 100,000 | None |
| gold-title | Golden Voice | title | 90,000 | None |
| neon-frame | Neon Circuit | frame | 90,000 | None |
| legend-title | Living Legend | title | 25,000 | 5000 XP |
| sapphire-frame | Sapphire Crown | frame | 18,000 | None |
| obsidian-frame | Obsidian Edge | frame | 14,000 | None |
| cyber-penguin | Cyber Penguin | pet | 12,000 | None |
| firefly-frame | Firefly Glow | frame | 12,000 | None |
| cyber-theme | Cyber Night | theme | 11,000 | None |
| pixel-owl | Pixel Owl | pet | 10,000 | None |
| comet-bunny | Comet Bunny | pet | 9,000 | None |
| arctic-theme | Arctic Blue | theme | 8,000 | None |
| byte-fox | Byte Fox | pet | 8,000 | None |
| cloud-cat | Cloud Cat | pet | 8,000 | None |
| curator-title | Digital Curator | title | 8,000 | 1000 XP |
| sunset-theme | Lagos Sunset | theme | 8,000 | None |
| forest-theme | Forest Retreat | theme | 7,000 | None |
| lavender-theme | Lavender Lounge | theme | 7,000 | None |
| coffee-theme | Coffee Corner | theme | 6,000 | None |
| peace-title | Peace Keeper | title | 6,000 | 500 XP |
| creative-title | Creative Spark | title | 5,000 | None |
| shield-emblem | Guardian Shield | emblem | 5,000 | None |
| bolt-emblem | Lightning Bolt | emblem | 4,500 | None |
| night-title | Night Owl | title | 4,500 | None |
| sunrise-title | Early Bird | title | 4,500 | None |
| moon-emblem | Crescent Moon | emblem | 4,000 | None |
| star-emblem | Starlight | emblem | 4,000 | None |
| heart-emblem | Community Heart | emblem | 3,500 | None |
| leaf-emblem | Green Leaf | emblem | 3,000 | None |
| streak-shield | Daily streak shield | tool | 2,000 | None |
| tagline-ticket | Profile tagline ticket | tool | 1,000 | None |
| pet-treat | Companion treat | tool | 300 | None |

Permanent cosmetics are purchased once and never lower XP. There is one equipped cosmetic slot plus a separate companion slot; changing it preserves previously purchased items. Colours and titles appear on Alpha's generated Aura card, not the person's actual WhatsApp account or application theme. The primary creator can buy locked cosmetics with unlimited Aura; all other members must meet the XP and balance requirements.

A streak shield is used automatically only when a member returns after missing exactly one Lagos calendar day of daily claims. It preserves the ongoing claim streak but does NOT pay a reward for the missed day. Longer gaps reset the streak without wasting a shield. A replay of the same daily claim never consumes another shield.

A tagline ticket is consumed transactionally only after a valid short plain message is supplied. Formatting, control characters, mentions and web-link prefixes are rejected. The tagline stays on the Aura card until replaced using another ticket. Invalid input or replayed events do not consume an extra ticket.

## Free collection

Eight cards: Byte Bot, Linux Penguin, Neon Terminal, Lagos Sunset, Cyber Shield, Circuit Heart, Pixel Crown and Alpha Comet. Each eligible daily claim chooses a card the member does not already own; there are no paid mystery boxes or random wallet losses. Cards are saved globally with the wallet. Once all eight are collected, the member receives 2,500 Aura and the permanent Collection Curator badge exactly once. No further completion rewards can be claimed. This requires at least eight different claim days while Aura is active.

Illustrated card messages use a local bounded canvas and fall back to text if rendering fails. They do not download new media or call an image-generation provider.

## Safety, compatibility and deployment

Existing inventory arrays are retained. Consumable quantities and card collections are initialized lazily when a wallet mutates; no destructive migration is needed. All purchases, consumption, collection rewards and daily shield consumption use the existing MongoDB transaction and idempotency ledger. Concurrent purchases cannot overdraw a balance or exceed tool limits.

Deploy the commit using the normal Render workflow. Verify `$aura shop`, a free preview, one permitted purchase and inventory. No environment variables or dependencies are added. Use `$aurasystem off` to pause economic changes. For rollback, turn Aura off, restore a tested compatible commit and restart; preserve all Aura collections for reconciliation. Previous code will retain unknown cosmetic IDs in saved inventories, although its old shop will not display their details.

## Inventory slots and expansion

New bags have 20 slots. Each permanent shop item and each unit of a consumable takes one slot. Collection cards, badges, unlocked Evo stages and the already-applied tagline do not use bag slots. Existing larger inventories receive a permanent grandfathered floor equal to their pre-limit usage; no existing item is deleted. This floor is initialized only once, not raised by new purchases.

Use `$aurabag` to see used/free slots. `$aurabag expand --confirm` buys the next tier that actually adds space: 24 slots costs 120,000 Aura; 40 costs 250,000; 64 costs 500,000; 128 costs 2,000,000. After rank unlock, Evo storage costs 75,000,000 for 10,000 total slots; Evo-Legendary+ storage costs 5,000,000,000 for 9,999,999 total slots. Prices are per upgrade, not cumulative totals. Maximum ordinary capacity is 128. Upgrades do not occupy slots. Existing grandfathered bags larger than ordinary capacity remain safe. The creator spends no Aura but still follows bag and per-item quantity limits.

Full bags reject purchases before charging. Consume a tool or use `$aurasalvage ITEM` to preview removing one owned item for 25% of the lower of its current and recorded purchase prices. Add `--confirm` to proceed. Salvaging removes equipped state if needed, frees a slot, and pays no XP. Cards and badges cannot be salvaged. Creator salvage returns zero Aura. There is no resale profit loop: buying and salvaging an ordinary item loses 75% of its price.

## Companions

Browse `$aura shop pets`; buy a pet, then `$aurapet equip byte-fox` (or another owned pet ID). `$aurapet equip none` removes it from the profile without losing ownership. Companions are cosmetic names/bond displays, not autonomous AI, animated stickers or money generators.

Buy a pet-treat for 300 Aura, then `$aurause pet-treat`. It consumes one treat, frees a slot and adds one bond point to the active pet, capped at 100. At most three interactions per member per Lagos day across all pets. Bond is tracked separately for each pet. At ten bond points, unlock the permanent Companion Friend badge. Maximum-bond pets do not consume more treats. Pet treats stack to ten units; existing shields and tagline tickets still stack to three each.

The shop is paginated in eight-item pages: `$aura shop all 2`, or categories frames/titles/themes/tools/pets/emblems/evo/legendary. Prices and XP requirements appear before purchase. Shop previews do not grant ownership.

## Owner: edit prices without changing JavaScript

Edit **config/aura-prices.json** in GitHub. This is the live pricing configuration, not just a reference list. It includes all 53 shop products, six paid bag upgrades, six paid Evo upgrades and all existing paid command groups. Numbers are Aura, not naira. No payment account or secret belongs in this file.

1. Open the file in your repository, click the pencil icon, and change only the numbers after the colons.
2. For example, change `"byte-fox": 8000` to `"byte-fox": 6000` in `shop`, or `"24": 120000` to `"24": 90000` in `bags`.
3. Keep IDs, quotation marks, braces and commas intact. JSON does not allow comments or trailing commas. Every editable price must be a whole number between 1 and 10,000,000,000 (command-group prices remain limited to 10,000). The starter bag and Spark stage remain free. Removing an entry restores its built-in default; it does not remove the product.
4. Validate locally with `node --input-type=module -e "await import('./utils/aura/policy.js'); await import('./utils/aura/inventory.js'); console.log('Aura prices valid')"` and `npm test` if you have the project on your computer. A misspelled ID, invalid amount or invalid JSON stops startup rather than silently charging a different amount.
5. Commit the edit to main and redeploy/restart Alpha using your normal hosting workflow. Prices are read once when the process starts; editing the file does not update an already-running instance. Restart every instance with the same commit.
6. Check `$aura shop pets`, `$auraitem byte-fox`, `$aurabag`, `$auraprices` and `$aura evo` as appropriate. The current in-bot price is authoritative; the stock table earlier in this guide lists initial defaults.

`shop` uses product IDs. `bags` uses the target capacity, not extra slots: `24` upgrades a qualifying bag to 24 total slots. Each upgrade has its own full price. `evo` uses stage names and leaves quest requirements unchanged. `commands` uses the first command in each existing alias group; changing it applies to every alias in that group. It cannot make an arbitrary new command chargeable.

Previously completed purchases and ledger receipts are not rewritten; there are no retroactive charges or refunds. Salvage uses 25% of the lower of current and recorded purchase price. Legacy items without cost records use conservative original catalogue prices, preventing resale profit from price increases. Plan changes accordingly and pause with `$aurasystem off` while making major economy changes. Restore the previous JSON in GitHub and restart to roll prices back. Owner recognition, reward amounts, fees, XP gates, quantity limits and bag sizes are not changed by this price file. Only people with repository write access should edit it; group admins cannot change it through chat.

## Complete member walkthrough

1. **Check your wallet:** `$balance`. Ask the owner to enable Aura if purchases say OFF. Earn through the existing `$daily`, `$quests` and redeem systems; see `$auraguide` for the economy rules.
2. **Browse:** `$aura shop` shows the first eight items. Use `$aura shop all 2` for the next page. Categories are `frames`, `titles`, `themes`, `tools`, `pets`, `emblems`, `evo` and `legendary`, for example `$aura shop themes`.
3. **Inspect first:** `$auraitem ruby-frame` shows price and requirements. `$aurapreview ruby-frame` produces a free preview, without buying it.
4. **Buy:** `$aurabuy ruby-frame`. Items below 100,000 Aura charge immediately. For 100,000 or more, repeat with `--confirm` after reading the price. You need enough Aura, any required lifetime XP, one free inventory slot, and room below the item's quantity limit. A permanent item cannot be bought twice while owned.
5. **Equip:** `$auraequip ruby-frame`, then `$auraprofile`. There is one cosmetic slot: choosing a title, emblem or theme replaces the currently equipped cosmetic, but retains ownership. `$auraequip none` restores the default. This changes Alpha's generated card, not your WhatsApp app appearance.
6. **Manage storage:** `$aurainventory` lists your possessions; `$aurabag` shows capacity. When full, consume a tool, salvage an item or use `$aurabag expand --confirm`. The upgrade charges the displayed price and adds no item to the bag. Each consumable unit occupies one slot.
7. **Use tools:** buy `$aurabuy tagline-ticket`, then `$aurause tagline-ticket Hello community`. A ticket changes your profile tagline and is consumed. Keep the text within 40 characters, without links, mentions or formatting. Streak shields work automatically on the next daily claim after exactly one missed Lagos day; do not try to equip them.
8. **Adopt a companion:** `$aurabuy byte-fox`, then `$aurapet equip byte-fox`. View `$aurapet` or `$auraprofile`. A pet has its own slot alongside your cosmetic. `$aurapet equip none` hides it but does not delete ownership or free a bag slot.
9. **Build friendship:** `$aurabuy pet-treat`, then `$aurause pet-treat`. One treat adds one bond point, up to three interactions per member per Lagos day across all pets. Ten bond points grants Companion Friend; 100 is the maximum. Treats give no Aura, XP or competitive power.
10. **Salvage carefully:** `$aurasalvage ruby-frame` previews the refund. `$aurasalvage ruby-frame --confirm` removes one item permanently and refunds 25% of the lower of current and recorded purchase prices, rounded down. Equipped items are unequipped automatically. To own it again you must buy it again. Cards and badges cannot be salvaged. The creator receives no salvage refund.
11. **Collect free cards:** `$auracollect` once per Lagos day, then `$auracollection`. Eight different cards complete the album and award 2,500 Aura plus Collection Curator once. Cards and badges never take bag slots. These illustrated cards are separate from paid cosmetics.

### Common questions

- **Why was a purchase refused?** Read the reply: Aura may be OFF, your balance or XP too low, your bag full, the tool quantity limit reached, or the permanent item already owned. Use the exact item ID rather than its display name.
- **Can I stack tools?** Up to three streak shields, three tagline tickets and ten pet treats, subject to bag space. Buy one unit per command.
- **Does removing equipment free space?** No. You still own it. Consuming or salvaging frees space.
- **Does changing prices delete anything?** No. Ownership, equipped items, bag capacity, bond and badges remain.
- **Can pets earn money or attack members?** No; they are cosmetic companions.
- **What is private?** `$transactions` sends your Aura transaction history to your personal chat. Shop browsing and card displays reply in the chat where you used the command; avoid putting private details in a tagline.
- **Which inventory should I use?** These features use `$aura shop` and `$aurainventory`. The older `$shop` and `$inventory` belong to Alpha's separate legacy coin system.
- **Who has unlimited Aura?** Only the configured primary creator. The creator still follows bag and tool quantity limits. Admin status alone grants no unlimited balance.

## One starting command

All old commands still work. Members only need `$aura`: use `$aura shop` and `$aura evo` to reach shopping and progression.

| Command | Example | Action |
| --- | --- | --- |
| `$aura` | `$aura` | Profile, balance, XP and Evo rank |
| `$aura daily` | `$aura daily` | Daily claim |
| `$aura quests` | `$aura quests 1` | Open a quest |
| `$aura answer` | `$aura answer 1 2` | Answer quest 1 with option 2 |
| `$aura redeem` | `$aura redeem CODE` | Redeem a code |
| `$aura inventory` | `$aura inventory` | Owned items |
| `$aura bag` | `$aura bag expand --confirm` | Preview or buy next storage tier |
| `$aura prices` | `$aura prices` | Current command fees |
| `$aura guide` | `$aura guide 2` | Full member guide |
| `$aura history` | `$aura history` | Private history |
| `$aura shop` | `$aura shop legendary` | Illustrated catalogue |
| `$aura shop buy` | `$aura shop buy ruby-frame --confirm` | Buy one item |
| `$aura shop item` | `$aura shop item ruby-frame` | Price and requirements |
| `$aura shop preview` | `$aura shop preview ruby-frame` | Free preview |
| `$aura shop equip` | `$aura shop equip ruby-frame` | Equip an owned cosmetic |
| `$aura shop use` | `$aura shop use pet-treat` | Consume a tool |
| `$aura shop pet` | `$aura shop pet equip byte-fox` | Equip an owned pet |
| `$aura shop salvage` | `$aura shop salvage ruby-frame --confirm` | Remove one item for the quoted refund |
| `$aura shop collect` | `$aura shop collect` | Free daily card |
| `$aura shop album` | `$aura shop album` | Album progress |
| `$aura evo` | `$aura evo upgrade --confirm` | Show ranks or buy the next stage |

## Evo and Evo-Legendary+ prestige

Evo is a permanent purchased rank track, separate from XP ranks and seasonal RP. Existing stage indices are preserved. Each stage requires the previous stage, its own full price and the total completed quests below.

| Stage | Aura price | Total quests |
| --- | ---: | ---: |
| Spark | 0 | 0 |
| Pulse | 50,000 | 5 |
| Surge | 150,000 | 20 |
| Nova | 350,000 | 50 |
| Apex | 750,000 | 100 |
| Evo | 100,000,000 | 200 |
| Evo-Legendary+ | 1,000,000,000 | 500 |

At Evo, receive the purple **Evo Sovereign Frame** and permanent **Evo Sovereign** title. At Evo-Legendary+, receive the gold **Legendary+ Infinity Frame** and permanent **Evo-Legendary+ Sovereign** title. The frame is automatically equipped and appears in the upgrade announcement and profile. The title stays visible if another cosmetic is equipped. No tier grants moderation, owner authority, extra income or command-fee bypasses.

Awarded frames occupy no bag slots and cannot be salvaged. Re-equip an earned reward with `$aura shop equip evo-sovereign-frame` or `$aura shop equip legendary-infinity-frame`. XP ranks remain unchanged.

Evo unlocks optional Nebula theme, Phoenix pet and Crest emblem purchases. Evo-Legendary+ unlocks Cosmos theme, Celestial Dragon pet and Sovereign Crown emblem purchases. These six optional items cost 50–800 million Aura and use bag slots. A rank purchase does not automatically purchase optional items or storage.

Storage is sparse: 9,999,999 is a capacity number, not millions of allocated empty records. Unique-item ownership, tool quantity limits and processing limits still apply. Old 16-slot bags now have at least 20 slots; larger existing bags and all possessions are preserved.

## Presentation, safeguards and deployment

The shop uses a locally rendered 1000×1420 PNG: eight products per page, highest price first, with purple/gold prestige accents. Its caption repeats the IDs, prices and unlock requirements for accessible copy/paste. A bounded 16-page public-image cache avoids repeated rendering. Failed rendering falls back to complete text. No image-generation service or API fee is needed.

Purchases costing 100,000+ Aura, storage expansions and evolution need explicit confirmation. Transactions and duplicate-event receipts remain atomic. New purchases save their cost basis; salvage is capped at 25% of the lower of that cost and current price. Tools consume their oldest cost record first. Legacy purchases use conservative original catalogue prices. Awarded prestige frames cannot be sold.

All prices remain provisional and editable in `config/aura-prices.json`. Creator gifts/custom coupons still share the 500,000 daily limit. Billion-Aura tiers are intentionally long-term goals; earning rates are unchanged.

Validate with `npm run check` and `npm test`. Deploy all instances at one commit, then check `$aura shop`, `$aura bag`, `$aura guide 2` and `$aura evo`. The saved Aura activation setting is unchanged. Pause with `$aurasystem off` if needed. For rollback, use code that understands seven Evo stages, or reconcile stage-5/6 wallets before returning to older code: older versions directly index a five-stage array and cannot safely display new stages. Preserve all wallets and ledger records.

## Member sharing and social play

Only `$aura` needs to be memorized. Use `$aura shop`, `$aura send`, `$aura thanks` and `$aura evo`. Help hides the full compatibility alias list; old commands remain functional.

| Action | Preview / use | Confirm |
| --- | --- | --- |
| Send Aura | `$aura send @member 1000` | `$aura send @member 1000 --confirm` |
| Gift one item | `$aura shop gift @member byte-fox` | `$aura shop gift @member byte-fox --confirm` |
| Thank a member | `$aura thanks @member` | No financial charge or confirmation |

Mention the recipient, or reply to their message. Aura transfers retain the 5% rounded-up fee, 10,000 per-transfer maximum and 20,000 daily outgoing principal limit. The primary creator can use the same `$aura send` interface for fee-free owner gifts under the existing combined 500,000 daily gift/coupon budget. Every send needs confirmation through this grouped interface. Failed private notifications do not roll back successful transfers; both users can read `$aura history` privately. Duplicate transfer events do not notify the recipient again.

Item gifts transfer **one already-owned item** at no Aura fee, capped at ten per sender per Lagos day. The recipient must meet XP/Evo requirements, have a free slot, not already own a permanent item, and have room below tool quantity limits. A full bag, invalid recipient, locked item or repeated event cannot consume the sender's item. Equipped gifts are unequipped automatically. Gifts are final; there is no trade escrow, sale marketplace, borrowing or automatic recall.

Pet friendship stays with each member rather than moving with the pet. Gifts do not equip themselves on the recipient. Original purchase costs follow the item, so gifting cannot reset its salvage value. Creator-origin items carry zero refundable cost. Prestige frames, awarded titles, ranks, XP, badges, storage upgrades and album cards cannot be transferred. Item gifts and received thanks have private ledger entries; public gift acknowledgements mention the two selected members without displaying balances or financial history.

Use `$aura thanks @member` to spotlight a helpful member. Each sender can thank three different members per Lagos day, once per recipient daily. Thanks from ten different members grants **Community Favourite**. Gifting to five different members grants **Community Giver**. Both are cosmetic social badges: they pay no Aura or XP and grant no permissions. They are not proof of trustworthiness or moderation status. All sharing and thanks pause when Aura is OFF.

The shop continues to use a local, bounded PNG renderer and a readable caption. These social actions do not introduce an image-generation provider, external payment service or new dependency.


## Reviewed sharing safeguards

Use `$aura help` for a short, ready-to-forward member guide; `$aura guide` keeps the full three-page version. A transfer/gift accepts exactly one selected recipient and one amount/item, rejecting ambiguous inputs before any wallet changes. Transfer previews name the recipient. Private `$aura history` includes item IDs and thanks totals. New social badges count distinct recipient/thank-you accounts using bounded tracking (five/ten entries); existing badges remain. Distinct accounts do not prove distinct humans. See [the review report](aura-review.md) for tested fixes and limitations.


## Deep-audit follow-up

See [the extensive Aura audit](aura-deep-audit.md) for findings, regression coverage and deployment/rollback steps. Pending paid-feature fees are reserved rather than spendable; the profile displays the known reserved total. Wallet capacity includes pending fees so later refunds keep their headroom. Expired unanswered quests may be re-opened, while completed attempts cannot be reset. The free first daily ranked loss preserves promotion shields. Operational failures show safe recovery guidance: check private history before starting a new financial request after an uncertain acknowledgement.
