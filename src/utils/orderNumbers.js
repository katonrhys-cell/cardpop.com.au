// Server-side lookup of `orders.order_number` for code that selects an explicit
// column list (shipment emails, refund notices, the invoice PDF…).
//
// Deliberately NOT part of those selects: the column lands with its migration, but
// a redeploy can briefly race ahead of `supabase db push`, and adding an unknown
// column to a select would fail the whole read — including payment handling. So
// this is a separate, best-effort read that never throws; a missing column, a
// network blip or an unknown id just means the caller prints the short id
// (`orderRef()` in utils/orderRef.js).

import { supabase as defaultClient } from './supabaseClient.js';
import logger from './logger.js';
import { orderRef } from '../../utils/orderRef.js';

// A receipt, a shipping email or a PDF must never wait on a cosmetic lookup, so
// a slow database means "use the short id", not a stalled request.
export const ORDER_NUMBER_LOOKUP_TIMEOUT_MS = 2500;

const withTimeout = (promise, ms) => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

/**
 * @param {string[]} ids order ids
 * @param {object} [client] a Supabase client (defaults to the service-role one)
 * @returns {Promise<Map<string, string>>} order id → order number (only the ones found)
 */
export async function fetchOrderNumbers(ids, client = defaultClient) {
  const wanted = [...new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean).map(String))];
  const found = new Map();
  if (!wanted.length) return found;
  try {
    const { data, error } = await withTimeout(
      Promise.resolve(client.from('orders').select('id, order_number').in('id', wanted)),
      ORDER_NUMBER_LOOKUP_TIMEOUT_MS,
    );
    if (error) throw error;
    for (const row of data || []) {
      if (row?.id && row.order_number) found.set(String(row.id), String(row.order_number));
    }
  } catch (err) {
    logger.warn(`[ORDER-NUMBER] lookup failed, falling back to the short id: ${err?.message || err}`);
  }
  return found;
}

/** The printable reference for one order id: `CP-000123`, or the short id as a fall-back. */
export async function orderRefFor(orderId, client = defaultClient) {
  if (!orderId) return '';
  const numbers = await fetchOrderNumbers([orderId], client);
  return orderRef({ id: orderId, order_number: numbers.get(String(orderId)) });
}
