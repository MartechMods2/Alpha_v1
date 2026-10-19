# Activity Radar

Alpha cannot reliably list everyone online, identify silent readers, or bypass WhatsApp privacy settings. These commands use existing recorded message statistics in the current group. No presence subscriptions, background polling, media downloads, new tracking storage, automatic mentions, or penalties are added.

| Command               | Access                   | Example          | Result                                                                                                                     |
| --------------------- | ------------------------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `$spy [window]`       | Group admins / bot owner | `$spy 48h`       | Recent-message count, quiet count, unknown history, and up to ten members whose last recorded message predates the window. |
| `$activitycard`       | Group members            | `$activitycard`  | Your own recorded message totals and a playful badge.                                                                      |
| `$groupmood [window]` | Group members            | `$groupmood 12h` | Aggregate participation and an icebreaker; no named member list.                                                           |

Window defaults to 24h; accepts whole hours from 1h through 168h. This measures time since each member's latest recorded message, not the number of messages sent within that window. Counts and badges cover only messages Alpha recorded, not lifetime WhatsApp history. Unknown, invalid, or future timestamps are kept out of the quiet list. Recent departures and the bot are excluded using the current roster and existing PN/LID identity helpers. No-history members are not accused of ghosting.

Commands appear in the existing generated help/command catalogue after restart. Existing bot enablement, command blocking, rate limits and message queue controls still apply. `$spy` explicitly requires an admin or owner even if a nonadmin is configured as a command helper.

Deploy: update to this commit and restart Alpha using the existing deployment workflow. No migrations or environment variables are needed. Rollback: revert the activity-radar commit and restart. Test with a local mocked group first; online status is intentionally not represented.
