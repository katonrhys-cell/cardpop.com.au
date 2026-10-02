import crypto from 'crypto';
import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { shopItemsCents } from './partnerService.js';
import { escapeLike } from '../utils/escapeLike.js';

/**
 * Admin-managed promo codes (Admin → Promo Codes). An admin sets any
 * percentage off, what it applies to (shop items only, or the whole cart), a
 * start/expiry window, a usage policy and who the code was given to.
 *
 * Checkout routing: POP-XXXX-XXXX → welcome offer; otherwise a promo code if
 * one exists with that text; otherwise a partner referral code. The two latter
 * share a namespace (a DB trigger stops a code existing in both tables).
 *
 * Lifecycle of one use (a promo_code_redemptions row):
 *   reserved  — at Checkout Session creation (`reservePromoCode`, row-locked
 *               in the DB so single-use / capped codes can't be overrun)
 *   redeemed  — by the Stripe webhook once payment completes
 *   released  — when the session expires, or every line was a double-sale
 * Like the welcome offer the discount is platform-funded: a one-off Stripe
 * amount-off coupon on the item subtotal, never fees/GST or seller proceeds.
 */

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

export const PROMO_CODE_SHAPE = /^[A-Z0-9][A-Z0-9-]{3,29}$/;
const WELCOME_CODE_SHAPE = /^POP-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
// No 0/O/1/I/L — codes get read out loud and typed from phone screens.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const PROMO_SELECT = 'id, code, description, discount_pct, applies_to, usage_type, max_redemptions, once_per_customer, min_order_aud, max_discount_aud, starts_at, expires_at, issued_to_name, issued_to_email, restrict_to_email, notes, active, created_at, updated_at';

// Stripe refuses a payment-mode session discounted below its 50¢ AUD minimum.
const STRIPE_MIN_CHARGE_CENTS = 50;

export function normalisePromoCode(code) {
  return String(code || '').trim().toUpperCase();
}

export function generatePromoCode(prefix = 'CP') {
  const bytes = crypto.randomBytes(8);
  let body = '';
  for (let i = 0; i < 8; i++) body += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return `${prefix}-${body}`;
}

// ─── Checkout ────────────────────────────────────────────────────────────────

/** The promo code with this text, or null when there is none (→ try partner codes). */
export async function findPromoCode(rawCode) {
  const code = normalisePromoCode(rawCode);
  if (!PROMO_CODE_SHAPE.test(code)) return null;
  const { data, error } = await supabase
    .from('promo_codes')
    .select(PROMO_SELECT)
    .eq('code', code)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

/**
 * Check a promo code is usable right now by this buyer. Usage caps are checked
 * here for a friendly message on the price preview; the authoritative,
 * race-free check is `reservePromoCode` at session creation.
 */
export async function validatePromoCode(promo, { userId, email }) {
  const now = Date.now();
  if (!promo.active) throw httpError(400, 'That promo code isn’t valid.');
  if (promo.starts_at && new Date(promo.starts_at).getTime() > now) {
    throw httpError(400, 'That promo code isn’t active yet.');
  }
  if (promo.expires_at && new Date(promo.expires_at).getTime() <= now) {
    throw httpError(410, 'That promo code has expired.');
  }
  if (promo.restrict_to_email) {
    const issued = String(promo.issued_to_email || '').trim().toLowerCase();
    if (!issued || issued !== String(email || '').trim().toLowerCase()) {
      throw httpError(403, 'That promo code isn’t valid for your account.');
    }
  }

  const staleBefore = new Date(now - 24 * 3600 * 1000).toISOString();
  const cap = promo.usage_type === 'single_use' ? 1 : promo.max_redemptions;
  const live = (q) => q
    .eq('promo_code_id', promo.id)
    .or(`status.eq.redeemed,and(status.eq.reserved,reserved_at.gt.${staleBefore})`);

  if (cap) {
    const { count, error } = await live(
      supabase.from('promo_code_redemptions').select('id', { count: 'exact', head: true }),
    );
    if (error) throw error;
    if ((count ?? 0) >= cap) throw httpError(409, 'That promo code has already been used.');
  }
  if (promo.once_per_customer && userId) {
    const { count, error } = await live(
      supabase.from('promo_code_redemptions').select('id', { count: 'exact', head: true }),
    ).eq('user_id', userId);
    if (error) throw error;
    if ((count ?? 0) > 0) throw httpError(409, 'You’ve already used this promo code.');
  }
  return promo;
}

/**
 * Cents off for a promo code against a priced cart. Throws httpError when the
 * cart doesn't qualify (no shop items for a shop-only code, below the minimum
 * spend). Never discounts below Stripe's minimum charge.
 */
export function promoDiscountCents(promo, priced) {
  const eligibleCents = promo.applies_to === 'all'
    ? priced.itemsCents
    : shopItemsCents(priced.orderLines);
  if (eligibleCents <= 0) {
    throw httpError(400, 'This code applies to CardPop Shop items only.');
  }
  const minCents = Math.round(Number(promo.min_order_aud || 0) * 100);
  if (minCents > 0 && eligibleCents < minCents) {
    throw httpError(400, `This code needs a minimum spend of $${(minCents / 100).toFixed(2)}${promo.applies_to === 'all' ? '' : ' on CardPop Shop items'}.`);
  }
  let cents = Math.round(eligibleCents * Number(promo.discount_pct) / 100);
  if (promo.max_discount_aud != null) {
    cents = Math.min(cents, Math.round(Number(promo.max_discount_aud) * 100));
  }
  if (Number.isFinite(priced.grandCents)) {
    cents = Math.min(cents, Math.max(0, priced.grandCents - STRIPE_MIN_CHARGE_CENTS));
  }
  return Math.max(0, cents);
}

/** Single-use Stripe amount-off coupon carrying the discount for one session. */
export async function buildPromoDiscount(stripeClient, promo, discountCents) {
  if (discountCents <= 0) return null;
  const coupon = await stripeClient.coupons.create({
    amount_off: discountCents,
    currency: 'aud',
    duration: 'once',
    name: `Promo ${promo.code} ${Number(promo.discount_pct)}% off`,
  });
  return { couponId: coupon.id, discountCents };
}

const RESERVE_ERRORS = {
  promo_invalid: [400, 'That promo code isn’t valid.'],
  promo_not_started: [400, 'That promo code isn’t active yet.'],
  promo_expired: [410, 'That promo code has expired.'],
  promo_exhausted: [409, 'That promo code has already been used.'],
  promo_already_used: [409, 'You’ve already used this promo code.'],
};

/** Atomically claim one use of the code for an in-flight checkout. Returns the redemption id. */
export async function reservePromoCode(promo, { userId, email, discountCents }) {
  const { data, error } = await supabase.rpc('reserve_promo_code', {
    p_promo_code_id: promo.id,
    p_user_id: userId || null,
    p_email: email || null,
    p_discount_cents: discountCents,
  });
  if (error) {
    const mapped = RESERVE_ERRORS[String(error.message || '').trim()];
    if (mapped) throw httpError(mapped[0], mapped[1]);
    throw error;
  }
  return data;
}

/** Link the reservation to its Checkout Session (for support lookups). Best-effort. */
export async function attachPromoSession(redemptionId, sessionId) {
  if (!redemptionId || !sessionId) return;
  const { error } = await supabase
    .from('promo_code_redemptions')
    .update({ stripe_session_id: sessionId })
    .eq('id', redemptionId);
  if (error) logger.warn(`[PROMO] Could not attach session ${sessionId} to redemption ${redemptionId}: ${error.message}`);
}

/** Free a reservation (session expired / never created / order fully refunded). */
export async function releasePromoRedemption(redemptionId) {
  if (!redemptionId) return;
  const { error } = await supabase
    .from('promo_code_redemptions')
    .update({ status: 'released' })
    .eq('id', redemptionId)
    .eq('status', 'reserved');
  if (error) logger.warn(`[PROMO] Failed to release redemption ${redemptionId}: ${error.message}`);
}

/** Called by the Stripe webhook once payment for a discounted order completes. Idempotent. */
export async function markPromoRedeemed(redemptionId, orderId = null) {
  if (!redemptionId) return;
  const { error } = await supabase
    .from('promo_code_redemptions')
    .update({ status: 'redeemed', redeemed_at: new Date().toISOString(), order_id: orderId })
    .eq('id', redemptionId)
    .neq('status', 'redeemed');
  if (error) logger.error(`[PROMO] Failed to mark redemption ${redemptionId} redeemed: ${error.message}`);
}

// ─── Admin ───────────────────────────────────────────────────────────────────

const cleanText = (value, max) => {
  if (value == null) return null;
  const s = String(value).trim().slice(0, max);
  return s || null;
};

const optionalNumber = (value, label, { min = 0, exclusiveMin = false } = {}) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || (exclusiveMin ? n <= min : n < min)) {
    throw httpError(400, `${label} must be ${exclusiveMin ? 'greater than' : 'at least'} ${min}.`);
  }
  return Math.round(n * 100) / 100;
};

const optionalDate = (value, label) => {
  if (value === null || value === undefined || value === '') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw httpError(400, `${label} isn’t a valid date.`);
  return d.toISOString();
};

/**
 * Validate and normalise an admin create/update body into column values.
 * `partial` (update) only returns the fields present in the body.
 */
export function parsePromoInput(body = {}, { partial = false } = {}) {
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);
  const out = {};

  if (!partial || has('code')) {
    const code = normalisePromoCode(body.code);
    if (!PROMO_CODE_SHAPE.test(code)) {
      throw httpError(400, 'Codes are 4–30 characters: letters, numbers and hyphens.');
    }
    if (WELCOME_CODE_SHAPE.test(code)) {
      throw httpError(400, 'That code format is reserved for welcome offers.');
    }
    out.code = code;
  }
  if (!partial || has('discountPct')) {
    const pct = Number(body.discountPct);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      throw httpError(400, 'Discount must be between 0.01% and 100%.');
    }
    out.discount_pct = Math.round(pct * 100) / 100;
  }
  if (!partial || has('appliesTo')) {
    const appliesTo = body.appliesTo ?? 'shop';
    if (!['shop', 'all'].includes(appliesTo)) throw httpError(400, 'Choose what the code applies to.');
    out.applies_to = appliesTo;
  }
  if (!partial || has('usageType')) {
    const usageType = body.usageType ?? 'ongoing';
    if (!['single_use', 'ongoing'].includes(usageType)) throw httpError(400, 'Choose one-off or ongoing.');
    out.usage_type = usageType;
  }
  if (!partial || has('maxRedemptions')) {
    const max = body.maxRedemptions;
    if (max === null || max === undefined || max === '') {
      out.max_redemptions = null;
    } else {
      const n = Number(max);
      if (!Number.isInteger(n) || n < 1) throw httpError(400, 'Usage limit must be a whole number of 1 or more.');
      out.max_redemptions = n;
    }
  }
  if (!partial || has('oncePerCustomer')) out.once_per_customer = body.oncePerCustomer !== false;
  if (!partial || has('minOrderAud')) out.min_order_aud = optionalNumber(body.minOrderAud, 'Minimum spend');
  if (!partial || has('maxDiscountAud')) out.max_discount_aud = optionalNumber(body.maxDiscountAud, 'Maximum discount', { exclusiveMin: true });
  if (!partial || has('startsAt')) out.starts_at = optionalDate(body.startsAt, 'Start date');
  if (!partial || has('expiresAt')) out.expires_at = optionalDate(body.expiresAt, 'Expiry date');
  if (!partial || has('description')) out.description = cleanText(body.description, 200);
  if (!partial || has('issuedToName')) out.issued_to_name = cleanText(body.issuedToName, 120);
  if (!partial || has('issuedToEmail')) {
    const email = cleanText(body.issuedToEmail, 254);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, 'Recipient email isn’t valid.');
    out.issued_to_email = email ? email.toLowerCase() : null;
  }
  if (!partial || has('restrictToEmail')) out.restrict_to_email = body.restrictToEmail === true;
  if (!partial || has('notes')) out.notes = cleanText(body.notes, 2000);
  if (!partial || has('active')) out.active = body.active !== false;

  if (out.starts_at && out.expires_at && new Date(out.expires_at) <= new Date(out.starts_at)) {
    throw httpError(400, 'Expiry must be after the start date.');
  }
  return out;
}

/** Display status of a code given its usage. */
export function promoStatus(promo, redeemedCount = 0, now = Date.now()) {
  if (!promo.active) return 'inactive';
  if (promo.expires_at && new Date(promo.expires_at).getTime() <= now) return 'expired';
  if (promo.starts_at && new Date(promo.starts_at).getTime() > now) return 'scheduled';
  const cap = promo.usage_type === 'single_use' ? 1 : promo.max_redemptions;
  if (cap && redeemedCount >= cap) return 'used_up';
  return 'active';
}

/** Every code with its usage stats, newest first. */
export async function listPromoCodes() {
  const [{ data: codes, error }, { data: uses, error: usesErr }] = await Promise.all([
    supabase.from('promo_codes').select(PROMO_SELECT).order('created_at', { ascending: false }).limit(1000),
    supabase.from('promo_code_redemptions')
      .select('promo_code_id, status, discount_cents, redeemed_at')
      .eq('status', 'redeemed')
      .limit(10000),
  ]);
  if (error) throw error;
  if (usesErr) throw usesErr;

  const stats = new Map();
  for (const u of uses || []) {
    const s = stats.get(u.promo_code_id) || { redeemed: 0, discountCents: 0, lastUsedAt: null };
    s.redeemed += 1;
    s.discountCents += u.discount_cents || 0;
    if (u.redeemed_at && (!s.lastUsedAt || u.redeemed_at > s.lastUsedAt)) s.lastUsedAt = u.redeemed_at;
    stats.set(u.promo_code_id, s);
  }
  return (codes || []).map((c) => {
    const s = stats.get(c.id) || { redeemed: 0, discountCents: 0, lastUsedAt: null };
    return {
      ...c,
      redeemed_count: s.redeemed,
      total_discount_aud: s.discountCents / 100,
      last_used_at: s.lastUsedAt,
      status: promoStatus(c, s.redeemed),
    };
  });
}

async function assertCodeFree(code, exceptId = null) {
  const [{ data: promo }, { data: partner }] = await Promise.all([
    supabase.from('promo_codes').select('id').eq('code', code).maybeSingle(),
    supabase.from('partners').select('id').ilike('code', escapeLike(code)).maybeSingle(),
  ]);
  if (promo && promo.id !== exceptId) throw httpError(409, `The code ${code} already exists.`);
  if (partner) throw httpError(409, `${code} is already a partner referral code.`);
}

const mapWriteError = (error) => {
  if (error?.code === '23505') return httpError(409, 'That code already exists (as a promo or partner code).');
  if (error?.code === '23514') return httpError(400, 'Some of those settings aren’t valid together.');
  return error;
};

export async function createPromoCode(body, adminId) {
  const row = parsePromoInput(body);
  if (row.restrict_to_email && !row.issued_to_email) {
    throw httpError(400, 'Add the recipient’s email to lock the code to them.');
  }
  await assertCodeFree(row.code);
  const { data, error } = await supabase
    .from('promo_codes')
    .insert({ ...row, created_by: adminId || null })
    .select(PROMO_SELECT)
    .single();
  if (error) throw mapWriteError(error);
  logger.info(`[PROMO] ${adminId} created ${data.code} (${data.discount_pct}% ${data.applies_to}, ${data.usage_type})`);
  return data;
}

export async function updatePromoCode(id, body, adminId) {
  const patch = parsePromoInput(body, { partial: true });
  if (!Object.keys(patch).length) throw httpError(400, 'Nothing to update.');

  const { data: existing } = await supabase.from('promo_codes').select(PROMO_SELECT).eq('id', id).maybeSingle();
  if (!existing) throw httpError(404, 'Promo code not found.');

  if (patch.code && patch.code !== existing.code) {
    const { count } = await supabase
      .from('promo_code_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('promo_code_id', id);
    if ((count ?? 0) > 0) throw httpError(409, 'This code has been used, so its text can’t change. Deactivate it and create a new one.');
    await assertCodeFree(patch.code, id);
  }
  const merged = { ...existing, ...patch };
  if (merged.restrict_to_email && !merged.issued_to_email) {
    throw httpError(400, 'Add the recipient’s email to lock the code to them.');
  }
  if (merged.starts_at && merged.expires_at && new Date(merged.expires_at) <= new Date(merged.starts_at)) {
    throw httpError(400, 'Expiry must be after the start date.');
  }

  const { data, error } = await supabase
    .from('promo_codes')
    .update(patch)
    .eq('id', id)
    .select(PROMO_SELECT)
    .single();
  if (error) throw mapWriteError(error);
  logger.info(`[PROMO] ${adminId} updated ${data.code}: ${Object.keys(patch).join(', ')}`);
  return data;
}

/** Delete an unused code. A code with any usage history can only be deactivated. */
export async function deletePromoCode(id, adminId) {
  const { count } = await supabase
    .from('promo_code_redemptions')
    .select('id', { count: 'exact', head: true })
    .eq('promo_code_id', id);
  if ((count ?? 0) > 0) throw httpError(409, 'This code has usage history — deactivate it instead of deleting.');
  const { data, error } = await supabase.from('promo_codes').delete().eq('id', id).select('code');
  if (error) throw mapWriteError(error);
  if (!data?.length) throw httpError(404, 'Promo code not found.');
  logger.info(`[PROMO] ${adminId} deleted ${data[0].code}`);
}

/** Every use of one code, with the buyer and order. */
export async function listPromoRedemptions(id) {
  const { data, error } = await supabase
    .from('promo_code_redemptions')
    .select('id, user_id, buyer_email, stripe_session_id, order_id, discount_cents, status, reserved_at, redeemed_at, order:orders(id, total_aud, status, created_at)')
    .eq('promo_code_id', id)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;

  const userIds = [...new Set((data || []).map((r) => r.user_id).filter(Boolean))];
  const profiles = new Map();
  if (userIds.length) {
    const { data: rows } = await supabase
      .from('profiles')
      .select('id, display_name, username, email')
      .in('id', userIds);
    for (const p of rows || []) profiles.set(p.id, p);
  }
  return (data || []).map((r) => ({
    ...r,
    discount_aud: (r.discount_cents || 0) / 100,
    buyer: r.user_id ? profiles.get(r.user_id) || null : null,
  }));
}
