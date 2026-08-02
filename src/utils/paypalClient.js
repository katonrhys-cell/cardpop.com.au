import 'dotenv/config';
import logger from './logger.js';
import { ENV, normalizePaidTier } from '../../config/subscription.js';

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

export function isPaypalConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

async function getAccessToken() {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error('PayPal credentials are not configured');

  const auth = Buffer.from(`${id}:${secret}`).toString('base64');
  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal token request failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  return json.access_token;
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
  });
  if (!res.ok) return false;
  const json = await res.json();
  return json.verification_status === 'SUCCESS';
}
