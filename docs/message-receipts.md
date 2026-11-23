# Message receipt reports

Group admins and Alpha's owner can reply to a group message sent by Alpha's linked WhatsApp account with `$readby`, `$whoread`, or `$readreceipts`. Use `$readby 2` on the same quoted message for another page. Reports show up to 20 recipients per page, read/delivery timestamps in Africa/Lagos time, and recorded totals. Reports do not notify listed members.

This uses Baileys `message-receipt.update` events. It cannot query readers of messages sent by a different WhatsApp account, bypass receipt settings, recover all historical receipts, or prove a message was not read. If your personal number is Alpha's linked account, receipts for that account's own messages can be reported when received. Otherwise send the announcement through Alpha and reply to that message. No mass messages are sent by this feature.

Only group receipts for outgoing messages are retained; no message bodies are stored. The in-memory store is limited to 200 messages and 256 receipt identities per message, with a 24-hour lifetime from the first recorded receipt. It resets on process restart, and capacity eviction may remove records sooner. Phone/LID identities are merged when group metadata provides their relationship. Missing records mean unavailable data, not unread messages. No tracking of online presence is involved.

Implementation validation covers deduplication, group isolation, incoming-message rejection, expiry/capacity, authorization, quote ownership, pagination and honest unavailable states. Live receipt arrival still needs validation with a group message after deployment.
