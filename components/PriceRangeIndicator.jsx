import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Visual price range bar showing Floor / Low / Avg / High for a card.
 * Optionally marks where the user's currentPrice sits on the scale.
 */
const PriceRangeIndicator = ({ range, currentPrice, className }) => {
  if (!range) return null;

  const { floor_aud, low_aud, avg_aud, high_aud } = range;

  // Scale slightly beyond the extremes so markers don't sit at the very edge
  const scaleMin = low_aud * 0.75;
  const scaleMax = high_aud * 1.12;
  const span = scaleMax - scaleMin;

  const pos = (v) =>
    span > 0 ? Math.max(0, Math.min(100, ((v - scaleMin) / span) * 100)) : 0;

  const lowPos  = pos(low_aud);
  const avgPos  = pos(avg_aud);
  const highPos = pos(high_aud);
  const pPos    = currentPrice != null ? pos(currentPrice) : null;

  const isBelowLow  = currentPrice != null && currentPrice < low_aud;
  const isInRange   = currentPrice != null && currentPrice >= low_aud && currentPrice <= high_aud;
  const isAboveHigh = currentPrice != null && currentPrice > high_aud;

  const priceColor = isBelowLow  ? 'bg-amber-400' :
                     isAboveHigh ? 'bg-primary'    : 'bg-emerald-500';

  const statusText = isBelowLow  ? 'Below market low — discounted pricing' :
                     isAboveHigh ? 'Above market high — premium pricing'    :
                     isInRange   ? 'Within typical market range'             : null;

  const statusColor = isBelowLow  ? 'text-amber-600'  :
                      isAboveHigh ? 'text-primary'     :
                      isInRange   ? 'text-emerald-600' : '';

  return (
    <div className={cn('space-y-3', className)}>
      {/* Labels */}
      <div className="grid grid-cols-3 text-center text-[10px] font-bold uppercase tracking-wide">
        <span className="text-amber-600">Low</span>
        <span className="text-emerald-600">Average</span>
        <span className="text-primary">High</span>
      </div>

      {/* Bar */}
      <div className="relative h-4 rounded-full bg-muted select-none">
        {/* Low→Avg zone */}
        <div
          className="absolute inset-y-0 rounded-l-full bg-amber-400/30"
          style={{ left: `${lowPos}%`, width: `${Math.max(0, avgPos - lowPos)}%` }}
        />
        {/* Avg→High zone */}
        <div
          className="absolute inset-y-0 bg-emerald-400/30"
          style={{ left: `${avgPos}%`, width: `${Math.max(0, highPos - avgPos)}%` }}
        />

        {/* Fixed tick markers */}
        {[
          { p: lowPos,  color: 'bg-amber-500',   label: `$${low_aud.toFixed(0)}`  },
          { p: avgPos,  color: 'bg-emerald-500',  label: `$${avg_aud.toFixed(0)}`  },
          { p: highPos, color: 'bg-primary',      label: `$${high_aud.toFixed(0)}` },
        ].map(({ p, color, label }) => (
          <div
            key={label}
            className={`absolute top-0 bottom-0 w-0.5 ${color} opacity-70`}
            style={{ left: `${p}%` }}
          />
        ))}

        {/* Current price marker */}
        {pPos != null && (
          <div
            className={`absolute top-1/2 w-5 h-5 rounded-full border-2 border-background shadow-md -translate-x-1/2 -translate-y-1/2 z-10 transition-all ${priceColor}`}
            style={{ left: `${pPos}%` }}
          />
        )}
      </div>

      {/* Price labels row */}
      <div className="grid grid-cols-3 text-center text-xs font-semibold">
        <span className="text-amber-600">${low_aud.toFixed(2)}</span>
        <span className="text-emerald-600">${avg_aud.toFixed(2)}</span>
        <span className="text-primary">${high_aud.toFixed(2)}</span>
      </div>

      {/* Status line for the user's price */}
      {statusText && (
        <p className={`text-xs font-semibold ${statusColor}`}>
          {statusText}
        </p>
      )}
    </div>
  );
};

export default PriceRangeIndicator;
