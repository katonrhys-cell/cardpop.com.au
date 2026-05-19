import 'dotenv/config';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';

const SESSION_TIMEOUT_MS = parseInt(process.env.SESSION_TIMEOUT_MS || '1800000', 10);

async function sessionTimeoutMiddleware(req, res, next) {
  if (!req.user) {
    return next();
  }

  try {
    const userId = req.user.id;
    const user = await pb.collection('users').getOne(userId);

    if (!user.activeSessions || user.activeSessions.length === 0) {
      return res.status(401).json({ error: 'No active sessions' });
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.substring(7);

    const currentSession = user.activeSessions.find(s => s.sessionId === token);

    if (!currentSession) {
      return res.status(401).json({ error: 'Session not found' });
    }

    const lastActivityTime = new Date(currentSession.lastActivityAt).getTime();
    const now = Date.now();
    const inactiveTime = now - lastActivityTime;

    if (inactiveTime > SESSION_TIMEOUT_MS) {
      const updatedSessions = user.activeSessions.filter(s => s.sessionId !== token);
      await pb.collection('users').update(userId, { activeSessions: updatedSessions });
      return res.status(401).json({ error: 'Session expired due to inactivity' });
    }

    const updatedSessions = user.activeSessions.map(s =>
      s.sessionId === token ? { ...s, lastActivityAt: new Date().toISOString() } : s
    );
    await pb.collection('users').update(userId, { activeSessions: updatedSessions });

    next();
  } catch (error) {
    logger.error('Session timeout middleware error:', error);
    next();
  }
}

export { sessionTimeoutMiddleware };