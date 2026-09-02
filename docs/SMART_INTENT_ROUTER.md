# Alpha Smart Intent Router

Members no longer need to memorise the full command catalogue.

## Group usage

Tag Alpha with a clear request:

```text
@Alpha send me Asake - Forgiveness
@Alpha get the lyrics for Wizkid - Essence
@Alpha show me Burna Boy music video
@Alpha find a funny reaction GIF
@Alpha send an African classroom photo
@Alpha play an applause sound effect
@Alpha weather in Lagos
@Alpha calculate 25 * 8
@Alpha translate to French good morning
@Alpha remind us in 2h to start the meeting
@Alpha search Wikipedia for Nigerian history
@Alpha start trivia
@Alpha show the game leaderboard
```

Only an explicit Alpha mention or reply activates natural recognition in a group. Ordinary group conversations are not scanned for commands.

## Private-chat usage

In a direct chat with the bot number, type the request without a prefix:

```text
send me Asake - Forgiveness
show me the lyrics for Davido - Unavailable
weather in Lagos
calculate 1250 / 5
```

Set `SMART_DM_INTENTS=false` to disable automatic direct-message recognition. Explicit smart commands remain available:

```text
$do send me Asake - Forgiveness
$smart weather in Lagos
$findit an African classroom photo
$getme a funny reaction GIF
$smarthelp
$intenthelp
$examples
$intentstatus
$intenttest send me Asake - Forgiveness
$recommend
$quickhelp
$whatcanido
```

## Recognised feature families

- Music, playable audio and audio documents
- Lyrics
- Music videos and other videos
- GIFs, photos and sound effects
- Weather and calculations
- Translation and reminders
- Wikipedia and web searches
- Rank and help
- Group polls, trivia, maths games, scrambles, riddles, tic-tac-toe, Connect Four and leaderboards

The router uses fixed high-confidence patterns rather than sending every group message to AI. Existing command cooldowns, quotas, admin restrictions and media-source safety checks still apply.
