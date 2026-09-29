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

The transactional emails and where they fire:

| Email | Recipient | Triggered from |
|---|---|---|
| Order confirmed | Buyer | `src/services/stripeWebhookService.js` (Stripe webhook) |
| Item sold | Seller | `src/services/stripeWebhookService.js` (Stripe webhook) |
| Refund processed | Buyer | `src/services/refundService.js` |
| Refund issued | Seller | `src/services/refundService.js` |
| Welcome offer (trial + discount) | New user | `src/services/welcomeOfferService.js` |
| Offer received (enquiry) | Seller | `src/routes/offers.js` (see below) |
| Offer placed — binding confirmation | Buyer | `src/routes/offers.js` |
| Offer made — admin alert | `admin@cardpop.com.au` + every admin + alerts inbox | `src/routes/offers.js` |
| Offer response — accepted (pay by …), countered, declined, counter accepted/declined, withdrawn | The other party (both, for an accepted counter) | `src/routes/offers.js` → `PATCH /offers/:id` |
| Order shipped (tracking) | Buyer | `src/routes/admin.js` `POST /admin/orders/:id/ship` (see below) |
| Sold-out shop enquiry | Admin (`noreply@cardpop.com.au`) | `src/routes/shop-enquiry.js` — the **Enquire** button on a shop product with `stock_quantity = 0`; reply-to is the shopper. Override the inbox with `SHOP_ENQUIRY_EMAIL` |

Email HTML is built by the templates in `src/emails/templates.js`.

### Order shipped (tracking)

Admin → Order Management → **Mark as Shipped** opens `components/admin/ShipOrderDialog.jsx`:
pick the carrier (Australia Post by default), paste the tracking reference, and
leave **Email the customer** ticked. It calls `POST /admin/orders/:id/ship`, which
sets `orders.status = 'shipped'`, stores `tracking_carrier` / `tracking_number` /
`shipped_at`, emails the buyer (guest email on the order, else `profiles.email`)
with a **Track Your Parcel** button, drops an `order_update` notification in the
bell, and stamps `shipping_notified_at` once the email is accepted by Resend.
Only `payment_confirmed` or already-`shipped` orders can be shipped; re-posting on
a shipped order is **Update Tracking** (untick the box to fix a typo without a
second email). Carrier list and tracking links live in `utils/shipmentTracking.js`
(StarTrack links go to the Australia Post tracker, which handles both). Buyers also
see the tracking link on `/account/orders`.

### Offer / enquiry notifications

A buyer enquiring on a card is an offer — `MakeOfferModal` → `POST /offers`.
The seller is told **twice**, by two independent mechanisms, so a failure in
one never silences the other:

- **In-app (the notification bell):** the `on_offer_created` database trigger
  calls `create_notification(seller_id, 'offer_received', …)`. This is a
  security-definer trigger on the `offers` table, so it fires for *any* insert
  — nothing in application code can skip it.
- **Email:** `src/routes/offers.js` sends it after the insert commits. The
  offer is written with a **caller-scoped** Supabase client so RLS is still the
  enforcement point (the modal used to insert straight from the browser; the
  route exists so there is a server-side moment to send mail). The send is
  best-effort: the response carries `emailed: true|false`, and a Resend outage
  logs but never fails the buyer's offer.

**Admins see every offer**, the same two ways: the `on_offer_created`
trigger also writes an `offer_received` bell notification for every
`is_admin` profile that isn't a party to the offer (linking to the listing),
and the route emails `admin@cardpop.com.au` — always, hard-coded as
`OFFER_ADMIN_EMAIL` — plus every admin account's email and the configured
alerts inbox (`getAdminNotificationEmails()`), deduped. The **buyer** gets a
confirmation email spelling out the binding terms. The three emails are sent
independently; the response reports `emailed` (seller), `buyerEmailed` and
`adminEmailed`.

**Offers are binding.** The buyer must tick "I understand this offer is
binding for 48 hours unless I withdraw it" (`acknowledgedBinding: true`, stored
as `offers.binding_acknowledged_at`; the route 400s and the insert trigger
refuses without it). The database — not the client — owns the lifecycle
(`supabase/migrations/20260928071648_binding_offers_lifecycle.sql`): every new
offer is forced to `pending` with `expires_at = now() + 48h`; once that passes
it can't be accepted or countered; a seller's counter gets a fresh 48 hours
for the buyer; the buyer can withdraw a `pending` offer but not an accepted
one; and pg_cron runs `expire_stale_offers()` every 15 minutes (both parties
get an "Offer expired" notification, and the seller one for a withdrawal).
Which listings take offers is `utils/offerEligibility.js` (buy-now unless the
seller switched Accept Offers off, EOI always; never trade-only or auctions),
mirrored by the insert trigger. `tests/db/run-offer-migrations.sh` exercises
all of this against a real Postgres.

**Responses** go through `PATCH /offers/:id` with an `action` — the seller's
`accept` / `decline` / `counter`, the buyer's `accept_counter` /
`decline_counter` / `withdraw` — which writes with the caller-scoped client (RLS
and the lifecycle trigger still decide what's allowed) and then emails the other
side via `sendOfferUpdate` (`offerUpdateEmail` in `src/emails/templates.js`).
An accepted offer gives the buyer **48 hours to pay** (`payment_due_at`, set by
the trigger — never by the client); the accept email states the deadline, the
Stripe webhook stamps `paid_at`, and `resolveOfferPrice()` refuses checkout once
the window closes. `expire_stale_offers()` lapses unpaid accepted offers and the
`notify_on_offer_updated` trigger bells the buyer, the seller and every admin
("Accepted offer went unpaid"). There is no reminder email before the deadline:
pg_cron can't send mail, so that would need a backend job.

Admins see every offer at **Admin → Offers** (`/admin/offers`, backed by the
admin-gated `GET /admin/offers`, since offers RLS only lets the two parties read
a row). Admin bell notifications for offers link there.

The route is the only writer of `offers` rows. If another one is ever added,
it must send the email too — the trigger will cover the bell by itself, but
there is no database-level hook for the email. (Hanging it off the
`notifications` insert instead would not work on this project: the
`notifications_push_dispatch` webhook in
`supabase/migrations/20260823053100_push_dispatch_webhook.sql` degrades to
"not installed" because `supabase_functions.http_request` is unavailable here,
which is also why web push for notifications is currently inert.)

**Verifying it end to end** — `scripts/verify-offer-notification.mjs` drives the
real path: it signs in as a test buyer, posts a real offer through the live
endpoint, reads the seller's notification row back out of the database, and
reports whether Resend accepted the email. It also checks the 48-hour window,
the `admin@cardpop.com.au` bell notification, and the admin + buyer emails.

```bash
SUPABASE_SERVICE_ROLE_KEY=... TEST_BUYER_EMAIL=... TEST_BUYER_PASSWORD=... \
  node scripts/verify-offer-notification.mjs --cleanup
```

It writes a real offer, so use `--cleanup` (or decline the offer from the
seller's `/account/offers` page) afterwards. `--listing <uuid>` targets a
specific listing; `--api http://localhost:3001/api` runs it against a local
server.

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

## Supabase Auth email (SMTP via Resend)

Supabase Auth — signup confirmation, **password reset / account recovery**,
magic links, email-change confirmation — is a **separate pipeline** from the
Resend SDK used for transactional mail. It is configured entirely in the
**Supabase dashboard**, and **nothing in this repo changes it**: the app only
calls `supabase.auth.resetPasswordForEmail(...)` (see
`contexts/AuthContext.jsx` → `resetPassword`, and the backend
`src/routes/auth/password.js` → `POST /auth/reset/request`). Whether the email
actually *delivers* depends on which mailer Supabase Auth is pointed at.

### Why you must use custom SMTP (don't rely on the built-in mailer)

Out of the box, Supabase Auth uses its **built-in email service**, which is:

- **Hard-capped at ~2 emails/hour** for the whole project, and
- **explicitly not for production** — poor deliverability, and it sends from a
  Supabase address (not `@cardpop.com.au`), so it fails our DMARC alignment and
  gets junked.

The failure mode is silent and confusing: `POST /recover` still returns **200**
and the UI shows "recovery link is on its way", but no mail is sent once the cap
is hit. The tell is in `auth.users` — a successful send stamps
`recovery_sent_at` to *now*; if that column stays frozen in the past while the
request returned 200, the mail was **dropped**, not sent. (A real SMTP send also
shows up as a ~1–2s `/recover` duration in the auth logs and logs a
`user_recovery_requested` auth event; the dropped built-in send completes in
~150ms with no auth event.)

The fix is to route Supabase Auth through **Resend over SMTP** — the same
already-verified `cardpop.com.au` domain, so recovery mail gets proper DKIM/SPF
alignment.

### Setup

1. **Create a dedicated Resend API key** — **Resend → API Keys → Create API
   Key**, name it `supabase-auth-smtp`, permission **Sending access**, domain
   `cardpop.com.au`. Copy the `re_…` value (shown once).

   Use a **separate** key — not the one the Resend↔Vercel integration syncs into
   `RESEND_API_KEY` (that powers the transactional SDK in
   `src/utils/emailService.js`), and not the default "Onboarding" key. A
   dedicated key means Supabase Auth can be rotated/revoked without knocking out
   checkout/refund email, and Resend's logs attribute sends cleanly.

2. **Supabase → Authentication → Emails → SMTP Settings → Enable Custom SMTP:**

   | Field | Value |
   |---|---|
   | Host | `smtp.resend.com` |
   | Port | `465` (SSL) or `587` (TLS) |
   | Username | `resend` |
   | Password | the `re_…` key from step 1 |
   | Sender email | `noreply@cardpop.com.au` |
   | Sender name | `Card Pop` |

   The sender domain must be **Verified in Resend** (see the section above) — it
   already is for `cardpop.com.au`.

3. **Raise the Auth email rate limit.** Only possible **after** custom SMTP is
   enabled — the built-in ceiling (2/hour) locks the field until then.
   **Authentication → Rate Limits → "Rate limit for sending emails"** → set the
   per-hour value (we run **100/hour** — project-wide across *all* auth mail, not
   per user). Enabling SMTP auto-bumps the default 2 → 30; raise from there.

4. **URL Configuration.** Confirm `https://cardpop.com.au/reset-password` (and
   `https://cardpop.com.au/**`) is in the **Redirect Allow List** — the recovery
   link's `redirectTo` targets `/reset-password`, which renders
   `pages/PasswordResetPage.jsx`.

### Verify it works

Request a recovery link (`/reset-password`), then confirm the send actually
fired — not just that the request returned 200:

```sql
-- recovery_sent_at should jump to ~now for the address you tested
select email, recovery_sent_at, updated_at, now()
from auth.users
where email = 'you@example.com';
```

If `recovery_sent_at` moved to the current time, Supabase handed the mail to
Resend successfully. If it stayed in the past despite a 200, SMTP isn't being
accepted — recheck the key/host/port and that the domain is Verified in Resend.

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
  it for `noreply@cardpop.com.au`, or a DMARC analytics service address
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
| Auth emails (signup/reset/recovery) missing, but order/refund emails work | Supabase Auth pipeline, not the Resend SDK — usually the built-in mailer's 2/hour cap silently dropping mail | Enable custom SMTP + raise the rate limit — see [Supabase Auth email (SMTP via Resend)](#supabase-auth-email-smtp-via-resend). Confirm with the `recovery_sent_at` check there |
| Marketing/newsletter not sending | Not a Resend issue | Check Kit.com (`src/routes/newsletter.js`, `KIT_*` env vars) |
