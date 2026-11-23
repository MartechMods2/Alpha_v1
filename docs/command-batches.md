# Comma-separated commands

Send `$ping, $help, $readby` to run commands sequentially. Repeat your configured prefix for every command. Each command keeps its own arguments. For example `$meme Hello, world, $ping` passes `Hello, world` to meme and then runs ping. Semicolons and newlines followed by the prefix also work. Unprefixed text after commas remains part of the current command.

Quoted strings/backticks and backslash-escaped separators are not split. Reply to a message normally to use it as context throughout a batch. Each segment receives its own text/caption and matched mentions, preserving media and quoted-message context. The original message is not mutated.

At most six commands are accepted. An oversized batch is rejected before command dispatch instead of partially executed. Commands run one at a time to avoid concurrent expensive requests. A denied, disabled, unknown or failed command does not prevent subsequent commands from being attempted. A failing command may already have made a change: inspect its result before retrying.

Every segment enters the normal permission, cooldown, global/group command availability and Aura billing paths. Group settings and roles refresh between segments; a refresh failure skips that segment rather than trusting stale roles. Moderation and passive handling still run once for the original incoming message. This is not a transaction: successful earlier changes are not rolled back.
