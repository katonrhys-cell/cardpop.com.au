import React, { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';

/*
 * "If this sells, you receive $X" — shown live under the asking-price field.
 *
 * Two deductions come out of a sale and a seller should meet both before they
 * set a price, not after they get paid:
 *
 *   - CardPop's commission.
 *   - GST. Listing prices are GST-inclusive (Australian consumer prices are),
 *     so the tax is already inside the number the seller typed. CardPop
 *     withholds it and remits it to the ATO on the seller's behalf, on every
 *     sale — see docs/order-pricing.md.
 *
 * Rates come from platform_settings, which is publicly readable, so this stays
 * correct when they're tuned in the admin panel. It is an estimate: the exact
 * commission depends on the seller's tier, and the real figures are on the
 * order once it completes.
 */
const round2 = n => Math.round(n * 100) / 100;

const SellerPayoutEstimate = ({ price }) => {
  const [rates, setRates] = useState(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('platform_settings')
      .select('key, value')
      .in('key', ['default_platform_fee_pct', 'gst_enabled', 'gst_rate_pct'])
      .then(({ data }) => {
        if (cancelled || !data) return;
        const byKey = Object.fromEntries(data.map(r => [r.key, r.value]));
        setRates({
          feePct: Number(byKey.default_platform_fee_pct ?? 3),
          gstEnabled: byKey.gst_enabled !== false,
          gstRatePct: Number(byKey.gst_rate_pct ?? 10),
        });
      });
    return () => { cancelled = true; };
  }, []);

  const value = Number(price);
  if (!rates || !Number.isFinite(value) || value <= 0) return null;

  const commission = round2(value * (rates.feePct / 100));
  // GST INSIDE a GST-inclusive price: amount × rate / (100 + rate), i.e. 1/11
  // at 10% — not 10% of the price.
  const gst = rates.gstEnabled ? round2(value * rates.gstRatePct / (100 + rates.gstRatePct)) : 0;
  const net = round2(value - commission - gst);
  if (net <= 0) return null;

  return (
    <div className="flex gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600" />
      <div className="text-xs text-emerald-800 dark:text-emerald-300 space-y-0.5">
        <p>
          If it sells at this price you receive about{' '}
          <span className="font-bold">${net.toFixed(2)}</span>.
        </p>
        <p className="text-emerald-700/80 dark:text-emerald-400/80">
          ${value.toFixed(2)} less ${commission.toFixed(2)} platform fee ({rates.feePct}%)
          {gst > 0 && <> and ${gst.toFixed(2)} GST, which we remit to the ATO for you</>}.
          {gst > 0 && ' Your price includes GST.'} Postage you charge is passed on to you in full, less the GST inside it.
        </p>
      </div>
    </div>
  );
};

export default SellerPayoutEstimate;
