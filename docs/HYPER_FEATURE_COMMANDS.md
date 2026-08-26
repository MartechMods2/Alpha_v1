# Alpha Hyper Features: Commands and Examples

The examples below use `-` as the command prefix. If `PREFIX` is different in Render, replace `-` with that prefix. Commands marked **Admin** can be used only by a group admin, moderator, or bot owner.

## Member Moderation Controls

The bot must be a group admin to delete muted messages or remove a status-mention offender. You can tag a member or reply directly to their message.

| Command | Usage | Example |
|---|---|---|
| `antistatus on\|off` | **Admin:** enable or disable protection against members mentioning the group in WhatsApp Status. | `-antistatus on` |
| `antistatus status` | **Admin:** show whether protection is enabled and its fixed three-strike policy. | `-antistatus status` |
| `antistatus list` | **Admin:** list members with status-mention strikes. | `-antistatus list` |
| `antistatus clear @member` | **Admin:** clear one member's status-mention strikes. | `-antistatus clear @Ada` |
| `statuswarns @member` | **Admin:** show one member's status-mention strikes. | `-statuswarns @Ada` |
| `mute @member [duration] [reason]` | **Admin:** silently delete the member's new messages. Without a duration, the mute is permanent. | `-mute @Tunde 2h repeated flooding` |
| `unmute @member` | **Admin:** stop deleting that member's messages. | `-unmute @Tunde` |
| `muteinfo @member` | **Admin:** show the duration and reason for a mute. | `-muteinfo @Tunde` |
| `mutelist` | **Admin:** list active permanent and timed mutes. | `-mutelist` |

Mute durations accept `m` (minutes), `h` (hours), `d` (days), and `w` (weeks), up to 30 days; use `forever` for a permanent mute. Muted messages are deleted silently to avoid bot-message floods. Admins, the group owner and the bot are protected from both features. Anti status mention is opt-in and removes a non-admin member when the third strike is recorded.

## Stickers

| Command | Usage | Example |
|---|---|---|
| `sticker` (`s`) | Send or reply to an image, GIF, sticker, or video of 10 seconds or less. Optional: `crop`, quality `40–90`, `pack`, `author`, `nometadata`. | Reply to an image: `-sticker crop 80 pack Alpha Squad author Martech` |
| `videosticker` | Convert a sent/replied short video into an animated sticker. | Reply to a 7-second video: `-videosticker` |
| `gifsticker` | Convert a sent/replied GIF into an animated sticker. | Reply to a GIF: `-gifsticker` |
| `aisticker` (`cutoutsticker`) | Remove an image background and make a sticker. Requires `REMOVE_BG_KEY`. | Reply to a photo: `-aisticker Alpha Cutouts` |
| `textsticker` (`ts`) | Make a sticker from typed text. | `-textsticker Weekend don land!` |
| `reactionsticker` | Make a sticker from the text in a replied message. | Reply to “I am coming”: `-reactionsticker` |
| `attp` | Make a public-chat-safe text sticker. Use `:` to create a line break. | `-attp No wahala:we move` |
| `avatarsticker` | Turn your WhatsApp profile photo into a sticker. | `-avatarsticker` |

## Group Sticker Pack

| Command | Usage | Example |
|---|---|---|
| `stickersave` | Reply to a sticker and save it with a name and optional tags. | `-stickersave Laughing Guy | laugh funny reaction` |
| `stickerpack` | List saved group stickers. | `-stickerpack` |
| `stickerpack delete <number>` | Delete your saved sticker; admins can delete any entry. | `-stickerpack delete 3` |
| `stickerfind <name/tag>` | Find and send a matching saved sticker. | `-stickerfind laugh` |
| `stickerrandom [tag]` | Send a random saved sticker, optionally filtered by tag. | `-stickerrandom reaction` |

Each group has its own private pack with a maximum of 40 saved stickers.

## Memes

| Command | Usage | Example |
|---|---|---|
| `meme` (`mememaker`) | Get a safe random meme. | `-meme` |
| `meme <category>` | Random categories: `wholesome`, `programming`, `gaming`, `reaction`. | `-meme programming` |
| `meme <top> \| <bottom>` | Send/reply to an image and add captions locally. | Reply to a photo: `-meme When salary enters | When bills arrive` |
| `meme template <name> \| <top> \| <bottom>` | Use a template configured in Media Studio. | `-meme template Drake | Ignore rules | Read pinned rules` |

If the random-meme provider fails, the bot can use a safe Memegen fallback. The dashboard can disable provider fallbacks.

## Image Studio

For media commands, send the media with the command as its caption or reply to existing media with the command.

| Command | Usage | Example |
|---|---|---|
| `upscale` | Locally resize and sharpen an image. | Reply to an image: `-upscale` |
| `replacebg <colour>` | Remove the background when `REMOVE_BG_KEY` is configured, then apply a colour. | `-replacebg #00a651` |
| `passport [colour]` | Create a clean passport-style photo. | `-passport #f4f8ff` |
| `thumbnail <title> \| <subtitle>` | Create a social/video thumbnail from an image. | `-thumbnail Group Awards | Season One` |
| `photogrid start` | Start a private 5-minute photo-grid session. | `-photogrid start` |
| `photogrid add` | Send/reply to an image and add it to the active grid. Add 2–4 images. | `-photogrid add` |
| `photogrid done` | Render the current grid. | `-photogrid done` |
| `photogrid cancel` | Discard the current grid. | `-photogrid cancel` |
| `signature` | Clean a photographed signature into a high-contrast image. | `-signature` |
| `scan` | Turn a document photo into a clearer scan. | `-scan` |
| `profilecard` | Create a member profile card using the member’s avatar and game points. | `-profilecard` |
| `rankcard` | Create a competitive rank card with points and wins. | `-rankcard` |

## Audio Studio

| Command | Usage | Example |
|---|---|---|
| `audiocut <start> <duration>` | Cut an audio/video segment. Time accepts seconds or `mm:ss`; maximum output is 60 seconds. | Reply to audio: `-audiocut 0:30 20` |
| `denoise` | Reduce steady background noise in audio. | Reply to a voice note: `-denoise` |
| `normalize` | Balance audio loudness for easier listening. | Reply to audio: `-normalize` |
| `waveform` | Create a waveform picture from audio/video. | Reply to a song: `-waveform` |
| `tts` (`say`) | Convert short text into spoken audio. | `-tts Welcome to the group` |

## Video Studio

| Command | Usage | Example |
|---|---|---|
| `videocut <start> <duration>` | Cut a video segment; maximum output is 60 seconds. | Reply to video: `-videocut 00:12 10` |
| `videocaption <text>` | Burn a short caption onto a video. | `-videocaption Alpha Squad Finals` |
| `videothumbnail [second]` | Extract a thumbnail at the requested second. | `-videothumbnail 5` |

## Media Battles

Only one media contest can be active in a group at a time. Each member gets one entry and one vote. The winner receives 20 game points.

| Command | Usage | Example |
|---|---|---|
| `memebattle start <topic>` | **Admin:** start a meme contest. | `-memebattle start Monday morning mood` |
| `memebattle submit <top> \| <bottom>` | Send/reply to an image and submit a generated meme. | `-memebattle submit Me planning | Reality arriving` |
| `memebattle vote <number>` | Vote for another member’s entry. | `-memebattle vote 2` |
| `memebattle` | Show the active contest and entries. | `-memebattle` |
| `memebattle end` | **Admin:** close voting and award the winner. | `-memebattle end` |
| `captionbattle` (`captioncontest`) | Same actions as meme battle, but members submit text captions. | `-captionbattle submit When the admin says one last announcement` |
| `stickerbattle` | Same actions as meme battle, but members submit replied stickers. | Reply to a sticker: `-stickerbattle submit` |

## Competitive Games

Wrong answers are silent, every member gets one attempt per round, and only one of these rounds can be active in a group at a time.

| Command | Usage | Example |
|---|---|---|
| `songguess` | Start a title-clue round worth 15 points. | `-songguess` |
| `songanswer <title>` | Answer the active Song Guess round. | `-songanswer Calm Down` |
| `spellingbee` | Start an audio spelling round worth 15 points. | `-spellingbee` |
| `spellanswer <word>` | Answer the active Spelling Bee round. | `-spellanswer necessary` |
| `team create <name>` | Create and join a group game team. | `-team create Thunder Kings` |
| `team join <name>` | Join an existing team. | `-team join Thunder Kings` |
| `team leave` | Leave your current team. | `-team leave` |
| `team list` (`teamboard`) | Show team points, wins, and member counts. | `-teamboard` |
| `teambattle` | Start a team question worth 25 team points. You must belong to a team. | `-teambattle` |
| `teamanswer <answer>` | Answer for your team; the first correct team wins. | `-teamanswer Abuja` |
| `bossbattle` | Start a cooperative three-hit group boss. | `-bossbattle` |
| `bossanswer <answer>` | Land one correct hit on the boss question. | `-bossanswer Pacific` |
| `weeklymission` | View progress or automatically claim a completed weekly mission. | `-weeklymission` |
| `trophyroom` | Show recent team and group trophies. | `-trophyroom` |

The original scored games remain available too: `gamehelp`, `trivia`, `mathgame`, `scramble`, `emojiguess`, `riddle`, `fasttype`, `rps`, `daily`, `battle`, `gameprofile`, `leaderboard`, `achievements`, and `gamestats`.

## Group Organiser

| Command | Usage | Example |
|---|---|---|
| `event add <YYYY-MM-DD> \| <title>` | **Admin:** save an event. | `-event add 2026-09-12 | Alpha League Final` |
| `calendar` (`event list`) | List upcoming group events. | `-calendar` |
| `event delete <number>` | **Admin:** delete an event shown in the calendar. | `-event delete 2` |
| `meeting start <title>` | **Admin:** start collaborative meeting notes. | `-meeting start September Planning` |
| `meeting add <point>` | Add a point to the active meeting. | `-meeting add Musa will prepare the flyer` |
| `meeting` | Show the active meeting status. | `-meeting` |
| `meeting end` | **Admin:** close and save the meeting minutes. | `-meeting end` |
| `minutes` | List saved meeting minutes. | `-minutes` |
| `minutes read <number>` | Read one saved set of minutes. | `-minutes read 1` |
| `decision add <text>` | **Admin:** record a group decision. | `-decision add Finals will begin at 7 PM` |
| `decision list` | List recorded decisions. | `-decision list` |
| `decision delete <number>` | **Admin:** remove a recorded decision. | `-decision delete 2` |
| `bookmark` | Reply to an important text message and save it. | Reply to a message: `-bookmark` |
| `bookmarks` | List saved bookmarks. | `-bookmarks` |
| `bookmarks delete <number>` | Delete your bookmark; admins can delete any bookmark. | `-bookmarks delete 1` |

## Smart @Alpha Assistant

The group’s normal chatbot switch must be on. Tag the bot’s WhatsApp account directly; `@Alpha` below means that real WhatsApp mention.

| Request | Example |
|---|---|
| Ask a normal question | `@Alpha explain compound interest simply` |
| Ask about a quoted message | Reply to a message: `@Alpha what does this mean?` |
| Continue the conversation | Reply directly to Alpha’s previous answer with the next question. |
| Summarize recent group chat | `@Alpha summarize today’s discussion` |
| Create a native poll | `@Alpha create poll Best meeting day? | Friday | Saturday | Sunday` |
| Schedule a group reminder | `@Alpha remind us in 30m to start the quiz` |
| Schedule at a local time | `@Alpha remind us at 7:30PM to join the meeting` |
| Understand an image | Send/reply to an image: `@Alpha explain this image` |
| Understand a voice note | Reply to audio: `@Alpha summarize this voice note` |
| Understand a document | Reply to a document: `@Alpha list the main points` |

Image understanding is on by default. Voice and document understanding are off by default because they upload media to the configured Gemini provider.

### Alpha Admin Commands

| Command | Usage | Example |
|---|---|---|
| `alphastatus` | Show the group’s current Alpha settings. | `-alphastatus` |
| `alphamode <mode>` | **Admin:** `smart`, `text`, `mixed`, `sticker`, or `off`. | `-alphamode smart` |
| `alphastyle <style>` | **Admin:** `friendly`, `funny`, or `professional`. | `-alphastyle funny` |
| `alphalength <length>` | **Admin:** `short`, `normal`, or `detailed`. | `-alphalength short` |
| `alphamemory <0–20>` | **Admin:** number of conversational turns to keep; `0` disables memory. | `-alphamemory 8` |
| `alphaquota <1–50>` | **Admin:** daily mention requests allowed per member. | `-alphaquota 10` |
| `alphafilter status` | **Admin:** show the current member-access mode and list sizes. | `-alphafilter status` |
| `alphafilter everyone` | **Admin:** let every member use Alpha mentions. | `-alphafilter everyone` |
| `alphafilter admins` | **Admin:** answer only group admins and the bot owner. | `-alphafilter admins` |
| `alphafilter allowlist` | **Admin:** answer only members added to the allowlist, plus admins/owner. | `-alphafilter allowlist` |
| `alphafilter denylist` | **Admin:** answer everyone except denied members; admins/owner remain allowed. | `-alphafilter denylist` |
| `alphafilter allow @member` | **Admin:** add mentioned/replied members and switch to allowlist mode. | `-alphafilter allow @Ada` |
| `alphafilter deny @member` | **Admin:** add mentioned/replied members and switch to denylist mode. | `-alphafilter deny @Tunde` |
| `alphafilter remove @member` | **Admin:** remove mentioned/replied members from both lists. | `-alphafilter remove @Ada` |
| `alphafilter clear` | **Admin:** clear both member lists without changing the current mode. | `-alphafilter clear` |
| `alphaquiet <HH:MM> <HH:MM>` | **Admin:** quiet hours in `BOT_TIMEZONE`. | `-alphaquiet 22:00 07:00` |
| `alphaquiet off` | **Admin:** disable quiet hours. | `-alphaquiet off` |
| `alphaimage on\|off` | **Admin:** allow or block tagged image understanding. | `-alphaimage on` |
| `alphavoice on\|off` | **Admin:** allow or block tagged voice-note understanding. | `-alphavoice on` |
| `alphadoc on\|off` | **Admin:** allow or block tagged document understanding. | `-alphadoc on` |
| `alphasticker on\|off` | **Admin:** allow or block tag stickers in sticker/mixed mode. | `-alphasticker off` |
| `alphaclear` | **Admin:** clear the group’s Alpha conversation memory. | `-alphaclear` |

The member filter applies to direct bot mentions and replies to Alpha's messages. Blocked members are ignored silently to avoid unnecessary group traffic. Group admins and the configured bot owner always retain access. You can use `-alphaaccess` as an alias for `-alphafilter`.

## Dashboard-Only Controls

Open `/admin/media-studio` from the Render service URL to manage:

- global safe mode and per-feature switches;
- one-at-a-time media processing and daily member/group quotas;
- maximum image/video sizes and video duration;
- recent queued, running, completed, or failed media jobs;
- retry for eligible failed jobs;
- FFmpeg and provider health;
- provider fallbacks and circuit-breaker status;
- saved group stickers and Memegen template IDs;
- Alpha’s global name, instructions, and global enable switch;
- group configuration export/import.

## Required and Optional Render Variables

```env
# Required by the existing bot
MONGODB_KEY=your_mongodb_connection_string
SESSION_SECRET=use_a_long_random_secret
PREFIX=-
BOT_TIMEZONE=Africa/Lagos

# Alpha text replies
NVIDIA_API_KEY=your_nvidia_api_key

# Background removal / AI cut-out sticker
REMOVE_BG_KEY=your_remove_bg_api_key

# Optional: tagged image, voice-note and document understanding
GOOGLE_API_KEY=your_google_gemini_api_key
GEMINI_MEDIA_MODEL=gemini-2.0-flash
```

`REMOVE_BG_KEY` is needed only for cut-out/background-removal features. `GOOGLE_API_KEY` is needed only for Alpha media understanding. Local memes, normal stickers, text stickers, image tools, audio/video conversion, games, scores, group tools, and the dashboard do not require those two API keys.

## Traffic-Safety Defaults

- Features respond only to a member command or direct bot mention.
- No unsolicited direct messages, mass broadcasts, or replies to every group message were added.
- Group messages pass through the spaced outbound queue.
- Media jobs are sequential by default and have daily limits.
- Wrong game answers are silent.
- Short-video and upload limits prevent large repeated transfers.
- Alpha has per-member quotas, quiet hours, memory limits, and an off switch.

These limits reduce unnecessary automated traffic, but Baileys is still an unofficial WhatsApp client and cannot guarantee zero restriction risk.
