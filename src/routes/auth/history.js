import 'dotenv/config';
import express from 'express';
import supabase from '../../utils/supabaseClient.js';
import { authMiddleware } from '../../middleware/auth.js';
import logger from '../../utils/logger.js';

const router = express.Router();

router.get('/login-history', authMiddleware, async (req, res) => {
  const { data: logs, error } = await supabase
    .from('audit_logs')
    .select('created_at, ip_address, user_agent, status')
    .eq('user_id', req.user.id)
    .eq('event_type', 'login')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw error;

  res.json({
    history: (logs || []).map(log => ({
      timestamp: log.created_at,
      ipAddress: log.ip_address,
      userAgent: log.user_agent,
      status: log.status || 'success',
    })),
  });
});

export default router;
