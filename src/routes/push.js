import { Router } from 'express';
import { z } from 'zod';
import supabase from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateRequestBody } from '../middleware/validateRequest.js';
import { getVapidPublicKey, sendPushToUser } from '../utils/pushService.js';

const router = Router();

const subscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
});

// Public: the VAPID application server key the browser subscribes with.
// null means push isn't configured on this deployment — the client hides the
// enable-push UI rather than erroring.
router.get('/public-key', (_req, res) => {
  res.json({ publicKey: getVapidPublicKey() });
});

// Store (or re-own) this browser's push subscription. Endpoints are unique:
// a subscription that reappears under a different signed-in user moves to
// them — a shared device should notify whoever is signed in now.
router.post('/subscribe', authMiddleware, validateRequestBody(subscribeSchema), async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: req.user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        user_agent: (req.headers['user-agent'] || '').slice(0, 512) || null,
      }, { onConflict: 'endpoint' });
    if (error) throw error;
    res.status(201).json({ success: true });
  } catch (error) {
    logger.error('Error saving push subscription:', error);
    res.status(500).json({ error: 'Failed to save push subscription' });
  }
});

// Remove this browser's subscription for the signed-in user.
router.post('/unsubscribe', authMiddleware, validateRequestBody(unsubscribeSchema), async (req, res) => {
  try {
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', req.body.endpoint)
      .eq('user_id', req.user.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    logger.error('Error removing push subscription:', error);
    res.status(500).json({ error: 'Failed to remove push subscription' });
  }
});

// Called by the notifications_push_dispatch DB trigger on every notifications
// INSERT (Database-Webhook payload: { type, table, record, … }). Unauthenticated
// by design, made safe by an atomic claim: the notification row is looked up
// fresh and pushed_at set in one conditional update, so a replayed or spoofed
// call can at most cause one push of a real, unclaimed notification — it can
// never invent content or send twice.
router.post('/dispatch', async (req, res) => {
  const id = req.body?.record?.id;
  if (!id) return res.status(400).json({ error: 'No notification id' });
  try {
    const { data: claimed, error } = await supabase
      .from('notifications')
      .update({ pushed_at: new Date().toISOString() })
      .eq('id', id)
      .is('pushed_at', null)
      .select('user_id, type, title, body, link')
      .maybeSingle();
    if (error) throw error;
    if (!claimed?.user_id) return res.json({ sent: false });

    await sendPushToUser(claimed.user_id, {
      title: claimed.title || 'CardPop',
      body: claimed.body || '',
      url: claimed.link || '/account/notifications',
      tag: claimed.type || 'cardpop',
    });
    res.json({ sent: true });
  } catch (error) {
    logger.error('Error dispatching push:', error);
    res.status(500).json({ error: 'Failed to dispatch push' });
  }
});

export default router;
