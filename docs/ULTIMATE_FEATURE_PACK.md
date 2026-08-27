# Alpha Ultimate Feature Pack

Examples use `-` as the prefix. Replace it if the Render `PREFIX` differs. Member data is group-specific, review queues are admin-only, and smart auto-reply is disabled by default.

The pack was informed by the modular command, scheduled-message, configurable auto-reply, privacy, game and group-protection patterns documented by [MEGA-MD](https://github.com/GlobalTechInfo/MEGA-MD), [Atlas-MD](https://github.com/FantoX/Atlas-MD), [Knight Bot](https://github.com/wambugu71/whatsapp_bot), and the current [Baileys](https://github.com/WhiskeySockets/Baileys) event model. The implementation here is original and uses Alpha’s existing MongoDB, queue, point and moderation systems.

## Community profiles and reputation

| Command | Usage and example |
|---|---|
| `-communityhelp` | Show the community menu: `-communityhelp` |
| `-mybio set/show/clear` | `-mybio set Front-end developer and football fan` |
| `-nickname set/show/list/clear` | `-nickname set Captain T` |
| `-giverep @member` | Appreciate one member once daily: `-giverep @Ada` |
| `-reputation [@member]` | `-reputation @Ada` |
| `-repboard` | Show the reputation leaderboard |

## Suggestions, confessions and support

| Command | Usage and example |
|---|---|
| `-suggest <message>` | Submit for admin approval: `-suggest Hold game night on Friday` |
| `-suggestions` | Show approved suggestions |
| `-confess <message>` | Anonymous submission for admin review |
| `-confessions` | Show approved anonymous confessions |
| `-ticket open <message>` | `-ticket open I cannot access the shared file` |
| `-mytickets` | List your ticket statuses |
| `-ticket close <number>` | `-ticket close 1` |
| `-reportmember @member <reason>` | Privately report a member to admins |

## Group organisation

| Command | Usage and example |
|---|---|
| `-lost add/list/found` | `-lost add Black USB drive last seen in class` |
| `-market add Item \| details` | Approval required: `-market add Textbook \| ₦3,000, clean copy` |
| `-market list/remove` | `-market remove 1` |
| `-faq [search]` | `-faq meeting time` |
| `-checkin` | Check in once for today |
| `-attendance` | Show today’s attendance |
| `-rsvp <event> yes/no/maybe` | Choose an event from `-calendar`: `-rsvp 1 yes` |
| `-rsvplist <event>` | `-rsvplist 1` |
| `-standup yesterday \| today \| blocker` | `-standup Finished ch. 2 \| Edit ch. 3 \| none` |
| `-standups` | Show today’s updates |

## Habits, goals and deadlines

| Command | Usage and example |
|---|---|
| `-productivityhelp` | Show the productivity menu |
| `-habit add/list/check/stats/remove` | `-habit add Read for 30 minutes`; `-habit check 1` |
| `-habits` | List active habits |
| `-goal add Name \| target` | `-goal add Read books \| 12` |
| `-goal progress <number> <value>` | `-goal progress 1 5` |
| `-goal list/remove` / `-goals` | Manage measurable goals |
| `-deadline add YYYY-MM-DD \| task` | `-deadline add 2026-09-30 \| Submit project` |
| `-deadline list/done/remove` / `-deadlines` | `-deadline done 1` |

## Study tools and calculations

| Command | Usage and example |
|---|---|
| `-flashcard add question \| answer` | `-flashcard add Capital of Nigeria? \| Abuja` |
| `-flashcard list/quiz/reveal/remove` / `-flashcards` | `-flashcard quiz` |
| `-studyroom start/join/status/end` | `-studyroom start Maths Revision` |
| `-pomodoro <1-120 minutes>` | `-pomodoro 25` |
| `-pomodorostop` | Cancel your active focus timer |
| `-expensesplit <amount> @members` | `-expensesplit 15000 @Ada @Tunde @Musa` |
| `-tipcalc <amount> <percent>` | `-tipcalc 25000 10` |
| `-percentage <part> <total>` | `-percentage 45 60` |
| `-datecalc <date1> <date2>` | `-datecalc 2026-09-01 2026-12-25` |
| `-randompick option1 \| option2` | `-randompick Rice \| Yam \| Beans` |

## Arcade Plus

Winners receive existing Alpha game points. Rounds expire automatically and actions are rate-limited.

| Start command | Answer/action command and example |
|---|---|
| `-arcadehelp` | Show the game menu |
| `-hangman` | `-guess <letter/word>` |
| `-wordchain` | `-word <word>` |
| `-anagram` | `-unscramble <word>` |
| `-mathrace` | `-mathanswer <answer>` |
| `-cryptogram` | `-cryptoanswer <decoded word>` |
| `-sequencequiz` | `-sequenceanswer <number>` |
| `-wordclue` | `-clueanswer <word>` |
| `-cardguess` | `-cardanswer higher/lower/same` |
| `-capitalquiz` | `-capitalanswer <city>` |
| `-storychain add/show/reset` | `-storychain add The door opened slowly.` |
| `-bingostart` | Start Bingo |
| `-bingocard` | Generate your five-number card |
| `-bingocall` | Call the next number |
| `-bingo` | Claim after every card number is called |
| `-quickdraw` | Start a reaction round |
| `-quicktap` | Send only after Alpha says GO |

## Alpha Text Lab

These tools run locally and need no API key.

| Command | Example |
|---|---|
| `-uppercase` | `-uppercase welcome to alpha` |
| `-lowercase` | `-lowercase HELLO WORLD` |
| `-titlecase` | `-titlecase the future of learning` |
| `-reverse` | `-reverse Alpha` |
| `-wordcount` | `-wordcount Count these words` |
| `-charcount` | `-charcount Hello world` |
| `-readingtime` | `-readingtime <long text>` |
| `-slugify` | `-slugify Alpha Feature Pack` |
| `-base64encode` / `-base64decode` | `-base64encode Hello`; `-base64decode SGVsbG8=` |
| `-urlencode` / `-urldecode` | `-urlencode Alpha bot & friends` |
| `-sha256` | `-sha256 verify this text` |
| `-uuid` | Generate a UUID |
| `-password [8-64]` | `-password 20` |
| `-timestamp` | Show Unix and ISO time |
| `-hexrgb` / `-rgbhex` | `-hexrgb #33AAFF`; `-rgbhex 51 170 255` |
| `-roman` / `-fromroman` | `-roman 49`; `-fromroman XLIX` |
| `-binary` / `-decimal` | `-binary 42`; `-decimal 101010` |
| `-morse` / `-unmorse` | `-morse help`; `-unmorse .... . .-.. .--.` |
| `-unitconvert` | `-unitconvert 5 km m` |
| `-sortlines` | `-sortlines Zebra \| Apple \| Mango` |
| `-uniquelines` | `-uniquelines Apple \| Mango \| Apple` |
| `-shufflewords` | `-shufflewords one two three four` |
| `-numberlist` | `-numberlist Rice \| Beans \| Yam` |

Unit symbols: `mm`, `cm`, `m`, `km`, `in`, `ft`, `yd`, `mi`, `mg`, `g`, `kg`, `lb`, `oz`, `ml`, `l`, `cup`, `gal`.

## Admin review and automation

| Command | Usage and example |
|---|---|
| `-suggestionqueue` | List pending suggestions |
| `-suggestionreview approve/reject <number>` | `-suggestionreview approve 1` |
| `-confessionqueue` | List pending confessions |
| `-confessionreview approve/reject <number>` | `-confessionreview reject 2` |
| `-reportqueue` | List open member reports |
| `-resolvereport <number> [note]` | `-resolvereport 1 warned both members` |
| `-ticketadmin list/close` | `-ticketadmin close 1 issue resolved` |
| `-faqadmin add question \| answer` | `-faqadmin add Game night? \| Friday at 8pm` |
| `-faqadmin list/remove` | `-faqadmin remove 1` |
| `-marketadmin queue/approve/reject` | `-marketadmin approve 1` |
| `-autoreply add trigger \| response` | `-autoreply add good morning \| Good morning, {name}!` |
| `-autoreply status/list/remove` | `-autoreply remove 1` |
| `-autoreply on/off` | Automation is off by default |
| `-autoreply hours HH:MM-HH:MM` | `-autoreply hours 08:00-22:00` |
| `-autoreply hours off` | Remove the hours restriction |
| `-roleadmin add/assign/remove` | `-roleadmin assign 1 @Ada` |
| `-roles` | Show cosmetic roles and holders |
| `-attendanceadmin clear` | Clear today’s check-ins |
| `-standupadmin clear` | Clear today’s stand-ups |
| `-nicknameadmin @member` | Clear an inappropriate nickname |
| `-communitystats` | Count stored community records |
| `-enhancementreset confirm` | Reset queues and active automation while preserving personal habits/cards |

## Safety and deployment

- No new environment variables are required.
- Auto-reply is group-only, off by default, limited to one rule per message, and has a two-minute member/rule cooldown.
- Anonymous submissions and market listings require admin approval.
- Reports and support tickets stay inside admin queues.
- Reputation can be given only once per target per day.
- Pomodoro timers are capped at 120 minutes.
- There are no bulk messages, unsolicited private messages, status automation, anti-delete recovery, or real-money gambling features.
