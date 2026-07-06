import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';

/**
 * Partner program: approved partners (local game stores, content creators)
 * hold a vanity referral code that does three jobs at once:
 *
 *  - discount:   a referred customer enters the code at checkout (or arrives
 *                via ?ref=CODE, which pre-fills it) and gets the partner's
 *                discount_pct off the SHOP-item subtotal. Platform-funded,
 *                applied as a single-use Stripe amount-off coupon — the same
 *                mechanism as the welcome offer.
 *  - commission: each referred purchase writes a partner_referrals ledger row.
 *                Commission is commission_pct of the shop-item subtotal AFTER
 *                the discount (fees/GST/shipping excluded), or of the first
 *                subscription payment for seller-membership referrals.
 *  - tracking:   ?ref=CODE visits bump the partner's click counter
 *                (session-only attribution — the code is kept in
 *                sessionStorage and auto-applied at checkout).
 *
 * Payouts ride the existing Stripe Connect rails: pending ledger rows are
 * transferred to the partner's connected account from the admin dashboard.
 */

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

const PARTNER_TYPES = ['local_game_store', 'content_creator', 'other'];

// Welcome codes are POP-XXXX-XXXX; partner codes must not collide with that
// namespace so checkout can route a promo code to the right validator.
const WELCOME_CODE_SHAPE = /^POP-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
// 4–20 chars, letters/digits/hyphens, must start with a letter or digit.
const PARTNER_CODE_SHAPE = /^[A-Z0-9][A-Z0-9-]{3,19}$/;

export function normalisePartnerCode(code) {
  return String(code || '').trim().toUpperCase();
}

export function isWelcomeCodeFormat(code) {
  return WELCOME_CODE_SHAPE.test(normalisePartnerCode(code));
}

export function validatePartnerCodeFormat(rawCode) {
  const code = normalisePartnerCode(rawCode);
  if (!PARTNER_CODE_SHAPE.test(code)) {
    throw httpError(400, 'Codes are 4–20 characters: letters, numbers and hyphens.');
  }
  if (isWelcomeCodeFormat(code)) {
    throw httpError(400, 'That code format is reserved for welcome offers.');
  }
  return code;
}

const clean = (value, max) => String(value ?? '').trim().slice(0, max);

/**
 * Create a pending partner application for the authenticated user.
 * One application per user, ever — a resubmission returns the existing row.
 */
export async function submitPartnerApplication(userId, body = {}) {
  const partnerType = clean(body.partnerType, 30);
  const businessName = clean(body.businessName, 120);
  const website = clean(body.website, 300);
  const socials = clean(body.socials, 500);
  const abn = clean(body.abn, 20).replace(/\s/g, '');
  const phone = clean(body.phone, 30);
  const pitch = clean(body.pitch, 1500);
  const localGameStoreId = clean(body.localGameStoreId, 60) || null;
  let preferredCode = clean(body.preferredCode, 20);

  if (!PARTNER_TYPES.includes(partnerType)) {
    throw httpError(400, 'Please choose what best describes you.');
  }
  if (businessName.length < 2) {
    throw httpError(400, 'Business or creator name is required.');
  }
  if (pitch.length < 20) {
    throw httpError(400, 'Tell us a little more about your store or audience (at least 20 characters).');
  }
  if (website && !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(website)) {
    throw httpError(400, 'Website must be a valid URL (starting with http:// or https://).');
  }
  if (abn && !/^\d{11}$/.test(abn)) {
    throw httpError(400, 'An ABN is 11 digits.');
  }
  if (preferredCode) {
    preferredCode = validatePartnerCodeFormat(preferredCode);
  }
  // Links belong in the website/socials fields — URLs in free text are the
  // most common spam signature on public application forms.
  if (/https?:\/\//i.test(businessName) || /https?:\/\//i.test(pitch)) {
    throw httpError(400, 'Please keep links to the website and socials fields.');
  }

  if (localGameStoreId) {
    const { data: store } = await supabase
      .from('local_game_stores')
      .select('id')
      .eq('id', localGameStoreId)
      .maybeSingle();
    if (!store) throw httpError(400, 'That store listing could not be found.');
  }

  const { data: inserted, error } = await supabase
    .from('partners')
    .insert({
      user_id: userId,
      partner_type: partnerType,
      business_name: businessName,
      website: website || null,
      socials: socials || null,
      abn: abn || null,
      phone: phone || null,
      pitch: pitch || null,
      preferred_code: preferredCode || null,
      local_game_store_id: localGameStoreId,
      status: 'pending',
    })
    .select('id, status, created_at')
    .maybeSingle();

  if (error) {
    if (error.code === '23505') {
      const { data: existing } = await supabase
        .from('partners')
        .select('id, status, created_at')
        .eq('user_id', userId)
        .maybeSingle();
      if (existing) return { ...existing, duplicate: true };
    }
    logger.error(`[PARTNER] Application insert failed for ${userId}: ${error.message}`);
    throw new Error('Could not submit your application. Please try again.');
  }

  logger.info(`[PARTNER] New application from ${userId} (${partnerType}: ${businessName})`);
  return inserted;
}

/**
 * The authenticated user's partner record with dashboard stats: click count,
 * referral totals and the earnings ledger.
 */
export async function getPartnerDashboard(userId) {
  const { data: partner } = await supabase
    .from('partners')
    .select('id, partner_type, business_name, website, socials, abn, phone, pitch, preferred_code, code, discount_pct, commission_pct, free_shipping, status, clicks, approved_at, created_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (!partner) return null;

  const { data: referrals } = await supabase
    .from('partner_referrals')
    .select('id, kind, sale_amount_cents, discount_cents, commission_cents, status, created_at, paid_at')
    .eq('partner_id', partner.id)
    .order('created_at', { ascending: false })
    .limit(100);

  const rows = referrals || [];
  const sum = (filter) => rows.filter(filter).reduce((n, r) => n + r.commission_cents, 0);

  return {
    partner,
    referrals: rows,
    stats: {
      clicks: partner.clicks,
      referredOrders: rows.length,
      pendingCents: sum((r) => r.status === 'pending'),
      paidCents: sum((r) => r.status === 'paid'),
    },
  };
}

/**
 * Resolve a promo code to an approved partner for a checkout by `userId`.
 * Throws httpError(4xx) with a user-facing message when invalid.
 */
export async function validatePartnerCode(userId, rawCode) {
  const code = normalisePartnerCode(rawCode);
  if (!code) throw httpError(400, 'Please enter a promo code.');

  const { data: partner } = await supabase
    .from('partners')
    .select('id, user_id, code, discount_pct, commission_pct, free_shipping, status')
    .ilike('code', code)
    .maybeSingle();

  if (!partner || partner.status !== 'approved') {
    throw httpError(400, 'That promo code isn’t valid.');
  }
  if (partner.user_id === userId) {
    throw httpError(403, 'You can’t use your own partner code.');
  }
  return partner;
}

/**
 * Partner discounts apply to the platform's own shop items only — marketplace
 * listings belong to peer sellers and aren't part of the program.
 * @returns cents of the cart's shop-item subtotal
 */
export function shopItemsCents(orderLines) {
  return (orderLines || [])
    .filter((l) => l.type === 'shop')
    .reduce((n, l) => n + Math.round(Number(l.line_total_aud || 0) * 100), 0);
}

/** Cents off for a partner code against a cart's shop-item subtotal. */
export function partnerDiscountCents(partner, orderLines) {
  return Math.round(shopItemsCents(orderLines) * Number(partner.discount_pct) / 100);
}

/**
 * Create the single-use Stripe coupon carrying the discount for one checkout
 * session. Amount-off (not percent-off) so fees, GST and marketplace items are
 * never discounted — only the shop-item subtotal is.
 */
export async function buildPartnerDiscount(stripeClient, partner, discountCents) {
  if (discountCents <= 0) return null;
  const coupon = await stripeClient.coupons.create({
    amount_off: discountCents,
    currency: 'aud',
    duration: 'once',
    name: `Partner ${partner.code} ${Number(partner.discount_pct)}% off`,
  });
  return { couponId: coupon.id, discountCents };
}

/**
 * Book the commission for a paid, referred shop order. Called by the Stripe
 * webhook after payment confirms. Idempotent per order (unique index) and
 * best-effort — a booking failure must never fail order fulfilment.
 */
export async function recordShopOrderReferral({ partnerId, orderId, referredUserId, orderLines, discountCents }) {
  if (!partnerId) return;
  try {
    const { data: partner } = await supabase
      .from('partners')
      .select('id, commission_pct, status')
      .eq('id', partnerId)
      .maybeSingle();
    if (!partner || partner.status !== 'approved') {
      logger.warn(`[PARTNER] Skipping referral for order ${orderId}: partner ${partnerId} not approved`);
      return;
    }

    // Commission base: shop-item subtotal after the code's discount.
    const baseCents = Math.max(0, shopItemsCents(orderLines) - (Number(discountCents) || 0));
    const commissionCents = Math.round(baseCents * Number(partner.commission_pct) / 100);
    if (commissionCents <= 0) return;

    const { error } = await supabase.from('partner_referrals').insert({
      partner_id: partnerId,
      kind: 'shop_order',
      order_id: orderId || null,
      referred_user_id: referredUserId || null,
      sale_amount_cents: baseCents,
      discount_cents: Number(discountCents) || 0,
      commission_pct: partner.commission_pct,
      commission_cents: commissionCents,
      status: 'pending',
    });
    if (error) {
      if (error.code === '23505') return; // webhook retry — already booked
      throw error;
    }
    logger.info(`[PARTNER] Booked $${commissionCents / 100} commission for partner ${partnerId} (order ${orderId})`);
  } catch (err) {
    logger.error(`[PARTNER] Failed to record referral for order ${orderId}: ${err.message}`);
  }
}

/**
 * Book the commission for a referred seller-subscription's FIRST payment.
 * Called when the Stripe subscription first turns 'active' (i.e. the first
 * invoice was paid — trial conversions included). Idempotent per referred
 * user (unique index). Best-effort.
 */
export async function recordSubscriptionReferral({ partnerId, referredUserId, firstPaymentCents }) {
  if (!partnerId || !referredUserId || !(firstPaymentCents > 0)) return;
  try {
    const { data: partner } = await supabase
      .from('partners')
      .select('id, commission_pct, status')
      .eq('id', partnerId)
      .maybeSingle();
    if (!partner || partner.status !== 'approved') return;

    const commissionCents = Math.round(firstPaymentCents * Number(partner.commission_pct) / 100);
    if (commissionCents <= 0) return;

    const { error } = await supabase.from('partner_referrals').insert({
      partner_id: partnerId,
      kind: 'subscription',
      referred_user_id: referredUserId,
      sale_amount_cents: firstPaymentCents,
      discount_cents: 0,
      commission_pct: partner.commission_pct,
      commission_cents: commissionCents,
      status: 'pending',
    });
    if (error) {
      if (error.code === '23505') return; // already booked for this user
      throw error;
    }
    logger.info(`[PARTNER] Booked $${commissionCents / 100} subscription commission for partner ${partnerId} (user ${referredUserId})`);
  } catch (err) {
    logger.error(`[PARTNER] Failed to record subscription referral for ${referredUserId}: ${err.message}`);
  }
}

/** Bump a code's click counter (public ?ref=CODE tracking). Best-effort. */
export async function recordPartnerClick(rawCode) {
  const code = normalisePartnerCode(rawCode);
  if (!PARTNER_CODE_SHAPE.test(code)) return;
  const { error } = await supabase.rpc('increment_partner_clicks', { p_code: code });
  if (error) logger.warn(`[PARTNER] Click increment failed for ${code}: ${error.message}`);
}

/**
 * Pay out a partner's pending commission via a Stripe Connect transfer to the
 * same connected account sellers use (profiles.stripe_connect_account_id).
 * Admin-triggered. Marks the swept ledger rows 'paid' with the transfer id.
 */
export async function payoutPartner(stripeClient, partnerId) {
  const { data: partner } = await supabase
    .from('partners')
    .select('id, user_id, business_name, status')
    .eq('id', partnerId)
    .maybeSingle();
  if (!partner) throw httpError(404, 'Partner not found');
  if (partner.status !== 'approved') throw httpError(400, 'Partner is not approved');

  const { data: pending } = await supabase
    .from('partner_referrals')
    .select('id, commission_cents')
    .eq('partner_id', partnerId)
    .eq('status', 'pending');

  const totalCents = (pending || []).reduce((n, r) => n + r.commission_cents, 0);
  if (totalCents <= 0) throw httpError(400, 'No pending commission to pay out');

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_connect_account_id, stripe_connect_onboarded')
    .eq('id', partner.user_id)
    .maybeSingle();

  if (!profile?.stripe_connect_account_id || !profile?.stripe_connect_onboarded) {
    throw httpError(409, 'Partner hasn’t completed Stripe payout onboarding yet');
  }

  const ids = pending.map((r) => r.id);

  // Mark rows paid BEFORE transferring so a crash can't double-pay; if the
  // transfer then fails, roll them back to pending.
  const now = new Date().toISOString();
  const { data: claimed, error: claimErr } = await supabase
    .from('partner_referrals')
    .update({ status: 'paid', paid_at: now })
    .in('id', ids)
    .eq('status', 'pending')
    .select('id, commission_cents');
  if (claimErr) throw new Error(`Could not claim ledger rows: ${claimErr.message}`);
  const claimedIds = (claimed || []).map((r) => r.id);
  const claimedCents = (claimed || []).reduce((n, r) => n + r.commission_cents, 0);
  if (claimedCents <= 0) throw httpError(409, 'Payout already in progress');

  try {
    const transfer = await stripeClient.transfers.create({
      amount: claimedCents,
      currency: 'aud',
      destination: profile.stripe_connect_account_id,
      metadata: { partner_id: partnerId, referral_ids: claimedIds.slice(0, 20).join(',') },
    });
    await supabase
      .from('partner_referrals')
      .update({ stripe_transfer_id: transfer.id })
      .in('id', claimedIds);
    logger.info(`[PARTNER] Paid out $${claimedCents / 100} to ${partner.business_name} (${transfer.id})`);
    return { transferId: transfer.id, amountCents: claimedCents, referralCount: claimedIds.length };
  } catch (err) {
    await supabase
      .from('partner_referrals')
      .update({ status: 'pending', paid_at: null })
      .in('id', claimedIds);
    logger.error(`[PARTNER] Payout transfer failed for ${partnerId}: ${err.message}`);
    throw httpError(502, `Stripe transfer failed: ${err.message}`);
  }
}
