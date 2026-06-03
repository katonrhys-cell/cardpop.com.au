import 'dotenv/config';
import express from 'express';
import supabase from '../../utils/supabaseClient.js';
import { authMiddleware } from '../../middleware/auth.js';
import { parseUserAgent } from '../../utils/deviceParser.js';
import logger from '../../utils/logger.js';

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  const { data: profile, error } = await supabase
    .from('profiles').select('active_sessions').eq('id', req.user.id).single();
  if (error) throw error;

  const devices = (profile?.active_sessions || []).map(session => {
    const parsed = parseUserAgent(session.deviceName);
    return {
      sessionId: session.sessionId,
      deviceName: session.deviceName,
      browser: parsed.browser,
      os: parsed.os,
      ipAddress: session.ipAddress,
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
      isCurrent: false,
    };
  });

  res.json({ devices });
});

router.post('/:sessionId/trust', authMiddleware, async (req, res) => {
  const { sessionId } = req.params;
  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

  const { data: profile, error } = await supabase
    .from('profiles').select('active_sessions').eq('id', req.user.id).single();
  if (error) throw error;

  const activeSessions = profile?.active_sessions || [];
  if (!activeSessions.find(s => s.sessionId === sessionId)) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ active_sessions: activeSessions.map(s => s.sessionId === sessionId ? { ...s, trusted: true } : s) })
    .eq('id', req.user.id);
  if (updateError) throw updateError;

  logger.info(`Session ${sessionId} marked as trusted for user ${req.user.id}`);
  res.json({ success: true, message: 'Device marked as trusted' });
});

export default router;
