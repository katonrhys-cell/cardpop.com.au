import supabase from '../utils/supabaseClient.js';
import { DEFAULT_REFUND_FEE_RETENTION_PCT } from '../../utils/refundAmounts.js';

// The arithmetic itself lives in utils/refundAmounts.js (dependency-free, so
// the buyer's Account → Orders page quotes the same figure). Marketplace
// refunds retain part of the platform fee and the processing fee; CardPop Shop
// orders are refunded in full — see that file for the rules and why.
export {
  computeRefundAmounts,
  isShopOrder,
  marketplaceShare,
  DEFAULT_REFUND_FEE_RETENTION_PCT,
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
