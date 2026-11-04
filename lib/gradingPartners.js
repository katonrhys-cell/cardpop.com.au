// Supabase read for the grading submission partners. Pure helpers live in
// utils/gradingPartners.js; the starting list is data/gradingPartnersSeed.js.
import { supabase } from '@/lib/supabaseClient.js';
import { GRADING_PARTNERS_SEED } from '@/data/gradingPartnersSeed.js';

export const GRADING_PARTNER_COLUMNS = [
  'id', 'slug', 'name', 'website', 'location', 'description', 'companies', 'company_links',
  'categories', 'sort_order', 'is_active',
].join(',');

// Admin view adds the private notes and timestamps.
export const GRADING_PARTNER_ADMIN_COLUMNS = `${GRADING_PARTNER_COLUMNS},notes,created_at,updated_at`;

// A few dozen businesses at most; the page reads them once.
export const GRADING_PARTNERS_LIMIT = 200;

/**
 * Every active partner in display order. If the table can't be read (the
 * migration hasn't landed, or the request failed) the seed list is returned
 * with `fromSeed: true` so the page still shows something — never an empty grid.
 */
export async function fetchActiveGradingPartners() {
  try {
    const { data, error } = await supabase
      .from('grading_submission_partners')
      .select(GRADING_PARTNER_COLUMNS)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
      .limit(GRADING_PARTNERS_LIMIT);
    if (error) throw error;
    return { partners: data || [], fromSeed: false };
  } catch (err) {
    if (import.meta.env?.DEV) console.warn('[gradingPartners] falling back to the seed list:', err?.message || err);
    return { partners: GRADING_PARTNERS_SEED, fromSeed: true };
  }
}
