import 'dotenv/config';
import supabase from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';

const SESSION_TIMEOUT_MS = parseInt(process.env.SESSION_TIMEOUT_MS || '1800000', 10);

async function sessionTimeoutMiddleware(req, res, next) {
  if (!req.user) return next();

  try {
    const userId = req.user.id;
    const token = req.headers.authorization?.substring(7);

    const { data: profile } = await supabase
      .from('user_security')
      .select('active_sessions')
      .eq('user_id', userId)
      .single();

    const sessions = profile?.active_sessions || [];
    if (sessions.length === 0) return next();

    const currentSession = sessions.find(s => s.sessionId === token);
    if (!currentSession) return next();

    const inactiveTime = Date.now() - new Date(currentSession.lastActivityAt).getTime();

    if (inactiveTime > SESSION_TIMEOUT_MS) {
      await supabase.from('user_security')
        .update({ active_sessions: sessions.filter(s => s.sessionId !== token) })
        .eq('user_id', userId);
      return res.status(401).json({ error: 'Session expired due to inactivity' });
    }

    // Update lastActivityAt
    await supabase.from('user_security')
      .update({ active_sessions: sessions.map(s => s.sessionId === token ? { ...s, lastActivityAt: new Date().toISOString() } : s) })
      .eq('user_id', userId);

    next();
  } catch (error) {
    logger.error('Session timeout middleware error:', error);
    next();
  }
}

export { sessionTimeoutMiddleware };
