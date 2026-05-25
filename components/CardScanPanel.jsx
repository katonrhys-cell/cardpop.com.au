import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, X, CheckCircle2 } from 'lucide-react';

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

const CardScanPanel = ({ isScanning, scanResult, onApply, onDismiss }) => {
  if (!isScanning && !scanResult) return null;

  const visibleFields = scanResult
    ? Object.entries(FIELD_LABELS).filter(([key]) => {
        const v = scanResult[key];
        return v !== null && v !== undefined && v !== '';
      })
    : [];

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center justify-between mb-4">
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
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-4">
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

          <div className="flex gap-2 pt-3 border-t border-primary/10">
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
  );
};

export default CardScanPanel;
