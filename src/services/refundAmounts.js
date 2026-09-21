import supabase from '../utils/supabaseClient.js';

// One place for the refund arithmetic, so the figure the buyer is quoted when
// they request a refund, the one the admin approves, and the one actually sent
// to Stripe can't drift apart. (They had: the request/approval paths hardcoded
// a 50% commission retention and ignored the processing fee, while processing
// used the refund_fee_retention_pct setting AND kept the processing fee, so the
// buyer was told one amount and received a smaller one.)
//
// Retained from the buyer's refund:
//   - refund_fee_retention_pct of the platform fee (commission incl. its GST)
//   - the payment-processing fee in full — Stripe keeps its fee on a refunded
//     payment, so refunding the buyer's reimbursement of it would make every
//     refund a loss on top of the goods coming back. Orders placed before the
//     fee existed carry 0 and are unaffected.

export const DEFAULT_REFUND_FEE_RETENTION_PCT = 50;

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export async function getRefundRetentionPct() {
  const { data } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'refund_fee_retention_pct')
    .maybeSingle();
  const pct = Number(data?.value);
  return Number.isFinite(pct) ? pct : DEFAULT_REFUND_FEE_RETENTION_PCT;
}

/**
 * Compute the refund split from the server-authoritative ORDER row (never
 * from the buyer-created refunds row, whose fee columns a buyer could zero).
 *
 * @param order { total_aud, platform_fee_aud, processing_fee_aud? }
 * @param retentionPct percentage of platform_fee_aud to keep (0-100)
 * @returns {{ orderTotal, retentionPct, retainedCommission, processingFee, retainedFee, refundAmount }}
 */
export function computeRefundAmounts(order, retentionPct = DEFAULT_REFUND_FEE_RETENTION_PCT) {
  const orderTotal = round2(order?.total_aud);
  const totalCommission = round2(order?.platform_fee_aud);
  const processingFee = Math.max(0, round2(order?.processing_fee_aud));
  const pct = Number.isFinite(Number(retentionPct)) ? Number(retentionPct) : DEFAULT_REFUND_FEE_RETENTION_PCT;
  const retainedCommission = round2(totalCommission * (pct / 100));
  const retainedFee = round2(retainedCommission + processingFee);
  const refundAmount = round2(orderTotal - retainedFee);
  return { orderTotal, retentionPct: pct, retainedCommission, processingFee, retainedFee, refundAmount };
}
