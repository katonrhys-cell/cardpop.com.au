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
   | `TXT` | `_dmarc` | see the **DMARC** section below | DMARC — publish the fuller record from that section, not a bare `p=none;` |

   Cloudflare notes:
   - Keep these **DNS only (grey cloud)**, not proxied.
   - Only **one** SPF (`v=spf1`) record is allowed per hostname. Safe here because
     Resend's SPF is on `send.` while Google's is on the root domain.
   - Only **one** `_dmarc` record is allowed. If the root domain already has one,
     **do not add a second** — skip that row.

3. **Resend → Verify.** Cloudflare propagates in seconds-to-minutes. Once the
   domain shows **Verified**, all transactional emails deliver again — no
   redeploy needed.

## DMARC

DMARC tells receiving mail servers what to do with mail claiming to be from
`cardpop.com.au` that fails **both** SPF and DKIM alignment, and (via `rua`)
sends you daily aggregate reports of who is sending as your domain. Cloudflare
Security Center flags a **"DMARC Record Error detected"** when the domain has no
valid DMARC record (or a malformed one). The fix is a single DNS TXT record.

DMARC only *reports on* or *enforces* the SPF/DKIM you already publish — it
authenticates nothing by itself. So publish it **after** the senders below are
aligned, and start in monitor mode (`p=none`) so a misconfiguration can never
silently drop real mail.

### The record

Add **one** TXT record in **Cloudflare → cardpop.com.au → DNS → Records**
(DNS only / grey cloud). There must be exactly one `_dmarc` record — if one
already exists, **edit** it rather than adding a second (two `_dmarc` records is
itself a DMARC error).

| Field | Value |
|---|---|
| Type | `TXT` |
| Name (host) | `_dmarc` (Cloudflare expands this to `_dmarc.cardpop.com.au`) |
| TTL | Auto |
| Content | `v=DMARC1; p=none; rua=mailto:dmarc-reports@cardpop.com.au; ruf=mailto:dmarc-reports@cardpop.com.au; fo=1; adkim=r; aspf=r; pct=100` |

Copy-paste value:

```
v=DMARC1; p=none; rua=mailto:dmarc-reports@cardpop.com.au; ruf=mailto:dmarc-reports@cardpop.com.au; fo=1; adkim=r; aspf=r; pct=100
```

What each tag does:

- `v=DMARC1` — version. Must be the first tag, exactly this value.
- `p=none` — **monitor only**: receivers report but do not quarantine/reject.
  This is the safe starting policy (see rollout below).
- `rua=mailto:…` — where daily **aggregate** (XML) reports are sent. Point this
  at a mailbox you can receive at. `dmarc-reports@cardpop.com.au` must exist as a
  real Google Workspace address/alias/group **before** you rely on it — or swap
  it for `admin@cardpop.com.au`, or a DMARC analytics service address
  (dmarcian, Postmark DMARC, Valimail — all have free tiers that make the XML
  readable).
- `ruf=mailto:…` — **forensic/failure** reports (per-message). Optional; many
  receivers ignore it for privacy. Safe to keep pointed at the same mailbox.
- `fo=1` — request a failure report whenever SPF **or** DKIM fails (most useful
  granularity). Only takes effect where `ruf` is honoured.
- `adkim=r`, `aspf=r` — **relaxed** alignment for DKIM and SPF. Relaxed SPF is
  required for our Resend/SES path: Resend's Return-Path is on the
  `send.cardpop.com.au` subdomain, which only counts as aligned to the root
  `cardpop.com.au` under relaxed (not strict) alignment.
- `pct=100` — apply the policy to 100% of mail (only meaningful once `p` is
  stronger than `none`; used to ramp enforcement gradually — see below).

### Check the senders align first

DMARC passes if a message aligns on **SPF or DKIM**. Confirm each sender that
uses an `@cardpop.com.au` From address is authenticated:

| Sender | Aligns via | Notes |
|---|---|---|
| **Resend** (transactional, `noreply@cardpop.com.au`) | DKIM `resend._domainkey` + relaxed SPF on `send.` | Requires the domain **Verified** in Resend (see above). `aspf=r` is what makes the `send.` Return-Path align. |
| **Google Workspace** (human mail) | Google SPF on the root + DKIM `google._domainkey` | Confirm DKIM is switched **on** in Google Admin → Apps → Google Workspace → Gmail → Authenticate email (not just generated). |
| **Kit.com** (marketing) | Kit domain authentication (its own DKIM/CNAMEs) | Only relevant if broadcasts send from an `@cardpop.com.au` From. If Kit sends from a Kit address, DMARC for `cardpop.com.au` doesn't apply to it. |
| **Supabase Auth** (signup/reset) | Depends on Supabase SMTP config | Default Supabase mail is **not** from `@cardpop.com.au`, so DMARC doesn't apply. If a custom SMTP with a `cardpop.com.au` From is configured, it must be SPF/DKIM-aligned too. |

The first aggregate reports (24–72h after publishing) will show any source that
is sending as `cardpop.com.au` **without** alignment — fix those before tightening.

### Rollout (don't jump straight to reject)

1. **`p=none`** (this record) — publish, then watch `rua` reports for **2–4
   weeks** until every legitimate source shows `pass`.
2. **`p=quarantine; pct=25`** → ramp `pct` 25 → 50 → 100 over a week or two,
   watching that nothing legitimate lands in spam.
3. **`p=quarantine; pct=100`**, then **`p=reject`** once you're confident. Reject
   is the end state that actually stops spoofing.

Only the `p=` (and `pct=`) values change between stages — keep the rest of the
record identical.

### Verify

After publishing, confirm the record resolves and is valid:

```bash
dig +short TXT _dmarc.cardpop.com.au
# → "v=DMARC1; p=none; rua=mailto:dmarc-reports@cardpop.com.au; ..."
```

Or paste the domain into any DMARC checker (e.g. dmarcian's inspector). Re-run
the Cloudflare Security Center scan — the "DMARC Record Error" finding clears
once a single valid record is live.

## Troubleshooting

| Symptom (in logs / Vercel runtime errors) | Cause | Fix |
|---|---|---|
| `[EMAIL] Send failed to …: The cardpop.com.au domain is not verified` | Domain not verified in Resend | Complete the DNS verification above |
| `[EMAIL] RESEND_API_KEY not set — emails will not be sent` | Missing key | Set `RESEND_API_KEY` in the server environment |
| Auth emails (signup/reset) missing, but order/refund emails work | Not a Resend issue | Check Supabase dashboard → Authentication → Email settings |
| Marketing/newsletter not sending | Not a Resend issue | Check Kit.com (`src/routes/newsletter.js`, `KIT_*` env vars) |
