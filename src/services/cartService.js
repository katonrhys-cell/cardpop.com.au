import { supabase } from '../utils/supabaseClient.js';
import { calculateBreakdown } from './commissionService.js';
import { getPlatformSetting } from './stripeWebhookService.js';

export async function priceCart(items, userId) {
  const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

  const gstEnabled = await getPlatformSetting('gst_enabled', true);
  const gstRate = Number(await getPlatformSetting('gst_rate_pct', 10));

  const lineItems = [];
  const orderLines = [];
  let itemsCents = 0;
  let commissionCents = 0;
  // GST that is ADDED on top of the item price (marketplace listings). This is
  // the only GST that increases the grand total and gets its own Stripe line.
  let gstCents = 0;
  // GST that is already BAKED INTO a GST-inclusive price (CardPop Shop items and
  // the shipping fee — Australian consumer prices are quoted GST-inclusive). It
  // is reported for the tax invoice but never re-added to the total.
  let includedGstCents = 0;
  // Only CardPop Shop items (platform-owned stock) attract the flat shipping
  // fee — marketplace listings ship seller-arranged. Tracked separately so both
  // the fee and the free-shipping threshold key off the shop-item subtotal.
  let shopItemsCents = 0;

  // Merge duplicate lines before pricing. Two lines for one listing would both
  // charge but only one can win the sold-claim (the other becomes a manual
  // refund), and duplicate shop lines each pass the per-line stock check while
  // overselling at decrement time.
  const merged = new Map();
  for (const raw of items) {
    const key = `${raw?.type}:${raw?.id}`;
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
      const { data: product, error } = await supabase
        .from('shop_products')
        .select('id, title, price_aud, stock_quantity, status')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!product || product.status !== 'active') throw httpError(404, 'A shop product in your cart is unavailable');
      if (product.stock_quantity < quantity) throw httpError(409, `Not enough stock for ${product.title}`);

      // The advertised shop price is GST-inclusive, so the buyer pays exactly
      // the ticket price — the GST is the tax component already inside it
      // (price × rate ÷ (100 + rate)), not an amount added on top.
      const unitCents = Math.round(Number(product.price_aud) * 100);
      const lineCents = unitCents * quantity;
      const lineGstCents = gstEnabled ? Math.round(lineCents * gstRate / (100 + gstRate)) : 0;

      itemsCents += lineCents;
      shopItemsCents += lineCents;
      includedGstCents += lineGstCents;

      lineItems.push({
        price_data: { currency: 'aud', product_data: { name: product.title }, unit_amount: unitCents },
        quantity,
      });
      orderLines.push({
        type: 'shop', id: product.id, seller_id: null, title: product.title,
        quantity, unit_price_aud: unitCents / 100, line_total_aud: lineCents / 100,
        commission_aud: 0, gst_aud: lineGstCents / 100,
      });
    } else if (type === 'listing') {
      const { data: listing, error } = await supabase
        .from('listings')
        .select('id, price_aud, seller_id, listing_type, status, vault_item:vault_items!inner(card_name), seller:profiles!seller_id(seller_tier)')
        .eq('id', id)
        .eq('status', 'active')
        .maybeSingle();
      if (error) throw error;
      if (!listing) throw httpError(404, 'A listing in your cart is no longer available');
      if (listing.seller_id === userId) throw httpError(403, 'You cannot purchase your own listing');

      const breakdown = await calculateBreakdown(listing, 'fixed');
      const itemC = Math.round(breakdown.itemPrice * 100);
      const commC = Math.round(breakdown.commissionAud * 100);
      const gstC = Math.round(breakdown.gstAud * 100);
      const name = listing.vault_item?.card_name || 'Trading Card';

      itemsCents += itemC;
      commissionCents += commC;
      gstCents += gstC;

      lineItems.push({
        price_data: { currency: 'aud', product_data: { name }, unit_amount: itemC },
        quantity: 1,
      });
      orderLines.push({
        type: 'listing', id: listing.id, seller_id: listing.seller_id, title: name,
        quantity: 1, unit_price_aud: itemC / 100, line_total_aud: itemC / 100,
        commission_aud: commC / 100, gst_aud: gstC / 100,
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
  const shipRateCents = Math.round(Number(await getPlatformSetting('default_shipping_rate_aud', 0)) * 100);
  const freeThresholdCents = Math.round(Number(await getPlatformSetting('free_shipping_threshold_aud', 0)) * 100);
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

  if (commissionCents > 0) {
    lineItems.push({ price_data: { currency: 'aud', product_data: { name: 'Platform Fee' }, unit_amount: commissionCents }, quantity: 1 });
  }
  // Only the additive (marketplace) GST becomes its own line — shop-item GST is
  // already inside each product's unit_amount, so charging it again would
  // double-bill the buyer.
  if (gstCents > 0) {
    lineItems.push({ price_data: { currency: 'aud', product_data: { name: 'GST' }, unit_amount: gstCents }, quantity: 1 });
  }
  if (shippingCents > 0) {
    lineItems.push({ price_data: { currency: 'aud', product_data: { name: 'Shipping' }, unit_amount: shippingCents }, quantity: 1 });
  }

  return { lineItems, orderLines, itemsCents, commissionCents, gstCents, includedGstCents, shippingCents, grandCents: itemsCents + commissionCents + gstCents + shippingCents };
}
