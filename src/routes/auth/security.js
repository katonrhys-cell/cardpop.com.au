import 'dotenv/config';
import express from 'express';
import supabase from '../../utils/supabaseClient.js';
import { authMiddleware } from '../../middleware/auth.js';
import { parseUserAgent } from '../../utils/deviceParser.js';
import logger from '../../utils/logger.js';

const router = express.Router();

router.post('/suspicious-activity/check', async (req, res) => {
  const { userId, ipAddress, userAgent } = req.body;
  if (!userId || !ipAddress) return res.status(400).json({ error: 'userId and ipAddress are required' });

  const { data: recentLogins } = await supabase
    .from('audit_logs')
    .select('ip_address, user_agent')
    .eq('user_id', userId)
    .eq('event_type', 'login')
    .order('created_at', { ascending: false })
    .limit(10);

  const currentDevice = parseUserAgent(userAgent || '');
  const logs = recentLogins || [];
  const alerts = [];

  if (logs.length > 0 && !logs.some(l => l.ip_address === ipAddress)) {
    alerts.push({ type: 'new_ip', severity: 'medium', message: 'Login from a new IP address' });
  }
  if (logs.length > 0 && !logs.some(l => {
    const d = parseUserAgent(l.user_agent || '');
    return d.browser === currentDevice.browser && d.os === currentDevice.os;
  })) {
    alerts.push({ type: 'new_device', severity: 'medium', message: 'Login from a new device' });
  }

  if (alerts.length > 0) {
    await supabase.from('security_alerts').insert({
      user_id: userId,
      alert_type: alerts[0].type,
      severity: alerts[0].severity,
      description: alerts[0].message,
      ip_address: ipAddress,
      user_agent: userAgent,
    });
  }

  res.json({ suspicious: alerts.length > 0, alerts });
});

router.get('/alerts', authMiddleware, async (req, res) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: alerts, error } = await supabase
    .from('security_alerts')
    .select('*')
    .eq('user_id', req.user.id)
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: false });

  if (error) throw error;

  res.json({
    alerts: (alerts || []).map(a => ({
      id: a.id,
      type: a.alert_type,
      severity: a.severity,
      description: a.description,
      ipAddress: a.ip_address,
      read: a.read,
      createdAt: a.created_at,
    })),
  });
});

router.post('/alerts/mark-read', authMiddleware, async (req, res) => {
  const { alertId } = req.body;
  if (!alertId) return res.status(400).json({ error: 'alertId is required' });

  const { error } = await supabase
    .from('security_alerts')
    .update({ read: true })
    .eq('id', alertId)
    .eq('user_id', req.user.id);
  if (error) throw error;

  logger.info(`Security alert ${alertId} marked as read for user ${req.user.id}`);
  res.json({ success: true, message: 'Alert marked as read' });
});

export default router;
