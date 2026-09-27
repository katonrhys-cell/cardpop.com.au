import express from 'express';
import supabase from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAal2.js';
import { VALID_STATES } from '../utils/eventData.js';
import { isFetchableHttpUrl } from '../utils/safeFetch.js';
import { WATCHED_FIELDS, withFreeFlag } from '../utils/eventSourceWatcher.js';

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

// ─── Weekly re-scan of an event's own website ───────────────────────────────
//
// The watch follows events.source_url (the event form's "Website to scrape").
// These routes only manage the watch and apply/dismiss what a scan proposed;
// the scan itself runs on the 300s function at /cron/event-scan?mode=watches.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadWatchAndEvent(eventId) {
  const [{ data: event, error: eventError }, { data: watch, error: watchError }] = await Promise.all([
    supabase.from('events').select('*').eq('id', eventId).maybeSingle(),
    supabase.from('event_source_watches').select('*').eq('event_id', eventId).maybeSingle(),
  ]);
  if (eventError || watchError) throw new Error((eventError || watchError).message);
  return { event, watch };
}

// Turn weekly re-scanning on or off for an event, following its current
// source_url. Answers `scanNow: true` when the page should be scanned straight
// away — a new watch, a changed URL, or a watch switched back on.
router.put('/watches/:eventId', async (req, res) => {
  const { eventId } = req.params;
  if (!UUID_RE.test(eventId)) return res.status(400).json({ error: 'Invalid event id.' });
  if (typeof req.body?.enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled must be a boolean' });
  }

  try {
    const { event, watch } = await loadWatchAndEvent(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    const url = typeof event.source_url === 'string' ? event.source_url.trim() : '';
    const now = new Date().toISOString();

    if (!req.body.enabled || !url) {
      if (watch?.is_active) {
        await supabase
          .from('event_source_watches')
          .update({ is_active: false, updated_at: now })
          .eq('event_id', eventId);
      }
      return res.json({ watch: watch ? { ...watch, is_active: false } : null, scanNow: false });
    }

    if (!isFetchableHttpUrl(url)) {
      return res.status(400).json({ error: 'The website to scrape must be a public http(s) URL.' });
    }

    const urlChanged = !watch || watch.url !== url;
    const reactivated = Boolean(watch) && !watch.is_active;
    const scanNow = urlChanged || reactivated;

    const row = {
      event_id: eventId,
      url,
      is_active: true,
      updated_at: now,
      ...(scanNow ? { next_scan_at: now } : {}),
      // A different page makes the old comparison state meaningless.
      ...(urlChanged ? { content_hash: null, pending_changes: {}, dismissed_changes: {} } : {}),
      ...(!watch ? { created_by: req.user?.id ?? null } : {}),
    };

    const { data, error } = await supabase
      .from('event_source_watches')
      .upsert(row, { onConflict: 'event_id' })
      .select()
      .single();
    if (error) throw new Error(error.message);

    res.json({ watch: data, scanNow });
  } catch (error) {
    logger.error(`[EVENT_WATCH] Failed to update watch for ${eventId}: ${error.message}`);
    res.status(500).json({ error: 'Failed to update the weekly re-scan.' });
  }
});

function pickFields(body, pending) {
  const fields = Array.isArray(body?.fields) ? body.fields.filter((f) => typeof f === 'string') : null;
  if (!fields?.length) return { error: 'fields must be a non-empty array.' };
  const unknown = fields.filter((f) => !(f in pending) || !WATCHED_FIELDS.includes(f));
  if (unknown.length) return { error: `No pending change for: ${unknown.join(', ')}` };
  return { fields };
}

// Write chosen proposed changes onto the event.
router.post('/watches/:eventId/apply', async (req, res) => {
  const { eventId } = req.params;
  if (!UUID_RE.test(eventId)) return res.status(400).json({ error: 'Invalid event id.' });

  try {
    const { event, watch } = await loadWatchAndEvent(eventId);
    if (!event || !watch) return res.status(404).json({ error: 'No re-scan set up for this event.' });

    const pending = watch.pending_changes || {};
    const { error: pickError, fields } = pickFields(req.body, pending);
    if (pickError) return res.status(400).json({ error: pickError });

    const patch = withFreeFlag(Object.fromEntries(fields.map((f) => [f, pending[f].found])));
    const { error: updateError } = await supabase.from('events').update(patch).eq('id', eventId);
    if (updateError) throw new Error(updateError.message);

    const remaining = Object.fromEntries(Object.entries(pending).filter(([f]) => !fields.includes(f)));
    const { data, error } = await supabase
      .from('event_source_watches')
      .update({ pending_changes: remaining, updated_at: new Date().toISOString() })
      .eq('event_id', eventId)
      .select()
      .single();
    if (error) throw new Error(error.message);

    res.json({ watch: data, applied: patch });
  } catch (error) {
    logger.error(`[EVENT_WATCH] Failed to apply changes for ${eventId}: ${error.message}`);
    res.status(500).json({ error: 'Failed to apply the changes.' });
  }
});

// Reject proposed changes. The rejected value is remembered so next week's
// scan doesn't propose the same thing again — only a different value will.
router.post('/watches/:eventId/dismiss', async (req, res) => {
  const { eventId } = req.params;
  if (!UUID_RE.test(eventId)) return res.status(400).json({ error: 'Invalid event id.' });

  try {
    const { watch } = await loadWatchAndEvent(eventId);
    if (!watch) return res.status(404).json({ error: 'No re-scan set up for this event.' });

    const pending = watch.pending_changes || {};
    const { error: pickError, fields } = pickFields(req.body, pending);
    if (pickError) return res.status(400).json({ error: pickError });

    const dismissed = { ...(watch.dismissed_changes || {}) };
    for (const f of fields) dismissed[f] = pending[f].found;
    const remaining = Object.fromEntries(Object.entries(pending).filter(([f]) => !fields.includes(f)));

    const { data, error } = await supabase
      .from('event_source_watches')
      .update({ pending_changes: remaining, dismissed_changes: dismissed, updated_at: new Date().toISOString() })
      .eq('event_id', eventId)
      .select()
      .single();
    if (error) throw new Error(error.message);

    res.json({ watch: data });
  } catch (error) {
    logger.error(`[EVENT_WATCH] Failed to dismiss changes for ${eventId}: ${error.message}`);
    res.status(500).json({ error: 'Failed to dismiss the changes.' });
  }
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
