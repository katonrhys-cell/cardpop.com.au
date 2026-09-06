import { Lock, ShoppingCart, ArrowRightLeft, Layers, HandCoins } from 'lucide-react';

/**
 * Listing-type chips for vault + marketplace cards.
 *
 * One mapping so the vault grid, the marketplace grid and the product page all
 * badge a listing the same way. The colours are the `--vault-*` tokens in
 * index.css — solid fills, because these chips sit on top of card photography
 * and a translucent tint is unreadable over busy card art.
 */
export const VAULT_LISTING_BADGES = {
  'Private':                { label: 'Private',                className: 'badge-vault-private', icon: Lock },
  'For Sale':               { label: 'For Sale',               className: 'badge-vault-sale',    icon: ShoppingCart },
  'For Trade':              { label: 'For Trade',              className: 'badge-vault-trade',   icon: ArrowRightLeft },
  'For Sale & Trade':       { label: 'Sale & Trade',           className: 'badge-vault-both',    icon: Layers },
  'Expression of Interest': { label: 'Expression of Interest',  className: 'badge-vault-eoi',    icon: HandCoins },
};

export const getVaultListingBadge = (listingType) =>
  VAULT_LISTING_BADGES[listingType] ?? {
    label: listingType || 'Private',
    className: 'badge-vault-private',
    icon: Lock,
  };

export default getVaultListingBadge;
