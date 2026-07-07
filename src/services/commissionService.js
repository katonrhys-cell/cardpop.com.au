import { supabase } from '../utils/supabaseClient.js';

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
    const ttKey = {
      fixed:   'commission_on_offers',
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

export { getPlatformSetting, getFeeConfig, calculateBreakdown };
