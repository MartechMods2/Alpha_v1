[![Buy Me a Coffee](https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&slug=jacktheboss220&button_colour=BD5FFF&font_colour=ffffff&outline_colour=000000&coffee_colour=FFDD00)](https://www.buymeacoffee.com/jacktheboss220)

# WhatsAppBotMultiDevice

A feature-rich WhatsApp bot with a modern React/Vite admin dashboard. Supports downloading songs, getting lyrics, creating stickers, memes, image search, media conversion, news, horoscopes, and much more — all controllable from a sleek web UI.

## Table of Contents

- [Commands List](#commands-list)
- [Running Locally](#running-the-whatsapp-bot-locally)
  - [Prerequisites](#prerequisites)
  - [Setup](#setup)
  - [Running the Dashboard (Dev Mode)](#running-the-dashboard-in-dev-mode)
  - [WhatsApp Login via Pairing Code](#whatsapp-login-via-pairing-code)
  - [Enabling the Bot in Groups](#enabling-bot-in-groups)
- [Deploy on Koyeb](#deploy-on-koyebcom)
- [Deploy on Heroku](#deploy-on-heroku)
- [Environment Variables](#environment-variables)
- [References](#references)

---

## Commands List

| **Group Commands**  |                      **Explanation**                      |              **Example**               | **Working/Not Working** |
| :-----------------: | :-------------------------------------------------------: | :------------------------------------: | :---------------------: |
|       -alive        |             Check if the bot is online or not             |                `-alive`                |            ✔            |
|       -admin        |                  List of admin commands                   |                `-admin`                |            ✔            |
|        -song        |           Send a song as playable WhatsApp audio           |      `-song love me like you do`       |            ✔            |
|         -l          |                   Get lyrics for a song                   | `-l Main woh chaand by darshan raval`  |            ✔            |
|       -delete       |             Delete a message sent by the bot              |               `-delete`                |            ✔            |
|        -joke        |                     Get a random joke                     |                `-joke`                 |            ✔            |
|  -joke categories   |            Get a joke from a specific category            |          `-joke programming`           |            ✔            |
|        -meme        |                     Get a random meme                     |                `-meme`                 |            ✔            |
|    -meme top \| bottom |        Create a meme from a sent/replied image          |       `-meme hello \| goodbye`         |            ✔            |
|       -movie        |              Get a download link for a movie              |           `-movie Avengers`            |           ❌            |
|       -anime        |        Get a quote from an anime character or show        |                `-anime`                |            ✔            |
|     -anime name     | Get a quote from an anime character with a specific name  |         `-anime name Saitama`          |            ✔            |
|    -anime title     |   Get a quote from an anime show with a specific title    |      `-anime title One Punch Man`      |            ✔            |
|      -sticker       |        Create a sticker from different media types        |   `-sticker pack myBitBot author MD`   |            ✔            |
|    -sticker crop    |                   Crop the sticker size                   |            `-sticker crop`             |            ✔            |
|   -sticker author   |                Add metadata to the sticker                |          `-sticker author MD`          |            ✔            |
|    -sticker pack    |                Add metadata to the sticker                |        `-sticker pack myBitBot`        |            ✔            |
| -sticker nometadata |           Remove all metadata from the sticker            |         `-sticker nometadata`          |            ✔            |
|       -steal        |          Send a sticker with the bot's metadata           |                `-steal`                |            ✔            |
|       -toimg        |               Convert a sticker to an image               |                `-toimg`                |            ✔            |
|       -image        |               Convert a sticker to an image               |                `-image`                |            ✔            |
|        -img         |             Search for an image using Google              |            `-img cute cat`             |            ✔            |
|        -mp3         |                 Convert a video to audio                  |                 `-mp3`                 |            ✔            |
|      -mp4audio      |                 Convert a video to audio                  |              `-mp4audio`               |            ✔            |
|       -tomp3        |                 Convert a video to audio                  |                `-tomp3`                |            ✔            |
|        -fact        |                     Get a random fact                     |                `-fact`                 |            ✔            |
|        -news        |                      Show tech news                       |                `-news`                 |            ✔            |
|  -news categories   |            Show news from a specific category             |             `-news sports`             |            ✔            |
|        -list        |            Show a list of categories for news             |                `-list`                 |            ✔            |
|        -idp         | Download the private profile picture of an Instagram user |            `-idp username`             |           ❌            |
|       -insta        |               Download media from Instagram               |          `-insta linkadress`           |            ✔            |
|       -gender       |            Get the gender percentage of a name            |          `-gender FirstName`           |            ✔            |
|         -yt         |       Download a YouTube video in the best quality        |           `-yt youtubelink`            |           ❌            |
|         -vs         |              Search for and download a video              |        `-vs khena galat galat`         |           ❌            |
|        -horo        |    Show your horoscope based on your astrological sign    |             `-horo pisces`             |            ✔            |
|       -advice       |             Get a random advice from the bot              |               `-advice`                |            ✔            |
|       -quote        |              Get a random quote from the bot              |                `-quote`                |            ✔            |
|        -proq        |           Get a programming quote from the bot            |                `-proq`                 |            ✔            |
|      -proquote      |           Get a programming quote from the bot            |              `-proquote`               |           ❌            |
|        -qpt         |              Get a poem written by an author              | `-qpt author Shakespeare title sonnet` |           ❌            |
|     -qpt author     |          Get a poem written by a specific author          |       `-qpt author Shakespeare`        |            ✔            |
|    -qpt authors     |              Get a list of authors for poems              |             `-qpt authors`             |            ✔            |
|      -qpoetry       |              Get a poem written by an author              |               `-qpoetry`               |            ✔            |
|      -removebg      |            Remove the background from an image            |              `-removebg`               |            ✔            |
|     -aisticker      |       Remove an image background and create a sticker       |     Reply to image: `-aisticker`       |            ✔            |
|    -textsticker     |              Create a local text sticker                    |       `-textsticker lets go`           |            ✔            |
|      -gamehelp      |     Show scored games, ranks and leaderboard commands       |             `-gamehelp`                |            ✔            |
|       -poll         |                 Create a native group poll                  | `-poll Food? \| Rice \| Pizza`         |            ✔            |
|        -nsfw        |            Get the NSFW percentage of an image            |                `-nsfw`                 |           ❌            |
|        -tts         |                  Convert text to speech                   |              `-tts text`               |            ✔            |
|        -text        |            Add a header and footer to an image            |       `-text TopText;BottomText`       |            ✔            |
|         -ud         |                Show the meaning of a name                 |              `-ud Mahesh`              |            ✔            |
|        -dic         |      Get the definition of a word from a dictionary       |              `-dic Love`               |            ✔            |
|      -txtmeme       |            Add a header and footer to an image            |     `-txtmeme TopText;BottomText`      |            ✔            |
|       -source       |                    Get the source code                    |               `-source`                |            ✔            |

<br>

| **Admin Commands** |             **Explanation**             |        **Example**        | **Working/Not Working** |
| :----------------: | :-------------------------------------: | :-----------------------: | :---------------------: |
|        -add        |      Add a new member to the group      |    `-add phone number`    |            ✔            |
|        -ban        |     Kick a member out of the group      |      `-ban @mention`      |            ✔            |
|      -promote      |   Give admin permissions to a member    |    `-promote @mention`    |            ✔            |
|      -demote       | Remove admin permissions from a member  |    `-demote @mention`     |            ✔            |
|      -rename       |       Change the group's subject        |   `-rename new-subject`   |            ✔            |
|      -welcome      |     Set the group's welcome message     |        `-welcome`         |            ✔            |
|       -chat        |      Enable or disable group chat       | `-chat on` or `-chat off` |            ✔            |
|       -link        |          Get the group's link           |          `-link`          |            ✔            |
|       -warn        |       Give a warning to a member        |     `-warn @mention`      |            ✔            |
|      -unwarn       |     Remove a warning from a member      |    `-unwarn @mention`     |            ✔            |
|      -tagall       | Send an attendance alert to all members |     `-tagall message`     |            ✔            |
|    -ref_delete     |    Delete a company (Admin only)       |      `-ref_delete Google`  |            ✔            |
|    -ref_update     |  Update a company name (Admin only)    | `-ref_update Google Alphabet` |         ✔            |
|      -automod      | Configure warnings, anti-link and spam   |     `-automod status`     |            ✔            |
|    -antistatus     | Stop members mentioning group in Status  |     `-antistatus on`      |            ✔            |
|       -mute        | Silently delete one member's messages     |   `-mute @user 2h`        |            ✔            |
|      -unmute       | Restore a muted member's messages         |    `-unmute @user`        |            ✔            |
|     -mutelist      | Show active group mutes                    |       `-mutelist`         |            ✔            |
|      -goodbye      |     Set an automatic goodbye message    | `-goodbye set Bye {user}` |            ✔            |
|       -rules       |          View or set group rules         |         `-rules`          |            ✔            |
|    -gamereset      |       Reset the group's game season       | `-gamereset confirm`      |            ✔            |

<br>

| **Referral Commands** |             **Explanation**             |        **Example**        | **Working/Not Working** |
| :------------------: | :-------------------------------------: | :-----------------------: | :---------------------: |
|       -reg_ref       |  Register yourself with a company       |      `-reg_ref Google`     |            ✔            |
|       -ref_list      |  View all companies and registered users |        `-ref_list`         |            ✔            |
|     -update_ref      |     Update your company registration     |   `-update_ref Microsoft`   |            ✔            |

---

# Running the WhatsApp Bot Locally

## Prerequisites

- **Node.js** 22.x
- **pnpm** 9.x (`npm install -g pnpm`)
- **MongoDB** — a free cluster on [mongodb.com](https://www.mongodb.com) works fine
- **Git**

## Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/jacktheboss220/WhatsAppBotMultiDevice.git
   cd WhatsAppBotMultiDevice
   ```

2. **Create a `.env` file** in the project root (see [Environment Variables](#environment-variables) below for all keys).

   At minimum you need:

   ```env
   PREFIX=-
   MY_NUMBER=1234567890
   MODERATORS=1234567890
   MONGODB_KEY=mongodb+srv://user:pass@cluster.mongodb.net/db
   ADMIN_PASSWORD=your_admin_panel_password
   ```

3. **Install backend dependencies**

   ```bash
   pnpm install
   ```

4. **Build the React dashboard** (required for production / first run)

   ```bash
   pnpm run build
   ```

   This installs the dashboard dependencies and compiles the React/Vite app into `public/app/`.

5. **Start the bot**

   ```bash
   pnpm start
   ```

   The server starts on port **8000** (configurable via `PORT`).

---

## Running the Dashboard in Dev Mode

The dashboard (`dashboard/`) is a React + Vite app. During development you can run it with hot-reload alongside the backend:

1. Start the backend first:

   ```bash
   pnpm start
   ```

2. In a second terminal, start the Vite dev server:

   ```bash
   cd dashboard
   npm install   # only needed the first time
   npm run dev
   ```

   The dashboard is now available at **http://localhost:5173** and proxies all `/api` calls to the backend at `http://localhost:8000`.

3. For a production build (served by the backend at `/admin`):

   ```bash
   # from the project root
   pnpm run build
   ```

   After building, visit **http://localhost:8000/admin** to use the dashboard.

---

## WhatsApp Login via Pairing Code

The bot supports **pairing-code authentication** through the admin dashboard — no QR code scanning needed.

### Steps to authenticate

1. **Build the React dashboard** (only needed the first time, or after a `git pull`):

   ```bash
   pnpm run build
   ```

2. **Start the bot:**

   ```bash
   pnpm start
   ```

3. **Open the admin dashboard** in your browser and log in with your `ADMIN_PASSWORD`:

   ```
   http://localhost:8000/admin
   ```

4. Navigate to **Bot Health** in the sidebar.

5. Enter your WhatsApp phone number (with country code, digits only — e.g. `911234567890`) and click **Get Pairing Code**.

6. A **8-character pairing code** will appear on screen (e.g. `ABCD-1234`).

7. On your phone, open WhatsApp → **Settings** → **Linked Devices** → **Link a Device** → **Link with phone number instead**.

8. Enter the pairing code shown in the dashboard.

9. The bot will connect automatically and the dashboard will update to show the connected status.

> **Note:** Once the bot is already logged in, the pairing-code option is disabled. To re-authenticate, use the **Clear Auth** option in the admin panel and restart the bot.

---

## Enabling Bot in Groups

After the bot is connected, add it to a group and let a few messages go through — this causes the group to appear in the database. Then use **any one** of these methods to enable it:

### Method 1: Admin Dashboard (recommended)

1. Open the dashboard at `http://localhost:8000/admin` and log in.
2. Go to the **Groups** page in the sidebar.
3. Search for your group by name.
4. Toggle the **Bot Active** switch on the group card.

### Method 2: Owner command (in the group chat)

Send this message from the number set in `MY_NUMBER`:

```
group isBotOn:true
```

### Method 3: MongoDB directly

1. Open your MongoDB database.
2. Go to the **groups** collection.
3. Find the document for your group.
4. Set `isBotOn` to `true`.

---

## Group Safety and Fun Pack

All new automatic features are disabled by default. Start with status, enable only what the group needs, and change one setting at a time:

```text
-automod status
-welcome set Welcome {users} to *{group}*! Please read -rules.
-welcome on
-goodbye set Goodbye {users}. Thanks for being part of *{group}*.
-goodbye on
-rules set 1. Be respectful. 2. No spam. 3. Ask before sharing links.
```

Configure warning-based moderation:

```text
# Remove a non-admin member when the third warning is reached
-automod warnings 3 remove

# Only notify admins at the limit; do not remove anyone
-automod warnings 3 notify

-warn @member repeated spam
-unwarn @member
-getwarn @member
```

Anti-link and anti-spam are opt-in. Admins, the group owner, and the bot are exempt from automatic actions:

```text
-automod antilink on warn
-automod allow add youtube.com
-automod allow list

-automod spam 6 12 3
-automod antispam on
```

`antilink on delete` deletes the triggering message when the bot is an admin and also records a warning. Anti-spam warns after either the configured message flood or duplicate-message threshold, then applies a one-minute cooldown so one burst cannot produce repeated bot replies.

Control WhatsApp Status mentions and individual member posting access:

```text
# Delete group Status mentions and remove an offender on the third strike
-antistatus on
-antistatus status
-antistatus list
-antistatus clear @member
-statuswarns @member

# Permanent mute (messages are silently deleted until unmuted)
-mute @member forever repeated disruption

# Timed mute: m=minutes, h=hours, d=days, w=weeks; maximum 30 days
-mute @member 30m cool down
-mute @member 2h flooding the chat
-mute @member 1d

-muteinfo @member
-mutelist
-unmute @member
```

You may reply to a member's message instead of tagging them. The bot must be a group admin to delete messages or remove an offender. Group admins, the group owner and the bot cannot be muted or receive automatic status-mention strikes.

Low-volume, on-demand social games include:

```text
-truth        -dare          -wyr           -icebreaker
-compliment   -coinflip      -dice 20       -8ball <question>
-choose tea | coffee
```

The scored Game Arena adds group-wide rounds and persistent MongoDB standings:

```text
-gamehelp                         show the arena guide
-trivia [general|science|tech|africa]
-mathgame   -scramble   -emojiguess   -riddle   -fasttype
-answer <answer>                  one attempt per member; first correct wins
-rps <rock|paper|scissors>        instant scored match
-gamescore                        personal points, streak and rank
-gameboard                        group top 10
-gamereset confirm                admin-only season reset
```

Competitive Arena extensions:

```text
-trivia [general|science|tech|africa|sports|naija]
-oddoneout   -flagguess   -truefalse   -numberguess
-dailychallenge                   one deterministic 25-point race per group/day
-battle @member                   issue a head-to-head quiz challenge
-acceptbattle                     accept the invitation
-battleanswer <answer>            first correct duellist wins 20 points
-battleboard                      duel ranking by wins
-badges                           personal trophy cabinet
-seasonstats                      group-wide season totals
```

The group toolkit stores useful shared information in MongoDB and only responds when requested:

```text
-groupkit                         show the toolkit guide
-gnote save Title | text          save a shared note (three per non-admin member)
-gnote list / read 1 / delete 1
-todo add <task>                   collaborative task board
-todo list / done 1 / undo 1 / remove 1
-birthday set DD-MM               save day/month only; no birth year
-birthday list / remove
-countdown YYYY-MM-DD | event     calculate an event countdown
-groupkitreset confirm            admin-only toolkit reset
```

Media Studio commands are deliberately request-driven: `-meme top | bottom` creates a local captioned meme from a sent or replied image, `-textsticker` creates a sticker locally, and `-aisticker` uses remove.bg to produce a transparent cut-out sticker. `-song` sends one playable MP3 result, while `-songdoc` sends the same result as a downloadable document. Only download media you are permitted to use.

## Hyper Features Pack

See the [complete Hyper Features command guide](docs/HYPER_FEATURE_COMMANDS.md) for usage and copy-ready examples.

The extended Media Studio uses one queued conversion job at a time by default. Direct and replied media share the same validated downloader, temporary files are cleaned up, and failed WhatsApp sends are surfaced to the command instead of disappearing in the outbound queue.

```text
# Image studio
-upscale                 -replacebg #ffffff      -passport [#background]
-thumbnail Title | subtitle                     -photogrid start|add|done|cancel
-signature               -scan                   -profilecard
-rankcard

# Audio and video studio
-audiocut <start> <duration>    -denoise          -normalize
-waveform                       -videocut <start> <duration>
-videocaption <text>            -videothumbnail [second]

# Sticker packs and media contests
-avatarsticker                  -reactionsticker
-stickersave Name | tag1 tag2   -stickerpack [list|delete 1]
-stickerfind <name/tag>         -stickerrandom [tag]
-memebattle start|submit|vote|end
-captionbattle start|submit|vote|end
-stickerbattle start|submit|vote|end

# Competitive Plus
-songguess / -songanswer <title>
-spellingbee / -spellanswer <word>
-team create|join|leave|list    -teambattle / -teamanswer <answer>
-bossbattle / -bossanswer <answer>
-weeklymission                 -teamboard         -trophyroom

# Persistent group organiser
-event add YYYY-MM-DD | title   -calendar
-meeting start|add|end          -minutes list|read 1
-decision add|list|delete       -bookmark          -bookmarks
```

Smart Alpha mentions are enabled only when the group's chatbot switch is on. A direct `@Alpha` mention can answer text, understand a quoted message, create a native poll, schedule a real group reminder (`@Alpha remind us in 30m to start the meeting`), summarize recent group context, and optionally inspect an attached/replied image, voice note or document. It never sends both the old tag sticker and an AI reply for the same mention.

```text
-alphastatus
-alphamode smart|text|mixed|sticker|off
-alphastyle friendly|funny|professional
-alphalength short|normal|detailed
-alphamemory 0-20
-alphaquota 1-50
-alphafilter status
-alphafilter everyone|admins|allowlist|denylist
-alphafilter allow|deny|remove @member
-alphafilter clear
-alphaquiet 22:00 07:00 | -alphaquiet off
-alphaimage on|off      -alphavoice on|off
-alphadoc on|off        -alphasticker on|off
-alphaclear
```

The admin dashboard's **Media Studio** page exposes job progress, failure logs, retries, FFmpeg/API health, daily member/group quotas, temporary storage usage, meme-template and sticker-pack management, Alpha instructions, feature toggles, provider circuit breakers and a global safe-mode switch. Group cards can export and import non-sensitive group configuration.

The outbound queue spaces group sends, automated join/leave notices are batched into one message per event, command bursts are rate-limited, Alpha mentions can be restricted by member, and synthetic typing/presence events are disabled. These safeguards reduce unnecessary automation traffic, but no unofficial WhatsApp client can guarantee that an account will not be restricted.

---

# Deploy on Koyeb.com

1. Create an account at [https://app.koyeb.com/auth/signup](https://app.koyeb.com/auth/signup).
2. In the dashboard create a new app and connect your GitHub fork.
3. Set all required environment variables (see [Environment Variables](#environment-variables)).
4. Set the **build command** to `npm run build` and the **run command** to `node index.js`.
5. Deploy — Koyeb will build the React dashboard and start the bot automatically.

# Deploy on Heroku

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/jacktheboss220/WhatsAppBotMultiDevice)

The `app.json` and `Procfile` are already configured. Click the button above, fill in the environment variables, and deploy.

---

# Environment Variables

Create a `.env` file in the project root with the following keys.

## Required

| Variable         | Description                                                               |
| ---------------- | ------------------------------------------------------------------------- |
| `PREFIX`         | Bot command prefix. Default: `-`                                          |
| `MY_NUMBER`      | Your WhatsApp number without `+` (owner number)                           |
| `BOT_NUMBER`     | The WhatsApp number the bot is logged in as (without `+`), used to filter self-messages. Can be the same as `MY_NUMBER` if you are self-hosting. |
| `MODERATORS`     | Comma-separated moderator numbers (e.g. `123,456`)                        |
| `MONGODB_KEY`    | MongoDB connection string from [mongodb.com](https://www.mongodb.com)     |
| `ADMIN_PASSWORD` | Password to log in to the React admin dashboard at `/admin`               |

## Optional

| Variable                | Description                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| `PORT`                  | Server port (default: `8000`)                                                            |
| `NODE_ENV`              | `development` or `production`                                                            |
| `BOT_TIMEZONE`          | Time zone used for challenges, events and reminders. Default: `Africa/Lagos`             |
| `SESSION_SECRET`        | Secret used to sign the session cookie. Set a strong random string in production.        |
| `NVIDIA_API_KEY`        | NVIDIA API key used by the Alpha text assistant                                            |
| `GOOGLE_API_KEY`        | Google/Gemini API key used only for optional tagged image/audio/document understanding     |
| `GEMINI_MEDIA_MODEL`    | Optional Gemini model for media understanding; defaults to `gemini-2.0-flash`              |
| `GOOGLE_API_KEY_SEARCH` | Google API key for the Custom Search API — used by the `-img` image search command       |
| `SEARCH_ENGINE_KEY`     | Google Custom Search Engine ID — required alongside `GOOGLE_API_KEY_SEARCH` for `-img`   |
| `GENIUS_ACCESS_SECRET`  | Genius API token — used by the `-l` lyrics command                                       |
| `PIN_KEY`               | Pinterest API key for Pinterest image search                                             |
| `REMOVE_BG_KEY`         | remove.bg API key — used by `-removebg` and AI cut-out `-aisticker`                    |
| `TRUECALLER_ID`         | Truecaller API ID for caller identification                                              |
| `TWITTER_BEARER_TOKEN`  | Twitter/X API bearer token for Twitter-related features                                  |
| `FFMPEG_PATH`           | Path to a custom `ffmpeg` binary. If unset the bundled `ffmpeg-static` binary is used.  |
| `TELEGRAM_BOT_TOKEN`    | Telegram bot token — enables sending bot logs to a Telegram chat                         |
| `TELEGRAM_CHAT_ID`      | Telegram chat/channel ID to receive bot logs                                             |

## YouTube Download (Optional)

| Variable                            | Default  | Description                          |
| ----------------------------------- | -------- | ------------------------------------ |
| `YOUTUBE_DELAY_BETWEEN_REQUESTS`    | `1000`   | Delay between requests (ms)          |
| `YOUTUBE_MAX_RETRIES`               | `3`      | Maximum retry attempts               |
| `YOUTUBE_RETRY_DELAY`               | `2000`   | Delay between retries (ms)           |
| `MAX_AUDIO_SIZE_MB`                 | `50`     | Maximum audio file size (MB)         |
| `MAX_VIDEO_SIZE_MB`                 | `50`     | Maximum video file size (MB)         |
| `DOWNLOAD_TIMEOUT_SECONDS`          | `600`    | Download timeout (seconds)           |
| `YOUTUBE_DEBUG`                     | `false`  | Enable debug logging                 |
| `ENABLE_USER_AGENT_ROTATION`        | `true`   | Rotate user agents                   |
| `FORCE_DISABLE_YTDLP`               | `false`  | Force-disable yt-dlp                 |

## Example `.env` File

```env
# Required
PREFIX=-
MY_NUMBER=1234567890
BOT_NUMBER=1234567890
MODERATORS=1234567890,0987654321
MONGODB_KEY=mongodb+srv://username:password@cluster.mongodb.net/database
ADMIN_PASSWORD=supersecretpassword

# Optional
PORT=8000
NODE_ENV=production
BOT_TIMEZONE=Africa/Lagos
SESSION_SECRET=change_this_to_a_random_string
MESSAGE_DELAY_MS=500
GROUP_MESSAGE_DELAY_MS=900
MAX_CONCURRENT_SENDS=2

# Alpha text AI and optional Gemini media understanding
NVIDIA_API_KEY=your_nvidia_api_key_here
GOOGLE_API_KEY=your_google_gemini_api_key_here
GEMINI_MEDIA_MODEL=gemini-2.0-flash

# Google Custom Search — required for -img image search command
GOOGLE_API_KEY_SEARCH=your_google_api_key_here
SEARCH_ENGINE_KEY=your_search_engine_id_here

# Other optional services
GENIUS_ACCESS_SECRET=your_genius_access_secret_here
PIN_KEY=your_pinterest_api_key_here
REMOVE_BG_KEY=your_remove_bg_key_here
TRUECALLER_ID=your_truecaller_id_here
TWITTER_BEARER_TOKEN=your_twitter_bearer_token_here

# Custom ffmpeg path (leave blank to use bundled ffmpeg-static)
# FFMPEG_PATH=/usr/bin/ffmpeg

# Telegram logging (optional — sends bot logs to a Telegram chat)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_telegram_chat_id_here

# YouTube Download Configuration
YOUTUBE_DELAY_BETWEEN_REQUESTS=1000
YOUTUBE_MAX_RETRIES=3
YOUTUBE_RETRY_DELAY=2000
MAX_AUDIO_SIZE_MB=50
MAX_VIDEO_SIZE_MB=50
DOWNLOAD_TIMEOUT_SECONDS=600
YOUTUBE_DEBUG=false
ENABLE_USER_AGENT_ROTATION=true
FORCE_DISABLE_YTDLP=false
```

---

# References

## Safe Complete Feature Pack

The account-safe moderation, automation, games, document tools, AI failover,
encrypted backups and privacy commands are documented in
[docs/SAFE_COMPLETE_FEATURE_PACK.md](docs/SAFE_COMPLETE_FEATURE_PACK.md).

The pack deliberately excludes bulk/private outreach, status automation,
anti-delete/view-once recovery, uncontrolled plugins and automatic mass removals.

- [@Baileys](https://github.com/WhiskeySockets/Baileys)

If you enjoyed using this project, please consider giving it a :star: on GitHub. Your support is greatly appreciated! ❤️
