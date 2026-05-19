import 'dotenv/config';
import express from 'express';
import pb from '../../utils/pocketbaseClient.js';
import { authMiddleware } from '../../middleware/auth.js';
import { getDeviceName } from '../../utils/deviceParser.js';
import logger from '../../utils/logger.js';

const router = express.Router();

router.post('/create', async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const user = await pb.collection('users').getOne(userId);
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const deviceName = getDeviceName(req.headers['user-agent'] || '');
  const ipAddress = req.ip || req.connection.remoteAddress;

  const newSession = {
    sessionId,
    deviceName,
    ipAddress,
    createdAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
  };

  const activeSessions = user.activeSessions || [];
  activeSessions.push(newSession);

  await pb.collection('users').update(userId, { activeSessions });

  logger.info(`Session created for user ${userId}`);

  res.json({
    sessionId,
    deviceName,
    createdAt: newSession.createdAt,
  });
});

router.get('/', authMiddleware, async (req, res) => {
  const user = await pb.collection('users').getOne(req.user.id);
  const sessions = user.activeSessions || [];

  res.json({
    sessions: sessions.map(s => ({
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

  if (!currentSessionId) {
    return res.status(400).json({ error: 'currentSessionId is required' });
  }

  const user = await pb.collection('users').getOne(req.user.id);
  const activeSessions = user.activeSessions || [];

  const updatedSessions = activeSessions.filter(s => s.sessionId === currentSessionId);

  await pb.collection('users').update(req.user.id, { activeSessions: updatedSessions });

  // Log the action
  await pb.collection('auditLogs').create({
    userId: req.user.id,
    eventType: 'logout_other_sessions',
    description: 'User logged out all other sessions',
    ipAddress: req.ip || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    status: 'success',
    timestamp: new Date().toISOString(),
  });

  logger.info(`Logged out other sessions for user ${req.user.id}`);

  res.json({
    success: true,
    message: 'All other sessions logged out',
  });
});

router.delete('/:sessionId', authMiddleware, async (req, res) => {
  const { sessionId } = req.params;

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  const user = await pb.collection('users').getOne(req.user.id);
  const activeSessions = user.activeSessions || [];

  const sessionToRevoke = activeSessions.find(s => s.sessionId === sessionId);
  if (!sessionToRevoke) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const updatedSessions = activeSessions.filter(s => s.sessionId !== sessionId);

  await pb.collection('users').update(req.user.id, { activeSessions: updatedSessions });

  // Log the action
  await pb.collection('auditLogs').create({
    userId: req.user.id,
    eventType: 'session_revoked',
    description: `Session revoked: ${sessionToRevoke.deviceName}`,
    ipAddress: req.ip || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    status: 'success',
    timestamp: new Date().toISOString(),
  });

  logger.info(`Session ${sessionId} revoked for user ${req.user.id}`);

  res.json({
    success: true,
    message: 'Session revoked',
  });
});

export default router;