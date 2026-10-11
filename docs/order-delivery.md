# Order delivery lifecycle — shipped, delivered, protected

How an order gets from "paid" to "done", who records each step, and what the
buyer and seller are told. The refund window that hangs off this is in
`utils/buyerProtectionPolicy.js` (see `docs/order-pricing.md` → Refunds).

## States

| `orders.status` | Set by | Means |
|---|---|---|
| `payment_confirmed` | Stripe webhook | Paid; the seller must post it |
| `shipped` | seller (`POST /orders/:id/ship`) or admin (`POST /admin/orders/:id/ship`) | Posted; `tracking_carrier`, `tracking_number`, `shipped_at` set; buyer emailed the tracking link |
| `completed` | `markOrderDelivered()` — carrier scan, buyer's **I've received it**, the 10-day auto rule, or an admin | `delivered_at` + `delivery_source` (`carrier` / `buyer` / `auto` / `admin`); buyer emailed; points awarded by the DB trigger |

`shipmentService.js` owns both transitions so the email, the bell and the
timestamps are identical whoever triggers them. Delivery is idempotent and
compare-and-swaps on `status = 'shipped'`, so the sweep and a buyer tapping
"Received" at the same moment can't double-fire.

## The seller's side — Account → Sales

`pages/account/AccountSales.jsx` lists the caller's sales from the
`seller_sales()` function (single-item orders where they are `orders.seller_id`
*and* their own lines of cart orders). For each unshipped sale:

- **Show delivery address** calls `seller_sale_shipping(order_id)` — a
  SECURITY DEFINER function that returns the buyer's address for *that one
  sale* only when the caller is its seller. The `orders` row itself stays
  unreadable to a per-line seller (it would expose the rest of the cart).
- **Mark as shipped** posts carrier + tracking to `POST /orders/:id/ship`.
  Ownership is checked server-side (`sellerOwnsOrder`). A cart that mixes
  several sellers can't be marked shipped as a whole (409) — each parcel is a
  separate shipment and the order has one tracking slot — those go through
  support until per-line shipments exist.

The "You made a sale" email now links here and says to post within 7 days
with tracking (the not-received claim opens after 7 days unposted).

## The buyer's side — Account → Orders

A shipped marketplace order shows **I've received it** (`POST
/orders/:id/received`), which records delivery with source `buyer`, completes
the order and starts the 7-day claim window. The delivered date is shown once
known. Reviews unlock at `shipped` (unchanged) and are nudged by the delivered
email.

## The sweep — daily cron

`.github/workflows/cron-daily.yml` (the shared daily run, `docs/scheduled-jobs.md`) → `GET /api/orders/delivery-sweep`
(`CRON_SECRET` bearer, fail-closed) → `runDeliverySweep()`:

1. Every `shipped` order with `delivered_at IS NULL`, oldest first, up to 60
   per run and 25 s of wall clock (the function has a 40 s budget).
2. If the carrier is trackable and credentials exist, `lookupTracking()`
   (`src/utils/carrierTracking.js`) asks for the latest events; a "Delivered"
   scan records delivery with source `carrier` at the scan time.
3. Otherwise, once `shipped_at` is 10 days old
   (`MARKETPLACE_PROTECTION.autoDeliveredDaysAfterShipped`), delivery is
   recorded with source `auto`.

`decideDelivery(order, tracking, now)` is the pure rule and is unit-tested.

### Carrier credentials (Vercel env, all optional)

| Carrier | Vars | Notes |
|---|---|---|
| Australia Post, StarTrack | `AUSPOST_API_KEY`, `AUSPOST_ACCOUNT_NUMBER`, `AUSPOST_PASSWORD` | Shipping & Tracking API — needs a business account and API approval at developers.auspost.com.au. StarTrack consignments resolve through the same API. |
| Sendle | `SENDLE_ID`, `SENDLE_API_KEY` | From the Sendle dashboard → Settings → Integrations |
| Aramex, other | — | No usable public tracking API; the 10-day rule applies |

Unset means that carrier is skipped and the 10-day rule applies. Every lookup
is fail-safe (timeout, non-2xx, unparseable → null → wait). The response
parsers (`parseAusPostTracking`, `parseSendleTracking`) follow the carriers'
documented shapes and are tested against sample payloads; **verify against a
live key before relying on carrier-sourced delivery**, since the sweep will
otherwise simply fall back to the 10-day rule.

## Files

| File | Role |
|---|---|
| `supabase/migrations/20261004000559_order_delivery_lifecycle.sql` | `delivered_at`, `delivery_source`, `delivery_notified_at`; `seller_sales()` with shipping state; `seller_sale_shipping()` |
| `src/services/shipmentService.js` | `markOrderShipped()`, `markOrderDelivered()`, ownership helpers |
| `src/services/deliverySweepService.js` | `decideDelivery()`, `runDeliverySweep()` |
| `src/utils/carrierTracking.js` | AusPost / StarTrack / Sendle adapters and parsers |
| `src/routes/orders.js` | seller ship, buyer received, cron sweep |
| `src/routes/admin.js` | admin ship (now via the shared service) |
| `src/emails/templates.js` → `orderDeliveredEmail` | the delivered email |
| `pages/account/AccountSales.jsx` | seller UI |
| `pages/account/AccountOrders.jsx` | buyer "I've received it" |
