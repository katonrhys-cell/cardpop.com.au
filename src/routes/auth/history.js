import 'dotenv/config';
import express from 'express';
import pb from '../../utils/pocketbaseClient.js';
import { authMiddleware } from '../../middleware/auth.js';
import logger from '../../utils/logger.js';

const router = express.Router();

router.get('/login-history', authMiddleware, async (req, res) => {
  const auditLogs = await pb.collection('auditLogs').getFullList({
    filter: `userId = "${req.user.id}" && eventType = "login"`,
    sort: '-timestamp',
    limit: 10,
  });

  const history = auditLogs.map(log => ({
    timestamp: log.timestamp,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    status: log.status || 'success',
  }));

  res.json({ history });
});

export default router;