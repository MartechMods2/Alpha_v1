# Command Guide and Command Lab

After deploying this commit, sign in to the dashboard and open **Community → Command Guide** (`/admin/command-guide`) or **Command Lab** (`/admin/command-lab`). Both pages are also linked from Commands and the dashboard palette.

## Guide

The guide builds from the successfully loaded command registry, including every registered name, the configured prefix, descriptions, access levels, syntax, example usage and implementation file. It supports search, filters, pagination, copying examples and opening an example in Command Lab. AI workflow entries use their individual catalog instructions. Syntax hints come from handler usage/help strings; the shared module reference remains visible for commands with multiple operations. Replace example text, URLs, numbers and other placeholders with your intended input.

A full game walkthrough covers automatic starter enrollment, native lobby polls, command joining/leaving, the minimum of two players, rounds, timers, admin participation, turns, scoring, winners and reconnect/resume behavior. Voting enrolls players; the lobby starts when its timer ends or a host closes it early.

Examples:

```text
$td start rounds=10 funny lobby=2m
$td join
$td status
$td close
$td truth
$td answer My answer
$td dare
$td done
$td score
$td resume

$game start trivia tech rounds=10 lobby=2m
$game join
$game status
$game close
$game answer my answer
$game liveboard
$game resume
```

Use Alpha's configured prefix if it differs from `$`. Choose 1–100 rounds and a lobby from 30 seconds through 10 minutes. Other controls and game-specific rules are documented in the guide.

## Sandbox tests

Command Lab does not send WhatsApp messages, change stored data, execute arbitrary JavaScript or call an AI provider. Calculator and Text Lab commands execute their actual offline handlers and capture the response. Truth or Dare and automatic-game starts exercise the real rounds/lobby parsers. Other commands validate registration, global enablement and simulated role/chat-context permissions, then show their syntax.

Examples:

```text
$calc 25 * 4 + 10
$uppercase Hello Alpha
$unitconvert 5 km m
$td start rounds=10 funny lobby=2m
```

Separate up to six commands with semicolons, commas or new lines followed by the command prefix. Choose Member/Admin/Owner and Group/Direct to test access conditions. Use a WhatsApp test group for live media, AI responses, group blocks, game turns and actual poll decoding. A sandbox validation pass does not imply those live integrations passed.

The legacy owner/moderator `$test` and `$code` commands now accept arithmetic expressions rather than unrestricted JavaScript.

## Concrete audit fixes

- `core/messages.js / getCommand`: honor multi-character prefixes and whitespace; use the connected account's JID for outgoing commands; support all configured owner identities; guard malformed messages and missing `cmdBlocked` arrays.
- `utils/commandLoader.js / addCommands, cmdToText`: stop deleting working-directory media on startup; serve metadata from the actual loaded handlers without repeatedly running command factories. Surface failed module imports in the guide.
- `commands/owner/blockUser.js / handler`: tolerate missing owner configuration, retain full member JIDs and await database updates. `commands/owner/dbControl.js / handler`: validate `field:value`, preserve spaces/colons in values and use the full member JID.
- `utils/truthDareHost.js / persistSession, finishSession`: serialize snapshot writes; persist final totals before saving permanent scores; keep failed finalizations available for retry/restart with idempotent result IDs; announce winners before deleting the checkpoint. Keep turn timers and transition recovery active through send failures. Check saved automatic sessions before starting Truth or Dare.
- `utils/autoGameHost.js / controlAutoGame, advance, deliverQuestion`: retry failed manual lobby closes and final announcements; persist pending question delivery and retry the same question without forfeiting an unsent turn.
- `commands/group/admins/gameAdmin.js / handler`: stop hosted Truth or Dare before resetting game scores, and defer reset while final stats are still pending.
- `utils/mediaStudio.js / imageBufferToSticker` and `commands/public/steal.js / handler`: replace the missing `wa-sticker-formatter.setMetadata` API with `utils/stickerMetadata.js / setStickerMetadata`, preserving WebP data and allowing metadata removal.

## Verification scope

The complete Node regression suite passes (258 tests), the dashboard production build passes, and an AST audit resolves relative imports/named exports across 286 backend files. Game integration regressions exercise native decoded poll updates, admin PN/LID identities, repeated rounds, scoring, winners, database failures, question-send failures and restart recovery. DOM-based UI checks cover rendering, search, example navigation into Command Lab, actual calculator output and invalid-round feedback with mocked dashboard APIs.

This review does not prove every external provider or deployed WhatsApp session is operational. Chromium could not launch in the execution workspace because socket creation is blocked; browser visual verification and a live Render/WhatsApp smoke test remain deployment checks.
