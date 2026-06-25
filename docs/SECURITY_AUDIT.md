# Security Audit — CardPop

Date: 2026-06. Scope: authorization model (backend routes + frontend direct-DB
access + RLS dependency). This is a **code-level** audit; the live RLS policies
must still be verified against the database (see §3).

---

## 1. Backend Express routes — PASS (well-built)

The backend uses the Supabase **service-role key**, which bypasses RLS, so every
route must enforce ownership/authorization itself. Reviewed routes do this well:

- **Server-authoritative pricing** — `stripe.js` fetches the listing/offer
  server-side and never trusts client totals; validates `offer.buyer_id ===
  userId` and `offer.listing_id === listingId`; prevents self-purchase; checks
  `session.metadata.userId === req.user.id`.
- **Ownership scoping** — `vault.js`, `photo-template.js`, `wishlist.js`,
  `buyer-protection.js`, `cardsight.js` scope writes by `owner_id` / `buyer_id`
  / `user_id`, or gate admin-only actions via `isAdminUser(req)`.
- **Trust-derived identity** — `seller-ratings.js` derives `reviewer_id` from the
  token (never the body) and verifies order participation before allowing a review.
- **Admin gates** — categories/subcategories/market-data/price-history writes
  require `authMiddleware` + `isAdminUser`.

No IDOR/BOLA holes found in the backend route layer.

---

## 2. Frontend direct-Supabase access — the real attack surface ⚠️

The frontend talks to Supabase directly with the **public anon key**. There are
**~85 write call-sites across ~25 tables**. For all of these, the *only* security
boundary is the table's RLS policy — the React UI (including "admin only" pages)
is **not** a security boundary. An attacker ignores the UI and calls the REST/JS
API directly with their own anon-key token.

### Critical escalation candidates (admin-gated in UI, RLS-only at the boundary)

These three are trust/privilege escalations if RLS is not airtight:

| Operation | Call site | Risk if RLS is weak |
|---|---|---|
| `profiles.update({ is_admin })` | `pages/admin/UserManagementPage.jsx:100` | **Privilege escalation** — a user updates their own profile row with `is_admin: true` and becomes admin. The classic Supabase hole. |
| `user_verifications.update({ status })` | `pages/admin/AdminVerificationDashboard.jsx:142` | **Self-verify identity** — a user marks their own verification `verified`, defeating KYC/trust. |
| `refunds.update({ status: 'approved' })` | `pages/admin/OrderManagementPage.jsx:57` | **Self-approve refunds** — a user approves their own refund and drains funds. |

### Other sensitive direct writes to verify

`orders.update` (mark paid?), `listings` insert/update/delete (edit another
seller's listing?), `offers` insert/update, `refunds.insert`,
`verification_audit_log.insert` (tamper with audit trail?), `business_profiles`,
`notification_preferences`, and the taxonomy tables `categories` /
`manufacturers` / `events` / `collection_eras` (insert/update/delete — should be
admin-only, vandalism risk if not).

---

## 3. What to verify in the database (RLS)

Run these in the Supabase SQL editor (or via the security advisor). For **every**
table in §2, confirm there is an RLS policy that is both present and correctly
scoped.

```sql
-- (a) Any table with RLS DISABLED is fully open to the anon key. There should be none
-- for user data tables.
SELECT n.nspname AS schema, c.relname AS table
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r' AND n.nspname = 'public' AND c.relrowsecurity = false
ORDER BY 2;

-- (b) Dump every policy so each can be reviewed (USING = read/row visibility,
-- WITH CHECK = what a write is allowed to produce).
SELECT tablename, policyname, cmd, roles, qual AS using_expr, with_check
FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, cmd;

-- (c) The privilege-escalation check: the UPDATE policy on `profiles` must NOT
-- let a user set is_admin on their own row. A bare `auth.uid() = id` USING/CHECK
-- is INSUFFICIENT — column-level protection is required.
SELECT policyname, cmd, qual, with_check FROM pg_policies
WHERE schemaname='public' AND tablename='profiles';
```

### Required outcomes
- **No** public user-data table has RLS disabled.
- `profiles`: users may update their own row but **cannot** change `is_admin`
  (and `seller_tier`, `rating`, `reviews_count`, balances). Enforce via a
  `GRANT UPDATE (col,...)` column list or a trigger, *not* RLS alone (RLS can't
  restrict columns). Best: move privileged columns behind backend endpoints.
- `user_verifications`, `refunds`: status/approval transitions are **admin-only**
  (`WITH CHECK` referencing an admin claim), and users may only insert rows for
  themselves with a non-privileged initial status.
- `categories`/`manufacturers`/`events`/`collection_eras`: write policies require admin.
- `orders`/`listings`/`offers`: a user can only write rows they own / participate in.

---

## 4. Recommended remediations

1. **Move privileged writes to the backend.** `is_admin`, verification approval,
   and refund approval should not be client-writable at all — route them through
   Express endpoints that use the service-role key *after* an `isAdminUser` check
   (the pattern already proven in §1). The admin UI calls those endpoints instead
   of `supabase.from(...).update(...)` directly.
2. **Column-level protection on `profiles`** for `is_admin`, tier, rating, balances.
3. **Run the Supabase security advisor regularly** (and after any DDL) — it flags
   missing RLS, `SECURITY DEFINER` views, and exposed objects automatically.
4. **Add RLS regression tests** — a small suite that signs in as a normal user and
   asserts the escalation writes above are rejected by the database.

---

## 5. Other items

- `verification.js` `POST /resend-verification` is unauthenticated — confirm it's
  rate-limited (it is reachable without a token; abuse = email bombing).
- Confirm the service-role key is only ever in backend env (never bundled).
- Production CSP/security-headers: verify the live responses match `secureHeaders`.
