# Alpha Benchmark Upgrade V5

This release adds production safeguards found in mature WhatsApp automation
servers without copying third-party code or adding high-ban-risk behaviour.

## Improvements

- Dashboard WebSockets require an authenticated, one-use, 60-second ticket.
- Dashboard sockets are read-only; mutations use authenticated HTTP routes.
- `POST /send` is disabled until an integration API key is configured.
- Integration recipients are allowlisted, requests are rate-limited, messages
  are capped at 4,096 characters, and batches are capped at three recipients.
- `/healthz` reports process liveness; `/readyz` checks MongoDB and WhatsApp.
- `help` is compact and supports categories, purpose search and typo suggestions.

## Command discovery

```text
$help
$help categories
$help public
$help group
$help admin
$help owner
$help search birthday reminder
$help search stikcer
$help sticker
$help all
```

Natural routing remains available through `$do <request>` or by tagging Alpha.

## Hosting probes

```text
GET /healthz
GET /readyz
```

`/healthz` returns 200 while the process is alive. `/readyz` returns 200 only
when MongoDB responds and WhatsApp is connected; otherwise it returns 503.

## Optional safe integration API

```env
INTEGRATION_API_KEY=<random-secret-of-at-least-32-characters>
INTEGRATION_ALLOWED_RECIPIENTS=2348012345678,12025550123
INTEGRATION_RATE_LIMIT=10
```

```bash
curl -X POST "https://your-service.example/send" \
  -H "Authorization: Bearer $INTEGRATION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"to":"2348012345678","message":"Your approved notification"}'
```

Use this only for consented transactional notifications—not scraped contacts,
unsolicited promotions or bulk messaging.

## Safety boundary

This upgrade excludes status auto-viewing, anti-delete, view-once recovery,
contact scraping, arbitrary chat-installed plugins and unrestricted bulk sends.
Baileys remains unofficial, so no implementation can guarantee zero restriction risk.
