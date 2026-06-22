import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, X, CheckCircle2, TrendingUp, ExternalLink, CreditCard } from 'lucide-react';

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

const SCAN_PHASES = ['Identifying card...', 'Extracting data...', 'Verifying fields...'];

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
  const [scanPhase, setScanPhase] = useState(0);

  useEffect(() => {
    if (!isScanning) { setScanPhase(0); return; }
    const interval = setInterval(() => {
      setScanPhase(p => (p + 1) % SCAN_PHASES.length);
    }, 1400);
    return () => clearInterval(interval);
  }, [isScanning]);

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
          <>
            <style>{`
              @keyframes scanBeam {
                0%, 100% { top: 10px; opacity: 1; }
                48% { top: calc(100% - 10px); opacity: 1; }
                50% { top: calc(100% - 10px); opacity: 0.3; }
              }
              @keyframes cornerPulse {
                0%, 100% { opacity: 0.5; }
                50% { opacity: 1; }
              }
              .scan-beam {
                animation: scanBeam 1.8s ease-in-out infinite;
                position: absolute;
                left: 14px;
                right: 14px;
                height: 2px;
                background: linear-gradient(90deg, transparent 0%, hsl(var(--primary)) 30%, hsl(var(--primary)) 70%, transparent 100%);
                box-shadow: 0 0 6px 2px hsl(var(--primary) / 0.45), 0 0 16px 4px hsl(var(--primary) / 0.2);
              }
              .scan-corner {
                animation: cornerPulse 1.8s ease-in-out infinite;
              }
            `}</style>
            <div className="relative rounded-xl overflow-hidden bg-gradient-to-b from-primary/8 to-muted/20 border border-primary/20 h-44 select-none">
              {/* Corner markers */}
              <div className="scan-corner absolute top-2.5 left-2.5 w-5 h-5 border-t-2 border-l-2 border-primary/70 rounded-tl" />
              <div className="scan-corner absolute top-2.5 right-2.5 w-5 h-5 border-t-2 border-r-2 border-primary/70 rounded-tr" />
              <div className="scan-corner absolute bottom-2.5 left-2.5 w-5 h-5 border-b-2 border-l-2 border-primary/70 rounded-bl" />
              <div className="scan-corner absolute bottom-2.5 right-2.5 w-5 h-5 border-b-2 border-r-2 border-primary/70 rounded-br" />

              {/* Card silhouette */}
              <div className="absolute inset-0 flex items-center justify-center text-primary/8 pointer-events-none">
                <CreditCard className="w-20 h-20" />
              </div>

              {/* Laser beam */}
              <div className="scan-beam" />

              {/* Phase text */}
              <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-1.5">
                <div className="flex gap-1">
                  {SCAN_PHASES.map((_, i) => (
                    <div
                      key={i}
                      className="w-1 h-1 rounded-full transition-all duration-300"
                      style={{ background: i === scanPhase ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.25)' }}
                    />
                  ))}
                </div>
                <span className="text-xs font-semibold text-primary ml-1">
                  {SCAN_PHASES[scanPhase]}
                </span>
              </div>
            </div>
          </>
        )}

        {!isScanning && scanResult && (
          <>
            {scanResult.catalogueMatch && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 rounded-lg px-2.5 py-1.5 mb-3">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Matched to catalogue{scanResult.catalogueMatch.source ? ` (${scanResult.catalogueMatch.source})` : ''} — set &amp; card number verified
                </span>
              </div>
            )}
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
