// Vault card upload/update — the one-call backend for the Add/Edit Card form.
//
// The form used to run four fragile client-side writes in sequence (vault
// insert, then a listings upsert, each with its own failure mode). This
// endpoint takes the whole submission at once, validates it with the same
// rules module the form uses, writes the vault row and syncs the marketplace
// listing, and answers with an honest per-part outcome the UI can toast.
//
// Photos are NOT uploaded through here: the client keeps uploading images
// straight to Supabase Storage (Vercel functions cap request bodies at
// ~4.5 MB, and direct-to-storage is the supported Supabase pattern) and sends
// the resulting storage paths, which are checked to live in the caller's own
// folder.
//
// Every DB write uses a client scoped to the CALLER'S token, not the service
// role, so RLS stays the single enforcement point: ownership, the
// can_sell() selling gate, the is_featured / locked-base-value column pins
// and the listing-approval trigger all apply exactly as they do for direct
// client-side writes. Full runbook: docs/vault-upload.md.
import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import createUserScopedClient from '../utils/userScopedSupabase.js';
import { buildVaultItemRow, validateVaultItemRow } from '../utils/vaultItemInput.js';
import { canUseStyle, normalizeStyle, normalizeTier, getStyleByKey, TIER_META } from '../../lib/displayStyles.js';
import { syncMarketplaceListing } from '../services/vaultListingService.js';
import logger from '../utils/logger.js';

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// `language` is a recently added column. Vercel's deploy and the Supabase
// migration workflow run independently on merge, so for a brief window the new
// backend can be live against a schema that lacks it. Rather than fail the
// seller's upload, drop the field and retry once. (PGRST204 = "Could not find
// the 'x' column ... in the schema cache".)
const isMissingLanguageColumn = (err) =>
  err && (err.code === 'PGRST204' || /schema cache/i.test(err.message || '')) &&
  /language/i.test(err.message || '');

const withoutLanguage = (row) => {
  const { language, ...rest } = row; // eslint-disable-line no-unused-vars
  return rest;
};

// The owner's subscription tier gates which display style may be saved. Read
// it server-side — the client's word for its own tier is not trusted.
const fetchOwnerTier = async (userClient, userId) => {
  const { data } = await userClient
    .from('profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .maybeSingle();
  return data?.subscription_tier ?? 'free';
};

const respondValidationError = (res, fields) =>
  res.status(400).json({
    error: 'Validation failed',
    // Keyed by the form's field names so the client can highlight the exact
    // inputs (cardName, estimatedValue, year, hierarchy, cardImage, ...).
    fields,
  });

// POST /vault/items — add a card to the caller's vault (and list it).
// Body: { item: {…vault_items columns…}, pricing: { askingPrice, offerMin, offerMax } }
router.post('/', authMiddleware, async (req, res) => {
  const token = (req.headers.authorization || '').slice(7);
  const userClient = createUserScopedClient(token);
  const { item = {}, pricing = {} } = req.body || {};

  const tier = await fetchOwnerTier(userClient, req.user.id);
  const { row, pathErrors } = buildVaultItemRow(item, { userId: req.user.id, tier, isEdit: false });
  if (pathErrors.length) return respondValidationError(res, { cardImage: pathErrors[0] });

  const fieldErrors = validateVaultItemRow(row, { pricing, isEdit: false });
  if (Object.keys(fieldErrors).length) return respondValidationError(res, fieldErrors);

  let { data: inserted, error } = await userClient.from('vault_items').insert(row).select('id').single();
  if (isMissingLanguageColumn(error)) {
    ({ data: inserted, error } = await userClient.from('vault_items').insert(withoutLanguage(row)).select('id').single());
  }
  if (error) {
    if (error.code === '42501' || /row-level security/i.test(error.message || '')) {
      return res.status(403).json({ error: 'You are not allowed to add this card to the vault.' });
    }
    throw error;
  }

  const listingStatus = await syncMarketplaceListing(userClient, {
    cardId: inserted.id,
    userId: req.user.id,
    listingType: row.listing_type,
    pricing,
  });

  logger.info(`[VAULT] User ${req.user.id} added card ${inserted.id} (${row.listing_type}, listing: ${listingStatus})`);
  res.status(201).json({ success: true, item: { id: inserted.id }, listing: { status: listingStatus } });
});

// PUT /vault/items/:id — full update of a card the caller owns (and re-sync
// its listing). Same body as POST. Send the complete item each time, exactly
// as the form does: flags derived from `variant` (and the listing type) are
// recomputed from THIS submission, so a partial body would clear them.
router.put('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  if (!UUID_RE.test(id || '')) return res.status(400).json({ error: 'Invalid card id' });

  const token = (req.headers.authorization || '').slice(7);
  const userClient = createUserScopedClient(token);
  const { item = {}, pricing = {} } = req.body || {};

  // Owner-scoped read: RLS already hides other users' private rows, and the
  // explicit owner filter keeps admins/public rows out of this edit path too.
  const { data: existing, error: findError } = await userClient
    .from('vault_items')
    .select('id, owner_id, card_image, category_id, franchise_id, locked_base_value_aud')
    .eq('id', id)
    .eq('owner_id', req.user.id)
    .maybeSingle();
  if (findError) throw findError;
  if (!existing) return res.status(404).json({ error: 'Card not found in your vault' });

  const tier = await fetchOwnerTier(userClient, req.user.id);
  const { row, pathErrors } = buildVaultItemRow(item, { userId: req.user.id, tier, isEdit: true });
  if (pathErrors.length) return respondValidationError(res, { cardImage: pathErrors[0] });

  const fieldErrors = validateVaultItemRow(row, { pricing, isEdit: true, existing });
  if (Object.keys(fieldErrors).length) return respondValidationError(res, fieldErrors);

  let { error } = await userClient.from('vault_items').update(row).eq('id', id).eq('owner_id', req.user.id);
  if (isMissingLanguageColumn(error)) {
    ({ error } = await userClient.from('vault_items').update(withoutLanguage(row)).eq('id', id).eq('owner_id', req.user.id));
  }
  if (error) {
    if (error.code === '42501' || /row-level security/i.test(error.message || '')) {
      return res.status(403).json({ error: 'You are not allowed to update this card.' });
    }
    throw error;
  }

  const listingStatus = await syncMarketplaceListing(userClient, {
    cardId: id,
    userId: req.user.id,
    listingType: row.listing_type,
    pricing,
  });

  logger.info(`[VAULT] User ${req.user.id} updated card ${id} (${row.listing_type}, listing: ${listingStatus})`);
  res.json({ success: true, item: { id }, listing: { status: listingStatus } });
});

// PATCH /vault/items/:id/display-style — change only how a card is shown.
// Deliberately NOT the PUT above: that is a full-replace contract whose
// derived fields (listing_type, flags) are recomputed from the submission, so
// sending just a style through it would unlist the card. This endpoint
// touches a single cosmetic column and re-checks the tier gate server-side.
router.patch('/:id/display-style', authMiddleware, async (req, res) => {
  const { id } = req.params;
  if (!UUID_RE.test(id || '')) return res.status(400).json({ error: 'Invalid card id' });

  const token = (req.headers.authorization || '').slice(7);
  const userClient = createUserScopedClient(token);

  const requested = normalizeStyle(req.body?.displayStyle);
  const tier = await fetchOwnerTier(userClient, req.user.id);
  if (!canUseStyle(requested, normalizeTier(tier))) {
    const style = getStyleByKey(requested);
    const need = TIER_META[style?.minTier]?.label || style?.minTier;
    return res.status(403).json({ error: `${style?.label || requested} is a ${need} display style. Upgrade to use it.` });
  }

  const { data, error } = await userClient
    .from('vault_items')
    .update({ display_style: requested })
    .eq('id', id)
    .eq('owner_id', req.user.id)
    .select('id')
    .maybeSingle();
  if (error) {
    if (error.code === '42501' || /row-level security/i.test(error.message || '')) {
      return res.status(403).json({ error: 'You are not allowed to update this card.' });
    }
    throw error;
  }
  if (!data) return res.status(404).json({ error: 'Card not found in your vault' });

  logger.info(`[VAULT] User ${req.user.id} set display style of card ${id} to ${requested}`);
  res.json({ success: true, displayStyle: requested });
});

export default router;
