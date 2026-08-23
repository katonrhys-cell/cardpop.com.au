import { Router } from 'express';
import supabase from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// How many watchlists a listing sits on. Watchlist rows are private per-user
// under RLS, so the aggregate is served here with the service-role client —
// only the count ever leaves the server, never who is watching.
router.get('/:listingId/watchers', async (req, res) => {
  const { listingId } = req.params;
  if (!UUID_RE.test(listingId)) {
    return res.status(400).json({ error: 'Invalid listing id' });
  }
  try {
    const { count, error } = await supabase
      .from('watchlist')
      .select('id', { count: 'exact', head: true })
      .eq('listing_id', listingId);
    if (error) throw error;
    res.json({ watchers: count ?? 0 });
  } catch (error) {
    logger.error('Error counting watchers:', error);
    res.status(500).json({ error: 'Failed to count watchers' });
  }
});

export default router;
