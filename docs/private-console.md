# Alpha private moderator console

These commands are for the configured creator and moderators (`MY_NUMBER` / `MODERATORS`), not ordinary group admins. They can be requested in a group, but the guide, settings and report are sent to the requester's personal chat. The group receives only a delivery acknowledgement or generic failure. The recipient cannot be overridden through arguments.

| Command | Use |
|---|---|
| `$privateguide all` | One TXT document with every registered command name, access rules, usage, examples and global-disable status. |
| `$privateguide security` | A private filtered guide by name, description or category. |
| `$privatemode list` | Private list of support modes and their descriptions. |
| `$privatemode savage` | Sharp, witty banter about situations; no threats or humiliating personal attacks. |
| `$privatemode angry` | Firm, frustrated-but-controlled wording. |
| `$privatemode emotional` | Emotionally expressive, empathetic wording. |
| `$privatemode supportive` | Warm encouragement with honest practical advice. |
| `$privatemode calm` | De-escalation and thoughtful wording. |
| `$privatemode professional` | Polished, firm professional replies. |
| `$privatemode mentor` | Candid coaching and next steps. |
| `$privatemode playful` | Light jokes and friendly teasing. |
| `$privatemode motivational` | Energetic encouragement and achievable goals. |
| `$privatemode detective` | Evidence, observations and careful hypotheses. |
| `$privatemode status` | Show your saved mode privately. |
| `$privatemode off` | Return to ordinary preferences. |
| `$privatehealth` | Private memory, queue, file-cache and cleanup report. |
| `$alphaperf` / `$alphaclean` | Existing runtime commands now deliver their detailed reports privately too. |

Modes are saved per moderator identity, resolving supplied PN/LID aliases to configured phone numbers. They apply to that moderator's Alpha/Gemini replies; other members retain their existing preferences. AI availability and quotas still apply. Modes change style, not authority or factual accuracy. Already cached conversation history may still influence the next reply.

The full guide lists the loaded command registry, including aliases and disabled commands. Access requirements, group settings and quotas still determine which operation can actually execute. Guide requests have a two-minute cooldown to prevent repeated document uploads. Text examples are starting points and must be edited for real targets.

Unhandled message-processing errors are reported privately to the configured creator through Alpha's existing deduplicated error reporter. Group text replies beginning with an error marker and containing recognized provider/database/connection diagnostics are replaced with a generic service message; sanitized diagnostics go privately to the creator. This is a targeted guard, not a guarantee that every third-party command error format is recognized. Existing owner notifications do not quote group messages into the owner's chat.

Deploy the latest commit on Render, then try `$privateguide all`, `$privatemode supportive` and `$alpha help me plan my day`. Set `ALPHA_PRIVATE_CHAT=true` if you also want ordinary AI conversations in direct messages; private console delivery itself does not need this setting.
