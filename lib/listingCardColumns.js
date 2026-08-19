// Shared column projections for browse-grid queries.
//
// vault_items is a wide table (60+ columns including AI-identify metadata,
// owner notes and purchase prices). The browse surfaces (marketplace,
// collections, search, home, seller stores) only render the card fields
// below, but historically fetched `*` — pulling the full row for every card
// in every grid. Supabase meters egress, so this list is the payload
// contract for grid queries: it cuts transfer/latency and stops shipping
// owner-private fields (notes, purchase_price_aud) to other visitors.
//
// Every name here was verified against the live schema. Unlike `*`, an
// explicit select of a non-existent column is a PostgREST 400 — add new
// columns here only after the migration creating them has been applied.
export const VAULT_ITEM_CARD_COLUMNS = [
  'id',
  'owner_id',
  'category_id',
  'franchise_id',
  'collection',
  'card_name',
  'set_name',
  'card_number',
  'year',
  'variant',
  'condition',
  'grade',
  'grading_company',
  'serial_number',
  'is_rookie',
  'is_auto',
  'is_foil',
  'is_sealed',
  'auto_type',
  'auto_signers',
  'card_image',
  'card_images',
  'display_style',
  'estimated_value_aud',
  'listing_type',
  'is_public',
  'is_featured',
  'created_at',
].join(',');

// The cards only read vault_images[0].storage_path.
export const VAULT_IMAGE_CARD_COLUMNS = 'storage_path';

// Embed fragments for listings-based grids. The !inner variant constrains the
// listings rows when filters reference the embedded vault_item (marketplace,
// collections, search); the plain variant is for seller-store pages that
// embed without filtering on it.
export const LISTING_CARD_VAULT_EMBED_INNER =
  `vault_item:vault_items!inner(${VAULT_ITEM_CARD_COLUMNS}, vault_images(${VAULT_IMAGE_CARD_COLUMNS}))`;
export const LISTING_CARD_VAULT_EMBED =
  `vault_item:vault_items(${VAULT_ITEM_CARD_COLUMNS}, vault_images(${VAULT_IMAGE_CARD_COLUMNS}))`;

// Marketplace state for a vault-item-sourced grid. "Sold" is a property of the
// listing, not of the card, so a grid reading vault_items has no way to badge a
// sold card without carrying its listing along. `listings.vault_item_id` is the
// only FK between the two tables, so the bare embed name is unambiguous. RLS
// still applies to the embed — an archived listing simply comes back absent.
export const VAULT_ITEM_LISTING_EMBED = 'listings(id, status, price_aud, sold_at)';

// Select clause for grids that query vault_items directly (homepage featured,
// collection sections, seller vault strips).
export const VAULT_ITEM_CARD_SELECT =
  `${VAULT_ITEM_CARD_COLUMNS}, vault_images(${VAULT_IMAGE_CARD_COLUMNS}), ${VAULT_ITEM_LISTING_EMBED}`;
