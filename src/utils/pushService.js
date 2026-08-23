import webpush from 'web-push';
import supabase from './supabaseClient.js';
import logger from './logger.js';

// Web push (VAPID). Fail-safe by design: with the keys unset every send is a
// silent no-op (mirrors emailService), so push can never break the flow that
// triggered it — an order must complete even if the push ecosystem is down.

let configured = null;

function ensureConfigured() {
  if (configured !== null) return configured;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    logger.warn('[PUSH] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY unset — web push disabled');
    configured = false;
    return configured;
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:noreply@cardpop.com.au',
    publicKey,
    privateKey,
  );
  configured = true;
  return configured;
}

export const isPushConfigured = () => ensureConfigured();
export const getVapidPublicKey = () => (ensureConfigured() ? process.env.VAPID_PUBLIC_KEY : null);

/**
 * Send a push notification to every subscribed device of one user.
 * Expired subscriptions (404/410 from the push service) are pruned as found.
 * Never throws.
 */
export async function sendPushToUser(userId, { title, body, url, tag } = {}) {
  if (!ensureConfigured() || !userId) return;
  try {
    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId);
    if (error || !subs?.length) return;

    const payload = JSON.stringify({ title, body, url, tag });
    await Promise.all(subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 24 * 60 * 60 },
        );
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
            .then(() => {}, () => {});
        } else {
          logger.warn(`[PUSH] send failed (user ${userId}): ${err.message}`);
        }
      }
    }));
  } catch (err) {
    logger.warn(`[PUSH] ${err.message}`);
  }
}
