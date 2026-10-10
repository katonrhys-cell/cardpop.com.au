import { supabase } from '../utils/supabaseClient.js';
import { processingFeeCents } from '../utils/processingFee.js';
// Cached per instance for a short window (src/utils/platformSettings.js) — the
// pricing path reads a dozen of these per cart, several per line.
import { getPlatformSetting } from '../utils/platformSettings.js';

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
 * The GST contained in an amount that is already GST-inclusive.
 *
 * Australian consumer prices are quoted GST-inclusive, so the tax is the
 * component *inside* the price — `amount x rate / (100 + rate)`, i.e. 1/11 at
 * 10% — never an extra charge on top of it. The shop catalogue has always
 * priced this way (`priceCart`); marketplace listings now match.
 */
function gstInsideCents(amountCents, gstRatePct) {
  const rate = Number(gstRatePct);
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  const amount = Number(amountCents);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * rate / (100 + rate));
}

/**
 * Split the GST on an order between the two parties who actually supplied
 * something, so each side's share can be handled correctly:
 *
 *   - `sellerAmountAud` — the card and the seller's postage. The GST on this is
 *     **deducted from the seller's payout** and remitted by CardPop on their
 *     behalf, so the platform is never holding a GST liability it didn't budget
 *     for. Applied to every seller and every transaction, with no
 *     GST-registration test: a deliberately conservative business decision, so
 *     nothing is ever owed to the ATO after the fact.
 *   - `platformAmountAud` — CardPop's own supplies (commission, payment
 *     processing). That GST is inside money the platform already holds.
 *
 * Both are *included* amounts: neither adds a cent to what the buyer pays.
 *
 * @returns {Promise<{ sellerGstAud, platformGstAud, gstIncludedAud, gstRatePct }>}
 */
async function calculateGst({ sellerAmountAud = 0, platformAmountAud = 0 } = {}) {
  const gstEnabled = await getPlatformSetting('gst_enabled', true);
  if (!gstEnabled) {
    return { sellerGstAud: 0, platformGstAud: 0, gstIncludedAud: 0, gstRatePct: 0 };
  }
  const gstRatePct = Number(await getPlatformSetting('gst_rate_pct', 10));

  const sellerGstAud = gstInsideCents(Math.round(Number(sellerAmountAud) * 100), gstRatePct) / 100;
  const platformGstAud = gstInsideCents(Math.round(Number(platformAmountAud) * 100), gstRatePct) / 100;

  return {
    sellerGstAud,
    platformGstAud,
    gstIncludedAud: Math.round((sellerGstAud + platformGstAud) * 100) / 100,
    gstRatePct,
  };
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
 * Calculate the cost breakdown for a listing purchase.
 *
 * The listing price is **GST-inclusive** — it is an Australian consumer price,
 * so the tax is already inside it and nothing is added on top of the buyer's
 * bill. GST is handled by calculateGst() once the caller knows the postage and
 * processing fee; it comes out of the seller's payout rather than out of the
 * buyer's pocket a second time.
 *
 * Returns { itemPrice, commissionPct, commissionAud, total, configId }
 */
async function calculateBreakdown(listing, transactionType = 'fixed') {
  const commEnabled = await getPlatformSetting('commissions_enabled', true);

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

  const total = Math.round((itemPrice + commissionAud) * 100) / 100;

  return { itemPrice, commissionPct, commissionAud, total, configId };
}

export { getPlatformSetting, getFeeConfig, calculateBreakdown, calculateProcessingFee, calculateGst, gstInsideCents };
