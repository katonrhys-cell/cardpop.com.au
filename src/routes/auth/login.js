import 'dotenv/config';
import express from 'express';
import supabase from '../../utils/supabaseClient.js';
import logger from '../../utils/logger.js';

const router = express.Router();
const LOGIN_ATTEMPT_MAX_TRIES = parseInt(process.env.LOGIN_ATTEMPT_MAX_TRIES || '5', 10);
const LOGIN_ATTEMPT_LOCK_DURATION_MS = parseInt(process.env.LOGIN_ATTEMPT_LOCK_DURATION_MS || '900000', 10);

async function getAttemptRecord(email, ipAddress) {
  const { data } = await supabase
    .from('login_attempts')
    .select('*')
    .eq('email', email)
    .eq('ip_address', ipAddress)
    .maybeSingle();
  return data;
}

async function checkLoginAttempts(email, ipAddress) {
  try {
    const record = await getAttemptRecord(email, ipAddress);
    if (!record) return { allowed: true };

    const now = Date.now();
    const lockExpiry = record.locked_until ? new Date(record.locked_until).getTime() : 0;

    if (record.failed_attempts >= LOGIN_ATTEMPT_MAX_TRIES && now < lockExpiry) {
      logger.warn(`[LOGIN] Blocked for ${email} from ${ipAddress}`);
      return { allowed: false, lockedUntil: record.locked_until, message: 'Account temporarily locked due to too many failed login attempts' };
    }
    return { allowed: true };
  } catch (error) {
    logger.error('[LOGIN] Error checking login attempts:', error);
    return { allowed: true };
  }
}

async function recordFailedAttempt(email, ipAddress) {
  try {
    const record = await getAttemptRecord(email, ipAddress);
    const lockedUntil = new Date(Date.now() + LOGIN_ATTEMPT_LOCK_DURATION_MS).toISOString();

    if (!record) {
      await supabase.from('login_attempts').insert({ email, ip_address: ipAddress, failed_attempts: 1, locked_until: lockedUntil });
    } else {
      const newCount = record.failed_attempts + 1;
      await supabase.from('login_attempts').update({
        failed_attempts: newCount,
        locked_until: newCount >= LOGIN_ATTEMPT_MAX_TRIES ? lockedUntil : record.locked_until,
        updated_at: new Date().toISOString(),
      }).eq('id', record.id);
    }
  } catch (error) {
    logger.error('[LOGIN] Error recording failed attempt:', error);
  }
}

async function clearLoginAttempts(email, ipAddress) {
  try {
    await supabase.from('login_attempts').delete().eq('email', email).eq('ip_address', ipAddress);
    logger.info(`[LOGIN] Attempts cleared for ${email} from ${ipAddress}`);
  } catch (error) {
    logger.error('[LOGIN] Error clearing login attempts:', error);
  }
}

// Check if a login is allowed (rate-limit gate). The IP is always taken from
// the request server-side (never the body) — this prevents IP spoofing and,
// because lockouts are keyed on (email, ip), stops an attacker from clearing or
// poisoning a victim's lockout from a different IP.
router.post('/attempt', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const ipAddress = req.ip || 'unknown';

  const check = await checkLoginAttempts(email.trim().toLowerCase(), ipAddress);
  if (!check.allowed) return res.status(429).json({ error: check.message, lockedUntil: check.lockedUntil });
  res.json({ allowed: true });
});

// Record a failed login
router.post('/record-failure', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const ipAddress = req.ip || 'unknown';

  await recordFailedAttempt(email.trim().toLowerCase(), ipAddress);
  res.json({ success: true });
});

// Clear failed attempts after successful login
router.post('/record-success', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const ipAddress = req.ip || 'unknown';

  await clearLoginAttempts(email.trim().toLowerCase(), ipAddress);
  res.json({ success: true });
});

export default router;
