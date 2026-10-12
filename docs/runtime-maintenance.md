# Alpha runtime maintenance

Use `$alphaperf` to inspect heap/process memory, queued messages, active sends and file-cache size. Use `$alphaclean` to expire stale runtime entries and clean empty idle queues. These commands use Alpha's owner-command permission tier, including configured moderators. They also appear in the dashboard guide.

Cleanup runs every 60 seconds while an event-handler cache is registered. It checks original cache TTLs and the file cache's idle expiration; it does not flush live caches, force garbage collection, delete files, clear MongoDB, touch WhatsApp auth keys, discard queued messages or stop games. Active send queues are preserved.

Removed the per-event forced-GC/100-MB cache-flush loop, which could repeatedly stall processing and cause refetches. File-cache replacement now subtracts the previous buffer before counting the replacement, and expired buffers cannot be revived on read. Reminder scheduler ticks now skip overlap while a previous tick is still running; due reminders remain eligible for the next tick. Time-specific group schedules retain their existing behavior.

Memory usage alone does not establish a leak. If queue depth grows, inspect sends and media uploads. If queues remain small but AI replies are slow, inspect provider health and response times. Render CPU throttling, database latency and WhatsApp connectivity require live measurements. This change does not claim to resolve those external causes.
