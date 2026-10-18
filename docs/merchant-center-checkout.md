# Google Merchant Center — checkout link

Merchant Center → **Checkout** ("Edit checkout settings") lets a Shopping ad or
free product listing send the shopper straight to the store's cart with the
product already in it, instead of to the product page. Google insists the URL
carries an `{id}` placeholder — pasting a bare `https://cardpop.com.au/checkout`
fails with *Missing required parameter: {id}* — and fills `{id}` (and the
optional `{quantity}`) in per click.

## What to paste

```
https://cardpop.com.au/checkout?id={id}&quantity={quantity}
```

The template lives in code as `MERCHANT_CHECKOUT_LINK_TEMPLATE`
(`utils/checkoutLink.js`) so a test guards it. Use *Test URL structure* in
Merchant Center after saving; the only requirement is that `{id}` appears.

## What `{id}` is, and what the site accepts

`{id}` is the product's **offer id** in Merchant Center. For products Google
picked up from the site's `Product` structured data, that is the `sku` the
markup emits (`utils/productIdentifiers.js`): the shop product's SKU
(`CP-9-POCKET-ZIP-BINDER`, a Palms Off Gaming line SKU, or a colour variant's
own SKU). A feed you upload yourself sets its own `id` column — use the SKU or
the product UUID there.

`pages/CheckoutPage.jsx` resolves `?id=` in this order, then adds the match to
the cart and strips the params (so a refresh can't add it twice):

1. `shop_products` by `id` (when the value is a UUID) or by `sku`
   (upper-cased; SKUs are stored upper-cased and unique case-insensitively),
   restricted to `PURCHASABLE_SHOP_STATUSES` (`active`, `preorder`). A product
   with colour variants gets its default in-stock colour.
2. `shop_product_variants` by the variant's own `sku` → its product with that
   colour chosen.
3. `listings` by `id` — only an `active`, `fixed`-price (buy-now) listing;
   auctions, trade-only and expressions of interest are refused. An Official
   CardPop Store listing is flagged `officialStore` so the marketplace identity
   gate treats it like a shop line.

Anything else shows "That product isn't available right now." and leaves the
cart as it was. `quantity` is clamped to 1–`CHECKOUT_LINK_MAX_QUANTITY` (20);
a listing is always 1. The cart line is the same shape the product pages
build, so the GA4 `add_to_cart` event fires through `useCart` and every price
is re-read server-side at checkout — the link only fills the cart, it never
sets a price.

## Checking it

- `npx vitest run tests/frontend/checkoutLink.test.js tests/frontend/CheckoutPage.test.jsx`
- In a browser: `https://cardpop.com.au/checkout?id=<any shop SKU>&quantity=2`
  should land on checkout with that product in the cart and the params gone
  from the address bar.

"Show in ads" (the checkbox under the URL) adds a *Buy* button to Shopping
ads that uses this link; leave it off until the link has been tried on a few
live SKUs.
