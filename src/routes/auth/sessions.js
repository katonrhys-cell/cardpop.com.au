import 'dotenv/config';
import express from 'express';
import supabase from '../../utils/supabaseClient.js';
import { authMiddleware } from '../../middleware/auth.js';
import { getDeviceName } from '../../utils/deviceParser.js';
import logger from '../../utils/logger.js';

const router = express.Router();

router.post('/create', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const { data: profile, error } = await supabase
    .from('profiles').select('active_sessions').eq('id', userId).single();
  if (error) throw error;

  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const deviceName = getDeviceName(req.headers['user-agent'] || '');
  const ipAddress = req.ip || req.connection?.remoteAddress;
  const now = new Date().toISOString();

  const newSession = { sessionId, deviceName, ipAddress, createdAt: now, lastActivityAt: now };
  const activeSessions = [...(profile?.active_sessions || []), newSession];

  const { error: updateError } = await supabase
    .from('profiles').update({ active_sessions: activeSessions }).eq('id', userId);
  if (updateError) throw updateError;

  logger.info(`Session created for user ${userId}`);
  res.json({ sessionId, deviceName, createdAt: now });
});

router.get('/', authMiddleware, async (req, res) => {
  const { data: profile, error } = await supabase
    .from('profiles').select('active_sessions').eq('id', req.user.id).single();
  if (error) throw error;

  res.json({
    sessions: (profile?.active_sessions || []).map(s => ({
      sessionId: s.sessionId,
      deviceName: s.deviceName,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt,
      lastActivityAt: s.lastActivityAt,
    })),
  });
});

router.post('/logout-other', authMiddleware, async (req, res) => {
  const { currentSessionId } = req.body;
  if (!currentSessionId) return res.status(400).json({ error: 'currentSessionId is required' });

  const { data: profile, error } = await supabase
    .from('profiles').select('active_sessions').eq('id', req.user.id).single();
  if (error) throw error;

  const updatedSessions = (profile?.active_sessions || []).filter(s => s.sessionId === currentSessionId);
  await supabase.from('profiles').update({ active_sessions: updatedSessions }).eq('id', req.user.id);
  await supabase.from('audit_logs').insert({
    user_id: req.user.id, event_type: 'logout_other_sessions',
    description: 'User logged out all other sessions',
    ip_address: req.ip || 'unknown', user_agent: req.headers['user-agent'] || 'unknown', status: 'success',
  });

  logger.info(`Logged out other sessions for user ${req.user.id}`);
  res.json({ success: true, message: 'All other sessions logged out' });
});

router.delete('/:sessionId', authMiddleware, async (req, res) => {
  const { sessionId } = req.params;
  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

  const { data: profile, error } = await supabase
    .from('profiles').select('active_sessions').eq('id', req.user.id).single();
  if (error) throw error;

  const sessions = profile?.active_sessions || [];
  const sessionToRevoke = sessions.find(s => s.sessionId === sessionId);
  if (!sessionToRevoke) return res.status(404).json({ error: 'Session not found' });

  await supabase.from('profiles')
    .update({ active_sessions: sessions.filter(s => s.sessionId !== sessionId) })
    .eq('id', req.user.id);
  await supabase.from('audit_logs').insert({
    user_id: req.user.id, event_type: 'session_revoked',
    description: `Session revoked: ${sessionToRevoke.deviceName}`,
    ip_address: req.ip || 'unknown', user_agent: req.headers['user-agent'] || 'unknown', status: 'success',
  });

  logger.info(`Session ${sessionId} revoked for user ${req.user.id}`);
  res.json({ success: true, message: 'Session revoked' });
});

export default router;
