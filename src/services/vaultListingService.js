// Keep a vault item's marketplace listing in step with its listing type.
// Server-side twin of the sync the Add/Edit form used to run client-side —
// all writes go through the caller-scoped Supabase client, so the
// `listings_require_selling_entitlement` RESTRICTIVE policy (identity
// verification + card on file, via private.can_sell()) and the
// enforce_listing_approval trigger keep applying exactly as before.
//
// Returns an honest status for the seller's toast rather than a blanket
// success:
//   'archived'     — card is private; any active listing was archived
//   'listed'       — live on the marketplace now
//   'pending'      — saved, but held for admin approval
//   'blocked'      — denied by the can_sell() RLS gate (identity/card missing)
//   'quota'        — rejected by the monthly listing quota trigger (tier limit)
//   'sold_visible' — card went private but its sold listing stays on the
//                    marketplace (sellers can't archive sold rows; admins can)
//   'error'        — any other failure (the vault card itself is already saved)
import { isSellingEntitlementError, isListingQuotaError } from '../../utils/listingErrors.js';
import { PUBLIC_LISTING_TYPES } from '../utils/vaultItemInput.js';
import logger from '../utils/logger.js';

const SALE_TYPES = ['For Sale', 'For Sale & Trade'];
const TRADE_TYPES = ['For Trade', 'For Sale & Trade'];

export const syncMarketplaceListing = async (userClient, { cardId, userId, listingType, pricing = {} }) => {
  const isPublic = PUBLIC_LISTING_TYPES.includes(listingType);
  const isSale = SALE_TYPES.includes(listingType);
  const acceptsTrade = TRADE_TYPES.includes(listingType);
  const isEOI = listingType === 'Expression of Interest';

  try {
    if (!isPublic) {
      const { error } = await userClient
        .from('listings')
        .update({ status: 'archived' })
        .eq('vault_item_id', cardId)
        .eq('seller_id', userId)
        .neq('status', 'archived');
      if (error) throw error;
      // RLS stops sellers updating sold rows, so the archive can silently
      // match nothing while the card is still visible on the marketplace —
      // report what actually remains instead of trusting the update.
      const { data: remaining, error: checkError } = await userClient
        .from('listings')
        .select('id, status')
        .eq('vault_item_id', cardId)
        .neq('status', 'archived');
      if (checkError) throw checkError;
      if (!remaining?.length) return 'archived';
      return remaining.every((r) => r.status === 'sold') ? 'sold_visible' : 'error';
    }

    const listingPayload = {
      vault_item_id: cardId,
      seller_id: userId,
      listing_type: isEOI ? 'expression_of_interest' : (isSale ? 'fixed' : 'trade'),
      status: 'active',
      accepts_trade: acceptsTrade,
      price_aud: isSale ? (Number(pricing.askingPrice) || null) : null,
      // Seller-set postage, charged to the buyer at checkout and passed through
      // to the seller's payout. 0 = free shipping. Applies to anything buyable
      // (sale and EOI listings — EOI sells via accepted offers); trade-only
      // listings never charge postage. Clamped to the DB check constraint's
      // range so a malformed value degrades to free shipping, not a failed save.
      shipping_cost_aud: (isSale || isEOI)
        ? Math.min(200, Math.max(0, Number(pricing.shippingCost) || 0))
        : 0,
      // Expression of Interest: no fixed price — publish the seller's target
      // range and open the listing to offers. Other types omit the flag: new
      // rows take the column default (offers on), existing rows keep the
      // seller's Accept Offers choice.
      price_min_aud: isEOI ? (Number(pricing.offerMin) || null) : null,
      price_max_aud: isEOI ? (Number(pricing.offerMax) || null) : null,
      ...(isEOI ? { accepts_offers: true } : {}),
      listed_at: new Date().toISOString(),
    };

    // Reuse an existing non-archived listing if one already exists.
    const { data: existing, error: findError } = await userClient
      .from('listings')
      .select('id')
      .eq('vault_item_id', cardId)
      .neq('status', 'archived')
      .maybeSingle();
    if (findError) throw findError;

    // Read the status back: the enforce_listing_approval trigger may have
    // downgraded a new 'active' listing to 'pending', and the seller needs to
    // know their card isn't visible yet.
    const writeListing = async (payload) => existing
      ? userClient
          .from('listings')
          .update(payload)
          .eq('id', existing.id)
          .eq('seller_id', userId)
          .select('status')
          .single()
      : userClient
          .from('listings')
          .insert(payload)
          .select('status')
          .single();

    let { data: row, error } = await writeListing(listingPayload);
    // Vercel can redeploy before `supabase db push` lands the
    // shipping_cost_aud migration — retry without the column (the listing
    // saves with free shipping) rather than failing the seller's save.
    if (error && /shipping_cost_aud/.test(error.message || '')) {
      const { shipping_cost_aud: _dropped, ...withoutShipping } = listingPayload;
      ({ data: row, error } = await writeListing(withoutShipping));
    }
    if (error) throw error;
    return row?.status === 'pending' ? 'pending' : 'listed';
  } catch (err) {
    logger.error(`[VAULT] Marketplace listing sync failed for card ${cardId}:`, err);
    if (isListingQuotaError(err)) return 'quota';
    return isSellingEntitlementError(err) ? 'blocked' : 'error';
  }
};

export default syncMarketplaceListing;
