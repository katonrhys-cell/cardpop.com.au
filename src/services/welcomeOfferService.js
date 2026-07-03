import crypto from 'crypto';
import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { sendWelcomeOffer } from '../utils/emailService.js';
import {
  WELCOME_TRIAL_DAYS,
  WELCOME_DISCOUNT_PCT,
  WELCOME_CODE_EXPIRY_DAYS,
  WELCOME_CODE_PREFIX,
  WELCOME_ISSUE_WINDOW_HOURS,
} from '../../config/welcomeOffer.js';

/**
 * Welcome-offer lifecycle: issue a unique code when a user registers, email it
 * to them separately from the verification email, then redeem it in two halves:
 *
 *  - trial:    sets profiles.trial_ends_at, which `can_sell()` (RLS) and the
 *              frontend's `canSell` already honour. subscription_status is left
 *              untouched so the trial expires naturally with the timestamp.
 *  - discount: validated at checkout and applied as a Stripe amount-off coupon
 *              covering DISCOUNT_PCT of the item subtotal (fees/GST excluded,
 *              seller proceeds unaffected — the platform funds the discount).
 *              Marked redeemed by the webhook only after payment completes.
 */

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

// No 0/O/1/I/L — codes get read out loud and typed from phone screens.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateCode() {
  const bytes = crypto.randomBytes(8);
  let body = '';
  for (let i = 0; i < 8; i++) {
    body += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return `${WELCOME_CODE_PREFIX}-${body.slice(0, 4)}-${body.slice(4)}`;
}

export function normaliseCode(code) {
  return String(code || '').trim().toUpperCase();
}

/**
 * Create (idempotently) the welcome offer for a freshly registered user and
 * send the offer email. Safe to call repeatedly — one row and one email per
 * user, ever. Returns { issued, emailed } for logging; callers should respond
 * generically regardless (the endpoint is unauthenticated).
 */
export async function issueWelcomeOffer(userId) {
  const { data: { user } = {}, error: userErr } = await supabase.auth.admin.getUserById(userId);
  if (userErr || !user) throw httpError(404, 'User not found');

  const accountAgeMs = Date.now() - new Date(user.created_at).getTime();
  if (!Number.isFinite(accountAgeMs) || accountAgeMs > WELCOME_ISSUE_WINDOW_HOURS * 3600 * 1000) {
    throw httpError(403, 'Welcome offers are only issued for new registrations');
  }

  let { data: offer } = await supabase
    .from('welcome_offers')
    .select('id, code, trial_days, discount_pct, expires_at, email_sent_at')
    .eq('user_id', userId)
    .maybeSingle();

  let issued = false;
  if (!offer) {
    const expiresAt = new Date(Date.now() + WELCOME_CODE_EXPIRY_DAYS * 86400 * 1000).toISOString();
    // Retry on the (astronomically unlikely) code collision; a concurrent
    // insert for the same user surfaces as a user_id conflict — re-read it.
    for (let attempt = 0; attempt < 3 && !offer; attempt++) {
      const { data: inserted, error: insertErr } = await supabase
        .from('welcome_offers')
        .insert({
          user_id: userId,
          code: generateCode(),
          trial_days: WELCOME_TRIAL_DAYS,
          discount_pct: WELCOME_DISCOUNT_PCT,
          expires_at: expiresAt,
        })
        .select('id, code, trial_days, discount_pct, expires_at, email_sent_at')
        .maybeSingle();

      if (inserted) {
        offer = inserted;
        issued = true;
      } else if (insertErr?.code === '23505') {
        const { data: existing } = await supabase
          .from('welcome_offers')
          .select('id, code, trial_days, discount_pct, expires_at, email_sent_at')
          .eq('user_id', userId)
          .maybeSingle();
        if (existing) offer = existing;
      } else if (insertErr) {
        throw insertErr;
      }
    }
    if (!offer) throw new Error('Could not create welcome offer');
  }

  let emailed = false;
  if (!offer.email_sent_at && user.email) {
    const name = user.user_metadata?.full_name?.split(' ')[0] || 'Collector';
    const ok = await sendWelcomeOffer({
      to: user.email,
      name,
      code: offer.code,
      trialDays: offer.trial_days,
      discountPct: Number(offer.discount_pct),
      expiresAt: offer.expires_at,
    });
    if (ok) {
      await supabase
        .from('welcome_offers')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', offer.id)
        .is('email_sent_at', null);
      emailed = true;
    }
  }

  logger.info(`[WELCOME] Offer for ${userId}: issued=${issued} emailed=${emailed}`);
  return { issued, emailed };
}

/** The authenticated user's own offer (for the account/checkout UI). */
export async function getWelcomeOffer(userId) {
  const { data } = await supabase
    .from('welcome_offers')
    .select('code, trial_days, discount_pct, expires_at, trial_redeemed_at, discount_redeemed_at')
    .eq('user_id', userId)
    .maybeSingle();
  return data || null;
}

/**
 * Redeem the trial half of the code: start the user's free selling trial by
 * setting trial_ends_at. Throws httpError(4xx) with a user-facing message.
 */
export async function redeemTrial(userId, rawCode) {
  const code = normaliseCode(rawCode);
  if (!code) throw httpError(400, 'Please enter your welcome code.');

  const { data: offer } = await supabase
    .from('welcome_offers')
    .select('id, code, trial_days, expires_at, trial_redeemed_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (!offer || normaliseCode(offer.code) !== code) {
    throw httpError(400, 'That code doesn’t match the welcome code we sent you.');
  }
  if (offer.trial_redeemed_at) throw httpError(409, 'This code’s free trial has already been claimed.');
  if (new Date(offer.expires_at).getTime() < Date.now()) throw httpError(410, 'This welcome code has expired.');

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, trial_ends_at')
    .eq('id', userId)
    .maybeSingle();

  const alreadyEntitled =
    ['trialing', 'active', 'grandfathered'].includes(profile?.subscription_status) ||
    (profile?.trial_ends_at && new Date(profile.trial_ends_at).getTime() > Date.now());
  if (alreadyEntitled) throw httpError(409, 'Your account can already sell — no trial needed.');

  // Guarded update wins the race if the same code is redeemed twice at once.
  const { data: claimed, error: claimErr } = await supabase
    .from('welcome_offers')
    .update({ trial_redeemed_at: new Date().toISOString() })
    .eq('id', offer.id)
    .is('trial_redeemed_at', null)
    .select('id');
  if (claimErr) throw claimErr;
  if (!claimed || claimed.length === 0) {
    throw httpError(409, 'This code’s free trial has already been claimed.');
  }

  const trialEndsAt = new Date(Date.now() + offer.trial_days * 86400 * 1000).toISOString();
  const { error: profileErr } = await supabase
    .from('profiles')
    .update({ trial_ends_at: trialEndsAt })
    .eq('id', userId);
  if (profileErr) {
    logger.error(`[WELCOME] Trial redeemed but profile update failed for ${userId}: ${profileErr.message}`);
    throw new Error('Could not start your trial — please contact support.');
  }

  logger.info(`[WELCOME] ${userId} redeemed trial via code (ends ${trialEndsAt})`);
  return { trialEndsAt, trialDays: offer.trial_days };
}

/**
 * Validate the discount half of the code for a checkout. Returns the offer row
 * when the code is valid and the discount unused; throws httpError otherwise.
 */
export async function validateWelcomeDiscount(userId, rawCode) {
  const code = normaliseCode(rawCode);
  if (!code) throw httpError(400, 'Please enter your welcome code.');

  const { data: offer } = await supabase
    .from('welcome_offers')
    .select('id, code, discount_pct, expires_at, discount_redeemed_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (!offer || normaliseCode(offer.code) !== code) {
    throw httpError(400, 'That promo code isn’t valid for your account.');
  }
  if (offer.discount_redeemed_at) throw httpError(409, 'This code’s first-order discount has already been used.');
  if (new Date(offer.expires_at).getTime() < Date.now()) throw httpError(410, 'This welcome code has expired.');

  return offer;
}

/** Cents off for an offer against an item subtotal (fees/GST excluded). */
export function welcomeDiscountCents(offer, itemsCents) {
  return Math.round(itemsCents * Number(offer.discount_pct) / 100);
}

/**
 * Create the single-use Stripe coupon carrying the discount for one checkout
 * session. Amount-off (not percent-off) so platform fees and the GST line are
 * never discounted — only the item subtotal is.
 */
export async function buildWelcomeDiscount(stripeClient, offer, itemsCents) {
  const discountCents = welcomeDiscountCents(offer, itemsCents);
  if (discountCents <= 0) return null;
  const coupon = await stripeClient.coupons.create({
    amount_off: discountCents,
    currency: 'aud',
    duration: 'once',
    name: `Welcome offer ${Number(offer.discount_pct)}% off`,
  });
  return { couponId: coupon.id, discountCents };
}

/** Called by the Stripe webhook once payment for a discounted order completes. */
export async function markWelcomeDiscountRedeemed(offerId, orderId = null) {
  const { error } = await supabase
    .from('welcome_offers')
    .update({ discount_redeemed_at: new Date().toISOString(), discount_order_id: orderId })
    .eq('id', offerId)
    .is('discount_redeemed_at', null);
  if (error) logger.error(`[WELCOME] Failed to mark discount redeemed for offer ${offerId}: ${error.message}`);
}
