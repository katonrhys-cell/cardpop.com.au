import { supabase } from '../utils/supabaseClient.js';
import { calculateBreakdown, calculateProcessingFee, calculateGst, gstInsideCents } from './commissionService.js';
import { getPlatformSetting } from './stripeWebhookService.js';
import { isPurchasableStatus, isPreorder, preorderEta } from '../../utils/shopStock.js';

const SHOP_COLUMNS = 'id, title, price_aud, stock_quantity, status, variants:shop_product_variants(id, sku, colour, barcode, stock_quantity, price_aud, status)';

/**
 * Price a cart server-side.
 *
 * @param items    cart lines ({ type: 'shop' | 'listing', id, quantity, variantId? })
 * @param userId   buyer's id, or null for a guest
 */
export async function priceCart(items, userId) {
  const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

  const gstEnabled = await getPlatformSetting('gst_enabled', true);
  const gstRate = Number(await getPlatformSetting('gst_rate_pct', 10));

  const lineItems = [];
  const orderLines = [];
  let itemsCents = 0;
  let commissionCents = 0;
  // Retired: GST used to be ADDED on top of marketplace listings as its own
  // Stripe line. Every price on CardPop is now GST-inclusive (Australian
  // consumer prices are), so nothing is added and this stays 0 — kept so the
  // API shape, the order row and the tax invoice keep their `gstAud` field,
  // which now consistently reports "nothing was added on top".
  const gstCents = 0;
  // GST that is already BAKED INTO a GST-inclusive price (CardPop Shop items and
  // the shipping fee — Australian consumer prices are quoted GST-inclusive). It
  // is reported for the tax invoice but never re-added to the total.
  let includedGstCents = 0;
  // CardPop Shop items (platform-owned stock) attract the flat platform
  // shipping fee; marketplace listings charge the seller's own per-listing
  // postage price (combined per seller, below). Tracked separately so the flat
  // fee and the free-shipping threshold key off the shop-item subtotal only.
  let shopItemsCents = 0;

  // Merge duplicate lines before pricing. Two lines for one listing would both
  // charge but only one can win the sold-claim (the other becomes a manual
  // refund), and duplicate shop lines each pass the per-line stock check while
  // overselling at decrement time.
  const merged = new Map();
  for (const raw of items) {
    const key = `${raw?.type}:${raw?.id}:${raw?.type === 'shop' && typeof raw?.variantId === 'string' ? raw.variantId : ''}`;
    const prev = merged.get(key);
    if (!prev) {
      merged.set(key, { ...raw });
    } else if (raw?.type === 'shop') {
      prev.quantity = (Math.max(1, parseInt(prev.quantity, 10) || 1)) + (Math.max(1, parseInt(raw.quantity, 10) || 1));
    }
    // duplicate 'listing' lines collapse to one — a listing is one of a kind
  }

  for (const raw of merged.values()) {
    const type = raw?.type;
    const id = raw?.id;
    const quantity = Math.max(1, parseInt(raw?.quantity, 10) || 1);

    if (type === 'shop') {
      // Variants ride along in the same query so a product with colours costs
      // no extra round trip (and the per-item query count stays at one).
      let { data: product, error } = await supabase
        .from('shop_products')
        .select(`${SHOP_COLUMNS}, preorder_eta`)
        .eq('id', id)
        .maybeSingle();
      // Vercel can redeploy before `supabase db push` lands the preorder_eta
      // migration — retry without the column (no product can be a pre-order
      // yet, so nothing is lost) rather than 500ing every shop checkout.
      if (error && /preorder_eta/.test(error.message || '')) {
        ({ data: product, error } = await supabase
          .from('shop_products')
          .select(SHOP_COLUMNS)
          .eq('id', id)
          .maybeSingle());
      }
      if (error) throw error;
      // `active` and `preorder` are both on sale; anything else (coming soon,
      // draft, archived) is refused however the cart line got here.
      if (!product || !isPurchasableStatus(product.status)) throw httpError(404, 'A shop product in your cart is unavailable');
      // Pre-orders are charged now and dispatched when stock arrives. Stock is
      // the pre-order allocation, so the checks below still cap them.
      const preorder = isPreorder(product);
      const eta = preorder ? preorderEta(product) : '';

      // A product with colour variants is sold per variant: the line must name
      // one (a single-variant product is resolved automatically), stock is the
      // variant's, and the variant may override the price.
      const variants = (Array.isArray(product.variants) ? product.variants : []).filter((v) => v && v.status !== 'archived');
      let variant = null;
      if (variants.length > 0) {
        const wanted = typeof raw?.variantId === 'string' ? raw.variantId : null;
        variant = wanted ? variants.find((v) => v.id === wanted) : (variants.length === 1 ? variants[0] : null);
        if (!variant) throw httpError(wanted ? 404 : 400, wanted ? `That colour of ${product.title} is unavailable` : `Please choose a colour for ${product.title}`);
        if (variant.stock_quantity < quantity) throw httpError(409, `Not enough stock for ${product.title}${variant.colour ? ` — ${variant.colour}` : ''}`);
      } else if (product.stock_quantity < quantity) {
        throw httpError(409, `Not enough stock for ${product.title}`);
      }
      const lineTitle = variant?.colour ? `${product.title} — ${variant.colour}` : product.title;
      // The Stripe Checkout page and Stripe receipt show this name,
      // so a pre-order says so (with its estimate) at the moment of payment.
      const stripeName = preorder ? `${lineTitle} (Pre-order — ${eta})` : lineTitle;

      // The advertised shop price is GST-inclusive, so the buyer pays exactly
      // the ticket price — the GST is the tax component already inside it
      // (price × rate ÷ (100 + rate)), not an amount added on top.
      const unitCents = Math.round(Number(variant?.price_aud ?? product.price_aud) * 100);
      const lineCents = unitCents * quantity;
      const lineGstCents = gstEnabled ? Math.round(lineCents * gstRate / (100 + gstRate)) : 0;

      itemsCents += lineCents;
      shopItemsCents += lineCents;
      includedGstCents += lineGstCents;

      lineItems.push({
        price_data: { currency: 'aud', product_data: { name: stripeName.slice(0, 250) }, unit_amount: unitCents },
        quantity,
      });
      orderLines.push({
        type: 'shop', id: product.id, seller_id: null, title: lineTitle,
        quantity, unit_price_aud: unitCents / 100, line_total_aud: lineCents / 100,
        commission_aud: 0, gst_aud: lineGstCents / 100,
        ...(variant ? { variant_id: variant.id, variant_sku: variant.sku, variant_colour: variant.colour || null, variant_barcode: variant.barcode || null } : {}),
        // Snapshot of the promise made at purchase time: the receipt, order
        // history and Admin → Order Management read these, so a later edit to
        // the product's estimate (or flipping it to active) doesn't rewrite
        // what this buyer was told.
        ...(preorder ? { preorder: true, preorder_eta: eta } : {}),
      });
    } else if (type === 'listing') {
      let { data: listing, error } = await supabase
        .from('listings')
        .select('id, price_aud, shipping_cost_aud, seller_id, listing_type, status, vault_item:vault_items!inner(card_name), seller:profiles!seller_id(seller_tier)')
        .eq('id', id)
        .eq('status', 'active')
        .maybeSingle();
      // Vercel can redeploy before `supabase db push` lands the
      // shipping_cost_aud migration — retry without the column (shipping
      // simply prices as free, exactly as before) rather than 500ing every
      // marketplace checkout for the window.
      if (error && /shipping_cost_aud/.test(error.message || '')) {
        ({ data: listing, error } = await supabase
          .from('listings')
          .select('id, price_aud, seller_id, listing_type, status, vault_item:vault_items!inner(card_name), seller:profiles!seller_id(seller_tier)')
          .eq('id', id)
          .eq('status', 'active')
          .maybeSingle());
      }
      if (error) throw error;
      if (!listing) throw httpError(404, 'A listing in your cart is no longer available');
      if (listing.seller_id === userId) throw httpError(403, 'You cannot purchase your own listing');

      const breakdown = await calculateBreakdown(listing, 'fixed');
      const itemC = Math.round(breakdown.itemPrice * 100);
      const commC = Math.round(breakdown.commissionAud * 100);
      // A marketplace listing is an Australian consumer price, so its GST is
      // INSIDE it exactly like a shop product's — nothing is added on top. The
      // seller's share is deducted from their payout below (their postage is
      // added to it once parcels are combined).
      const lineGstC = gstEnabled ? gstInsideCents(itemC, gstRate) : 0;
      const name = listing.vault_item?.card_name || 'Trading Card';

      itemsCents += itemC;
      commissionCents += commC;
      includedGstCents += lineGstC;

      lineItems.push({
        price_data: { currency: 'aud', product_data: { name }, unit_amount: itemC },
        quantity: 1,
      });
      orderLines.push({
        type: 'listing', id: listing.id, seller_id: listing.seller_id, title: name,
        quantity: 1, unit_price_aud: itemC / 100, line_total_aud: itemC / 100,
        commission_aud: commC / 100, gst_aud: lineGstC / 100,
        // The GST deducted from this seller's payout and remitted by CardPop.
        // Postage GST is folded in below, on whichever line carries the parcel.
        seller_gst_aud: lineGstC / 100,
        // The seller's own postage price — combined per seller below, so it is
        // NOT yet the amount this line will charge (that lands in shipping_aud).
        listing_shipping_cost_aud: Math.max(0, Number(listing.shipping_cost_aud) || 0),
      });
    } else {
      throw httpError(400, `Unknown cart item type: ${type}`);
    }
  }

  // Flat-rate shipping on the CardPop Shop portion of the cart. Both values are
  // set in Platform Settings (Admin → Listings). The rate is charged once per
  // order unless the shop-item subtotal reaches the free-shipping threshold; a
  // rate of 0 (or no shop items) means nothing is charged, and a threshold of 0
  // means there's no free tier. The rate is treated as GST-inclusive (AUD
  // consumer prices are), so no extra GST line is added on top of it.
  // Defaults ($15 flat, free from $100) match the seeded platform_settings so the
  // shipping rule still holds if those rows haven't been provisioned yet; an
  // explicit admin value (including 0 to disable) always wins.
  const shipRateCents = Math.round(Number(await getPlatformSetting('default_shipping_rate_aud', 15)) * 100);
  const freeThresholdCents = Math.round(Number(await getPlatformSetting('free_shipping_threshold_aud', 100)) * 100);
  // The fee is mandatory below the threshold — no promo or partner code waives it.
  let shippingCents = 0;
  if (shopItemsCents > 0 && shipRateCents > 0) {
    const qualifiesForFree = freeThresholdCents > 0 && shopItemsCents >= freeThresholdCents;
    shippingCents = qualifiesForFree ? 0 : shipRateCents;
  }
  // The shipping fee is GST-inclusive too, so its tax component is part of the
  // reported GST (not an extra charge) — mirrors how the item prices are treated.
  if (gstEnabled && shippingCents > 0) {
    includedGstCents += Math.round(shippingCents * gstRate / (100 + gstRate));
  }

  // Seller postage on marketplace listings, combined per seller: one seller's
  // cards ship as one parcel, so the buyer pays that seller's single highest
  // postage price, not the sum. The charge is recorded as shipping_aud on the
  // line that set it (the parcel-defining line) so the webhook can pass it
  // through to the seller's payout and refunds can reverse it per line. It is
  // the seller's own consumer-quoted price — no commission is taken from it
  // and no GST is added or reported on it (unlike the platform's shop fee, it
  // is not platform revenue), and the partner free-shipping perk only ever
  // waives the platform's shop fee above, never money owed to a seller.
  let sellerShippingCents = 0;
  const parcelLineBySeller = new Map();
  for (const line of orderLines) {
    if (line.type !== 'listing') continue;
    const costCents = Math.round((line.listing_shipping_cost_aud || 0) * 100);
    delete line.listing_shipping_cost_aud;
    const best = parcelLineBySeller.get(line.seller_id);
    if (!best || costCents > best.costCents) parcelLineBySeller.set(line.seller_id, { line, costCents });
  }
  for (const { line, costCents } of parcelLineBySeller.values()) {
    if (costCents <= 0) continue;
    line.shipping_aud = costCents / 100;
    sellerShippingCents += costCents;
    // Postage is part of the seller's own supply, so its GST is deducted from
    // their payout alongside the card's — it is charged to the buyer as a
    // GST-inclusive consumer price, same as everything else here.
    if (gstEnabled) {
      const shipGstC = gstInsideCents(costCents, gstRate);
      line.seller_gst_aud = Math.round((Number(line.seller_gst_aud || 0) * 100 + shipGstC)) / 100;
      includedGstCents += shipGstC;
    }
  }
  shippingCents += sellerShippingCents;

  if (commissionCents > 0) {
    lineItems.push({ price_data: { currency: 'aud', product_data: { name: 'Platform Fee' }, unit_amount: commissionCents }, quantity: 1 });
  }
  if (shippingCents > 0) {
    lineItems.push({ price_data: { currency: 'aud', product_data: { name: 'Shipping' }, unit_amount: shippingCents }, quantity: 1 });
  }

  // Payment processing — reimburses the platform for Stripe's cut of the whole
  // captured amount, so it is priced on the finished subtotal (items,
  // commission and shipping) and added last. No GST is added on top of it: its
  // own GST, like the commission's, is inside the amount (counted below).
  const preFeeCents = itemsCents + commissionCents + shippingCents;
  const processingCents = Math.round((await calculateProcessingFee(preFeeCents / 100)) * 100);
  if (processingCents > 0) {
    lineItems.push({ price_data: { currency: 'aud', product_data: { name: 'Payment processing' }, unit_amount: processingCents }, quantity: 1 });
  }

  // CardPop's own supplies: the commission (charged to the buyer as a line AND
  // deducted from each seller's payout, so it is earned twice) and the
  // processing fee. That GST is inside money the platform already holds — it is
  // reported for remittance, not deducted from anyone.
  const platformGstCents = gstEnabled
    ? gstInsideCents(commissionCents * 2 + processingCents, gstRate)
    : 0;
  includedGstCents += platformGstCents;

  // Every seller's deduction, summed — what CardPop remits on their behalf.
  const sellerGstCents = orderLines.reduce(
    (sum, l) => sum + Math.round((Number(l.seller_gst_aud) || 0) * 100), 0,
  );

  // Snapshot the wholesale cost onto each shop line so the Finance & Tax
  // report can compute cost of goods sold as it stood at the time of sale,
  // even if the supplier price changes later. Fail-safe: any problem here
  // (table missing, RLS, network) leaves the lines without a cost and the
  // report falls back to the current shop_product_costs row.
  const shopIds = [...new Set(orderLines.filter((l) => l.type === 'shop').map((l) => l.id))];
  if (shopIds.length) {
    try {
      const { data: costs } = await supabase
        .from('shop_product_costs')
        .select('product_id, wholesale_ex_gst_aud, wholesale_inc_gst_aud')
        .in('product_id', shopIds);
      const byId = new Map((costs || []).map((c) => [c.product_id, c]));
      for (const line of orderLines) {
        const c = line.type === 'shop' ? byId.get(line.id) : null;
        if (!c) continue;
        if (c.wholesale_ex_gst_aud != null) line.unit_cost_ex_gst_aud = Number(c.wholesale_ex_gst_aud);
        if (c.wholesale_inc_gst_aud != null) line.unit_cost_inc_gst_aud = Number(c.wholesale_inc_gst_aud);
      }
    } catch (_) {
      // cost snapshot is best-effort
    }
  }

  return {
    lineItems, orderLines, itemsCents, commissionCents,
    // True when any line is a pre-order — checkout echoes it so the buyer's
    // order summary can warn that part of the order ships later.
    hasPreorder: orderLines.some((l) => l.preorder === true),
    // Nothing is added on top of the buyer's bill any more: gstCents stays 0 so
    // every caller that reported an "added GST" line reports none.
    gstCents,
    includedGstCents, sellerGstCents, platformGstCents,
    shippingCents, processingCents,
    grandCents: preFeeCents + processingCents,
  };
}
