# Alpha by Martech — Safe Monetisation Plan

## Recommended model

Keep essential group safety free and sell optional convenience/resource-heavy features.

1. **Free** — moderation, help, basic games, basic utilities and limited security checks.
2. **Plus group** — higher media quota, scheduled tools, advanced cards and additional game sessions.
3. **Pro group** — larger quotas, backups, branded group settings, analytics and priority support.

Do not charge for gambling, cash-prize games, personal-data searches, pirated media, account recovery, hacking, mass messaging or ban-evasion tools.

## Payment process

1. Register a business/merchant account with Paystack and complete verification.
2. Start with Paystack test keys.
3. Put the secret key only in Render Environment; never in WhatsApp or frontend JavaScript.
4. Create plans in your dashboard/database with price, duration and feature limits.
5. Generate a hosted Paystack checkout link from the server.
6. Attach a unique internal customer/group reference—never trust a price supplied by chat.
7. Receive Paystack webhooks over HTTPS.
8. Verify the webhook signature before updating access.
9. Confirm the transaction reference with Paystack server-to-server.
10. Activate the plan only after verified success.
11. Store transaction reference, amount, currency, group, plan, status and expiry—never card details.
12. Provide `$plan`, `$subscribe`, `$billing`, `$cancelplan` and `$support` flows.
13. Honour cancellations, refunds and opt-outs under published terms.

## Proposed environment variables

```env
MONETIZATION_ENABLED=false
PAYSTACK_PUBLIC_KEY=
PAYSTACK_SECRET_KEY=
PAYSTACK_WEBHOOK_SECRET=
PAYSTACK_CURRENCY=NGN
PAYSTACK_CALLBACK_URL=https://your-service.example.com/api/payments/callback
FREE_DAILY_QUOTA=10
PLUS_DAILY_QUOTA=40
PRO_DAILY_QUOTA=100
PLUS_MONTHLY_PRICE_KOBO=
PRO_MONTHLY_PRICE_KOBO=
BILLING_SUPPORT_URL=
TERMS_URL=
PRIVACY_URL=
```

Keep `MONETIZATION_ENABLED=false` until live-key verification, webhook tests, terms, privacy notice, support contact and refund process are ready.

## WhatsApp safeguards

- Sell only to users who request it; never send unsolicited payment links.
- Do not mass-DM members or repeatedly advertise in groups.
- Keep an explicit `$stop`/opt-out route.
- Do not lock safety or moderation essentials behind payment.
- Never ask users to paste card numbers, bank details, OTPs or PINs into chat.
- Send users to the payment provider's hosted checkout.
- Maintain a human support route.

## Suggested launch order

1. Publish privacy policy, terms, acceptable-use policy and refund policy.
2. Test payments and webhook replay protection.
3. Pilot with one consenting group.
4. Start with one simple monthly Plus plan.
5. Monitor failure rate, complaints, blocks, refunds and hosting/API costs.
6. Add Pro only after the pilot is stable.
