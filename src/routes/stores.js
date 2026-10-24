import express from 'express';
import supabase from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { escapeLike } from '../utils/escapeLike.js';
import { authMiddleware, isAdminUser } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAal2.js';
import { sendSoleTraderChanged } from '../utils/emailService.js';
import { getAdminNotificationEmails } from '../utils/adminNotificationRecipient.js';

const router = express.Router();

const VALID_STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
const VALID_CITIES = [
  'sydney', 'newcastle', 'wollongong', 'central-coast', 'canberra',
  'melbourne', 'geelong', 'ballarat', 'bendigo',
  'adelaide', 'hobart', 'launceston',
  'brisbane', 'gold-coast', 'sunshine-coast', 'cairns', 'townsville', 'toowoomba',
  'perth', 'darwin',
];
const VALID_CATEGORIES = ['pokemon', 'tcg', 'sports', 'collectibles'];

const slugify = (str = '') => String(str)
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9\s-]/g, ' ')
  .trim()
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-');

const clean = (value, max) => String(value ?? '').trim().slice(0, max);

/**
 * POST /stores/sole-trader-change   { enabled: boolean }
 * Called by Account → Sole Trader right after a member switches Sole Trader
 * mode on or off. The profile is already saved (through RLS); this is the
 * server-side moment to tell admins — an email to every admin plus a bell.
 *
 * The state is re-read from the DB and the notice is only sent when it matches
 * `enabled`, so a client can't make us email admins about a change that never
 * happened. Best-effort: a failed email never fails the member's save.
 */
router.post('/sole-trader-change', authMiddleware, async (req, res) => {
  const enabled = req.body?.enabled;
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled must be true or false' });
  }
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, email, display_name, username, is_sole_trader, business_name, abn, store_slug')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!profile || Boolean(profile.is_sole_trader) !== enabled) {
      return res.json({ notified: false });
    }

    const userName = profile.display_name || profile.username || null;
    const userEmail = profile.email || req.user?.email || null;

    try {
      const { data: admins, error: adminsErr } = await supabase.from('profiles').select('id').eq('is_admin', true);
      if (adminsErr) throw adminsErr;
      if (admins?.length) {
        const { error: insertErr } = await supabase.from('notifications').insert(admins.map((a) => ({
          user_id: a.id,
          type: 'sole_trader_changed',
          title: `Sole trader mode ${enabled ? 'enabled' : 'disabled'}`,
          body: `${userName || 'A member'} switched sole trader mode ${enabled ? 'on' : 'off'}.`,
          link: `/admin/users/${userId}`,
          related_id: userId,
        })));
        if (insertErr) throw insertErr;
      }
    } catch (e) {
      logger.warn(`[STORES] sole-trader bell notification failed for ${userId}: ${e.message}`);
    }

    const to = await getAdminNotificationEmails();
    const sent = await sendSoleTraderChanged({
      to,
      enabled,
      userId,
      userName,
      userEmail,
      businessName: profile.business_name,
      abn: profile.abn,
      storeSlug: profile.store_slug,
    });
    return res.json({ notified: Boolean(sent) });
  } catch (err) {
    logger.error(`[STORES] sole-trader-change failed for ${userId}: ${err.message}`);
    return res.status(500).json({ error: 'Could not send the notification' });
  }
});

/**
 * POST /stores/submit
 * Public "add your store" submission. Row lands as status=pending and only
 * appears in the directory once approved from the admin dashboard.
 */
router.post('/submit', async (req, res) => {
  const body = req.body || {};

  // Honeypot: the form renders an invisible "company" field humans never fill.
  if (body.company) {
    return res.json({ ok: true });
  }

  const name = clean(body.name, 120);
  const suburb = clean(body.suburb, 80);
  const city = clean(body.city, 40).toLowerCase();
  const state = clean(body.state, 5).toUpperCase();
  const website = clean(body.website, 300);
  const description = clean(body.description, 500);
  const email = clean(body.email, 200);
  const categories = Array.isArray(body.categories)
    ? body.categories.filter((c) => VALID_CATEGORIES.includes(c)).slice(0, VALID_CATEGORIES.length)
    : [];

  if (name.length < 2) return res.status(400).json({ error: 'Store name is required' });
  if (!VALID_CITIES.includes(city)) return res.status(400).json({ error: 'Please choose a listed city/region' });
  if (!VALID_STATES.includes(state)) return res.status(400).json({ error: 'Please choose a valid state' });
  if (website && !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(website)) {
    return res.status(400).json({ error: 'Website must be a valid URL (starting with http:// or https://)' });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Contact email is not valid' });
  }
  // Links belong in the website field; URLs inside free-text fields are the
  // most common spam signature on public directory forms.
  if (/https?:\/\//i.test(name) || /https?:\/\//i.test(description)) {
    return res.status(400).json({ error: 'Please keep links to the website field' });
  }

  try {
    const baseSlug = slugify(`${name} ${suburb || city}`) || 'store';

    // Duplicate guard: same name in the same city (any status) is re-submitted
    // spam or an impatient owner — treat as accepted without a second row.
    const { data: existing, error: existingError } = await supabase
      .from('local_game_stores')
      .select('id')
      .ilike('name', escapeLike(name))
      .eq('city', city)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing) return res.json({ ok: true, duplicate: true });

    // Slugs must be unique across the table; suffix on collision.
    const { data: slugRows, error: slugError } = await supabase
      .from('local_game_stores')
      .select('slug')
      .like('slug', `${baseSlug}%`);
    if (slugError) throw new Error(slugError.message);
    const taken = new Set((slugRows || []).map((r) => r.slug));
    let slug = baseSlug;
    let n = 2;
    while (taken.has(slug)) slug = `${baseSlug}-${n++}`;

    const { error: insertError } = await supabase.from('local_game_stores').insert({
      slug,
      name,
      suburb: suburb || null,
      city,
      state,
      website: website || null,
      categories,
      description: description || null,
      submitter_email: email || null,
      submitted_by: req.user?.id || null,
      status: 'pending',
    });
    if (insertError) throw new Error(insertError.message);

    logger.info(`[STORES_SUBMIT] New pending store "${name}" (${city}, ${state})`);
    res.json({ ok: true });
  } catch (error) {
    logger.error(`[STORES_SUBMIT] ${error.message}`);
    res.status(500).json({ error: 'Submission failed. Please try again later.' });
  }
});

/**
 * GET /stores/admin
 * Admin-only full store list, including submitter_email — which the public
 * column grants deliberately hide from the anon client. Read with the service
 * role after an isAdminUser check so the moderation dashboard can still show the
 * submitter's contact.
 */
router.get('/admin', authMiddleware, requireAdmin, async (req, res) => {
  if (!(await isAdminUser(req))) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  try {
    const { data, error } = await supabase
      .from('local_game_stores')
      .select('id, slug, name, suburb, city, state, website, categories, description, status, submitter_email, created_at')
      .order('created_at', { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    res.json({ stores: data || [] });
  } catch (error) {
    logger.error(`[STORES_ADMIN] ${error.message}`);
    res.status(500).json({ error: 'Failed to load stores' });
  }
});

export default router;
