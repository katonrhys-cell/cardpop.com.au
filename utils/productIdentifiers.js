// Product identifiers for schema.org Product markup (Google Merchant listings).
//
// Google's Merchant listings report flags a Product node that carries no
// "global identifier" — none of gtin / mpn / brand — as "No global identifier
// provided (e.g., gtin, brand)". It is a non-critical warning today, but Google
// has said it may become critical, and a product with identifiers is matched
// to Google's product graph far more reliably. Every Product node the site
// emits (api/prerender.js for crawlers, the SPA pages for everyone else) builds
// its identifiers through these helpers so the two renderings agree.
//
// Dependency-free apart from isGtin: shared by the SPA, api/prerender.js and
// the backend.
import { isGtin } from './productReviews.js';

/** Brand attached to CardPop's own (CP-…) shop products. */
export const SHOP_HOUSE_BRAND = 'CardPop';

/**
 * Brand of a shop_products row: the `brand` column (Palms Off Gaming rows carry
 * it from their seed), else CardPop — house products are CardPop's own.
 * Admins set Brand in the product form for any other wholesale line.
 */
export const shopBrandName = (product) => String(product?.brand || '').trim() || SHOP_HOUSE_BRAND;

/**
 * brand / sku / mpn / gtin for a shop product's Product node.
 *
 * - `brand` — the row's brand, or the override (catalogue pages know theirs).
 * - `sku` + `mpn` — the SKU. For wholesale lines it is the brand's own SKU,
 *   for house products CardPop is the manufacturer, so it is the part number
 *   in both cases, and brand + mpn is an identifier pair Google accepts.
 * - `gtin` — the packaging barcode, only when it is a well-formed GTIN
 *   (Google rejects anything else as an invalid gtin).
 */
export const shopProductIdentifiersLd = (product, { brand } = {}) => {
  const sku = String(product?.sku || '').trim();
  const barcode = String(product?.barcode || '').trim();
  return {
    brand: { '@type': 'Brand', name: String(brand || '').trim() || shopBrandName(product) },
    ...(sku ? { sku, mpn: sku } : {}),
    ...(isGtin(barcode) ? { gtin: barcode } : {}),
  };
};

// Trading-card brands by the franchise / collection names the site stores
// (collection slugs like "pokemon", price categories like "Basketball (NBA)",
// free-text categories like "Pokémon"). Anything unmatched is used as given.
const CARD_BRANDS = [
  [/pok[eé]mon/i, 'Pokémon'],
  [/magic|\bmtg\b/i, 'Magic: The Gathering'],
  [/yu-?gi-?oh/i, 'Yu-Gi-Oh!'],
  [/one[ -]?piece/i, 'One Piece Card Game'],
  [/lorcana/i, 'Disney Lorcana'],
  [/dragon[ -]?ball/i, 'Dragon Ball Super Card Game'],
  [/digimon/i, 'Digimon Card Game'],
  [/basketball|\bnba\b/i, 'NBA'],
  [/\bafl\b|aussie rules|australian rules/i, 'AFL'],
  [/\bnrl\b|rugby league/i, 'NRL'],
];

/**
 * Brand name for a trading card from whatever franchise / collection /
 * category names are known, first non-empty wins. Returns null when nothing
 * is known — a Product with no brand is better than one with a made-up brand.
 */
export const cardBrandName = (...names) => {
  for (const raw of names) {
    const name = String(raw || '').trim();
    if (!name) continue;
    const hit = CARD_BRANDS.find(([re]) => re.test(name));
    return hit ? hit[1] : name;
  }
  return null;
};

/** Manufacturer part number for a single card: "<set> <number>", or null without a number. */
export const cardMpn = ({ setName, cardNumber } = {}) => {
  const number = String(cardNumber || '').trim();
  if (!number) return null;
  const set = String(setName || '').trim();
  return set ? `${set} ${number}` : number;
};

/**
 * brand / sku / mpn for a single trading card's Product node. Cards have no
 * GTIN, so brand + mpn (set and card number) is the identifier pair.
 */
export const cardIdentifiersLd = ({ brand, setName, cardNumber } = {}) => {
  const name = cardBrandName(brand);
  const mpn = cardMpn({ setName, cardNumber });
  const number = String(cardNumber || '').trim();
  return {
    ...(name ? { brand: { '@type': 'Brand', name } } : {}),
    ...(number ? { sku: number } : {}),
    ...(mpn ? { mpn } : {}),
  };
};
