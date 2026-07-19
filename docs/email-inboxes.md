# Email inboxes — wiring up Gmail / Google Workspace properly

**Goal:** all CardPop **business** mail lands in **`admin@cardpop.com.au`**
(Google Workspace), and **`katonrhys@gmail.com`** goes back to being **personal
only**. Today the two are mixed — Stripe, Supabase, Sentry, Kit and others all
email the personal account. This doc separates them cleanly.

> Related: `docs/email.md` covers *outbound* transactional mail (Resend) and the
> DNS records. This doc is about *inbound* human mail and how the addresses are
> organised.

## Target architecture

| Address | Type | Lands in | Used by the site for |
|---|---|---|---|
| `admin@cardpop.com.au` | **Workspace user** (real mailbox) | itself | The one business inbox you watch |
| `support@cardpop.com.au` | **Alias** of admin@ | admin@ | Customer support (Contact page, order/refund emails, security.txt) |
| `notifications@cardpop.com.au` | Alias of admin@ | admin@ | App/ops alerts (new orders, event submissions) |
| `privacy@cardpop.com.au` | Alias of admin@ | admin@ | Data-deletion / privacy requests |
| `accessibility@cardpop.com.au` | Alias of admin@ | admin@ | Accessibility page |
| `developers@cardpop.com.au` | Alias of admin@ | admin@ | security.txt, API docs |
| `hello@cardpop.com.au` | Alias of admin@ | admin@ | General / marketing |
| `noreply@cardpop.com.au` | Send-only (Resend) | — | Outbound transactional mail — **do not** make this an inbox |
| `reece@cardpop.com.au` | A **person** | reece@ | Keep as Reece's own user (or alias if he uses admin@) — not a role address |
| `katonrhys@gmail.com` | **Personal** | itself | Your personal life — should carry **no** CardPop business mail |

Aliases are **free** (up to 30 per user) and inherit admin@'s mailbox, so every
role address above arrives in one place without extra Workspace seats.

> **Later, if Reece needs to share the support queue:** convert `support@` and
> `notifications@` from aliases into **Google Groups** ("Collaborative Inbox").
> Also free, but lets multiple people claim/assign customer mail. Start with
> aliases (below); the upgrade is easy when you need it.

---

## Part 1 — Create the aliases (Admin console)

1. Go to **[admin.google.com](https://admin.google.com)** → **Directory → Users**.
2. Click **admin@cardpop.com.au** → **User information** → **Add alternate emails**.
3. Add each of these as an alternate email (alias):
   `support` · `notifications` · `privacy` · `accessibility` · `developers` · `hello`
4. **Save.** Allow a few minutes to propagate.

Mail to any of these now arrives in the admin@ inbox with the original `To:`
preserved (which is what the filters in Part 3 key on).

## Part 2 — Reply *as* the right address

So a reply to a customer comes **from** `support@`, not `admin@`:

1. In **admin@'s Gmail** → **Settings → Accounts → "Send mail as" → Add another
   email address.**
2. Add `support@cardpop.com.au` (uncheck "Treat as an alias" if you want a clean
   separate identity; leave checked to share the same sent view). Because it's a
   Workspace alias, **no SMTP/password step is needed** — it verifies instantly.
3. Repeat for any other address you'll reply from (e.g. `privacy@`).
4. Set **"When replying to a message: Reply from the same address the message was
   sent to."** Now replies auto-use the alias the customer wrote to.

## Part 3 — Import the filters + labels

A ready-made filter file lives at **`scripts/gmail-filters-admin.xml`**. It sorts
each alias into its own label and quiets deploy/billing noise.

1. In **admin@'s Gmail** → **Settings → Filters and Blocked Addresses → Import
   filters**.
2. Choose `gmail-filters-admin.xml` → **Open File** → tick **Select all** →
   **Create filters** (optionally "Apply to matching conversations").

Labels created: `Support`, `Ops-Alerts`, `Legal-Privacy`, `Dev-Security`,
`General`, `Deploys`, `Billing`, `Monitoring`. Adjust or delete any you don't want.

> ⚠️ Import into **admin@** only — not your personal Gmail.

## Part 4 — De-mix your personal account

Two things: stop business mail arriving at `katonrhys@gmail.com`, and move
business accounts off it.

**A. Turn off any bleed into personal Gmail** — in **katonrhys@gmail.com**:
- **Settings → Forwarding and POP/IMAP** — remove any forwarding to/from CardPop
  addresses.
- **Settings → Accounts and Import → "Send mail as"** and **"Check mail from
  other accounts"** — remove any `*@cardpop.com.au` entries.

**B. Repoint business service accounts to `admin@`** (or a role alias). These
services currently email your personal account — update the account/billing email
in each:

| Service | Currently emails | Change to |
|---|---|---|
| Stripe | katonrhys@gmail.com | `admin@` (or `billing@` if you add it) |
| Supabase | katonrhys@gmail.com | `admin@` |
| Sentry | katonrhys@gmail.com | `admin@` (or `developers@`) |
| Kit (ConvertKit) | katonrhys@gmail.com | `admin@` |
| PartnerStack / CJ Affiliate | katonrhys@gmail.com | `admin@` |

Do these gradually — each is a "change account email" in that service's settings.
Until then, the filters in Part 3 at least keep them tidy **if** they're
forwarded; the real fix is changing them at the source.

## Part 5 — Verify

1. From any outside address (or your personal Gmail), email
   **support@cardpop.com.au**. It should arrive in admin@ under the **Support**
   label. (No bounce = the alias is live.)
2. Reply and confirm it goes out **from** `support@`.
3. Send a test to `notifications@` and `privacy@` and confirm labels apply.

## Appendix — while you're in there

- **`reece@cardpop.com.au`** is a person, not a role. Keep it as its own
  Workspace user, or an alias if Reece just uses admin@. (The Facebook Business
  Portfolio invite went to reece@, so it's active.)
- **Stray Supabase project:** `supabase-cardpop-australia`
  (`pffitekuotmyhxlugwtm`, created via the Vercel Marketplace, now paused) is a
  duplicate — the app uses `odoglvswwymyjuwlonkf`. Consider deleting the stray to
  avoid confusion and billing surprises. There are also quota-exceeded notices
  for an org `pysxhujsamygmcclmelr` — worth confirming which org owns the live
  project and consolidating.
