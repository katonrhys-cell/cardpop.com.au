import 'dotenv/config';
import express from 'express';
import pb from '../../utils/pocketbaseClient.js';
import { authMiddleware } from '../../middleware/auth.js';
import { parseUserAgent } from '../../utils/deviceParser.js';
import logger from '../../utils/logger.js';

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  const user = await pb.collection('users').getOne(req.user.id);
  const sessions = user.activeSessions || [];

  const devices = sessions.map(session => {
    const parsed = parseUserAgent(session.deviceName);
    return {
      sessionId: session.sessionId,
      deviceName: session.deviceName,
      browser: parsed.browser,
      os: parsed.os,
      ipAddress: session.ipAddress,
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
      isCurrent: session.sessionId === req.headers.authorization?.substring(7),
    };
  });

  res.json({ devices });
});

router.post('/:sessionId/trust', authMiddleware, async (req, res) => {
  const { sessionId } = req.params;

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  const user = await pb.collection('users').getOne(req.user.id);
  const activeSessions = user.activeSessions || [];

  const sessionToTrust = activeSessions.find(s => s.sessionId === sessionId);
  if (!sessionToTrust) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const updatedSessions = activeSessions.map(s =>
    s.sessionId === sessionId ? { ...s, trusted: true } : s
  );

  await pb.collection('users').update(req.user.id, { activeSessions: updatedSessions });

  logger.info(`Device ${sessionId} marked as trusted for user ${req.user.id}`);

  res.json({
    success: true,
    message: 'Device marked as trusted',
  });
});

router.post('/:sessionId/untrust', authMiddleware, async (req, res) => {
  const { sessionId } = req.params;

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  const user = await pb.collection('users').getOne(req.user.id);
  const activeSessions = user.activeSessions || [];

  const sessionToUntrust = activeSessions.find(s => s.sessionId === sessionId);
  if (!sessionToUntrust) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const updatedSessions = activeSessions.map(s =>
    s.sessionId === sessionId ? { ...s, trusted: false } : s
  );

  await pb.collection('users').update(req.user.id, { activeSessions: updatedSessions });

  logger.info(`Device ${sessionId} marked as untrusted for user ${req.user.id}`);

  res.json({
    success: true,
    message: 'Device marked as untrusted',
  });
});

export default router;