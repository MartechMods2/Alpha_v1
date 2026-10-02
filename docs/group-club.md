# Group Club

Group Club runs creative contests without an AI provider. Caption mode gives a funny situation to caption; pitch mode asks for a playful product idea; tagline mode asks for a catchy slogan.

Example flow:

1. `$club start caption` — Alpha posts a prompt. Use `pitch` or `tagline` for other modes.
2. `$club submit My phone waited until game night to reach 1%` — each member sends one entry. Submitting again edits it before voting starts. Starter and admins can enter.
3. `$club status` — show the prompt, phase and numbered entries.
4. `$club vote` — starter, group admin or owner opens the native WhatsApp poll. At least two different members must enter. Entry numbers match the posted list.
5. Vote on the poll within 10 minutes. All group members may vote, including entrants. Latest votes count; withdrawing a vote removes it from the result.
6. `$club finish` — starter, admin or owner closes voting and announces the winner, ties or no-vote result. Winner announcements require this command; they are not scheduled automatically.
7. `$club status` — view the saved result after completion. `$club stop` cancels an active contest.

Limits: one active club per group, eight entries, 240 characters per entry, session expiry after 24 hours. Entries and results persist in MongoDB across restarts. There are no permanent leaderboard points for this activity. Keep entries friendly; the activity is not an AI content moderation service.

Find `club` in the dashboard Full Command Guide for syntax and examples. Command Lab checks registration and permissions; the contest and poll run in WhatsApp.
