// Carrier tracking lookups for the delivery sweep (src/services/deliverySweepService.js).
//
// Each carrier is a small adapter: given a tracking reference, answer
// { delivered: boolean, deliveredAt: Date|null, status: string|null } or null
// when the carrier can't be asked (no credentials, network error, unknown
// reference). Every path is fail-safe — a null simply leaves the order to the
// 10-day auto-delivery rule in utils/buyerProtectionPolicy.js.
//
// Credentials (all optional; unset = that carrier is skipped):
//   AUSPOST_API_KEY, AUSPOST_ACCOUNT_NUMBER, AUSPOST_PASSWORD
//     Australia Post Shipping & Tracking API (also resolves StarTrack).
//     https://developers.auspost.com.au — needs a business account.
//   SENDLE_ID, SENDLE_API_KEY
//     Sendle public tracking API.
//
// The hosts here are fixed carrier endpoints, never user-supplied, so plain
// fetch with a timeout is appropriate (safeFetch is for untrusted URLs).

import logger from './logger.js';

const TIMEOUT_MS = 8000;

async function fetchJson(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) return { ok: false, status: res.status, data: null };
    const data = await res.json().catch(() => null);
    return { ok: true, status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

const toDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const DELIVERED_RE = /\bdelivered\b/i;
const NOT_DELIVERED_RE = /\b(not|un|attempted|awaiting|left|card)\b.*\bdeliver/i;

/** True when an event description means the parcel reached the recipient. */
export function isDeliveredDescription(text) {
  if (!text || typeof text !== 'string') return false;
  if (!DELIVERED_RE.test(text)) return false;
  // "Delivery attempted", "Awaiting collection", "Card left" … are not deliveries.
  if (/attempt|awaiting|collect|card left|left in|unable|could not|returning|return to/i.test(text) && !/^delivered\b/i.test(text.trim())) return false;
  return !NOT_DELIVERED_RE.test(text) || /^delivered\b/i.test(text.trim());
}

/**
 * Australia Post Shipping & Tracking API response → delivery verdict.
 * Shape (documented): { tracking_results: [{ tracking_id, status, trackable_items: [{ events: [{ description, date }] }] }] }
 */
export function parseAusPostTracking(data) {
  const result = data?.tracking_results?.[0];
  if (!result) return null;
  const events = (result.trackable_items || []).flatMap((it) => it?.events || []);
  const statusText = String(result.status || '');
  const deliveredEvent = events.find((e) => isDeliveredDescription(e?.description));
  const delivered = isDeliveredDescription(statusText) || !!deliveredEvent;
  const latest = events
    .map((e) => toDate(e?.date))
    .filter(Boolean)
    .sort((a, b) => b - a)[0] || null;
  return {
    delivered,
    deliveredAt: delivered ? (toDate(deliveredEvent?.date) || latest) : null,
    status: statusText || events[0]?.description || null,
  };
}

/**
 * Sendle tracking API response → delivery verdict.
 * Shape (documented): { state: 'Delivered' | 'In Transit' | …, tracking_events: [{ event_type, scan_time, description }] }
 */
export function parseSendleTracking(data) {
  if (!data || typeof data !== 'object') return null;
  const state = String(data.state || '');
  const events = Array.isArray(data.tracking_events) ? data.tracking_events : [];
  const deliveredEvent = events.find((e) => /^delivered$/i.test(String(e?.event_type || '')) || isDeliveredDescription(e?.description));
  const delivered = /^delivered$/i.test(state) || !!deliveredEvent;
  return {
    delivered,
    deliveredAt: delivered ? (toDate(deliveredEvent?.scan_time) || toDate(data.scheduling?.delivered_on) || null) : null,
    status: state || events[0]?.event_type || null,
  };
}

export function ausPostConfigured() {
  return !!(process.env.AUSPOST_API_KEY && process.env.AUSPOST_ACCOUNT_NUMBER && process.env.AUSPOST_PASSWORD);
}
export function sendleConfigured() {
  return !!(process.env.SENDLE_ID && process.env.SENDLE_API_KEY);
}

export async function lookupAusPost(trackingNumber) {
  if (!ausPostConfigured()) return null;
  try {
    const url = `https://digitalapi.auspost.com.au/shipments/v1/track?tracking_ids=${encodeURIComponent(trackingNumber)}`;
    const auth = Buffer.from(`${process.env.AUSPOST_ACCOUNT_NUMBER}:${process.env.AUSPOST_PASSWORD}`).toString('base64');
    const { ok, status, data } = await fetchJson(url, {
      headers: { 'AUTH-KEY': process.env.AUSPOST_API_KEY, Authorization: `Basic ${auth}`, Accept: 'application/json' },
    });
    if (!ok) { logger.warn(`[TRACKING] AusPost ${trackingNumber} → HTTP ${status}`); return null; }
    return parseAusPostTracking(data);
  } catch (err) {
    logger.warn(`[TRACKING] AusPost lookup failed for ${trackingNumber}: ${err.message}`);
    return null;
  }
}

export async function lookupSendle(trackingNumber) {
  if (!sendleConfigured()) return null;
  try {
    const url = `https://api.sendle.com/api/tracking/${encodeURIComponent(trackingNumber)}`;
    const auth = Buffer.from(`${process.env.SENDLE_ID}:${process.env.SENDLE_API_KEY}`).toString('base64');
    const { ok, status, data } = await fetchJson(url, { headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' } });
    if (!ok) { logger.warn(`[TRACKING] Sendle ${trackingNumber} → HTTP ${status}`); return null; }
    return parseSendleTracking(data);
  } catch (err) {
    logger.warn(`[TRACKING] Sendle lookup failed for ${trackingNumber}: ${err.message}`);
    return null;
  }
}

/** Which carriers the sweep can actually ask right now. */
export function trackableCarriers() {
  const out = [];
  if (ausPostConfigured()) out.push('auspost', 'startrack');
  if (sendleConfigured()) out.push('sendle');
  return out;
}

/** Look up any supported carrier; null when unsupported / unconfigured / failed. */
export async function lookupTracking(carrier, trackingNumber) {
  if (!trackingNumber) return null;
  switch (carrier) {
    case 'auspost':
    case 'startrack':
      return lookupAusPost(trackingNumber);
    case 'sendle':
      return lookupSendle(trackingNumber);
    default:
      return null;
  }
}
