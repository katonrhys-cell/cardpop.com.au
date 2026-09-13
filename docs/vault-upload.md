# Vault card upload — backend flow

Adding or editing a card in the vault is **one API call**. The Add/Edit Card
form (`pages/AddEditCardPage.jsx`) collects everything, uploads photos, then
hands the whole submission to the backend, which validates it, writes the
vault row and syncs the marketplace listing together, and answers with an
honest per-part outcome.

```
Add/Edit Card form
  1. client-side validation pass (utils/listingValidation.js) — instant feedback
  2. photo uploads → Supabase Storage `vault-images` (client-direct, + .thumb.webp)
  3. POST /vault/items            (create)   ─┐
     PUT  /vault/items/:id        (edit)     ─┤ src/routes/vault-items.js
       ├─ re-validate with the SAME rules module
       ├─ insert/update vault_items          (caller-scoped client → RLS applies)
       └─ sync listings row                  (src/services/vaultListingService.js)
  4. toast from response: { item: { id }, listing: { status } }
```

## Why photos don't travel through the API

Vercel serverless functions cap request bodies (~4.5 MB) and card photos are
multi-megabyte. The client keeps uploading straight to Supabase Storage (the
supported pattern) and sends only the resulting **storage paths**. The backend
verifies every path lives inside the caller's own folder
(`<ownerId>/<timestamped name>`) so one account can never point its card at —
or later orphan — another account's photos.

## Why the backend does NOT use the service-role key

`src/routes/vault-items.js` builds a Supabase client scoped to the **caller's
token** (`src/utils/userScopedSupabase.js`, anon key + the request's Bearer
JWT). Every DB write therefore passes through RLS exactly like the old
client-side writes did, and the database stays the single enforcement point
for:

- ownership (`owner_id = auth.uid()` policies on `vault_items` / `listings`)
- the selling gate — the RESTRICTIVE `listings_require_selling_entitlement`
  policy calling `private.can_sell()` (identity verified + card on file)
- the locked columns — `is_featured` pin, admin-only base-value columns
- the owner's own edit lock — `vault_items.locked`, toggled by the owner via
  `PATCH /vault/items/:id/lock` (one call, no confirmation either way) and
  enforced by `trg_fn_vault_enforce_item_lock`: while `locked` is true, every
  other column is pinned to its stored value until the owner unlocks it again.
  `PUT /vault/items/:id` pre-checks this and returns `423` with a friendly
  message before ever reaching the trigger. `pages/account/AccountListings.jsx`
  links each listing to `/vault/edit/:id`, and `AddEditCardPage.jsx` disables
  the whole form (visually and via `inert`) while a card is locked.
- the `enforce_listing_approval` trigger (new listings may be held `pending`)

A service-role write would silently bypass all of these, and each rule would
need a JS re-implementation that could drift (that class of drift is exactly
what broke `can_sell()` in July 2026 — see
`20260728205156_fix_selling_gate_uses_stale_private_can_sell.sql`).

What the backend adds on top of RLS:

- **Column whitelist + derivation** (`src/utils/vaultItemInput.js`): only the
  columns the form writes are accepted; flags derived from the variant chips
  (`is_rookie`, `is_foil`, …) and conditional detail fields are recomputed
  server-side so they can never disagree with their source chips.
- **Display-style tier clamp**: the owner's `subscription_tier` is read
  server-side and `display_style` is clamped with `lib/displayStyles.js` —
  previously this clamp only lived in the client and could be bypassed.
- **Display style applies to the first photograph only**: the chosen style
  dresses the listing's first photo — the grid tile and the detail-page hero
  before the buyer touches the thumbnails. Selecting any later photo in
  `ProductImageCarousel` drops back to the plain image, so the extra shots
  (backs, corners, edges, flaws) stay unembellished condition evidence.
- **Shared validation**: `utils/listingValidation.js` (the exact module the
  form uses on blur/submit) runs again on the server. A 400 response carries
  `{ fields: { cardName: '…', … } }` keyed by the form's field names, so the
  page highlights the same inputs either way.

## Response contract

```jsonc
// 201 (POST) / 200 (PUT)
{ "success": true, "item": { "id": "…" }, "listing": { "status": "listed" } }

// 400 — validation
{ "error": "Validation failed", "fields": { "cardName": "Card name is required" } }
```

`listing.status` reports how the marketplace row actually ended up (the vault
card itself is already saved in every case):

| status | meaning |
|---|---|
| `archived` | card is private; any active listing was archived |
| `listed` | live on the marketplace now |
| `pending` | held for admin approval by the listing-approval trigger |
| `blocked` | denied by the `can_sell()` gate — identity/card-on-file missing |
| `quota` | rejected by the monthly listing quota trigger — the seller has used their tier's monthly listing allowance (see `LISTINGS_PER_MONTH` in `config/plans.js`) |
| `sold_visible` | card went private, but its **sold** listing stays visible on the marketplace — RLS stops sellers updating sold rows, so only an admin can archive it |
| `error` | listing write failed; the seller can re-list from the vault |

## Update semantics

`PUT /vault/items/:id` expects the **complete item**, exactly as the form
sends it. Derived flags are recomputed from the submitted `variant` string and
listing type, so a partial body would clear them. Two deliberate exceptions:

- an omitted `card_image` keeps the stored photo (the form only sends a path
  when a new photo was chosen);
- omitted CardSight fields keep the stored identification (the form only
  knows CardSight in the session that matched it).

Edits also re-check the admin-locked base value: `estimated_value_aud` /
`trade_value_aud` below `locked_base_value_aud` are rejected as validation
errors, mirroring the form.

## Schema-drift safety

Vercel deploys and Supabase migrations land independently on merge, so a new
column can briefly be missing from the live schema. Writes that fail with
PGRST204 on the `language` column are retried once without it rather than
failing the seller's upload (same fallback the client used to carry).

## Tests

- `tests/backend/vault-item-input.test.js` — whitelist, path ownership,
  derivations, tier clamp, validation.
- `tests/backend/vault-items.test.js` — route behaviour: statuses, blocked
  listings, RLS denials, locked-base-value edits, the language retry.
