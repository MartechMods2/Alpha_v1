# Alpha Aura economy — owner setup and member guide

Aura is virtual currency with no cash value, purchases, withdrawals or cash betting. Only the FIRST number in the existing private `MY_NUMBER` environment setting is the creator with unlimited spending and gifting authority. Do not post the setting or credentials in a group. Group ownership, admin status, moderator status, message sender names and the generic `isOwner` flag do not grant unlimited Aura. Verified WhatsApp phone/LID mappings unify each member's global wallet; unresolved identities fail safely.

## Activation — OFF by default

Aura starts OFF when no activation record exists. Only the primary creator can run `$aurasystem on` or `$aurasystem off`. The setting is global and persists across restarts. Anyone can run `$aurasystem status`.

While OFF, ordinary commands use their normal permissions and provider quotas WITHOUT Aura fees. New Aura earnings, coupon redemption, gifts, transfers, purchases, Evo upgrades, ranked duels and drop broadcasts pause. Balances remain saved. Existing reservations can still settle/refund, and private journals, appeals and creator refunds remain accessible. Already-admitted operations may finish after a toggle; deactivation does not erase completed transactions. A database failure to read activation blocks a potentially priced request safely rather than silently bypassing an enabled economy.

`$auraguide 1`, `$auraguide 2` and `$auraguide 3` explain the full system to members, including while OFF. The creator can run `$auraannounce` inside a group to post a status introduction and all three guide pages. This is an explicit announcement command, never an automatic broadcast to every group.

## Before deployment

1. Use a transaction-capable MongoDB deployment (for example, an Atlas replica set). Existing `MONGODB_KEY` is reused. Aura refuses unsafe writes if the server cannot run transactions; it does not fall back to independent debit/credit updates. Indexes are created automatically. The database account needs normal collection/index creation and transactional read/write permission.
2. Confirm the FIRST international number in `MY_NUMBER` is your creator account. Only this account can mint gifts/coupons, configure drops or review penalties. Other numbers in the older setting do not receive Aura creator powers.
3. Deploy the commit and restart Alpha. Existing startup confirmation will identify the deployed commit. MongoDB and live WhatsApp still require a deployment smoke test.
4. Run `$aurasystem on` yourself when ready. Then, in EACH group you select, run `$auradrops on` yourself. Use `$auradrops off` to remove a group. Nothing is broadcast to all groups by default. At most 20 groups are selected.
5. As an ordinary test member, run `$daily`, `$balance`, `$quests 1`, and `$prices`. Then test one cheap command, its insufficient-funds response and a provider failure refund. Test a small owner gift before distributing a large amount.

No new API keys or payment integration are required. Existing provider keys/quotas still apply. Normal transport, media and safety limits remain in force for the creator too. To pause the entire economy, use `$aurasystem off`. To remove a selected drop group while the economy is ON, use `$auradrops off`. Aura prices are maintained in `utils/aura/policy.js`.

## What remains separate

- Existing virtual COINS and `$wallet` / `$dailycoins` / `$shop` are preserved; coins cannot pay Aura prices. Use `$balance` and `$aurashop` for Aura.
- Existing message-count ranks stay intact, with Master at 200,000, Grandmaster at 350,000, Legendary at 500,000 and Alpha Elite at 1,000,000 recorded messages. These do not mint Aura for message spam.
- Aura lifetime XP starts at zero and is earned from successful quests, daily claims and eligible ranked results. Spending never lowers XP.
- Aura ranked RP is an opt-in competition separate from existing game leaderboards. Existing Truth or Dare and other games remain available; they do not automatically mint Aura or lose RP. Aura awards are confined to the verified new ranked duel flow and learning quests.

## Expanded shop and collections

See [the shop guide](aura-shop.md) for the full 12-item catalogue, colour previews, XP unlocks, consumable inventory, automatic one-day streak shields, profile taglines and the free eight-card collection. Use `$aurashop`, `$aurainventory`, `$aurapreview ruby-frame`, `$auracollect` and `$auracollection`. These features follow the same OFF-by-default activation switch.

## Earning and gifting

| Command / activity                 | Reward / effect                                                        | Limit                                                                                |
| ---------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `$daily`                           | 500 Aura + 50 XP                                                       | Once per Lagos calendar day globally                                                 |
| Seven consecutive daily claims     | Extra 2,000 Aura + permanent streak badge                              | Each completed seven-day streak                                                      |
| `$quests 1` / `$quests 2`          | Show a technical/digital-safety multiple-choice quest                  | Two distinct quests daily; ten-minute expiry                                         |
| `$questanswer 1 2`                 | Answer quest 1 with option 2; a correct answer earns 750 Aura + 100 XP | One attempt per quest; wrong answers deduct nothing                                  |
| Ranked duel win                    | 1,000 Aura + 100 XP                                                    | First three eligible wins per day; further eligible wins can still earn XP/RP        |
| Lifetime XP promotion              | 1,000 + floor(total XP / 10) Aura, capped at 10,000, plus a rank badge | Once when crossing each XP rank threshold                                            |
| `$auragift @member 25000`          | Creator issues 25,000 Aura                                             | Combined gift/custom-coupon budget: 500,000 per Lagos day                            |
| `$auracoupon 20000`                | Creator gets an unpredictable redeem code in PRIVATE chat              | Value reserved against the same 500,000 daily budget, even if the code later expires |
| `$aurasend @member 1000 --confirm` | Member transfers 1,000 Aura, paying a 50 Aura fee                      | 10,000 per transfer; 20,000 principal daily; fee rounded upward                      |

Transfers without `--confirm` show the fee and total debit first. The creator uses `$auragift`, not member transfers. The creator cannot claim member coupons or scheduled prizes. Gifts and received transfers do not grant XP or competitive rank.

## Scheduled drops

08:00, 14:00 and 20:00, **Africa/Lagos**, each issue ONE globally shared 20,000-Aura coupon across the selected groups. Use `$redeem CODE` in a selected group. The first valid claim wins globally; one scheduled win per member per Lagos day. The code expires 30 minutes after creation. Custom creator coupons also expire after 30 minutes but are not subject to the scheduled-win limit.

Drop creation and delivery claims are persisted. Reconnects and restarts do not regenerate a slot's prize. A five-minute dispatch window tolerates normal scheduling delay; missed windows are skipped, not released in a burst. The bot must be running and connected to deliver a drop. Delivery is claimed before sending, so an uncertain/failed send is not automatically reposted; no claim of guaranteed exactly-once WhatsApp delivery is made.

## Member commands

Activation: `$aurasystem on` / `$aurasystem off` (creator only); `$aurasystem status` (everyone). Full guide: `$auraguide 1`, `2` or `3`. Group introduction: `$auraannounce` (creator only).

| Command                                          | Example / result                                                                         |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `$balance`, `$aura`, `$auraprofile`, `$aurarank` | Photo card showing your Aura, lifetime XP, ranked RP, Evo, conduct and selected cosmetic |
| `$auraboard`                                     | Current group's top ten Aura XP members; creator excluded; no global member directory    |
| `$aurabadges`                                    | Permanent Aura rank, Evo and streak badges                                               |
| `$prices`, `$auraprices`                         | Exact list of charged aliases and prices; all unlisted commands remain free              |
| `$transactions`, `$auratransactions`             | Last ten Aura ledger entries delivered to YOUR PRIVATE CHAT                              |
| `$aurashop`                                      | View Aura cosmetics and prices                                                           |
| `$aurabuy gold-title`                            | Buy once; 5,000 Aura                                                                     |
| `$aurabuy aurora-frame`                          | Buy once; 15,000 Aura                                                                    |
| `$aurabuy midnight-theme`                        | Buy once; 10,000 Aura                                                                    |
| `$aurainventory`                                 | View owned Aura cosmetics                                                                |
| `$auraequip aurora-frame`                        | Apply cosmetic colour border on `$auraprofile`                                           |
| `$evo`                                           | View permanent emblem upgrade requirements                                               |
| `$evo upgrade --confirm`                         | Buy next Evo stage after satisfying its quest requirement                                |
| `$aurarules`, `$aurahelp`                        | Rules and navigation                                                                     |

Cosmetics are applied to the bot-generated Aura card, not the member's actual WhatsApp avatar or WhatsApp application theme. Unavailable photos get the existing fallback. A title/colour is cosmetic, with no moderation powers or competitive advantage.

## Lifetime XP and Evo

XP thresholds: Rookie 0, Bronze 500, Silver 2,000, Gold 5,000, Platinum 12,000, Diamond 25,000, Master 50,000, Grandmaster 100,000, Legendary 200,000.

| Evo stage | Upgrade price | Total correct learning quests required |
| --------- | ------------: | -------------------------------------: |
| Spark     |          Free |                                      0 |
| Pulse     |         5,000 |                                      5 |
| Surge     |        15,000 |                                     20 |
| Nova      |        35,000 |                                     50 |
| Apex      |        75,000 |                                    100 |

Unlocked stages and earned badges are permanent. The creator can preview upgrades without the member's currency/quest requirements. No currency purchases can buy RP.

## Optional ranked arena

1. `$auraduel @member` creates an invitation in the group.
2. Only that opponent can `$auraaccept`; either invited member can `$auradecline` while pending.
3. After acceptance, a technical trivia question appears. Each invited member gets one `$auraanswer <answer>` attempt. The first correct answer wins.
4. A win adds 30 RP; a loss removes 15 RP. The first loss per Lagos day is protected. Promotion across a 300-RP tier grants two loss shields. Bronze provides a 300-RP floor once reached.
5. Invitations and questions expire after two minutes. No correct answer, bot failure or expiry means no Aura/RP loss. A pending result can recover after restart.
6. No more than three scored results per opponent pair daily or ten per member daily. Conduct below 60 prevents further scored results. Over-limit results settle without awards, preventing a stuck group duel.

Ranks: Rookie → Bronze → Silver → Gold → Platinum → Diamond → Master → Grandmaster → Legendary. Each tier covers 300 RP; the middle ranks have III/II/I divisions. Calendar-month seasons use Lagos time. On the member's first next-season ranked result, RP resets to half the previous value capped at 300; XP, Aura and cosmetics stay. Previous season and previous best RP are retained. No automatic end-of-season prize pool is currently minted.

## Deductions and appeals

Only the creator can run `$aurapenalty @member 1000 repeated command spam`. The FIRST reviewed incident per member each Lagos day records a warning with zero deduction. Further reviewed incidents may deduct up to 1,000 each, capped at 5,000 requested penalty Aura daily. Actual deduction is limited by the balance; it never becomes negative. A financial penalty also removes ten conduct points. A daily check-in restores one conduct point, up to 100.

These are MANUAL, reasoned creator reviews, not automatic fines for every spam/filter signal. Admins and moderators cannot mint or impose Aura penalties. Existing moderation sanctions remain separate. Conduct below 40 blocks paid Aura features; below 60 blocks scored Aura duels. Help, rules, privacy, appeals, daily recovery and essential moderation stay available.

Penalty receipts are attempted privately and remain in the ledger even if private delivery fails. Members can `$auraappeal RECEIPT reason for review`. The creator uses `$auraappeals` to get open appeal details privately, then `$aurarefund RECEIPT` to reverse a mistaken penalty once. Reversal restores the deducted amount and the conduct loss. Do not deduct for silence, normal losses, failed APIs or ordinary wrong answers. There are no random wallet losses, theft commands or cash betting.

## Paid command execution and refunds

Prices apply to registered aliases, natural-request routing through the registry, and each child of command batches. Only the actual configured primary creator bypasses charges. Before paid work starts, Aura reserves the cost in a transaction; insufficient funds prevent the handler from running. Commands costing 1,000 or more need a trailing `--confirm`, for example `$img a futuristic Lagos skyline --confirm` or replying to an image with `$removebg --confirm`.

A delivered supported media result, or an explicitly successful AI reply, retains the charge. Usage messages, cooldowns and provider failures refund the reservation. A duplicate event cannot execute and charge again. If the process dies before settlement, a one-minute maintenance tick releases reservations older than ten minutes. Thus a rare crash after delivery but before settlement may result in a free result, instead of a permanent unexplained charge. Database transaction failures do not trigger unsafe fallback writes.

Multi-step PDF merge reserves on each command but refunds steps that produce no final document; the final successful document is charged. Other existing command quotas and permission checks still apply. Unlisted AI integrations/utilities remain free unless explicitly listed below; this is an explicit policy, not a universal provider billing meter.

## Verification, monitoring and rollback

Local tests use synthetic identities, a snapshot/serial transaction simulator, mocked command flows and mocked Mongo sessions. They check simultaneous claims/debits, budgets, replay protection, refund settlement, rank changes, private delivery, identity resolution and scheduled delivery claims. These are not a live replica-set concurrency test or a live WhatsApp delivery test. Deployment smoke testing must verify your actual MongoDB permissions/topology and provider deliveries.

Aura indexes and transaction records are separate from existing data. Keep database backups. Ledger records intentionally have no automatic TTL so old message/coupon replays do not become new rewards. Monitor Aura collection/index size, stale reservations, scheduler warnings and issuance versus spend. Multiple phone accounts and colluding players remain possible; the daily caps reduce farming, they do not prove one account equals one human.

Rollback: turn off selected drops, revert the Aura implementation commit and restart the previous version. Keep Aura collections for reconciliation; do not delete them or convert existing coins. Existing commands return to previous behaviour after code rollback. Do not expose wallet journals or private database connection errors in public dashboards.

## Exact charged command aliases

### 500 Aura per successful result

- `$airewrite`, `$aipolish`, `$aishorten`, `$aiexpand`, `$aiproofread`, `$aigrammar`
- `$aiformaltone`, `$aicasualtone`, `$aiparagraph`, `$aibullets`, `$aisummarize`, `$aikeypoints`
- `$aiexplain`, `$aisimplify`, `$aieli5`, `$aifaq`, `$aiflashcards`, `$aistudyguide`
- `$ainotes`, `$aiglossary`, `$aibusinessplan`, `$aiswot`, `$aiproposal`, `$aiexecutivesummary`
- `$aibusinesscase`, `$airiskregister`, `$aistakeholdermap`, `$aisop`, `$aiprocessmap`, `$aidecisionmatrix`
- `$aiadcopy`, `$aicaption`, `$aihashtags`, `$aicampaign`, `$aicontentplan`, `$aibrandvoice`
- `$aipersona`, `$aivalueprop`, `$aisalespitch`, `$aicalltoaction`, `$aifollowup`, `$aiobjection`
- `$aicrmnote`, `$aileadqualify`, `$aicustomerservice`, `$airefundreply`, `$aicomplaintreply`, `$aiescalation`
- `$aitestimonial`, `$aicustomerfaq`, `$aimeetingminutes`, `$aiagenda`, `$aiactionitems`, `$aidecisionlog`
- `$aistandup`, `$airetro`, `$aioneonone`, `$aiteamupdate`, `$aihandover`, `$aibrief`
- `$ailessonplan`, `$aiquizmaker`, `$aiexamquestions`, `$aimarkingguide`, `$airubric`, `$aihomework`
- `$aiclassactivity`, `$ailearningobjectives`, `$airevisionplan`, `$aiteacherfeedback`, `$aibookoutline`, `$aichapteroutline`
- `$aiblurb`, `$aibackcover`, `$aieditorialreview`, `$aicopyedit`, `$aifactcheckplan`, `$aicontinuitycheck`
- `$aiageappropriate`, `$aicurriculummap`, `$airesume`, `$aicoverletter`, `$aiinterviewquestions`, `$aiinterviewprep`
- `$aijobdescription`, `$aiappraisal`, `$aiperformancereview`, `$aionboarding`, `$aitrainingplan`, `$aihiringrubric`
- `$aiplan`, `$aitodolist`, `$aipriority`, `$aitimeline`, `$aiprojectplan`, `$aimilestones`
- `$aichecklist`, `$aitemplate`, `$aigoals`, `$aiweeklyreview`, `$aibudget`, `$aiexpenseplan`
- `$aiinvoiceemail`, `$aipaymentreminder`, `$aifinancialsummary`, `$aicostcompare`, `$aiprofitideas`, `$aipricing`
- `$aiprocurement`, `$aivendorcompare`, `$aiemail`, `$aiwhatsapp`, `$aimemo`, `$ainotice`
- `$aiannouncement`, `$aiapology`, `$aithankyou`, `$aiinvitation`, `$airemindertext`, `$aifollowuptext`
- `$aistory`, `$aipoem`, `$aislogan`, `$aitagline`, `$ainameideas`, `$aibrainstorm`
- `$aiplot`, `$aicharacter`, `$aidialogue`, `$aispeech`, `$aicodeexplain`, `$aidebugplan`
- `$airefactorplan`, `$aitestcases`, `$aiunittestideas`, `$aiapidesign`, `$aidatamodel`, `$aisqlhelp`
- `$airegexhelp`, `$aigittest`, `$airesearchquestions`, `$aihypothesis`, `$ailiteraturereview`, `$aisourcechecklist`
- `$aicompare`, `$aitradeoffs`, `$aicauseeffect`, `$airootcause`, `$aifivewhys`, `$aiscenario`
- `$aimealplan`, `$aiworkoutplan`, `$aitravelplan`, `$aishoppinglist`, `$aihabitplan`, `$aijournalprompt`
- `$aiconversationstarter`, `$aigiftideas`, `$aiaffirmation`, `$aidecisioncoach`, `$aicreatorbrief`, `$aifeaturespec`
- `$aimvpplan`, `$aiproductconcept`, `$aiproductstory`, `$ailaunchnotes`, `$aibuildbrief`, `$aicreatorcheck`
- `$aiproductposition`, `$airoadmapreview`, `$aibugtriage`, `$aierroranalysis`, `$ailogreview`, `$aicodeaudit`
- `$aiperformanceplan`, `$aidependencyreview`, `$aireleasecheck`, `$aideploycheck`, `$aiincidentreview`, `$airegressionplan`
- `$aistudysession`, `$aimemoryhooks`, `$aipracticequestions`, `$aiconceptmap`, `$ailearningpath`, `$aiteachback`
- `$aistudycheck`, `$aiexamstrategy`, `$aiprogressreview`, `$aifocusplan`, `$aivoicenotereply`, `$aiconversationreply`
- `$aidifficultmessage`, `$aiboundarymessage`, `$ainegotiationmessage`, `$aiclarifymessage`, `$aiwhatsappstatus`, `$aigroupannouncement`
- `$aicheckinmessage`, `$aifriendlyreply`, `$aiicebreakerpro`, `$aihypothetical`, `$aiwouldyourather`, `$aitruthprompt`
- `$aidareprompt`, `$aichallengeidea`, `$aifunquestion`, `$aigroupgameidea`, `$aimemeconcept`, `$aibanterreply`
- `$aicounterargument`, `$aipremortem`, `$aidecisiontree`, `$aiassumptioncheck`, `$aievidencecheck`, `$aiblindspots`
- `$aicriteria`, `$aioptiongen`, `$aitwosidedview`, `$aiuncertainty`, `$aierrandplan`, `$aidailyplan`
- `$aimorningplan`, `$aieveningreview`, `$aipackinglist`, `$aicleaningplan`, `$aiorganizeplan`, `$aiweeklyreset`
- `$aieventplan`, `$aihomeproject`, `$aihookideas`, `$aivideooutline`, `$aishortscript`, `$aithumbnailtext`
- `$aicontentseries`, `$aireelidea`, `$aitiktokscript`, `$aiyoutubedesc`, `$aipostcarousel`, `$aicommentreply`
- `$aigroupicebreaker`, `$aigroupchallenge`, `$aiwelcomeidea`, `$aicelebrationmessage`, `$aigrouprecap`, `$aicommunityevent`
- `$aibirthdaymessage`, `$aiawardtitles`, `$aigrouprulesfriendly`, `$aiengagementplan`, `$aiportfolioreview`, `$aiprojectstory`
- `$ailinkedinsummary`, `$aiskillgap`, `$ailearningroadmap`, `$aicareeroptions`, `$aijobsearchplan`, `$ainegotiateoffer`
- `$aiperformancegoals`, `$ainetworkingmessage`, `$aiwildideas`, `$aiconstraintsprint`, `$aifeatureprioritize`, `$aiprototypeplan`
- `$aiexperimentdesign`, `$aiuserstories`, `$aiacceptancecriteria`, `$aiproductrisks`, `$aibetaquestions`, `$aifeedbackanalysis`
- `$aireadability`, `$aiclarityscore`, `$aiaudiencefit`, `$aifirstdraft`, `$aisecondpass`, `$aiconciseedit`
- `$aiplainenglish`, `$aiexamplemaker`, `$aianalogy`, `$aiquestionimprove`

### 2500 Aura per successful result

- `$img`, `$imagegen`, `$drawai`, `$aipicture`

### 1000 Aura per successful result

- `$voice`, `$voiceask`, `$askvoice`, `$aivoice`, `$vnote`

### 300 Aura per successful result

- `$say`, `$speak`, `$tts`

### 500 Aura per successful result

- `$alpha`, `$gemini`, `$stylealpha`

### 100 Aura per successful result

- `$textsticker`, `$ts`, `$reactionsticker`, `$sticker`, `$s`, `$steal`
- `$stealn`, `$videosticker`, `$gifsticker`, `$image`, `$toimg`

### 1500 Aura per successful result

- `$aisticker`, `$cutoutsticker`, `$removebg`, `$bg`

### 1000 Aura per successful result

- `$transcribe`, `$voicesummary`, `$voicetranslate`

### 1000 Aura per successful result

- `$autocaption`

### 300 Aura per successful result

- `$img2pdf`, `$pdf2img`, `$pdfmerge`, `$pdfsplit`, `$pdfcompress`

All commands not listed above remain free.
