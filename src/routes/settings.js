import { Router } from 'express';
import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';

const router = Router();

// Platform settings that are safe to expose to ANY client, including logged-out
// visitors — feature flags, the maintenance switch, and listing-form limits.
// Each carries a typed default so the app renders correctly before a row exists
// (the table is seeded lazily by the admin Settings page) and if the read fails.
// Security-sensitive switches (email_verification_required, require_mfa_admins)
// are deliberately excluded — they're enforced server-side, never trusted from
// the client, so there's no reason to publish them.
const PUBLIC_SETTINGS = {
  site_name: 'CardPop',
  maintenance_mode: false,
  enable_marketplace: true,
  // Trading defaults OFF: the propose-trade flow isn't built yet, so every
  // trade surface stays hidden until an admin explicitly switches it on
  // (Admin → Settings). Flip this default back to true once trading ships.
  enable_trading: false,
  enable_blog: true,
  max_images_per_listing: 10,
  listing_approval_required: false,
};

// platform_settings.value is jsonb: booleans store as real JSON booleans, but
// the admin number inputs store as strings ('10'). Coerce each value to the
// shape of its default so consumers get a clean boolean/number/string.
function coerce(defaultValue, value) {
  if (value === undefined || value === null) return defaultValue;
  if (typeof defaultValue === 'boolean') return value === true || value === 'true';
  if (typeof defaultValue === 'number') {
    const n = Number(value);
    return Number.isFinite(n) ? n : defaultValue;
  }
  return String(value);
}

// GET /settings/public — no auth. Returns the whitelist above, merged over any
// stored overrides. Fails open to defaults so a settings-table outage can never
// take the whole site down (or falsely trip maintenance mode).
router.get('/public', async (_req, res) => {
  const out = { ...PUBLIC_SETTINGS };
  try {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('key, value')
      .in('key', Object.keys(PUBLIC_SETTINGS));
    if (error) throw error;
    for (const row of data || []) {
      if (row.key in out) out[row.key] = coerce(PUBLIC_SETTINGS[row.key], row.value);
    }
  } catch (err) {
    logger.error(`[SETTINGS] public read failed, serving defaults: ${err.message}`);
  }
  // Identical for every visitor and fetched on every SPA boot — let the
  // Cloudflare edge absorb it (overrides the API-wide no-store default).
  // s-maxage 60 keeps a maintenance-mode flip visible within a minute.
  res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  res.removeHeader('Pragma');
  res.removeHeader('Expires');
  res.json(out);
});

export default router;
export { PUBLIC_SETTINGS, coerce };
