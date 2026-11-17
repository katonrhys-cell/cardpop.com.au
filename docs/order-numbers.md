# Order numbers

Every order has a sequential, human-readable number — **`CP-000123`** — that
buyers, sellers and admins all see and can read out over the phone. It replaced
the first 8 characters of the order's UUID (`0F0F0F0F`), which was random,
unmemorable and the only thing the tax invoice used to print in full.

Don't confuse it with the **invoice number** (`INV-000042` / `CN-000003`): that
is the accountant's gapless series, one per tax invoice or credit note
(`docs/order-invoices.md`). An order has one order number and, once paid, an
invoice number; the invoice prints both.

## Where it lives

`orders.order_number` — `text`, `NOT NULL`, unique, `CP-` + six digits (it grows
a digit past a million). Migration `20261117101216_sequential_order_numbers.sql`.

- **The database owns it.** `trg_orders_assign_order_number` (BEFORE INSERT)
  always takes the next value of `order_number_seq`, so the two Express insert
  paths (`src/routes/stripe.js` cart checkout, `src/services/stripeWebhookService.js`
  single item) need no change, and a caller can't choose or spoof a number — a
  value supplied on insert is overwritten.
- **It never changes.** Once set, an UPDATE that tries to change or clear it is
  silently reverted by the same trigger. Never write `order_number` from code.
- **It isn't gapless.** An order row is written `pending` when its Checkout
  Session is created, so an abandoned checkout uses a number. That's fine for a
  reference people quote; the series an accountant needs to be gapless is the
  invoice number.
- **Existing orders were numbered once**, oldest first (`created_at`, then `id`),
  by the migration's backfill. The backfill only touches rows without a number,
  and the only triggers on `orders` that react to updates fire on
  `update of status`, so it creates no invoices, notifications or points.
- **Sellers** read the number of their own sales through
  `seller_order_numbers(uuid[])` (security definer, same ownership rule as
  `seller_sales()`), because a seller inside a multi-seller cart can't read the
  `orders` row directly.

## Showing it

Always go through **`orderRef(order)`** from `utils/orderRef.js` (dependency-free:
the SPA, the API, the email templates and the PDF all import it). It returns
`order_number`, else the short id (`shortOrderId()`), else `''`. The short id is
only a fall-back for the deploy window where the app is live before
`supabase db push` has run, or a query that didn't select the column — never
hand-write `order.id.slice(0, 8)` into a page.

| Where | How it gets the number |
|---|---|
| Account → Orders, Admin → Order Management / Order detail / Ship dialog / Revenue breakdown / User detail | `select('*')` already returns it → `orderRef(order)` |
| Account → My Sales | `seller_order_numbers()` after `seller_sales()`; falls back to the short id |
| Order confirmation, admin "new order" notice | `emailService` looks it up (`fetchOrderNumbers`) and passes `orderNumber` to the template |
| Shipped / delivered emails, refund-request alert | `orderRefFor(orderId)` in `shipmentService.js` / `routes/refunds.js` |
| Tax invoice / credit note PDF | `buildInvoicePdf()` adds `order_number` to the row; prints `Order: CP-000123` |

Server code that selects an **explicit column list** must not add `order_number`
to it: during the deploy window the unknown column would fail the whole read —
including payment handling. Use `src/utils/orderNumbers.js` instead
(`fetchOrderNumbers(ids)` / `orderRefFor(id)`): a separate best-effort read with
a 2.5 s timeout that never throws and returns nothing on any failure, so a
receipt is never held up or broken by a cosmetic lookup.

## Searching

Admin → Order Management matches the number (`cp-000123`, or just `123`), the
order id, buyer, checkout email and shipping name.

## Testing

```bash
PGHOST=/var/tmp PGPORT=55432 PGUSER=postgres tests/db/run-order-numbers-migration.sh
```

Applies the migration twice (re-running must be a no-op) to a throwaway
database whose `orders` table already holds rows inserted out of creation order,
then checks: oldest-first backfill with the `id` tie-break, the backfill not
firing status triggers, new orders continuing the sequence, a supplied number
being overridden, immutability, `NOT NULL` + unique, contiguity, and
`seller_order_numbers()` returning only the caller's own sales. Not part of
`npm test` (CI has no Postgres) — run it whenever the migration changes. The JS
side is covered by `tests/backend/orderNumbers.test.js`, the email, PDF and ship
tests, and `tests/frontend/accountSalesOrderNumber.test.jsx`.
