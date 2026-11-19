# Cloudflare image generation

Alpha now prefers Cloudflare Workers AI's `@cf/black-forest-labs/flux-1-schnell` at four steps, called directly from Render. No separate Worker deployment or OpenAI key is needed. Cloudflare currently includes 10,000 Neurons/day on Workers Free. It is a shared compute allowance, not unlimited images. Keep the Cloudflare account on Workers Free if paid usage is not intended. No plan upgrade is made by this code.

In the Cloudflare dashboard, open Workers AI → Use REST API → Create a Workers AI API Token. Use its account-scoped template (Workers AI Read/Edit). Copy the Account ID separately. Save these only in Alpha's Render Environment:

- `CLOUDFLARE_ACCOUNT_ID`: account ID (32 hexadecimal characters).
- `CLOUDFLARE_API_TOKEN`: the scoped Workers AI token.

Optional explicit settings: `ALPHA_IMAGE_PROVIDER=cloudflare`, `ALPHA_IMAGE_FALLBACK=false`. These are already the defaults. Save/redeploy on Render, then use `$imgstatus` and `$img a sunny Lagos street` in WhatsApp. Status shows credentials/configuration only; a successful real image verifies account access and remaining quota. Do not send tokens in chat or commit them to GitHub.

Cloudflare is the only image provider attempted by default. Existing Gemini/OpenAI/Pollinations image credentials are retained but not used automatically. Only an explicit `ALPHA_IMAGE_FALLBACK=true` enables fallback, which may incur provider costs. Text AI and voice providers are unaffected. Quota errors produce a cooldown, not repeated requests; concurrency is limited to two; responses and request duration are bounded. Only PNG, JPEG or WebP results accepted by Alpha's validator are sent to WhatsApp.

No Cloudflare connector was available in this session. Live generation remains unverified until the account/token are configured and a real request succeeds.

Official references:
- https://developers.cloudflare.com/workers-ai/get-started/rest-api/
- https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/
- https://developers.cloudflare.com/workers-ai/platform/pricing/
