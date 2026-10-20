# Photo-first messages

`$menu`, `$help` and their category overview show Alpha's WhatsApp profile photo above the message caption. Set or change Alpha's profile picture in WhatsApp; the command reads the current picture. Detailed command searches and paged catalogues remain text so usage examples stay easy to read and copy.

Welcome and farewell messages show the corresponding member's accessible profile photo as the main image, rather than placing it inside a wide banner. Existing custom templates, mentions, member counts, recorded ranks, welcome/goodbye switches, and bulk-join limits remain in effect. A departure event can mean leaving or removal; Alpha does not claim to distinguish them.

A private, unavailable, invalid or slow photo uses a neutral Alpha portrait. If generating that fallback fails, the complete caption is sent as text. Captions over 4,000 characters also use complete text rather than truncating a custom template. Privacy restrictions are respected.

The shared `profileMessage` helper is available for other profile-oriented commands. Media conversion and unrelated text commands do not receive arbitrary decorative photos. Photo work is capped at two concurrent lookups/downloads, two MiB per download, four million image pixels and five seconds of foreground waiting. Pending lookups retain their capacity permit until completion, preventing reconnection/event bursts from accumulating work. No profile-photo history is stored.

Premium text frames keep one brand header, short dividers and readable body text. Existing framed messages, code blocks, commands and URLs retain their content. Existing per-group plain-reply settings continue to apply.

Deploy and restart with the existing hosting workflow. No migration or environment setting is required. Verify `$menu`, a permitted test welcome, and a permitted departure in a test group. Roll back by reverting the photo-replies commit and restarting. Local tests use synthetic photos and mock lookups; no real group events are generated.
