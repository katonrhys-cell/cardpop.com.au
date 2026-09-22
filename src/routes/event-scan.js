import express from 'express';
import supabase from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAal2.js';
import { VALID_STATES } from '../utils/eventData.js';
import { isFetchableHttpUrl } from '../utils/safeFetch.js';

// Admin management of the nightly event scanner's source list.
//
// Reads of event_scan_sources / _runs / _candidates go straight from the admin
// UI to Supabase under the admin read policies — this router exists only for
// the writes, which stay server-side on the service-role key so the tables
// need no write policies at all.
//
// Triggering a scan is NOT here: that runs for minutes and lives on its own
// 300s function at /cron/event-scan (see api/event-scan.js). This router is
// mounted on the 40s api/index.js function.

const router = express.Router();
const VALID_KINDS = ['search_query', 'seed_url'];

router.use(authMiddleware);
// Admin + MFA step-up, matching the /admin router (was a bare isAdminUser check).
router.use(requireAdmin);

function validateSource({ kind, value, state, label, priority }) {
  if (!VALID_KINDS.includes(kind)) {
    return { error: `kind must be one of: ${VALID_KINDS.join(', ')}` };
  }
  if (typeof value !== 'string' || !value.trim()) {
    return { error: 'value is required' };
  }
  const trimmed = value.trim();
  if (trimmed.length > 300) {
    return { error: 'value must be 300 characters or fewer' };
  }
  if (kind === 'seed_url' && !isFetchableHttpUrl(trimmed)) {
    return { error: 'A seed_url must be a valid http(s) URL' };
  }
  if (state != null && !VALID_STATES.includes(state)) {
    return { error: `state must be one of: ${VALID_STATES.join(', ')}` };
  }
  const parsedPriority = priority == null ? 100 : Number(priority);
  if (!Number.isInteger(parsedPriority) || parsedPriority < 0 || parsedPriority > 1000) {
    return { error: 'priority must be an integer between 0 and 1000' };
  }

  return {
    source: {
      kind,
      value: trimmed,
      state: state ?? null,
      label: typeof label === 'string' && label.trim() ? label.trim().slice(0, 120) : null,
      priority: parsedPriority,
    },
  };
}

router.post('/sources', async (req, res) => {
  const { error: validationError, source } = validateSource(req.body || {});
  if (validationError) return res.status(400).json({ error: validationError });

  const { data, error } = await supabase
    .from('event_scan_sources')
    .insert(source)
    .select()
    .single();

  if (error) {
    // 23505 = the (kind, value) unique constraint — this query already exists.
    if (error.code === '23505') {
      return res.status(409).json({ error: 'That source is already on the list.' });
    }
    logger.error(`[EVENT_SCAN] Failed to create source: ${error.message}`);
    return res.status(500).json({ error: 'Failed to create source.' });
  }

  res.status(201).json({ source: data });
});

router.patch('/sources/:id', async (req, res) => {
  const patch = {};

  if ('is_active' in req.body) {
    if (typeof req.body.is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active must be a boolean' });
    }
    patch.is_active = req.body.is_active;
  }

  if ('priority' in req.body) {
    const priority = Number(req.body.priority);
    if (!Number.isInteger(priority) || priority < 0 || priority > 1000) {
      return res.status(400).json({ error: 'priority must be an integer between 0 and 1000' });
    }
    patch.priority = priority;
  }

  if ('label' in req.body) {
    patch.label = typeof req.body.label === 'string' && req.body.label.trim()
      ? req.body.label.trim().slice(0, 120)
      : null;
  }

  if (!Object.keys(patch).length) {
    return res.status(400).json({ error: 'Nothing to update.' });
  }

  patch.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('event_scan_sources')
    .update(patch)
    .eq('id', req.params.id)
    .select()
    .maybeSingle();

  if (error) {
    logger.error(`[EVENT_SCAN] Failed to update source ${req.params.id}: ${error.message}`);
    return res.status(500).json({ error: 'Failed to update source.' });
  }
  if (!data) return res.status(404).json({ error: 'Source not found.' });

  res.json({ source: data });
});

router.delete('/sources/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('event_scan_sources')
    .delete()
    .eq('id', req.params.id)
    .select('id')
    .maybeSingle();

  if (error) {
    logger.error(`[EVENT_SCAN] Failed to delete source ${req.params.id}: ${error.message}`);
    return res.status(500).json({ error: 'Failed to delete source.' });
  }
  if (!data) return res.status(404).json({ error: 'Source not found.' });

  res.json({ ok: true });
});

export default router;
