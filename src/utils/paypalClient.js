import 'dotenv/config';
import logger from './logger.js';
import { ENV, normalizePaidTier } from '../../config/subscription.js';
import { OUTBOUND_TIMEOUT_MS } from './outboundTimeouts.js';

/**
 * Minimal PayPal REST client for subscription billing.
 *
 * Uses the v1 Billing Subscriptions API. Credentials come from env:
 *   PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENV ('sandbox' | 'live'),
 *   the per-tier billing plan ids (PAYPAL_SUBSCRIPTION_PLAN_ID for Pro,
 *   PAYPAL_SUBSCRIPTION_PLAN_ID_PREMIUM / _ELITE / _ULTIMATE for the higher
 *   tiers — see config/subscription.js ENV), and PAYPAL_WEBHOOK_ID.
 *
 * The plans themselves (including the 30-day free trial) are created once in
 * the PayPal dashboard / API and referenced here by id — see docs/SUBSCRIPTION_SETUP.md.
 */

const PAYPAL_ENV = process.env.PAYPAL_ENV === 'live' ? 'live' : 'sandbox';
const BASE_URL = PAYPAL_ENV === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

const signal = () => AbortSignal.timeout(OUTBOUND_TIMEOUT_MS.paypal);

export function isPaypalConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

// PayPal client-credential tokens live for hours (expires_in ≈ 32400), but
// every call used to fetch a fresh one — two round trips per subscription
// operation and per webhook. Cache it for its lifetime (minus a minute), keyed
// to the credentials so a rotated secret can't reuse the old token. A token
// response with no usable expires_in is not cached.
let cachedToken = null; // { token, expiresAt, credentials }

async function getAccessToken() {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error('PayPal credentials are not configured');

  const credentials = `${id}:${secret}`;
  const now = Date.now();
  if (cachedToken && cachedToken.credentials === credentials && now < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const auth = Buffer.from(credentials).toString('base64');
  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    signal: signal(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal token request failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  const ttlSeconds = Number(json.expires_in);
  if (Number.isFinite(ttlSeconds) && ttlSeconds > 60) {
    cachedToken = { token: json.access_token, expiresAt: now + (ttlSeconds - 60) * 1000, credentials };
  }
  return json.access_token;
}

/** For tests. */
export function _resetPaypalTokenCache() {
  cachedToken = null;
}

/**
 * Create a subscription against the requested tier's billing plan and return
 * the approval URL the buyer must visit to authorise it.
 * @param {object} args - { userId, email, returnUrl, cancelUrl, tier? }
 */
export async function createPaypalSubscription({ userId, email, returnUrl, cancelUrl, tier }) {
  const paidTier = normalizePaidTier(tier);
  const planEnvName = ENV.paypalPlanIds[paidTier];
  const planId = process.env[planEnvName];
  if (!planId) throw new Error(`${planEnvName} is not configured`);

  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}/v1/billing/subscriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      plan_id: planId,
      custom_id: userId,
      subscriber: email ? { email_address: email } : undefined,
      application_context: {
        brand_name: 'CardPop',
        user_action: 'SUBSCRIBE_NOW',
        shipping_preference: 'NO_SHIPPING',
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    }),
    signal: signal(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal create subscription failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  const approveLink = (json.links || []).find((l) => l.rel === 'approve');
  return { id: json.id, status: json.status, approveUrl: approveLink?.href || null };
}

/** Fetch a subscription's current state from PayPal. */
export async function getPaypalSubscription(subscriptionId) {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}/v1/billing/subscriptions/${subscriptionId}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: signal(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal get subscription failed (${res.status}): ${text}`);
  }
  return res.json();
}

/**
 * Verify a PayPal webhook signature via the verify-webhook-signature API.
 * Returns true only when PayPal reports SUCCESS.
 */
export async function verifyPaypalWebhook({ headers, body }) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    logger.warn('[PAYPAL] PAYPAL_WEBHOOK_ID not configured — rejecting webhook');
    return false;
  }
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_algo:         headers['paypal-auth-algo'],
      cert_url:          headers['paypal-cert-url'],
      transmission_id:   headers['paypal-transmission-id'],
      transmission_sig:  headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id:        webhookId,
      webhook_event:     body,
    }),
    signal: signal(),
  });
  if (!res.ok) return false;
  const json = await res.json();
  return json.verification_status === 'SUCCESS';
}
