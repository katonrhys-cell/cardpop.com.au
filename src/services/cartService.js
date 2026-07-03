import { supabase } from '../utils/supabaseClient.js';
import { calculateBreakdown } from './commissionService.js';
import { getPlatformSetting } from './stripeWebhookService.js';
import { gstPortionCents, shippingFeeCents, SUPPLIES_SETTING_DEFAULTS } from './suppliesPricingService.js';

export async function priceCart(items, userId) {
  const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

  const gstEnabled = await getPlatformSetting('gst_enabled', true);
  const gstRate = Number(await getPlatformSetting('gst_rate_pct', 10));

  const lineItems = [];
  const orderLines = [];
  let itemsCents = 0;
  let commissionCents = 0;
  // Shop prices are GST-inclusive (standard AU retail): their GST is a portion
  // of the price, not an extra charge. Listing GST is charged on top of the
  // item price alongside the platform fee, as before. Track them separately so
  // only the on-top portion becomes a Stripe line item.
  let inclusiveGstCents = 0;
  let feeGstCents = 0;
  let shopGoodsCents = 0;

  for (const raw of items) {
    const type = raw?.type;
    const id = raw?.id;
    const quantity = Math.max(1, parseInt(raw?.quantity, 10) || 1);

    if (type === 'shop') {
      const { data: product, error } = await supabase
        .from('shop_products')
        .select('id, title, price_aud, stock_quantity, status, is_supply, in_stock')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!product || product.status !== 'active') throw httpError(404, 'A shop product in your cart is unavailable');
      // Dropshipped supplies have no owned stock count — availability is the
      // admin-managed in_stock flag. Owned stock uses the counted quantity.
      if (product.is_supply) {
        if (product.in_stock === false) throw httpError(409, `${product.title} is currently out of stock`);
      } else if (product.stock_quantity < quantity) {
        throw httpError(409, `Not enough stock for ${product.title}`);
      }

      const unitCents = Math.round(Number(product.price_aud) * 100);
      const lineCents = unitCents * quantity;
      const lineGstCents = gstEnabled ? gstPortionCents(lineCents, gstRate) : 0;

      itemsCents += lineCents;
      shopGoodsCents += lineCents;
      inclusiveGstCents += lineGstCents;

      lineItems.push({
        price_data: { currency: 'aud', product_data: { name: product.title }, unit_amount: unitCents },
        quantity,
      });
      orderLines.push({
        type: 'shop', id: product.id, seller_id: null, title: product.title,
        is_supply: product.is_supply === true,
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
      feeGstCents += gstC;

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

  // Platform-shipped shop goods: free shipping at/above the threshold, a flat
  // fee below it. Seller-shipped listings never attract this fee.
  let shippingCents = 0;
  if (shopGoodsCents > 0) {
    const thresholdAud = Number(await getPlatformSetting('free_shipping_threshold_aud', SUPPLIES_SETTING_DEFAULTS.free_shipping_threshold_aud));
    const feeAud = Number(await getPlatformSetting('flat_shipping_fee_aud', SUPPLIES_SETTING_DEFAULTS.flat_shipping_fee_aud));
    shippingCents = shippingFeeCents(shopGoodsCents, Math.round(thresholdAud * 100), Math.round(feeAud * 100));
  }

  if (commissionCents > 0) {
    lineItems.push({ price_data: { currency: 'aud', product_data: { name: 'Platform Fee' }, unit_amount: commissionCents }, quantity: 1 });
  }
  if (feeGstCents > 0) {
    lineItems.push({ price_data: { currency: 'aud', product_data: { name: 'GST' }, unit_amount: feeGstCents }, quantity: 1 });
  }
  if (shippingCents > 0) {
    lineItems.push({ price_data: { currency: 'aud', product_data: { name: 'Shipping' }, unit_amount: shippingCents }, quantity: 1 });
  }

  return {
    lineItems,
    orderLines,
    itemsCents,
    commissionCents,
    feeGstCents,
    gstCents: inclusiveGstCents + feeGstCents,
    shippingCents,
    grandCents: itemsCents + commissionCents + feeGstCents + shippingCents,
  };
}
