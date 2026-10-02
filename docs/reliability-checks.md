# Alpha reliability checks

Run `npm run verify` after installing the repository dependencies. It checks backend JavaScript syntax, runs the complete regression suite, and builds the dashboard. Run `npm run check` for a quick syntax-only check. These commands do not start Alpha, connect to WhatsApp, or modify saved production data.

The regression suite covers native encrypted poll enrollment, starter/admin participation, game rounds and scoring, recovery, command registration, guide examples, permission checks, AI quota handling and media fallbacks.

After deployment, use a WhatsApp test group to confirm a fresh lobby, multiple Join votes, vote retraction, automatic turns and final winner. Use the dashboard Command Lab to verify command syntax and supported offline handlers. A passing local suite does not establish that production credentials, network providers or MongoDB are available.

Poll retractions are stored as empty choices with the original vote timestamp. This prevents stale reconnect deliveries from restoring a withdrawn enrollment. Older writes are rejected atomically in MongoDB. Poll confirmations close both the live cache and database session so repeated deliveries cannot repeat birthday confirmation actions.

Message queue cleanup retains queues with sends in flight, allowing later messages to reach the active worker even during a slow WhatsApp upload.
