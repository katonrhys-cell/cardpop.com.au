import React, { useState, useEffect } from 'react';
import { ExternalLink, TrendingUp, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import apiServerClient from '@/lib/apiServerClient.js';

const PSACertificationSection = ({ certNumber, gradingCompany }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!certNumber || gradingCompany !== 'PSA') {
      setLoading(false);
      return;
    }

    const fetchPSAData = async () => {
      try {
        const response = await apiServerClient.fetch(`/psa/cert/${certNumber}`);
        if (!response.ok) throw new Error('Failed to fetch PSA data');
        const json = await response.json();
        setData(json);
      } catch (err) {
        console.error('Error fetching PSA data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(() => {
      fetchPSAData();
    }, 300);

    return () => clearTimeout(timer);
  }, [certNumber, gradingCompany]);

  if (!certNumber || gradingCompany !== 'PSA') return null;

  if (loading) {
    return (
      <div className="mt-8 p-6 bg-card rounded-2xl border border-border shadow-sm">
        <div className="space-y-4">
          <Skeleton className="h-6 w-48 rounded" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
          <Skeleton className="h-40 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 p-6 bg-card rounded-2xl border border-border shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <ShieldCheck className="w-5 h-5 text-emerald-600" />
        <h3 className="font-bold text-lg text-foreground">PSA Certification Verification</h3>
      </div>

      {error ? (
        <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg border border-border">
          <AlertCircle className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">Unable to fetch PSA certification details at this time.</p>
        </div>
      ) : data ? (
        <>
          {/* Certification Number */}
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Certification Number</p>
            <p className="text-2xl font-bold text-foreground font-mono">{data.certNumber}</p>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="mt-3 w-full rounded-lg"
            >
              <a
                href={`https://www.psacard.com/cert/${data.certNumber}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Verify on PSA Website
              </a>
            </Button>
          </div>

          {/* Card Title */}
          {data.cardTitle && (
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Card Title</p>
              <p className="text-lg font-bold text-foreground">{data.cardTitle}</p>
            </div>
          )}

          {/* Card Details Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {data.cardYear && (
              <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Year</p>
                <p className="font-bold text-foreground">{data.cardYear}</p>
              </div>
            )}
            {data.cardSet && (
              <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Set</p>
                <p className="font-bold text-foreground text-sm">{data.cardSet}</p>
              </div>
            )}
            {data.cardNumber && (
              <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Card #</p>
                <p className="font-bold text-foreground">#{data.cardNumber}</p>
              </div>
            )}
            {data.grade != null && (
              <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/30">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Grade</p>
                <p className="font-bold text-lg text-purple-700 dark:text-purple-400">{data.grade}</p>
              </div>
            )}
          </div>

          {/* Grade Category */}
          {data.gradeCategory && (
            <div className="mb-6">
              <Badge variant="outline" className="text-sm font-bold border-purple-400/50 text-purple-700 bg-purple-400/10 dark:text-purple-300">
                {data.gradeCategory}
              </Badge>
            </div>
          )}

          {/* Population Stats */}
          {(data.population != null || data.popHigher != null) && (
            <div className="grid grid-cols-2 gap-4 mb-6">
              {data.population != null && (
                <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Population (at this grade)</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{data.population.toLocaleString()}</p>
                </div>
              )}
              {data.popHigher != null && (
                <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Pop Higher</p>
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{data.popHigher.toLocaleString()}</p>
                </div>
              )}
            </div>
          )}

          {/* PSA Estimate (USD & AUD) */}
          {data.psaEstimate != null && (
            <div className="mb-6 space-y-3">
              {/* USD Price */}
              <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">PSA Estimate (USD)</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                  USD ${data.psaEstimate.toFixed(2)}
                </p>
              </div>

              {/* AUD Price */}
              {data.psaEstimateAud != null && (
                <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">PSA Estimate (AUD)</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                    AUD ${data.psaEstimateAud.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Exchange rate: 1 USD = {data.exchangeRate ? `${data.exchangeRate.toFixed(4)} AUD` : 'N/A'}
                  </p>
                </div>
              )}

              {/* Disclaimer */}
              <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  <span className="font-bold">Exchange Rate Disclaimer:</span> AUD price is updated daily and reflects the most recent USD/AUD exchange rate available. Prices based on PSA's most recent comparable sales data. Actual value may vary based on market conditions.
                  {data.lastExchangeRateUpdate && (
                    <span className="block mt-1 text-[11px] text-muted-foreground">
                      Last updated: {new Date(data.lastExchangeRateUpdate).toLocaleString()}
                    </span>
                  )}
                </p>
              </div>

              <p className="text-xs text-muted-foreground">Estimate based on PSA's recent comparable sales data</p>
            </div>
          )}

          {/* Card Images */}
          {(data.frontImage || data.backImage) && (
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Card Images</p>
              <div className="grid grid-cols-2 gap-4">
                {data.frontImage && (
                  <div className="rounded-lg overflow-hidden border border-border">
                    <img
                      src={data.frontImage}
                      alt="Card Front"
                      className="w-full h-auto object-contain"
                    />
                    <p className="text-xs text-center text-muted-foreground py-2 bg-muted/30">Front</p>
                  </div>
                )}
                {data.backImage && (
                  <div className="rounded-lg overflow-hidden border border-border">
                    <img
                      src={data.backImage}
                      alt="Card Back"
                      className="w-full h-auto object-contain"
                    />
                    <p className="text-xs text-center text-muted-foreground py-2 bg-muted/30">Back</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Variant & Condition Notes */}
          {(data.variant || data.condition) && (
            <div className="mb-6 p-4 bg-muted/30 rounded-lg border border-border">
              {data.variant && (
                <div className="mb-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Variant</p>
                  <p className="text-sm text-foreground">{data.variant}</p>
                </div>
              )}
              {data.condition && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Condition Notes</p>
                  <p className="text-sm text-foreground">{data.condition}</p>
                </div>
              )}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};

export default PSACertificationSection;
