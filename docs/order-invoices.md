# Order invoices (Admin → Invoices)

Every paid order has a **tax invoice**, and every refunded order a **credit
note**, as rows in `public.invoices`. They are issued by the database the moment
the order's status changes, carry sequential numbers, snapshot every amount and
the GST inside each line, and hold the fields needed to link each document to
the matching one in **Xero** — see "Linking to Xero" below.

Admin → Invoices (`/admin/invoices`, `pages/admin/InvoicesAdminPage.jsx`) lists
them, exports them and records the Xero link. Backend:
`src/routes/admin-invoices.js` (mounted under `/admin` so it inherits the
admin + MFA gates), `src/services/invoiceService.js`, the pure helpers
`src/utils/invoiceAccounting.js` (line kind → Xero account / tax type) and
`src/utils/invoiceExport.js` (CSV, Xero import, Xero API payload). Schema and
issuing logic: `supabase/migrations/20261102074307_order_invoices.sql`.

## How a document is issued

`trg_orders_issue_invoice` runs `AFTER INSERT OR UPDATE OF status` on `orders`:

| Transition | Effect |
|---|---|
| into a paid status (`payment_confirmed`, `shipped`, `delivered`, `completed`, `disputed`, `refunded`) from a non-paid one, or inserted already paid | `issue_invoice_for_order(order_id)` → one `tax_invoice`, status `paid` |
| paid → `pending` / `payment_failed` / `cancelled` | the invoice is **voided** (the cart webhook hands an order back to pending when nothing in it could be fulfilled). Paying it again reinstates the same number |
| → `refunded` | `issue_credit_note_for_order(order_id)` → one `credit_note` crediting the invoice; the invoice becomes `credited` |

Both webhook paths are covered: the cart path flips a `pending` row to
`payment_confirmed` (UPDATE), the single-item path inserts the row already
`payment_confirmed` (INSERT). The trigger body is wrapped in an exception
handler and only *warns* on failure — an invoicing problem must never fail the
write that records a buyer's payment. Anything it missed is picked up by
`issue_missing_invoices()` (the **Issue missing** button, `POST
/admin/invoices/issue-missing`), which also ran once as the migration's
backfill so historic paid orders got numbers in sale order.

One invoice and at most one credit note per order (unique on `order_id, kind`).
An order deleted by the webhook's claim-error rollback takes its invoice with it
(`on delete cascade`), which leaves a gap in the sequence — acceptable, and
rarer than a duplicate would be.

### Numbering and dates

`INV-000001` / `CN-000001` from `invoice_number_seq` / `credit_note_number_seq`.
`invoice_date` is the day the buyer paid in **Australian time** (the order's
`created_at` in `Australia/Sydney`); `issued_at` is when the row was written
(a backfilled invoice keeps its original sale date). `due_date` equals the
invoice date — every CardPop invoice is paid on issue.

### Lines

`lines` is a jsonb array built from the order: cart lines from `order_items`,
a Buy Now order from its listing. Each line has a `kind`, which drives the
accounting coding:

| kind | What | Where it comes from |
|---|---|---|
| `shop_item` | a CardPop Shop product (qty, unit price, SKU) | `order_items[type=shop]` |
| `marketplace_item` | a seller's card | `order_items[type=listing]` or the order's listing |
| `seller_shipping` | the seller's postage | `shipping_aud` on the parcel-defining line, or the order's `shipping_aud` on a single-item order |
| `shop_shipping` | CardPop Shop shipping | order `shipping_aud` minus seller postage |
| `commission` | the service fee (incl. its GST) | `platform_fee_aud` |
| `processing_fee` | payment processing | `processing_fee_aud` |
| `discount` | welcome / promo / wallet discount, as a negative line | `discount_aud` |
| `adjustment` | `total_aud − sum(lines)`, cent rounding only | computed |

Every amount is GST-inclusive and every line carries the GST *inside* it
(1/11 at the `gst_rate_pct` setting; a shop line uses the `gst_aud` the cart
recorded). The header `gst_aud` is the order's own `gst_included_aud +
gst_aud`, split into `seller_gst_aud` (remitted on sellers' behalf) and
`platform_gst_aud` (inside CardPop's fees) exactly as `docs/order-pricing.md`
describes. Legacy orders from before GST became inclusive (`orders.gst_aud >
0`) keep that treatment: item lines carry no GST and the commission line
carries the GST that was added on top.

A credit note's lines are the invoice's lines scaled pro-rata to the refunded
amount (the latest `processed` row in `refunds`, else the full total — the
Buyer Protection policy refunds in full), with the cent remainder on the
largest line.

## Linking to Xero

Nothing here calls Xero yet. The columns and exports are shaped so that the
connection, when it comes, is a thin layer:

- `accounting_provider`, `accounting_invoice_id`, `accounting_number`,
  `accounting_url`, `accounting_sync_status` (`pending` → `synced` / `failed`
  / `skipped`), `accounting_synced_at`, `accounting_sync_error` — written today
  by the **Record the Xero document** form in the detail dialog (`PATCH
  /admin/invoices/:id/accounting`), later by the sync itself. The list filters
  on sync status so "what still needs to go to Xero" is one click.
- **Export for Xero** (`GET /admin/invoices/export?format=xero`) writes Xero's
  *sales invoice import* CSV (`*ContactName … *InvoiceNumber … *AccountCode,
  *TaxType`), one row per line, dates as `dd/mm/yyyy`, amounts
  **GST-inclusive** — choose *Tax Inclusive* for "UnitAmount" in Xero's import
  dialog. A credit note is emitted with negative amounts, which Xero's sales
  import records as a credit note; confirm that on the first import.
  Voided documents are left out. Filters apply, so export one BAS quarter at a
  time (the export caps at 5,000 documents and says so in a header).
- The detail dialog's **Xero API payload preview** is `toXeroDocument()` —
  an `ACCREC` Invoice (or `ACCRECCREDIT` CreditNote) with `LineAmountTypes:
  'Inclusive'`, the contact, and every line coded — i.e. the body a sync would
  POST to `/api.xro/2.0/Invoices` / `/CreditNotes`. Building the sync means:
  Xero OAuth 2.0 app + tenant id stored server-side, a job over
  `accounting_sync_status = 'pending'`, POST the payload, then
  `recordAccountingSync()` with Xero's `InvoiceID` / `InvoiceNumber` /
  deep link, and a Payment against the invoice for the Stripe payout.

### Account codes and tax types

Which Xero account and tax type each line kind posts to is **data**: the
`platform_settings` rows `invoice_xero_account_codes` and
`invoice_xero_tax_types` (JSON objects, kind → value) override the defaults in
`src/utils/invoiceAccounting.js`. Defaults:

| kind | account | tax type |
|---|---|---|
| `shop_item`, `shop_shipping`, `discount` | `200` Sales | `OUTPUT` (GST on Income) |
| `commission`, `processing_fee` | `260` Other Revenue | `OUTPUT` |
| `marketplace_item`, `seller_shipping` | `835` (create a *Seller funds held* liability / clearing account) | `BASEXCLUDED` |
| `adjustment` | `860` Rounding | `BASEXCLUDED` |

The marketplace card and the seller's postage are the **seller's** supply —
CardPop holds the money until payout and never counts it as revenue
(`docs/finance-tax.md`) — so they must not land in Sales. The seller GST
CardPop withholds and remits is reported on its own (`seller_gst_aud`), not
inside the coded lines. **Confirm this treatment with your accountant** before
the first import; change the two settings rows (not the code) to match the
chart of accounts they want.

## Access

- Admin routes: `authMiddleware` + `isAdminUser` + `requireAal2` (inherited
  from the `/admin` router). The service role reads and updates; nothing is
  ever inserted from JavaScript — issuing is the database's job.
- RLS on `invoices`: a buyer can `select` their own rows (`buyer_id`), admins
  all rows; no client can insert, update or delete. The issuing functions are
  `security definer`, executable by `service_role` only.

## Tests

- `tests/db/run-invoices-migration.sh` — applies the migration twice to a
  throwaway Postgres and checks issuing on both webhook paths, lifecycle steps,
  void/reinstate, partial and full credit notes, legacy GST, the backfill
  function, the fail-safe and RLS. Needs a local Postgres; not part of
  `npm test`.
- `tests/backend/adminInvoices.test.js` — the routes (filters, exports,
  mapping, issue-missing, detail, sync record, auth).
- `tests/backend/invoiceExport.test.js` — the mapping and the three export
  shapes.
- `tests/frontend/invoicesAdminPage.test.jsx` — the admin page.

## Other exports

`GET /admin/invoices/export` (default `format=csv`) is the accountant's
**register**: one row per document with every header figure (items, shipping,
fees, discount, total, GST inside, seller GST remitted, CardPop GST, payment
reference, Xero status). The Finance & Tax page's shop-sales CSV stays the
margin view; this register is the document view.
