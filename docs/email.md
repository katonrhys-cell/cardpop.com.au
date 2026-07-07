# Email

CardPop uses **three separate mail systems**, each for a distinct job. They do
not overlap, and confusing them is the usual source of "why isn't email
working?" questions.

| System | Role | Used for |
|---|---|---|
| **Google Workspace** | Human inbox (person-to-person) | Reading/replying to support@, personal correspondence. Not called from code. |
| **Kit.com** (ConvertKit) | Bulk marketing | Newsletters, launch list, campaign broadcasts. One message → many subscribers. See `src/routes/newsletter.js`. |
| **Resend** | Transactional | Automated, server-triggered messages to one recipient in response to an event. See `src/utils/emailService.js`. |

**Supabase Auth** also sends email — signup confirmation, password reset, magic
links — but that is a **fourth, separate** pipeline handled entirely by Supabase
(configured in the Supabase dashboard), not by any of the above.

## Transactional email (Resend)

`src/utils/emailService.js` wraps the Resend SDK. It sends from
`CardPop <noreply@cardpop.com.au>` and is fail-safe: if `RESEND_API_KEY` is
unset it logs a warning and returns without sending, so a missing key never
crashes a checkout or refund.

The five transactional emails and where they fire:

| Email | Recipient | Triggered from |
|---|---|---|
| Order confirmed | Buyer | `src/services/stripeWebhookService.js` (Stripe webhook) |
| Item sold | Seller | `src/services/stripeWebhookService.js` (Stripe webhook) |
| Refund processed | Buyer | `src/services/refundService.js` |
| Refund issued | Seller | `src/services/refundService.js` |
| Welcome offer (trial + discount) | New user | `src/services/welcomeOfferService.js` |

Email HTML is built by the templates in `src/emails/templates.js`.

### Configuration

1. **`RESEND_API_KEY`** must be set in the server environment (Vercel → Settings
   → Environment Variables, Production). Get it from resend.com → API Keys.
   Without it, `emailService.js` logs `RESEND_API_KEY not set — emails will not
   be sent` and skips every send.
2. **The sending domain must be verified in Resend** (below). An unverified
   domain makes every send fail with
   `The cardpop.com.au domain is not verified` — the API key is present, but
   Resend refuses to deliver.

## Verifying the domain in Resend

Sending from `noreply@cardpop.com.au` requires `cardpop.com.au` to be a
**verified domain** in Resend. Verification is done once via DNS records added
in **Cloudflare** (the authoritative DNS provider — see the DNS note in the root
`CLAUDE.md`; confirm with `dig NS cardpop.com.au`).

Resend's records coexist with Google Workspace because they use **different
hostnames**, so there is no conflict:

- Resend SPF/MX → the `send.cardpop.com.au` subdomain; DKIM → `resend._domainkey`.
- Google SPF → the root `cardpop.com.au`; DKIM → `google._domainkey`.

### Steps

1. **Resend → Domains → Add Domain** → enter `cardpop.com.au`, pick a region.
   Resend generates 3–4 DNS records unique to the domain (the DKIM key is
   generated per-domain — read the real values from the Resend dashboard).

2. **Cloudflare → cardpop.com.au → DNS → Records** → add exactly what Resend
   shows. They take this shape (values are illustrative — copy the real ones):

   | Type | Name (host) | Value | Purpose |
   |---|---|---|---|
   | `MX` | `send` | `feedback-smtp.<region>.amazonses.com` (priority 10) | Bounce/complaint handling |
   | `TXT` | `send` | `v=spf1 include:amazonses.com ~all` | SPF for the send subdomain |
   | `TXT` | `resend._domainkey` | `p=MIGf…` (long key) | DKIM signature |
   | `TXT` | `_dmarc` | `v=DMARC1; p=none;` | DMARC — only if one doesn't already exist |

   Cloudflare notes:
   - Keep these **DNS only (grey cloud)**, not proxied.
   - Only **one** SPF (`v=spf1`) record is allowed per hostname. Safe here because
     Resend's SPF is on `send.` while Google's is on the root domain.
   - Only **one** `_dmarc` record is allowed. If the root domain already has one,
     **do not add a second** — skip that row.

3. **Resend → Verify.** Cloudflare propagates in seconds-to-minutes. Once the
   domain shows **Verified**, all transactional emails deliver again — no
   redeploy needed.

## Troubleshooting

| Symptom (in logs / Vercel runtime errors) | Cause | Fix |
|---|---|---|
| `[EMAIL] Send failed to …: The cardpop.com.au domain is not verified` | Domain not verified in Resend | Complete the DNS verification above |
| `[EMAIL] RESEND_API_KEY not set — emails will not be sent` | Missing key | Set `RESEND_API_KEY` in the server environment |
| Auth emails (signup/reset) missing, but order/refund emails work | Not a Resend issue | Check Supabase dashboard → Authentication → Email settings |
| Marketing/newsletter not sending | Not a Resend issue | Check Kit.com (`src/routes/newsletter.js`, `KIT_*` env vars) |
