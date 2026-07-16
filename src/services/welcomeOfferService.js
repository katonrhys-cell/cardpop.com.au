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
 *  - trial:    the code confirms the 30-day free-trial offer, but the trial
 *              itself is always activated through the normal Stripe/PayPal
 *              card-on-file subscription flow (`StartTrialOptions`) — a payment
 *              method is required, and no charge happens until the trial ends.
 *              `validateTrialCode` only checks the code; `markTrialRedeemed` is
 *              called by the subscription webhooks once a trial actually starts.
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
 * Validate the trial half of the code. This does NOT start the trial — the
 * trial is always activated through the Stripe/PayPal card-on-file flow, and
 * the subscription webhooks call `markTrialRedeemed` once it actually starts.
 * Throws httpError(4xx) with a user-facing message.
 */
export async function validateTrialCode(userId, rawCode) {
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

  logger.info(`[WELCOME] ${userId} confirmed trial code — awaiting payment method`);
  return { trialDays: offer.trial_days };
}

/**
 * Consume the trial half of the code once a trial/subscription actually starts
 * (called by the Stripe/PayPal subscription webhooks). Best-effort and
 * idempotent — most users simply won't have an unredeemed offer.
 */
export async function markTrialRedeemed(userId) {
  if (!userId) return;
  const { error } = await supabase
    .from('welcome_offers')
    .update({ trial_redeemed_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('trial_redeemed_at', null);
  if (error) logger.warn(`[WELCOME] Failed to mark trial redeemed for ${userId}: ${error.message}`);
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

// A reservation older than this is treated as abandoned and reclaimable — a
// safety net so a missed checkout.session.expired webhook can't lock a buyer
// out of their own welcome discount indefinitely.
const RESERVATION_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Atomically claim the one-time welcome discount for a single in-flight
 * checkout. Prevents applying it to several concurrent checkouts (each of which
 * would otherwise mint its own platform-funded coupon). Throws httpError(409) if
 * the offer is already reserved by another live checkout.
 *
 * Race-free: the conditional UPDATE is a compare-and-swap — Postgres row locking
 * serialises concurrent calls, so the second sees the just-set reservation and
 * matches zero rows. Call ONLY at real checkout-session creation (never on the
 * price-preview path, which must not consume the offer).
 */
export async function reserveWelcomeDiscount(offerId) {
  const staleBefore = new Date(Date.now() - RESERVATION_TTL_MS).toISOString();
  const { data } = await supabase
    .from('welcome_offers')
    .update({ discount_reserved_at: new Date().toISOString() })
    .eq('id', offerId)
    .is('discount_redeemed_at', null)
    .or(`discount_reserved_at.is.null,discount_reserved_at.lt.${staleBefore}`)
    .select('id')
    .maybeSingle();
  if (!data) {
    throw httpError(409, 'A checkout using your welcome code is already in progress. Please finish or cancel it before starting another.');
  }
}

/** Release a welcome-discount reservation (e.g. when its checkout session expires). */
export async function releaseWelcomeDiscount(offerId) {
  if (!offerId) return;
  const { error } = await supabase
    .from('welcome_offers')
    .update({ discount_reserved_at: null })
    .eq('id', offerId)
    .is('discount_redeemed_at', null);
  if (error) logger.warn(`[WELCOME] Failed to release reservation for offer ${offerId}: ${error.message}`);
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
