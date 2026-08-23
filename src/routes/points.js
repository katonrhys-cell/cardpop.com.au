import { Router } from 'express';
import supabase from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Daily claim pays a random amount in this range — a small dice-roll beats a
// flat number for making the claim worth tapping (the Courtyard pattern).
const DAILY_CLAIM_MIN = 5;
const DAILY_CLAIM_MAX = 25;

const utcDayStart = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
};

const utcMonthStart = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
};

// The signed-in user's points: lifetime and this-month totals, whether
// today's claim is still available, and the recent ledger.
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const uid = req.user.id;
    const [allRes, claimRes, recentRes] = await Promise.all([
      supabase.from('points_ledger').select('points, created_at').eq('user_id', uid),
      supabase.from('points_ledger').select('id', { count: 'exact', head: true })
        .eq('user_id', uid).eq('reason', 'daily_claim').gte('created_at', utcDayStart()),
      supabase.from('points_ledger').select('points, reason, created_at')
        .eq('user_id', uid).order('created_at', { ascending: false }).limit(20),
    ]);
    if (allRes.error) throw allRes.error;

    const monthStart = utcMonthStart();
    const total = (allRes.data || []).reduce((s, r) => s + r.points, 0);
    const monthTotal = (allRes.data || [])
      .filter(r => r.created_at >= monthStart)
      .reduce((s, r) => s + r.points, 0);

    res.json({
      total,
      monthTotal,
      claimedToday: (claimRes.count ?? 0) > 0,
      recent: recentRes.data || [],
    });
  } catch (error) {
    logger.error('Error fetching points:', error);
    res.status(500).json({ error: 'Failed to fetch points' });
  }
});

// Claim today's points. The partial unique index on (user, UTC day) is the
// real gate — a double claim comes back as a 23505 conflict, never two rows.
router.post('/claim', authMiddleware, async (req, res) => {
  try {
    const points = DAILY_CLAIM_MIN + Math.floor(Math.random() * (DAILY_CLAIM_MAX - DAILY_CLAIM_MIN + 1));
    const { error } = await supabase
      .from('points_ledger')
      .insert({ user_id: req.user.id, points, reason: 'daily_claim' });
    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Already claimed today — come back tomorrow!' });
      }
      throw error;
    }
    res.status(201).json({ points });
  } catch (error) {
    logger.error('Error claiming daily points:', error);
    res.status(500).json({ error: 'Failed to claim points' });
  }
});

// Public: this month's top collectors.
router.get('/leaderboard', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .rpc('points_leaderboard', { p_since: utcMonthStart(), p_limit: 20 });
    if (error) throw error;
    res.json({ since: utcMonthStart(), leaders: data || [] });
  } catch (error) {
    logger.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

export default router;
