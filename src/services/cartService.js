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
  let gstCents = 0;
  // Only CardPop Shop items (platform-owned stock) attract the flat shipping
  // fee — marketplace listings ship seller-arranged. Tracked separately so both
  // the fee and the free-shipping threshold key off the shop-item subtotal.
  let shopItemsCents = 0;

  for (const raw of items) {
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

      const unitCents = Math.round(Number(product.price_aud) * 100);
      const lineCents = unitCents * quantity;
      const lineGstCents = gstEnabled ? Math.round(lineCents * (gstRate / 100)) : 0;

      itemsCents += lineCents;
      shopItemsCents += lineCents;
      gstCents += lineGstCents;

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

  if (commissionCents > 0) {
    lineItems.push({ price_data: { currency: 'aud', product_data: { name: 'Platform Fee' }, unit_amount: commissionCents }, quantity: 1 });
  }
  if (gstCents > 0) {
    lineItems.push({ price_data: { currency: 'aud', product_data: { name: 'GST' }, unit_amount: gstCents }, quantity: 1 });
  }
  if (shippingCents > 0) {
    lineItems.push({ price_data: { currency: 'aud', product_data: { name: 'Shipping' }, unit_amount: shippingCents }, quantity: 1 });
  }

  return { lineItems, orderLines, itemsCents, commissionCents, gstCents, shippingCents, grandCents: itemsCents + commissionCents + gstCents + shippingCents };
}
