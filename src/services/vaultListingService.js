// Keep a vault item's marketplace listing in step with its listing type.
// Server-side twin of the sync the Add/Edit form used to run client-side —
// all writes go through the caller-scoped Supabase client, so the
// `listings_require_selling_entitlement` RESTRICTIVE policy (identity
// verification + card on file, via private.can_sell()) and the
// enforce_listing_approval trigger keep applying exactly as before.
//
// Returns an honest status for the seller's toast rather than a blanket
// success:
//   'archived' — card is private; any active listing was archived
//   'listed'   — live on the marketplace now
//   'pending'  — saved, but held for admin approval
//   'blocked'  — denied by the can_sell() RLS gate (identity/card missing)
//   'error'    — any other failure (the vault card itself is already saved)
import { isSellingEntitlementError } from '../../utils/listingErrors.js';
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
      return 'archived';
    }

    const listingPayload = {
      vault_item_id: cardId,
      seller_id: userId,
      listing_type: isEOI ? 'expression_of_interest' : (isSale ? 'fixed' : 'trade'),
      status: 'active',
      accepts_trade: acceptsTrade,
      price_aud: isSale ? (Number(pricing.askingPrice) || null) : null,
      // Expression of Interest: no fixed price — publish the seller's target
      // range and open the listing to offers.
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
    let row, error;
    if (existing) {
      ({ data: row, error } = await userClient
        .from('listings')
        .update(listingPayload)
        .eq('id', existing.id)
        .eq('seller_id', userId)
        .select('status')
        .single());
    } else {
      ({ data: row, error } = await userClient
        .from('listings')
        .insert(listingPayload)
        .select('status')
        .single());
    }
    if (error) throw error;
    return row?.status === 'pending' ? 'pending' : 'listed';
  } catch (err) {
    logger.error(`[VAULT] Marketplace listing sync failed for card ${cardId}:`, err);
    return isSellingEntitlementError(err) ? 'blocked' : 'error';
  }
};

export default syncMarketplaceListing;
