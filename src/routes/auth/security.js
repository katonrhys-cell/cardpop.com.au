import 'dotenv/config';
import express from 'express';
import pb from '../../utils/pocketbaseClient.js';
import { authMiddleware } from '../../middleware/auth.js';
import { parseUserAgent } from '../../utils/deviceParser.js';
import logger from '../../utils/logger.js';

const router = express.Router();

router.post('/suspicious-activity/check', async (req, res) => {
  const { userId, ipAddress, userAgent } = req.body;

  if (!userId || !ipAddress) {
    return res.status(400).json({ error: 'userId and ipAddress are required' });
  }

  const recentLogins = await pb.collection('auditLogs').getFullList({
    filter: `userId = "${userId}" && eventType = "login"`,
    sort: '-timestamp',
    limit: 10,
  });

  const currentDevice = parseUserAgent(userAgent || '');
  const alerts = [];

  const newIp = !recentLogins.some(log => log.ipAddress === ipAddress);
  if (newIp && recentLogins.length > 0) {
    alerts.push({
      type: 'new_ip',
      severity: 'medium',
      message: 'Login from a new IP address',
    });
  }

  const newDevice = !recentLogins.some(log => {
    const logDevice = parseUserAgent(log.userAgent || '');
    return logDevice.browser === currentDevice.browser && logDevice.os === currentDevice.os;
  });
  if (newDevice && recentLogins.length > 0) {
    alerts.push({
      type: 'new_device',
      severity: 'medium',
      message: 'Login from a new device',
    });
  }

  if (alerts.length > 0) {
    await pb.collection('securityAlerts').create({
      userId,
      alertType: alerts[0].type,
      severity: alerts[0].severity,
      description: alerts[0].message,
      ipAddress,
      userAgent,
      read: false,
      createdAt: new Date().toISOString(),
    });
  }

  res.json({
    suspicious: alerts.length > 0,
    alerts,
  });
});

router.get('/alerts', authMiddleware, async (req, res) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const alerts = await pb.collection('securityAlerts').getFullList({
    filter: `userId = "${req.user.id}" && createdAt >= "${thirtyDaysAgo}"`,
    sort: '-createdAt',
  });

  res.json({
    alerts: alerts.map(alert => ({
      id: alert.id,
      type: alert.alertType,
      severity: alert.severity,
      description: alert.description,
      ipAddress: alert.ipAddress,
      read: alert.read,
      createdAt: alert.createdAt,
    })),
  });
});

router.post('/alerts/mark-read', authMiddleware, async (req, res) => {
  const { alertId } = req.body;

  if (!alertId) {
    return res.status(400).json({ error: 'alertId is required' });
  }

  await pb.collection('securityAlerts').update(alertId, { read: true });

  logger.info(`Security alert ${alertId} marked as read for user ${req.user.id}`);

  res.json({
    success: true,
    message: 'Alert marked as read',
  });
});

export default router;