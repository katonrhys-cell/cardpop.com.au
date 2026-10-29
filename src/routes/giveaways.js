import { Router } from 'express';
import supabase from '../utils/supabaseClient.js';
import createUserScopedClient from '../utils/userScopedSupabase.js';
import logger from '../utils/logger.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAal2.js';
import { validateRequestBody, validateRequestParams } from '../middleware/validateRequest.js';
import {
  giveawaySlugSchema, giveawayIdSchema, giveawayEntryIdSchema, enterGiveawayBodySchema,
  createGiveawayBodySchema, updateGiveawayBodySchema, verifyEntryBodySchema, drawGiveawayBodySchema,
} from '../schemas/giveawaySchemas.js';
import { subscribeToNewsletter } from '../utils/newsletter.js';
import { sendGiveawayWinner } from '../utils/emailService.js';
import { drawWinner, entriesToCsv } from '../services/giveawayService.js';
import { cleanPrizes, giveawayPhase, canDraw, prizeForEntry, normaliseInstagramHandle } from '../../utils/giveaway.js';

// Giveaways — docs/giveaways.md.
//
// Public reads come through here (not straight from the browser) so one call
// returns the giveaway, its entry count and the caller's own entry. The entry
// INSERT uses a CALLER-SCOPED client: RLS and the trigger in
// 20261029203631_giveaways.sql are the rules (open window, confirmed email,
// residency/age ticks, valid prize pick, one entry per member and per handle).
// Admin writes use the service role behind requireAdmin (auth + admin + MFA).

const router = Router();

const PUBLIC_COLUMNS = 'id, slug, title, description, image_url, prizes, entry_mode, instagram_post_url, opens_at, closes_at, status, terms, min_age, winner_entry_id, drawn_at';
const ADMIN_COLUMNS = `${PUBLIC_COLUMNS}, draw_record, drawn_by, created_by, created_at, updated_at`;
const ENTRY_OWN_COLUMNS = 'id, giveaway_id, instagram_handle, prize_key, state, postcode, newsletter_opt_in, created_at';
const ENTRY_ADMIN_COLUMNS = `${ENTRY_OWN_COLUMNS}, user_id, email_confirmed, verified_at, verified_by`;
const WINNER_CLAIM_DAYS = 7;
const APP_URL = () => (process.env.APP_URL || 'https://cardpop.com.au').replace(/\/+$/, '');

const isLive = (g) => g && ['open', 'closed', 'drawn'].includes(g.status);

async function entryCount(giveawayId) {
  const { count, error } = await supabase
    .from('giveaway_entries')
    .select('id', { count: 'exact', head: true })
    .eq('giveaway_id', giveawayId);
  if (error) throw error;
  return count || 0;
}

async function ownEntry(giveawayId, userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('giveaway_entries')
    .select(ENTRY_OWN_COLUMNS)
    .eq('giveaway_id', giveawayId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

// The winner is shown publicly as their Instagram handle and the card they
// named — never a name, email or location.
async function publicWinner(giveaway) {
  if (!giveaway?.winner_entry_id) return null;
  const { data } = await supabase
    .from('giveaway_entries')
    .select('instagram_handle, prize_key')
    .eq('id', giveaway.winner_entry_id)
    .maybeSingle();
  if (!data) return null;
  return { instagram_handle: data.instagram_handle, prize: prizeForEntry(giveaway, data) };
}

async function publicPayload(giveaway, userId) {
  const [count, mine, winner] = await Promise.all([
    entryCount(giveaway.id),
    ownEntry(giveaway.id, userId),
    publicWinner(giveaway),
  ]);
  return { giveaway, phase: giveawayPhase(giveaway), entryCount: count, myEntry: mine, winner };
}

// ─── Admin ───────────────────────────────────────────────────────────────────
// Mounted BEFORE the public `/:slug` routes so `/giveaways/admin` is never read
// as a giveaway called "admin".

const admin = Router();
admin.use(authMiddleware, requireAdmin);

const rowFromBody = (b, userId) => ({
  slug: b.slug,
  title: b.title,
  description: b.description || null,
  image_url: b.imageUrl || null,
  prizes: cleanPrizes(b.prizes),
  entry_mode: b.entryMode,
  instagram_post_url: b.instagramPostUrl || null,
  opens_at: b.opensAt,
  closes_at: b.closesAt,
  status: b.status,
  terms: b.terms || null,
  min_age: b.minAge,
  ...(userId && { created_by: userId }),
});

admin.get('/', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('giveaways')
      .select(ADMIN_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    const giveaways = data || [];
    // One count query per giveaway is fine at this scale (a handful of rows).
    const counts = await Promise.all(giveaways.map((g) => entryCount(g.id).catch(() => 0)));
    res.json({ giveaways: giveaways.map((g, i) => ({ ...g, phase: giveawayPhase(g), entry_count: counts[i] })) });
  } catch (error) {
    logger.error(`[GIVEAWAY] admin list failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to load giveaways' });
  }
});

admin.post('/', validateRequestBody(createGiveawayBodySchema), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('giveaways')
      .insert(rowFromBody(req.body, req.user.id))
      .select(ADMIN_COLUMNS)
      .single();
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'A giveaway with that slug already exists' });
      throw error;
    }
    res.status(201).json({ giveaway: data });
  } catch (error) {
    logger.error(`[GIVEAWAY] create failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to create giveaway' });
  }
});

admin.patch('/:id', validateRequestParams(giveawayIdSchema), validateRequestBody(updateGiveawayBodySchema), async (req, res) => {
  try {
    const { data: existing, error: e0 } = await supabase
      .from('giveaways').select('id, status').eq('id', req.params.id).maybeSingle();
    if (e0) throw e0;
    if (!existing) return res.status(404).json({ error: 'Giveaway not found' });
    // A drawn giveaway's result is final; status can't be edited back.
    if (existing.status === 'drawn' && req.body.status !== 'drawn') {
      return res.status(409).json({ error: 'This giveaway has been drawn; its status cannot change' });
    }
    const { data, error } = await supabase
      .from('giveaways')
      .update(rowFromBody(req.body))
      .eq('id', req.params.id)
      .select(ADMIN_COLUMNS)
      .single();
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'A giveaway with that slug already exists' });
      throw error;
    }
    res.json({ giveaway: data });
  } catch (error) {
    logger.error(`[GIVEAWAY] update failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to update giveaway' });
  }
});

async function loadEntriesWithPeople(giveawayId) {
  const { data: entries, error } = await supabase
    .from('giveaway_entries')
    .select(ENTRY_ADMIN_COLUMNS)
    .eq('giveaway_id', giveawayId)
    .order('created_at', { ascending: true })
    .limit(5000);
  if (error) throw error;
  const ids = [...new Set((entries || []).map((e) => e.user_id))];
  const people = {};
  if (ids.length) {
    const { data: profiles } = await supabase
      .from('profiles').select('id, email, display_name, username').in('id', ids);
    for (const p of profiles || []) people[p.id] = p;
  }
  return (entries || []).map((e) => ({
    ...e,
    email: people[e.user_id]?.email || null,
    name: people[e.user_id]?.display_name || people[e.user_id]?.username || null,
  }));
}

admin.get('/:id/entries', validateRequestParams(giveawayIdSchema), async (req, res) => {
  try {
    const entries = await loadEntriesWithPeople(req.params.id);
    res.json({ entries });
  } catch (error) {
    logger.error(`[GIVEAWAY] entries failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to load entries' });
  }
});

admin.get('/:id/entries.csv', validateRequestParams(giveawayIdSchema), async (req, res) => {
  try {
    const { data: giveaway } = await supabase.from('giveaways').select('slug, prizes').eq('id', req.params.id).maybeSingle();
    if (!giveaway) return res.status(404).json({ error: 'Giveaway not found' });
    const entries = await loadEntriesWithPeople(req.params.id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="giveaway-${giveaway.slug}-entries.csv"`);
    res.send(entriesToCsv(entries, giveaway.prizes));
  } catch (error) {
    logger.error(`[GIVEAWAY] csv failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to export entries' });
  }
});

admin.patch('/:id/entries/:entryId', validateRequestParams(giveawayEntryIdSchema), validateRequestBody(verifyEntryBodySchema), async (req, res) => {
  try {
    const patch = req.body.verified
      ? { verified_at: new Date().toISOString(), verified_by: req.user.id }
      : { verified_at: null, verified_by: null };
    const { data, error } = await supabase
      .from('giveaway_entries')
      .update(patch)
      .eq('id', req.params.entryId)
      .eq('giveaway_id', req.params.id)
      .select(ENTRY_ADMIN_COLUMNS)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Entry not found' });
    res.json({ entry: data });
  } catch (error) {
    logger.error(`[GIVEAWAY] verify failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to update entry' });
  }
});

admin.post('/:id/draw', validateRequestParams(giveawayIdSchema), validateRequestBody(drawGiveawayBodySchema), async (req, res) => {
  try {
    const { data: giveaway, error: gErr } = await supabase
      .from('giveaways').select(ADMIN_COLUMNS).eq('id', req.params.id).maybeSingle();
    if (gErr) throw gErr;
    if (!giveaway) return res.status(404).json({ error: 'Giveaway not found' });
    if (giveaway.status === 'drawn') return res.status(409).json({ error: 'This giveaway has already been drawn' });
    if (!canDraw(giveaway)) {
      return res.status(409).json({ error: 'The draw can only run once entries have closed' });
    }

    const entries = await loadEntriesWithPeople(giveaway.id);
    const { winner, record } = drawWinner(entries, { pool: req.body.pool });
    if (!winner) {
      return res.status(409).json({
        error: req.body.pool === 'verified'
          ? 'No verified entries to draw from. Tick the entries whose comment you found, or draw from all entries.'
          : 'No entries to draw from',
      });
    }

    // Claim the draw atomically: only a giveaway still un-drawn takes the
    // result, so two admins clicking at once can't produce two winners.
    const { data: updated, error: uErr } = await supabase
      .from('giveaways')
      .update({
        status: 'drawn',
        winner_entry_id: winner.id,
        drawn_at: record.drawn_at,
        drawn_by: req.user.id,
        draw_record: record,
      })
      .eq('id', giveaway.id)
      .neq('status', 'drawn')
      .select(ADMIN_COLUMNS)
      .maybeSingle();
    if (uErr) throw uErr;
    if (!updated) return res.status(409).json({ error: 'This giveaway has already been drawn' });

    const prize = prizeForEntry(giveaway, winner);
    const resultUrl = `${APP_URL()}/giveaways/${giveaway.slug}`;
    if (winner.email) {
      sendGiveawayWinner({
        to: winner.email,
        name: winner.name,
        giveawayTitle: giveaway.title,
        prizeLabel: prize?.label,
        prizeDetail: prize?.detail,
        instagramHandle: winner.instagram_handle,
        claimDays: WINNER_CLAIM_DAYS,
        url: resultUrl,
      }).catch((err) => logger.error(`[GIVEAWAY] winner email failed: ${err.message}`));
    }
    const { error: nErr } = await supabase.from('notifications').insert({
      user_id: winner.user_id,
      type: 'giveaway_won',
      title: `You won the ${giveaway.title}`,
      body: prize?.label ? `Your pick, ${prize.label}, is yours. Check your email to claim it.` : 'Check your email to claim your prize.',
      link: `/giveaways/${giveaway.slug}`,
      related_id: winner.id,
    });
    if (nErr) logger.warn(`[GIVEAWAY] winner bell failed: ${nErr.message}`);

    res.json({
      giveaway: updated,
      winner: { id: winner.id, instagram_handle: winner.instagram_handle, prize, email: winner.email, name: winner.name },
      record,
    });
  } catch (error) {
    logger.error(`[GIVEAWAY] draw failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to run the draw' });
  }
});

router.use('/admin', admin);

// ─── Public ──────────────────────────────────────────────────────────────────

// The giveaway /giveaway should show: the open one closing soonest, else the
// most recently drawn or closed one.
router.get('/current', optionalAuthMiddleware, async (req, res) => {
  try {
    const nowIso = new Date().toISOString();
    const { data: open, error: e1 } = await supabase
      .from('giveaways')
      .select(PUBLIC_COLUMNS)
      .eq('status', 'open')
      .lte('opens_at', nowIso)
      .order('closes_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (e1) throw e1;
    let giveaway = open;
    if (!giveaway) {
      const { data: recent, error: e2 } = await supabase
        .from('giveaways')
        .select(PUBLIC_COLUMNS)
        .in('status', ['open', 'closed', 'drawn'])
        .order('closes_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (e2) throw e2;
      giveaway = recent;
    }
    if (!giveaway) return res.json({ giveaway: null });
    res.json(await publicPayload(giveaway, req.user?.id));
  } catch (error) {
    logger.error(`[GIVEAWAY] current failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to load giveaway' });
  }
});

router.get('/:slug', optionalAuthMiddleware, validateRequestParams(giveawaySlugSchema), async (req, res) => {
  try {
    const { data: giveaway, error } = await supabase
      .from('giveaways')
      .select(PUBLIC_COLUMNS)
      .eq('slug', req.params.slug)
      .maybeSingle();
    if (error) throw error;
    if (!isLive(giveaway)) return res.status(404).json({ error: 'Giveaway not found' });
    res.json(await publicPayload(giveaway, req.user?.id));
  } catch (error) {
    logger.error(`[GIVEAWAY] load ${req.params.slug} failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to load giveaway' });
  }
});

router.post('/:slug/enter', authMiddleware, validateRequestParams(giveawaySlugSchema), validateRequestBody(enterGiveawayBodySchema), async (req, res) => {
  // Honeypot: accept silently so a bot doesn't learn it was caught.
  if (req.body.company) return res.status(201).json({ ok: true });
  try {
    const { data: giveaway, error: gErr } = await supabase
      .from('giveaways')
      .select(PUBLIC_COLUMNS)
      .eq('slug', req.params.slug)
      .maybeSingle();
    if (gErr) throw gErr;
    if (!isLive(giveaway)) return res.status(404).json({ error: 'Giveaway not found' });
    if (giveawayPhase(giveaway) !== 'open') {
      return res.status(409).json({ error: 'This giveaway is not open for entries' });
    }

    const token = (req.headers.authorization || '').slice(7);
    const db = createUserScopedClient(token);
    const { data: entry, error } = await db
      .from('giveaway_entries')
      .insert({
        giveaway_id: giveaway.id,
        user_id: req.user.id,
        instagram_handle: normaliseInstagramHandle(req.body.instagramHandle),
        prize_key: giveaway.entry_mode === 'pick_prize' ? req.body.prizeKey : null,
        state: req.body.state,
        postcode: req.body.postcode,
        resident_confirmed: true,
        age_confirmed: true,
        newsletter_opt_in: req.body.newsletterOptIn === true,
      })
      .select(ENTRY_OWN_COLUMNS)
      .single();

    if (error) {
      if (error.code === '23505') {
        const onHandle = /one_per_handle/.test(error.message || '');
        return res.status(409).json({
          error: onHandle
            ? 'That Instagram account has already entered this giveaway'
            : 'You have already entered this giveaway',
        });
      }
      if (error.code === '22023' || error.code === '23514') {
        return res.status(400).json({ error: error.code === '23514' ? 'Check your details and try again' : error.message });
      }
      if (error.code === '42501') return res.status(403).json({ error: 'You can only enter as yourself' });
      throw error;
    }

    // Best-effort marketing opt-in; a Kit hiccup never fails the entry.
    if (entry.newsletter_opt_in && req.user.email) {
      subscribeToNewsletter(req.user.email, req.user.user_metadata?.full_name, {})
        .catch((err) => logger.warn(`[GIVEAWAY] newsletter opt-in failed for ${req.user.id}: ${err.message}`));
    }

    res.status(201).json({ ok: true, entry });
  } catch (error) {
    logger.error(`[GIVEAWAY] enter ${req.params.slug} failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to submit your entry' });
  }
});


export default router;
