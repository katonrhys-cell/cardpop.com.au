/**
 * Records every card identification, and accumulates a catalogue out of them.
 *
 * Two things are being captured, and the second is the more valuable:
 *
 *   - what the pipeline read, plus how it got there (which model, whether it
 *     escalated and why, what the catalogue corroborated). Aggregated, this is a
 *     production accuracy signal — the fixture harness measures seven cards, this
 *     measures every scan a seller actually runs.
 *
 *   - what the seller then *changed*. An edit after an identification is ground
 *     truth, and it is the only ground truth that arrives for free.
 *
 * Writes go through the service-role client rather than the browser, so scan
 * history can't be forged and the shared catalogue can't be corrupted by a
 * seller. See supabase/migrations/*_card_scans_and_catalogue.sql.
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import supabase from '../utils/supabaseClient.js';
import { buildCatalogueKey, isStrongCatalogueKey } from '../../utils/catalogueKey.js';
import logger from '../utils/logger.js';

const router = Router();

router.use(authMiddleware);

// Identity fields. A change to any of these means the pipeline identified the
// wrong card, as opposed to getting a descriptive detail slightly wrong.
const IDENTITY_FIELDS = ['collection', 'setName', 'insertName', 'cardNumber', 'parallel'];

const str = value => (value === null || value === undefined ? null : String(value).trim() || null);

/** The subset of a scan payload that describes which card it is. */
function identityOf(body) {
  return {
    collection: str(body.collection),
    setName: str(body.setName),
    insertName: str(body.insertName),
    cardNumber: str(body.cardNumber),
    parallel: str(body.parallel),
    name: str(body.cardName),
  };
}

/**
 * Upserts the catalogue entry for a scan. Best-effort: a catalogue write must
 * never fail the scan record it came from, since the log is the thing we can't
 * reconstruct later.
 */
async function promote(identity, extra, confirmed) {
  const key = buildCatalogueKey(identity);
  if (!key) return null;

  const { error } = await supabase.rpc('record_catalogue_observation', {
    p_catalogue_key: key,
    p_collection: identity.collection,
    p_set_name: identity.setName,
    p_insert_name: identity.insertName,
    p_card_number: identity.cardNumber,
    p_parallel: identity.parallel,
    p_card_name: identity.name,
    p_year: extra.year,
    p_rookie: extra.rookie,
    p_manufacturer: extra.manufacturer,
    p_strong_key: isStrongCatalogueKey(key),
    p_confirmed: Boolean(confirmed),
  });

  if (error) logger.warn(`[CARD_SCANS] Catalogue promotion failed for ${key}: ${error.message}`);
  return key;
}

// ─── POST /card-scans ────────────────────────────────────────────────────────
// Records one identification. Called after an identify completes, before the
// seller has had a chance to correct anything.
router.post('/', async (req, res) => {
  const body = req.body ?? {};
  const identity = identityOf(body);
  const extra = {
    year: str(body.year),
    rookie: str(body.rookie),
    manufacturer: str(body.manufacturer),
  };

  try {
    const catalogueKey = await promote(identity, extra, false);

    const { data, error } = await supabase
      .from('card_scans')
      .insert({
        user_id: req.user.id,
        image_count: Math.min(Math.max(Number(body.imageCount) || 1, 1), 5),
        ocr: body.ocr ?? null,
        collection: identity.collection,
        set_name: identity.setName,
        insert_name: identity.insertName,
        card_number: identity.cardNumber,
        parallel: identity.parallel,
        card_name: identity.name,
        year: extra.year,
        rookie: extra.rookie,
        grading_company: str(body.gradingCompany),
        grade: str(body.grade),
        cert_number: str(body.certNumber),
        model_escalated: Boolean(body.escalated),
        escalation_reason: str(body.escalationReason),
        catalogue_verified: Array.isArray(body.catalogueVerified) ? body.catalogueVerified : null,
        cardsight_card_id: str(body.cardsightCardId),
        cardsight_confidence: str(body.cardsightConfidence),
        cardsight_ambiguous: typeof body.cardsightAmbiguous === 'boolean' ? body.cardsightAmbiguous : null,
        catalogue_key: catalogueKey,
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);
    res.status(201).json({ id: data.id, catalogueKey });
  } catch (err) {
    // A failed log must not surface as a failed scan — the seller's
    // identification already succeeded and this is bookkeeping behind it.
    logger.warn(`[CARD_SCANS] Could not record scan: ${err.message}`);
    res.status(202).json({ id: null, recorded: false });
  }
});

// ─── PATCH /card-scans/:id ───────────────────────────────────────────────────
// Attaches what the seller actually saved. The diff against the identified
// values is the accuracy signal; an unchanged identity counts as a human
// confirming the catalogue entry.
router.patch('/:id', async (req, res) => {
  const body = req.body ?? {};
  const saved = body.savedFields ?? {};

  try {
    const { data: scan, error: readError } = await supabase
      .from('card_scans')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (readError) throw new Error(readError.message);
    if (!scan) return res.status(404).json({ error: 'Scan not found' });

    // Confirmed only when every identity field survived the seller's review.
    const identified = {
      collection: scan.collection, setName: scan.set_name, insertName: scan.insert_name,
      cardNumber: scan.card_number, parallel: scan.parallel,
    };
    const unchanged = IDENTITY_FIELDS.every(f => {
      const before = str(identified[f]);
      const after = str(saved[f]);
      // A field the seller filled in that we left blank is not a correction of
      // a wrong answer; it is them completing one we didn't have.
      return before === null || before === after;
    });

    const { error } = await supabase
      .from('card_scans')
      .update({
        saved_fields: saved,
        corrected_at: new Date().toISOString(),
        vault_item_id: str(body.vaultItemId),
      })
      .eq('id', scan.id)
      .eq('user_id', req.user.id);

    if (error) throw new Error(error.message);

    // A confirmation records the seller's own values: where they filled a gap we
    // left blank, theirs is the better record.
    if (unchanged && scan.catalogue_key) {
      await promote(
        {
          collection: str(saved.collection) ?? identified.collection,
          setName: str(saved.setName) ?? identified.setName,
          insertName: str(saved.insertName) ?? identified.insertName,
          cardNumber: str(saved.cardNumber) ?? identified.cardNumber,
          parallel: str(saved.parallel) ?? identified.parallel,
          name: str(saved.cardName) ?? scan.card_name,
        },
        {
          year: str(saved.year) ?? scan.year,
          rookie: str(saved.rookie) ?? scan.rookie,
          manufacturer: str(saved.manufacturer),
        },
        true,
      );
    }

    res.json({ confirmed: unchanged });
  } catch (err) {
    logger.warn(`[CARD_SCANS] Could not attach saved fields: ${err.message}`);
    res.status(202).json({ recorded: false });
  }
});

// ─── GET /card-scans ─────────────────────────────────────────────────────────
// The caller's own scan history, newest first.
router.get('/', async (req, res) => {
  // Floor at 1 as well as capping at 100: a negative ?take (e.g. -5) is
  // truthy, so `Number(...) || 25` keeps it, and PostgREST rejects a negative
  // .limit() — 502-ing the caller's own history. parseInt also drops a
  // fractional take. Matches the clamp pattern used across the other routes.
  const take = Math.min(100, Math.max(1, parseInt(req.query.take, 10) || 25));

  const { data, error } = await supabase
    .from('card_scans')
    .select('id, created_at, collection, set_name, insert_name, card_number, parallel, card_name, year, catalogue_key, model_escalated, escalation_reason, corrected_at')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(take);

  if (error) {
    logger.warn(`[CARD_SCANS] History query failed: ${error.message}`);
    return res.status(502).json({ error: 'Could not load scan history' });
  }

  res.json({ scans: data ?? [] });
});

export default router;
