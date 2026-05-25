import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, X, CheckCircle2, TrendingUp, ExternalLink } from 'lucide-react';

const FIELD_LABELS = {
  name: 'Card Name',
  collectionType: 'Collection',
  cardSetName: 'Set Name',
  cardNumber: 'Card #',
  releaseYear: 'Release Year',
  condition: 'Condition',
  gradingService: 'Grading',
  gradeScore: 'Grade Score',
  certificationNumber: 'Cert Number',
  rarity: 'Rarity',
  cardType: 'Card Type',
  brand: 'Brand',
  series: 'Series',
  description: 'Description',
};

const fmt = v => `$${v.toFixed(2)}`;

const CardScanPanel = ({
  isScanning,
  scanResult,
  onApply,
  onDismiss,
  isLookingUp,
  priceData,
  onApplyPrice,
}) => {
  const isVisible = isScanning || scanResult || isLookingUp || priceData;
  if (!isVisible) return null;

  const visibleFields = scanResult
    ? Object.entries(FIELD_LABELS).filter(([key]) => {
        const v = scanResult[key];
        return v !== null && v !== undefined && v !== '';
      })
    : [];

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 animate-in fade-in slide-in-from-top-2 duration-300 space-y-4">

      {/* OCR Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isScanning ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <Sparkles className="w-4 h-4 text-primary" />
            )}
            <h3 className="font-bold text-sm text-primary">
              {isScanning ? 'Scanning card...' : 'AI Scan Results — review before applying'}
            </h3>
          </div>
          {!isScanning && (
            <button
              type="button"
              onClick={onDismiss}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {isScanning && (
          <div className="space-y-2">
            {[80, 60, 70, 50, 65, 55].map((w, i) => (
              <div
                key={i}
                className="h-3.5 bg-muted/60 rounded-full animate-pulse"
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
        )}

        {!isScanning && scanResult && (
          <>
            {visibleFields.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">
                No data could be extracted from this image.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {visibleFields.map(([key, label]) => (
                  <div key={key} className={key === 'description' ? 'col-span-2 border-t border-primary/10 pt-2 mt-1' : ''}>
                    <span className="text-xs text-muted-foreground block">{label}</span>
                    <span className="font-semibold text-foreground leading-tight">
                      {String(scanResult[key])}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-3 mt-3 border-t border-primary/10">
              <Button
                type="button"
                size="sm"
                onClick={onApply}
                disabled={visibleFields.length === 0}
                className="flex-1 font-semibold gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                Apply to Form
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={onDismiss} className="flex-1">
                Dismiss
              </Button>
            </div>
          </>
        )}
      </div>

      {/* eBay Price Section — shows after OCR completes */}
      {(isLookingUp || priceData) && !isScanning && scanResult && (
        <div className="border-t border-primary/15 pt-4">
          <div className="flex items-center gap-2 mb-3">
            {isLookingUp ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-green-600" />
            ) : (
              <TrendingUp className="w-3.5 h-3.5 text-green-600" />
            )}
            <span className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wide">
              eBay AU Price Estimate
            </span>
          </div>

          {isLookingUp && (
            <div className="space-y-1.5">
              {[55, 40, 70].map((w, i) => (
                <div key={i} className="h-3 bg-muted/60 rounded-full animate-pulse" style={{ width: `${w}%` }} />
              ))}
            </div>
          )}

          {!isLookingUp && priceData && (
            <>
              <div className="flex items-end gap-3 mb-3">
                <div>
                  <p className="text-xs text-muted-foreground">Suggested</p>
                  <p className="text-2xl font-bold text-foreground">{fmt(priceData.suggested)}</p>
                </div>
                <div className="pb-1 text-sm text-muted-foreground">
                  <span>Range: {fmt(priceData.low)} – {fmt(priceData.high)}</span>
                  <span className="ml-2 text-xs">({priceData.count} listings)</span>
                </div>
              </div>

              {priceData.sampleListings?.length > 0 && (
                <div className="space-y-1 mb-3">
                  {priceData.sampleListings.slice(0, 3).map((l, i) => (
                    <a
                      key={i}
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors group"
                    >
                      <span className="truncate flex-1 mr-2">{l.title}</span>
                      <span className="font-semibold text-foreground whitespace-nowrap">{fmt(l.price)}</span>
                      <ExternalLink className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </a>
                  ))}
                </div>
              )}

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onApplyPrice(priceData.suggested)}
                className="w-full border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950 font-semibold gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Use {fmt(priceData.suggested)} as estimated value
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default CardScanPanel;
