// Server-side shaping of a vault card upload: whitelist the writable columns,
// coerce types, re-derive every flag the UI derives, and validate with the
// SAME rules module the Add/Edit form uses (utils/listingValidation.js), so a
// seller sees identical messages whether a check fires on blur in the form or
// on the server. RLS remains the security boundary (writes go through the
// caller-scoped client); this module exists so the API cannot be handed
// columns the form never writes (is_featured, locked_base_value_aud, ...) and
// so derived fields can't drift from their source-of-truth inputs.
import { validateListingForm } from '../../utils/listingValidation.js';
import { canUseStyle, normalizeStyle, normalizeTier } from '../../lib/displayStyles.js';
import { FOIL_VARIANT, ROOKIE_VARIANT } from '../../lib/cardVariants.js';
import { hasVideoExtension } from '../../utils/cardVideo.js';

// Listing types a buyer can see. Anything else (the form's 'private', legacy
// casings, garbage) is stored as the canonical 'Private'.
export const PUBLIC_LISTING_TYPES = ['For Sale', 'For Trade', 'For Sale & Trade', 'Expression of Interest'];

const GRADING_COMPANIES = ['raw', 'psa', 'bgs', 'cgc', 'ace', 'sgc', 'other'];

// ── Type coercers ────────────────────────────────────────────────────────────
const str = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};
const num = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const int = (v) => {
  const n = num(v);
  return n === null ? null : Math.trunc(n);
};
const bool = (v) => v === true;

// Every column the API will write, with its coercer. Anything not listed —
// owner_id, is_featured, locked_base_value_aud, base_value_source, admin/
// curation columns — is dropped no matter what the client sends.
const WRITABLE = {
  category_id: str,
  franchise_id: str,
  manufacturer_id: str,
  team_id: str,
  set_id: str,
  parallel_id: str,
  subset_id: str,
  collection: str,
  card_name: str,
  set_name: str,
  card_number: str,
  year: str,
  variant: str,
  is_foil: bool,
  is_sealed: bool,
  serial_number: str,
  is_auto: bool,
  auto_type: str,
  auto_signers: int,
  patch_type: str,
  patch_pieces: int,
  relic_material: str,
  relic_source: str,
  serial_position: int,
  serial_print_run: int,
  sp_variation: str,
  sp_tier: str,
  rookie_type: str,
  rookie_logo: str,
  refractor_type: str,
  refractor_color: str,
  prizm_type: str,
  prizm_color: str,
  grading_company: str,
  grade: str,
  cert_number: str,
  condition: str,
  language: str,
  estimated_value_aud: num,
  purchase_price_aud: num,
  acquired_date: str,
  acquired_from: str,
  notes: str,
  trade_value_aud: num,
  listing_type: str,
  display_style: str,
  cardsight_card_id: str,
  cardsight_set_id: str,
  card_image: str,
  card_images: (v) => (Array.isArray(v) ? v.map(str).filter(Boolean) : null),
  // One optional <=10s video. Omitted on an edit = keep the stored one; an
  // explicit null removes it. (Duration is enforced in the form — storage
  // can't inspect it — and size/type by the bucket's limits.)
  card_video: str,
};

// Storage object paths the form writes are `<ownerId>/<timestamped name>`.
// A path pointing into someone else's folder must never be accepted — it
// would let one account display (and later delete-orphan) another's photos.
const ownsStoragePath = (path, userId) =>
  typeof path === 'string' &&
  path.startsWith(`${userId}/`) &&
  !path.includes('..') &&
  path.length <= 512;

/**
 * Shape a raw request body into a vault_items row.
 *
 * @param {object} raw          request body `item` object
 * @param {object} opts
 * @param {string} opts.userId  authenticated caller (owner)
 * @param {string} opts.tier    owner's subscription tier (server-read)
 * @param {boolean} opts.isEdit
 * @returns {{ row: object, pathErrors: string[] }}
 */
export const buildVaultItemRow = (raw, { userId, tier, isEdit }) => {
  const row = {};
  for (const [col, coerce] of Object.entries(WRITABLE)) {
    if (raw[col] !== undefined) row[col] = coerce(raw[col]);
  }

  const pathErrors = [];
  if (row.card_image != null && !ownsStoragePath(row.card_image, userId)) {
    pathErrors.push('card_image must be a storage path inside your own folder');
  }
  if (row.card_video != null &&
      (!ownsStoragePath(row.card_video, userId) || !hasVideoExtension(row.card_video))) {
    pathErrors.push('card_video must be a video storage path inside your own folder');
    delete row.card_video;
  }
  if (row.card_images != null) {
    row.card_images = row.card_images.filter((p) => {
      if (ownsStoragePath(p, userId)) return true;
      pathErrors.push('card_images entries must be storage paths inside your own folder');
      return false;
    });
  }

  // ── Derivations (mirror pages/AddEditCardPage.jsx handleSubmit) ───────────
  const variant = row.variant || '';
  const has = (chip) => variant.includes(chip);

  const listingType = PUBLIC_LISTING_TYPES.includes(row.listing_type) ? row.listing_type : 'Private';
  row.listing_type = listingType;
  row.is_public = listingType !== 'Private';

  // Selecting the Foil / Holo chip says the card is foiled, so the flag buyers
  // filter on follows the chip without needing the toggle ticked too.
  row.is_foil = bool(row.is_foil) || has(FOIL_VARIANT);
  // The variant chips are the single source of truth for these derived flags —
  // filters query the flags, so they must never disagree with the chips.
  row.is_rookie = has(ROOKIE_VARIANT);
  row.is_refractor = has('Refractor');
  row.is_sealed = bool(row.is_sealed);
  // The Auto chip and the is_auto flag both mean "this card is autographed";
  // the chip implies the flag so the two can never disagree — a mismatch is
  // how a removed Auto pill used to survive (flag stayed true, chip gone).
  row.is_auto = bool(row.is_auto) || has('Auto');

  row.auto_type = row.is_auto ? (row.auto_type ?? null) : null;
  row.auto_signers = row.is_auto ? (row.auto_signers ?? 1) : null;
  row.patch_type = has('Patch') ? (row.patch_type ?? null) : null;
  row.patch_pieces = has('Patch') ? (row.patch_pieces ?? 1) : null;
  row.relic_material = has('Relic / Jersey') ? (row.relic_material ?? null) : null;
  row.relic_source = has('Relic / Jersey') ? (row.relic_source ?? null) : null;
  row.serial_position = has('Numbered') ? (row.serial_position ?? null) : null;
  row.serial_print_run = has('Numbered') ? (row.serial_print_run ?? null) : null;
  row.sp_variation = has('Short Print (SP)') ? (row.sp_variation ?? null) : null;
  row.sp_tier = has('Short Print (SP)') ? (row.sp_tier ?? null) : null;
  row.rookie_type = row.is_rookie ? (row.rookie_type ?? null) : null;
  row.rookie_logo = row.is_rookie ? (row.rookie_logo ?? null) : null;
  row.refractor_type = row.is_refractor ? (row.refractor_type ?? null) : null;
  row.refractor_color = row.is_refractor ? (row.refractor_color ?? null) : null;
  row.prizm_type = has('Prizm') ? (row.prizm_type ?? null) : null;
  row.prizm_color = has('Prizm') ? (row.prizm_color ?? null) : null;

  const grading = GRADING_COMPANIES.includes(row.grading_company) ? row.grading_company : 'raw';
  row.grading_company = grading;
  if (grading === 'raw') {
    row.grade = null;
    row.cert_number = null;
  }

  // Money fields are never defaulted here: an absent estimated value fails
  // validation (same as the form), rather than being silently written as $0.
  if (row.trade_value_aud != null) row.trade_value_locked = row.trade_value_aud > 0;

  // Clamp the display style to what the owner's tier allows — server-side, so
  // a locked style can't be saved by bypassing the picker (the form clamps
  // too, but the client is not a security boundary).
  if (row.display_style !== undefined || !isEdit) {
    row.display_style = canUseStyle(row.display_style, normalizeTier(tier))
      ? normalizeStyle(row.display_style)
      : 'classic';
  }

  // CardSight identity: stamped server-side when a match is supplied; an edit
  // that doesn't mention CardSight leaves the stored identification alone.
  if (row.cardsight_card_id) {
    row.cardsight_identified_at = new Date().toISOString();
  } else if (raw.cardsight_card_id === undefined) {
    delete row.cardsight_card_id;
    delete row.cardsight_set_id;
  } else {
    row.cardsight_card_id = null;
    row.cardsight_set_id = null;
  }

  if (!isEdit) row.owner_id = userId;

  return { row, pathErrors };
};

/**
 * Validate a shaped row with the shared listing rules. Returns {} when clean,
 * otherwise { field: message } keyed by the form's field names so the client
 * can highlight the exact inputs.
 */
export const validateVaultItemRow = (row, { pricing = {}, isEdit = false, existing = null }) => {
  const formShape = {
    cardName: row.card_name || '',
    estimatedValue: row.estimated_value_aud != null ? String(row.estimated_value_aud) : '',
    year: row.year || '',
    listingType: row.listing_type,
    askingPrice: pricing.askingPrice != null ? String(pricing.askingPrice) : '',
    shippingCost: pricing.shippingCost != null ? String(pricing.shippingCost) : '',
    offerMin: pricing.offerMin != null ? String(pricing.offerMin) : '',
    offerMax: pricing.offerMax != null ? String(pricing.offerMax) : '',
    tradeValue: row.trade_value_aud != null ? String(row.trade_value_aud) : '',
  };
  const ctx = {
    isEdit,
    lockedBaseValue: existing?.locked_base_value_aud ?? null,
    selCategoryId: row.category_id ?? existing?.category_id ?? null,
    franchiseId: row.franchise_id ?? existing?.franchise_id ?? null,
    hasImage: !!(row.card_image || existing?.card_image),
    requireImage: true,
  };
  const errors = validateListingForm(formShape, ctx);
  // The EOI offer window arrives as timestamps (the browser converts the
  // seller's local dates), so it is checked here rather than by the form
  // rules, which work on the date inputs.
  if (row.listing_type === 'Expression of Interest') {
    const open = pricing.offersOpenAt ? new Date(pricing.offersOpenAt) : null;
    const close = pricing.offersCloseAt ? new Date(pricing.offersCloseAt) : null;
    if (open && Number.isNaN(open.getTime())) errors.offerOpenDate = 'Enter a valid opening date';
    if (close && Number.isNaN(close.getTime())) errors.offerCloseDate = 'Enter a valid closing date';
    else if (open && close && close <= open) errors.offerCloseDate = 'The closing date must be on or after the opening date';
  }
  return errors;
};
