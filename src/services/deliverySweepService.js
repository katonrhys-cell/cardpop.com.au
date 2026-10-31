import { supabase } from '../utils/supabaseClient.js';
import logger from '../utils/logger.js';
import { lookupTracking, trackableCarriers } from '../utils/carrierTracking.js';
import { markOrderDelivered } from './shipmentService.js';
import { MARKETPLACE_PROTECTION } from '../../utils/buyerProtectionPolicy.js';

// Daily cron (cloudflare/scheduler/worker.js → GET /api/orders/delivery-sweep).
//
// For every shipped order with no delivery recorded:
//   1. ask the carrier (Australia Post / StarTrack / Sendle, when credentials
//      exist) — a "Delivered" scan records delivery with source 'carrier';
//   2. otherwise, once shipped_at is MARKETPLACE_PROTECTION.autoDeliveredDaysAfterShipped
//      days old, record delivery with source 'auto'.
// Either way the order moves to 'completed', the buyer is told, and the
// 7-day Buyer Protection window (utils/buyerProtectionPolicy.js) starts.
//
// Bounded per run (count and wall clock) because api/index.js has a 40s
// budget; whatever isn't reached today is reached tomorrow.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Pure decision for one order, so the rule is testable without I/O. */
export function decideDelivery(order, tracking, now = new Date()) {
  if (!order || order.delivered_at) return { action: 'skip', reason: 'already delivered' };
  if (order.status !== 'shipped') return { action: 'skip', reason: `status ${order.status}` };
  if (tracking?.delivered) return { action: 'deliver', source: 'carrier', deliveredAt: tracking.deliveredAt || now };
  const shipped = order.shipped_at ? new Date(order.shipped_at) : null;
  if (shipped && now.getTime() - shipped.getTime() >= MARKETPLACE_PROTECTION.autoDeliveredDaysAfterShipped * DAY_MS) {
    return { action: 'deliver', source: 'auto', deliveredAt: now };
  }
  return { action: 'wait', reason: tracking ? `carrier says ${tracking.status || 'in transit'}` : 'awaiting auto-delivery' };
}

export async function runDeliverySweep({ limit = 60, budgetMs = 25000, now = new Date() } = {}) {
  const started = Date.now();
  const summary = { scanned: 0, delivered: 0, byCarrier: 0, auto: 0, waiting: 0, errors: 0, trackable: trackableCarriers() };

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, status, shipped_at, delivered_at, tracking_carrier, tracking_number')
    .eq('status', 'shipped')
    .is('delivered_at', null)
    .order('shipped_at', { ascending: true })
    .limit(limit);
  if (error) throw error;

  for (const order of orders || []) {
    if (Date.now() - started > budgetMs) { logger.info('[DELIVERY] sweep budget reached; remainder next run'); break; }
    summary.scanned += 1;
    try {
      const tracking = summary.trackable.includes(order.tracking_carrier)
        ? await lookupTracking(order.tracking_carrier, order.tracking_number)
        : null;
      const decision = decideDelivery(order, tracking, now);
      if (decision.action !== 'deliver') { summary.waiting += 1; continue; }
      const res = await markOrderDelivered({ orderId: order.id, source: decision.source, deliveredAt: decision.deliveredAt });
      if (res.changed) {
        summary.delivered += 1;
        if (decision.source === 'carrier') summary.byCarrier += 1; else summary.auto += 1;
      }
    } catch (err) {
      summary.errors += 1;
      logger.error(`[DELIVERY] sweep failed for order ${order.id}: ${err.message}`);
    }
  }
  logger.info(`[DELIVERY] sweep: ${JSON.stringify(summary)}`);
  return summary;
}
