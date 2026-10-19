# Private startup / deployment confirmation

After Alpha connects to WhatsApp, it sends a private startup confirmation to the first number in the existing `MY_NUMBER` environment variable. Use your international number including country code. No group receives this notice. No new phone number needs to be committed to GitHub.

On Render, the notice shows the first 12 characters of `RENDER_GIT_COMMIT`, plus the process startup time in UTC. If the host does not provide a valid revision, it says so. Compare the revision with your GitHub commit to confirm the intended code started. It confirms process startup and WhatsApp connection, not that every provider, command or game is healthy.

Successful notices are sent once per process. Ordinary reconnects do not repeat them. Process restarts (including host recovery restarts) can send another notice. A failed send may retry on a subsequent successful connection, up to three attempts. A pending send is shared across reconnects; no extra background timer or unbounded queue is created. Delivery is not guaranteed if WhatsApp is disconnected or rejects the message.

Enabled by default. Set `ALPHA_DEPLOY_NOTIFY=false` to disable. Missing or invalid `MY_NUMBER` safely skips delivery. Server logs show only delivery outcome, without the number, message body, credentials or session details.

Deploy this commit and verify the private message. No migration is required. To roll back, revert this commit and restart using the existing hosting workflow.
