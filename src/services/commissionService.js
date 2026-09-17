import { supabase } from '../utils/supabaseClient.js';
import { processingFeeCents } from '../utils/processingFee.js';

async function getPlatformSetting(key, defaultValue) {
  const { data } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  return data?.value !== undefined ? data.value : defaultValue;
}

/**
 * Looks up the fee_config row for a given seller_tier and transaction_type.
 * Falls back to the 'none' tier if no match.
 */
async function getFeeConfig(sellerTier, transactionType) {
  // Try exact tier match
  let { data } = await supabase
    .from('fee_config')
    .select('id, fee_pct')
    .eq('seller_tier', sellerTier || 'none')
    .eq('is_active', true)
    .contains('applies_to', [transactionType])
    .maybeSingle();

  if (!data) {
    // Fall back to the 'none' tier — but still scoped to this transaction type,
    // matching the primary query, so we never apply a fee config that doesn't
    // cover the transaction type being charged.
    const { data: fallback } = await supabase
      .from('fee_config')
      .select('id, fee_pct')
      .eq('seller_tier', 'none')
      .eq('is_active', true)
      .contains('applies_to', [transactionType])
      .maybeSingle();
    data = fallback;
  }

  return data || { id: null, fee_pct: 3 };
}

/**
 * The buyer-paid payment-processing fee for a given pre-fee subtotal.
 *
 * Deliberately NOT part of calculateBreakdown: the fee is a percentage of
 * everything the buyer is charged, and shipping is only known to the caller
 * (it comes off the listing, not the commission tier). Every checkout path
 * therefore prices its lines first and calls this last.
 *
 * The fee is treated as GST-INCLUSIVE and sits outside the GST base, exactly
 * like the Stripe fee it reimburses — Stripe's own AU fees are GST-inclusive.
 * Adding GST on top of it would bill the buyer tax on a tax.
 *
 * @param subtotalAud everything charged before this fee (items + commission +
 *                    GST + shipping)
 * @returns {Promise<number>} the fee in AUD, 0 when disabled or nothing to charge
 */
async function calculateProcessingFee(subtotalAud) {
  const enabled = await getPlatformSetting('processing_fee_enabled', true);
  if (!enabled) return 0;

  const pct = Number(await getPlatformSetting('processing_fee_pct', 1.9));
  const fixedAud = Number(await getPlatformSetting('processing_fee_fixed_aud', 0.35));

  const cents = processingFeeCents(Math.round(Number(subtotalAud) * 100), {
    pct: Number.isFinite(pct) ? pct : 0,
    fixedCents: Number.isFinite(fixedAud) ? Math.round(fixedAud * 100) : 0,
  });
  return cents / 100;
}

/**
 * Calculate the full cost breakdown for a listing purchase.
 * Returns { itemPrice, commissionPct, commissionAud, gstAud, total, configId }
 */
async function calculateBreakdown(listing, transactionType = 'fixed') {
  const commEnabled = await getPlatformSetting('commissions_enabled', true);
  const gstEnabled  = await getPlatformSetting('gst_enabled', true);
  const gstRate     = Number(await getPlatformSetting('gst_rate_pct', 10));
  // GST applies to the full sale price (item + commission), not just the
  // commission — confirmed business decision; matches the live platform_settings
  // value (see migration 20260707120240_gst_on_full_sale_price.sql).
  const gstOnCommOnly = await getPlatformSetting('gst_on_commission_only', false);

  const itemPrice = Number(listing.price_aud) || 0;
  let commissionPct = 0;
  let configId = null;

  if (commEnabled) {
    // Each transaction type gets its OWN toggle. 'fixed' used to share
    // 'commission_on_offers' with 'offer', so switching off commission for
    // negotiated offers silently switched it off for every ordinary Buy Now
    // sale too — the platform's main revenue path — and the two admin toggles
    // moved as one. 'commission_on_fixed' is seeded from the old shared value
    // so existing behaviour carries over.
    const ttKey = {
      fixed:   'commission_on_fixed',
      auction: 'commission_on_auctions',
      trade:   'commission_on_trades',
      offer:   'commission_on_offers',
    };
    const typeEnabled = await getPlatformSetting(ttKey[transactionType] || 'commissions_enabled', true);

    if (typeEnabled) {
      const sellerTier = listing.seller?.seller_tier || 'none';
      const cfg = await getFeeConfig(sellerTier, transactionType);
      commissionPct = Number(cfg.fee_pct);
      configId = cfg.id;
    }
  }

  const commissionAud = Math.round(itemPrice * (commissionPct / 100) * 100) / 100;

  let gstAud = 0;
  if (gstEnabled) {
    const gstBase = gstOnCommOnly ? commissionAud : itemPrice + commissionAud;
    gstAud = Math.round(gstBase * (gstRate / 100) * 100) / 100;
  }

  const total = Math.round((itemPrice + commissionAud + gstAud) * 100) / 100;

  return { itemPrice, commissionPct, commissionAud, gstAud, total, configId };
}

export { getPlatformSetting, getFeeConfig, calculateBreakdown, calculateProcessingFee };
