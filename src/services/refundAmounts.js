import supabase from '../utils/supabaseClient.js';
import { DEFAULT_REFUND_FEE_RETENTION_PCT, DEFAULT_REFUND_RETAIN_PROCESSING_FEE } from '../../utils/refundAmounts.js';

// The arithmetic itself lives in utils/refundAmounts.js (dependency-free, so
// the buyer's Account → Orders page quotes the same figure). Approved refunds
// are full refunds by default; the retention knobs below exist so the policy
// can be tightened from Admin → Settings without a deploy.
export {
  computeRefundAmounts,
  isShopOrder,
  marketplaceShare,
  DEFAULT_REFUND_FEE_RETENTION_PCT,
  DEFAULT_REFUND_RETAIN_PROCESSING_FEE,
} from '../../utils/refundAmounts.js';

export async function getRefundRetentionPct() {
  const { data } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'refund_fee_retention_pct')
    .maybeSingle();
  const pct = Number(data?.value);
  return Number.isFinite(pct) ? pct : DEFAULT_REFUND_FEE_RETENTION_PCT;
}

/** Whether the (marketplace share of the) processing fee is kept on a refund. Default: no. */
export async function getRefundRetainProcessingFee() {
  const { data } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'refund_retain_processing_fee')
    .maybeSingle();
  const v = data?.value;
  if (v === true || v === 'true') return true;
  if (v === false || v === 'false') return false;
  return DEFAULT_REFUND_RETAIN_PROCESSING_FEE;
}

/** Both knobs at once, for the three refund paths. */
export async function getRefundPolicyOptions() {
  const [retentionPct, retainProcessingFee] = await Promise.all([getRefundRetentionPct(), getRefundRetainProcessingFee()]);
  return { retentionPct, retainProcessingFee };
}
