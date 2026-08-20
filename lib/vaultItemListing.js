// Resolve the marketplace listing behind a vault card.
//
// The vault row is the card; the `listings` row is its state on the
// marketplace — and "sold" lives only on the listing. Grids that query
// `vault_items` directly (homepage featured cards, collection rails, seller
// stores) therefore have no way to know a card has sold unless they carry the
// listing with them, which is why VAULT_ITEM_CARD_SELECT embeds it.
//
// Prefer a live listing over a sold one: relisting a sold card leaves both
// rows attached to the same vault item, and the live one is the current truth.
// Archived rows are ignored — archiving is how a card leaves the marketplace.
const rank = (status) => (status === 'active' ? 2 : status === 'sold' ? 1 : 0);

export const vaultItemListing = (vaultItem, listing = null) => {
  if (listing) return listing;
  const rows = Array.isArray(vaultItem?.listings)
    ? vaultItem.listings
    : (vaultItem?.listings ? [vaultItem.listings] : []);
  let best = null;
  for (const row of rows) {
    if (!row || !rank(row.status)) continue;
    if (!best || rank(row.status) > rank(best.status)) best = row;
  }
  return best;
};

export const isSoldVaultItem = (vaultItem, listing = null) =>
  vaultItemListing(vaultItem, listing)?.status === 'sold';

export default vaultItemListing;
