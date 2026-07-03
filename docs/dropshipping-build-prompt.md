# Build Prompt: CardPop Trading Card Supplies — Dropshipping Range

> Give this prompt to Claude Code in the cardpop.com.au repository to build the feature.

---

## The task

Build a complete dropshipping product range for **trading card supplies** on CardPop
(cardpop.com.au), an Australian trading card marketplace. Supplies are the consumables
and accessories collectors need when buying, selling, storing and shipping cards. The
range extends the existing shop (Supabase `shop_products` + Stripe checkout) — it is
**not** a separate storefront. Deliver the complete build in one go: supplier research,
storefront, pricing engine, checkout, semi-automated fulfilment, and full admin tooling.

## Product range at launch

Seed the catalogue structure with three supply categories (admins will manage the real
catalogue via the admin portal — see Admin tools below):

1. **Core protection basics** — penny sleeves, toploaders, card savers/semi-rigids,
   team bags, sleeve multipacks.
2. **Storage & display** — binders, 9-pocket pages, storage boxes (100ct–5000ct),
   magnetic one-touch holders, display stands.
3. **Grading & shipping supplies** — grading submission kits, bubble mailers,
   cardboard dividers/stiffeners, shipping-safe packaging for marketplace sellers.

## Supplier strategy

No supplier is chosen yet. As the first deliverable, **research and recommend 3–5
dropship/wholesale suppliers** of trading card supplies, evaluated against these
criteria (in priority order):

1. **Australian-based ideally** (local warehousing → fast domestic delivery).
2. **Extremely reliable** (established, consistent stock, good reputation).
3. **Good shipping rates** to Australian customers.
4. Willingness to dropship or blind-ship (or viable as a low-MOQ wholesale source).

Present the research as a comparison (products carried, indicative cost prices,
shipping rates/times, dropship support, how orders are placed) with a clear
recommendation. The integration must not assume any particular supplier API — the
fulfilment flow below works with any supplier that accepts orders by email or portal.

Note: the owner mentioned AWS. The current stack is Vercel + Supabase — prefer the
existing stack for everything (cron via Vercel/GitHub Actions, email via a
transactional provider, storage via Supabase Storage). Only flag an AWS service if it
provides something the existing stack genuinely cannot.

## Pricing rules (build these into the pricing engine)

- **Markup**: recommend and implement a default markup rule appropriate for a new
  business that must be financially viable. Card accessories typically sustain
  keystone-or-better margins; propose a researched default (e.g. 50–100% over landed
  cost depending on category) and justify it. The default markup percentage lives in a
  settings table and is **overridable per product** by admins.
- **Shipping**: free shipping above an order-value threshold (default AU$50,
  admin-editable). **Below the threshold, a $10 shipping cost must be covered** —
  either charged as a flat shipping fee at checkout or built into pricing; implement
  it so the business never absorbs that $10 on small orders.
- **GST**: the business is GST-registered. All displayed prices are **GST-inclusive**
  (standard AU retail). Order confirmations/receipts must be valid **tax invoices**
  showing the ABN and the GST portion (1/11th of the GST-inclusive total). Store the
  GST amount on each order. Configure Stripe amounts as GST-inclusive.

## Fulfilment flow (semi-automated)

When a customer pays for an order containing supply items:

1. The order lands in an **admin fulfilment queue** with status `awaiting_fulfilment`.
2. The system **auto-generates a pre-filled supplier order** — a ready-to-send email
   body and/or CSV containing supplier SKUs, quantities, cost prices, and the
   customer's shipping address.
3. An admin **approves with one click**, which marks the order `ordered_with_supplier`
   (and opens/sends the pre-filled supplier email).
4. When the supplier ships, the admin **pastes in the tracking number**; the customer
   automatically receives a shipping-confirmation email with tracking, and the order
   moves to `shipped` → `delivered`/`complete`.
5. Support statuses for `cancelled` and `refunded` (refund via Stripe).

Order status must also be visible to the customer in their account's order history.

## Stock handling

Manual stock flags only: admins toggle **in stock / out of stock** per product based
on supplier availability. Out-of-stock products show as unavailable and cannot be
added to the cart or checked out (enforce server-side at checkout, not just in the UI).
No supplier stock API integration in this release.

## Admin tools (in the existing admin portal, behind `ProtectedAdminRoute`)

Admin users must be able to manage **everything** about the range without touching the
database:

- **Catalogue management**: create/edit/archive supply products — name, description,
  images (Supabase Storage upload), category, variant/size options, supplier, supplier
  SKU, cost price, markup override, computed retail price preview, stock flag,
  featured flag.
- **Category management** for the supplies section.
- **Pricing settings**: default markup %, free-shipping threshold, flat shipping fee,
  ABN/business details for tax invoices.
- **Supplier management**: supplier records (name, contact email, ordering
  instructions/portal URL, notes) so products link to a supplier and the fulfilment
  email is addressed correctly.
- **Fulfilment queue**: list and filter orders by status, view the pre-filled supplier
  order, one-click approve, enter tracking numbers, cancel/refund.

## Technical requirements

- Follow all conventions in `CLAUDE.md`. Extend the existing shop — reuse
  `shop_products`, the cart (`CartProvider`), and the Stripe checkout routes
  (`src/routes/stripe.js`) rather than building parallel systems.
- **Schema changes are Supabase migrations** in `supabase/migrations/` (idempotent
  DDL, unique increasing timestamps, backward compatible). Expected additions:
  dropship fields on products (supplier id, supplier SKU, cost price, markup
  override, stock flag), a `suppliers` table, an orders/order-items model with the
  fulfilment status lifecycle and GST amounts, and a settings table for pricing rules.
  Apply proper **RLS**: customers see only their own orders; only admins can write
  catalogue/supplier/settings data; server-side (service role) handles order creation
  from Stripe webhooks.
- Customer-facing storefront: a "Supplies" section in the existing shop with category
  browsing, product pages (variants, images, stock state), cart and Stripe checkout,
  free-shipping-threshold messaging ("Add $X more for free shipping"), and order
  history with tracking.
- Transactional email (order confirmation / tax invoice, shipping confirmation with
  tracking) via a transactional email provider, with the sending key held as a
  server-side env var; document any new env vars in `CLAUDE.md`'s Vercel table.
- Write frontend and backend **tests** for the pricing engine (markup, GST portion,
  shipping threshold and the $10 rule), the fulfilment status transitions, checkout
  stock enforcement, and admin route authorisation. `npm test` and `npm run lint`
  must pass.

## Deliverables checklist

1. Supplier research report with recommendation (commit as `docs/supplier-research.md`).
2. Supabase migrations for the full schema + RLS.
3. Customer storefront (Supplies section, product pages, cart, checkout, order history).
4. Pricing engine with GST-inclusive pricing, markup rules and shipping threshold.
5. Semi-automated fulfilment queue with pre-filled supplier orders and tracking emails.
6. Full admin catalogue/supplier/pricing/fulfilment tooling.
7. Tests passing, lint clean, `CLAUDE.md` updated with new env vars and architecture notes.
