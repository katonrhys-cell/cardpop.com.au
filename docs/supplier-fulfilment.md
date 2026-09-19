# Supplier fulfilment (drop-shipping)

CardPop sells shop stock it does not hold. Those products are **drop-shipped**:
the buyer pays CardPop, and the supplier picks, packs and posts the parcel
straight to the buyer under CardPop's name. This is the runbook for the
automated hand-off.

## The shape

```
Stripe checkout.session.completed
  → stripeWebhookService.handleCartOrder
      → stock decremented, seller payouts, buyer receipt, admin notice
      → supplierFulfilmentService.dispatchSupplierOrders({ order, lines })
          → claim a supplier_dispatches row   (unique per order+supplier)
          → emailService.sendSupplierOrder    (Resend)
          → mark the row sent / failed
```

| Piece | Where |
|---|---|
| `suppliers` table | `supabase/migrations/20260919002740_create_suppliers.sql` |
| `supplier_dispatches` table | `supabase/migrations/20260919002800_create_supplier_dispatches.sql` |
| Dispatch logic | `src/services/supplierFulfilmentService.js` |
| Email template | `supplierOrderEmail()` in `src/emails/templates.js` |
| Send wrapper | `sendSupplierOrder()` in `src/utils/emailService.js` |
| Hook point | `handleCartOrder` in `src/services/stripeWebhookService.js` |
| Tests | `tests/backend/supplierFulfilmentService.test.js`, `tests/backend/emailTemplates.test.js` |

Fulfilment routing hangs off `shop_products.supplier_id`, **not**
`shop_products.brand`. Brand is a storefront display field; an editor renaming a
brand must never re-route a parcel.

## Turning it on for a supplier

Nothing is emailed until a supplier row is deliberately completed. The Palms Off
Gaming row is seeded by migration as a **stub** — `active = false`, no
`fulfilment_email` — because the real ops address is not known to the repo, and
a guessed address means a customer's home address is emailed to a stranger.

To go live for a supplier:

1. Set `fulfilment_email` to their real fulfilment inbox (and `cc_emails` for any
   warehouse alias or account manager).
2. Agree the wording of `blind_shipping_note` with them. It is reproduced
   **verbatim** in every dispatch email, so it can be changed without a deploy.
3. Confirm the right products are linked:
   `select count(*) from shop_products where supplier_id = '<id>';`
4. Place a small live test order and confirm the email arrives and reads
   correctly to *them*, not just to you.
5. Set `active = true`.

Until step 5, every order still records a dispatch row with `status = 'skipped'`
and `last_error` explaining why — so the work is visible and re-drivable rather
than lost.

## Why the dispatch table exists

A bare `await sendSupplierOrder(...)` in the webhook has two failure modes that
both cost real money.

**Double shipment.** Stripe retries webhook deliveries, and two deliveries of
`checkout.session.completed` can be in flight simultaneously. Send twice and the
supplier posts two parcels; CardPop pays for both and eats the return. The
`unique (order_id, supplier_id)` constraint makes the **insert the claim**:
exactly one caller wins and sends, every other caller sees `23505` and returns
having sent nothing.

**Silent non-shipment.** On 2026-07-16 a live payment sat unfulfilled for two
weeks because `checkout.session.completed` never arrived while five sibling
events processed fine (this is why `pendingOrderAlertService.js` exists). A
fire-and-forget email inherits that failure with a customer's money attached: the
buyer paid, the supplier never heard, and nothing anywhere is red. A row still
`pending` or `failed` is a queryable fact.

It is also the audit trail. A dispatch discloses a named customer's residential
address to a third party; `payload` records exactly what was disclosed, to which
address, and when.

## Operational queries

Anything not yet out the door:

```sql
select d.id, d.order_id, s.name, d.status, d.last_error, d.created_at
  from supplier_dispatches d
  join suppliers s on s.id = d.supplier_id
 where d.status in ('pending', 'failed', 'skipped')
 order by d.created_at;
```

Statuses read as: `sent` done; `skipped` expected until a supplier row is
completed; `failed` needs a human — either the send was rejected or the order had
no usable delivery address.

A `pending` row older than a few minutes means the process died between the claim
and the send — the one state that needs a human, because the claim is spent but
nothing was emailed. Resolve by reading `payload` and sending manually, or by
setting `status = 'failed'` and re-driving.

## Deliberate design choices

- **No prices in the email.** The supplier invoices CardPop at the agreed
  wholesale rate, so the retail figure the customer paid is irrelevant to picking
  and commercially none of their business. A misdirected dispatch also leaks
  less. Guarded by a test.
- **Oversold lines are never dispatched.** Only lines whose `decrement_shop_stock`
  call succeeded are handed over; an oversold line has nothing to pick and is
  headed for a refund.
- **An order with no usable address is never dispatched.** Every `shipping_*`
  column on `orders` is nullable, so an order can reach the dispatch path with
  nowhere to post to. A pick list the supplier cannot fulfil is worse than none,
  so the dispatch is recorded `failed` with the reason and no email is sent.
- **Never throws into the webhook.** A throw in the Stripe handler means Stripe
  retries the whole order — replaying the payment confirmation, payouts and
  receipt. Every failure here is recorded and logged instead.
- **Cart path only.** Shop products can only be bought through the cart
  (`handleCartOrder`); the single-item path is marketplace listings, which have a
  seller rather than a supplier. If shop products ever get a Buy Now,
  `handleSingleItemOrder` needs the same call.
- **Admin-only RLS.** Both tables hold another business's ops contact and
  customers' addresses. The backend writes them with the service-role key, which
  bypasses RLS, so the policies only govern admin UI reads.

## Known gap: colour variants

**A dispatch email cannot currently name the exact variant to pick.**

Palms Off rows are one product line per colour *range* — `BODS-JPN` covers 14
colours, and `data/palmsOffCatalogue.js` records the full `skus` array per line.
But the cart carries only `{ type, id, title, quantity }`
(`src/services/cartService.js`), with no variant, so `shop_products.sku` is the
line-level SKU and the picker is left to confirm the colour.

The email makes this loud rather than silent: a line with no SKU renders
**"NO SKU — CONFIRM BEFORE PICKING"** instead of an empty cell.

Closing it properly means variant capture end to end — a variant concept on
`shop_products` (or a `shop_product_variants` table), variant selection on the
product page, the variant id carried through `cartService.priceCart` into
`order_items`, and per-variant stock. That is a larger change than this
hand-off, and is deliberately **not** done here.

## Things this does not do yet

- No admin UI. Suppliers and dispatches are SQL-only for now; a panel under
  Admin → Orders with a manual resend is the obvious next step.
- No automatic retry. A `failed` row stays failed until re-driven. Folding
  unresolved dispatches into the existing every-2-hours
  `/api/stripe/reconcile-pending` job (`.github/workflows/cron-reconcile-pending.yml`)
  is the natural home.
- No inbound tracking capture. The email asks the supplier to reply with a
  tracking number to the admin notification address; nothing parses that reply.

## Privacy

A dispatch sends a customer's name and full residential address to a third-party
business. Two consequences worth keeping in mind:

- The privacy policy should disclose that order fulfilment may involve sharing
  delivery details with suppliers.
- The email carries only what is needed to pick and post — no prices, no email
  address, no phone number, no other lines from the order. Keep it that way.
