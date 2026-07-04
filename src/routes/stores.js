import express from 'express';
import supabase from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';

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
      .ilike('name', name)
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

export default router;
