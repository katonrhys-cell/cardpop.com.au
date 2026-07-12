import React, { useState, useEffect } from 'react';
import { ExternalLink, CheckCircle2, AlertCircle, Loader2, ShieldCheck, BadgeCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import apiServerClient from '@/lib/apiServerClient.js';
import { verifyGradingNumber } from '@/lib/gradingVerification.js';
import GradeBadge from '@/components/GradeBadge.jsx';

// Pull a numeric grade out of values like "PSA 10", "9", or "GEM MT 10" so the
// listed grade can be compared against the grade PSA has on record.
const numericGrade = (value) => {
  if (value == null) return null;
  const match = String(value).match(/(\d+(?:\.\d+)?)\s*$/);
  return match ? parseFloat(match[1]) : null;
};

/**
 * Single unified certification section. Combines the verification status check
 * (cert exists + listed grade matches) with the full PSA certificate details
 * (card info, population, estimates, images) that used to live in a separate
 * card. The two lookups run in parallel and back each other up: if the
 * verification endpoint fails but the PSA detail lookup returns the cert, we
 * still know the cert is real instead of showing a contradictory error.
 */
const CertificationVerificationSection = ({ certNumber, gradingCompany = 'psa', grade }) => {
  const company = (gradingCompany || 'psa').toLowerCase();
  const isPSA = company === 'psa';

  const [verification, setVerification] = useState(null);
  const [psaData, setPsaData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!certNumber) return undefined;

    let cancelled = false;
    setLoading(true);
    setVerification(null);
    setPsaData(null);

    // Pass the listing's claimed grade so the server can tell us whether it
    // matches the real cert — not just that the cert exists.
    const verifyPromise = verifyGradingNumber(certNumber, company, grade)
      .then((data) => { if (!cancelled) setVerification(data); })
      .catch((err) => { console.error('Error verifying certification:', err); });

    // Rich certificate details are PSA-only and optional — a failure here
    // never downgrades the verification status.
    const detailsPromise = !isPSA
      ? Promise.resolve()
      : apiServerClient.fetch(`/psa/cert/${certNumber}`)
          .then((res) => {
            if (!res.ok) throw new Error('Failed to fetch PSA data');
            return res.json();
          })
          .then((json) => { if (!cancelled) setPsaData(json); })
          .catch((err) => { console.error('Error fetching PSA data:', err); });

    Promise.allSettled([verifyPromise, detailsPromise]).then(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [certNumber, company, grade, isPSA]);

  if (!certNumber) return null;

  if (loading) {
    return (
      <div className="mt-8 p-6 bg-card rounded-2xl border border-border shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
          <h3 className="font-bold text-lg text-foreground">Certification Verification</h3>
          <span className="ml-auto flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
          </span>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-24 rounded-lg" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  const listedGrade = numericGrade(grade);
  const psaGrade = numericGrade(psaData?.grade);

  // The verification endpoint is the primary signal. When it errored, the PSA
  // detail lookup doubles as a fallback: a cert we just fetched details for
  // clearly exists, so don't tell the buyer "verification error".
  // Status: 'verified' | 'mismatch' | 'not_found' | 'error'
  let status;
  if (verification) {
    if (verification.verified === true) {
      // The cert exists AND the claimed grade contradicts the real one — the
      // "real cert, inflated grade" scam. Warn, never show "verified".
      status = verification.gradeMatch === false ? 'mismatch' : 'verified';
    } else {
      status = 'not_found';
    }
  } else if (psaData) {
    status = listedGrade != null && psaGrade != null && listedGrade !== psaGrade
      ? 'mismatch'
      : 'verified';
  } else {
    status = 'error';
  }

  const verifiedGrade = verification?.verifiedGrade
    ?? (psaData?.grade != null ? String(psaData.grade) : null);
  // Only claim the GRADE is confirmed when it actually matched (not when the
  // comparison was inconclusive).
  const gradeConfirmed = status === 'verified'
    && (verification
      ? verification.gradeMatch === true
      : listedGrade != null && psaGrade != null && listedGrade === psaGrade);

  const companyLabel = company.toUpperCase();

  return (
    <div className="mt-8 p-6 bg-card rounded-2xl border border-border shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 mb-5">
        <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
        <h3 className="font-bold text-lg text-foreground">Certification Verification</h3>
        {status === 'verified' && (
          <Badge
            variant="outline"
            className="ml-auto shrink-0 inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 text-[11px] font-semibold border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 shadow-sm"
          >
            <BadgeCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            Verified by CardPop
          </Badge>
        )}
      </div>

      {/* Summary rows */}
      <div className="space-y-2 text-sm mb-4">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Company</span>
          <span className="font-medium uppercase">{company}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground">Certificate Number</span>
          <span className="font-mono font-medium">{certNumber}</span>
        </div>

        {grade && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Listed Grade</span>
            <span className="font-bold">{grade}</span>
          </div>
        )}

        {verifiedGrade != null && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Grade on {companyLabel} Record</span>
            <span className="font-bold">{verifiedGrade}</span>
          </div>
        )}

        <div className="flex justify-between items-center pt-2">
          <span className="text-muted-foreground">Status</span>
          <div className="flex items-center gap-2">
            {status === 'mismatch' && (
              <>
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                <span className="text-sm font-bold text-red-600 dark:text-red-400">Grade mismatch</span>
              </>
            )}
            {status === 'verified' && (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  Verified with {companyLabel}
                </span>
              </>
            )}
            {status === 'not_found' && (
              <>
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  Not found on {companyLabel}
                </span>
              </>
            )}
            {status === 'error' && (
              <>
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                <span className="text-sm font-medium text-red-600 dark:text-red-400">Verification error</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Status explanation */}
      {status === 'mismatch' ? (
        <p className="text-xs font-medium text-red-600 dark:text-red-400 border border-red-500/20 bg-red-500/5 px-3 py-2 rounded-lg mb-4">
          ⚠ This listing is labelled <strong>{grade}</strong>, but {companyLabel} cert{' '}
          <span className="font-mono">{certNumber}</span>
          {verifiedGrade ? <> records a grade of <strong>{verifiedGrade}</strong></> : ' records a different grade'}.
          Do not purchase based on the listed grade — confirm directly with {companyLabel} first.
        </p>
      ) : gradeConfirmed ? (
        <p className="text-xs text-muted-foreground mb-4">
          This certificate number has been verified against the official {companyLabel} database, confirming the cert is genuine and the listed grade matches the official record.
        </p>
      ) : status === 'verified' ? (
        <p className="text-xs text-muted-foreground mb-4">
          This certificate number was found in the official {companyLabel} database. We couldn't automatically match the listed grade — confirm the exact grade and card details with {companyLabel} before purchasing.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground mb-4">
          {status === 'error'
            ? `We couldn't reach the ${companyLabel} database to verify this certificate. Please try again later.`
            : `This certificate number could not be found in the official ${companyLabel} database. Confirm the details directly with ${companyLabel} before purchasing.`}
        </p>
      )}

      {/* Direct link to the official PSA cert page */}
      {isPSA && (
        <Button asChild variant="outline" size="sm" className="w-full rounded-lg mb-2">
          <a
            href={`https://www.psacard.com/cert/${certNumber}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Verify on PSA Website
          </a>
        </Button>
      )}

      {/* Full PSA certificate details */}
      {psaData && (
        <div className="pt-4 mt-4 border-t border-border">
          {/* Card Title */}
          {psaData.cardTitle && (
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Card Title</p>
              <p className="text-lg font-bold text-foreground">{psaData.cardTitle}</p>
            </div>
          )}

          {/* Card Details Grid */}
          {(psaData.cardYear || psaData.cardSet || psaData.cardNumber || psaData.grade != null) && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {psaData.cardYear && (
                <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Year</p>
                  <p className="font-bold text-foreground">{psaData.cardYear}</p>
                </div>
              )}
              {psaData.cardSet && (
                <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Set</p>
                  <p className="font-bold text-foreground text-sm">{psaData.cardSet}</p>
                </div>
              )}
              {psaData.cardNumber && (
                <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Card #</p>
                  <p className="font-bold text-foreground">#{psaData.cardNumber}</p>
                </div>
              )}
              {psaData.grade != null && (
                <div className="p-3 bg-muted/30 rounded-lg border border-border/50 flex flex-col justify-center">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Grade</p>
                  <GradeBadge grade={psaData.grade} gradingCompany="psa" isPositioned={false} className="w-fit" />
                </div>
              )}
            </div>
          )}

          {/* Additional PSA record details — horizontal rows so long values
              (subject, set/category names, label type) stay on one line and
              remain readable instead of wrapping inside a cramped grid cell. */}
          {(psaData.subject || psaData.category || psaData.variety || psaData.labelType) && (
            <div className="space-y-2 mb-6">
              {psaData.subject && (
                <div className="flex items-center justify-between gap-4 p-3 bg-muted/30 rounded-lg border border-border/50">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground shrink-0">Subject</p>
                  <p className="font-bold text-foreground text-sm text-right">{psaData.subject}</p>
                </div>
              )}
              {psaData.category && (
                <div className="flex items-center justify-between gap-4 p-3 bg-muted/30 rounded-lg border border-border/50">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground shrink-0">Category</p>
                  <p className="font-bold text-foreground text-sm text-right">{psaData.category}</p>
                </div>
              )}
              {psaData.variety && (
                <div className="flex items-center justify-between gap-4 p-3 bg-muted/30 rounded-lg border border-border/50">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground shrink-0">Variety</p>
                  <p className="font-bold text-foreground text-sm text-right">{psaData.variety}</p>
                </div>
              )}
              {psaData.labelType && (
                <div className="flex items-center justify-between gap-4 p-3 bg-muted/30 rounded-lg border border-border/50">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground shrink-0">Label Type</p>
                  <p className="font-bold text-foreground text-sm text-right">{psaData.labelType}</p>
                </div>
              )}
            </div>
          )}

          {/* Grade Category / cert flags */}
          {(psaData.gradeCategory || psaData.isDualCert || psaData.isPsaDna) && (
            <div className="flex flex-wrap gap-2 mb-6">
              {psaData.gradeCategory && (
                <Badge variant="outline" className="text-sm font-bold border-purple-400/50 text-purple-700 bg-purple-400/10 dark:text-purple-300">
                  {psaData.gradeCategory}
                </Badge>
              )}
              {psaData.isDualCert && (
                <Badge variant="outline" className="text-sm font-bold border-blue-400/50 text-blue-700 bg-blue-400/10 dark:text-blue-300">
                  Dual Cert
                </Badge>
              )}
              {psaData.isPsaDna && (
                <Badge variant="outline" className="text-sm font-bold border-emerald-400/50 text-emerald-700 bg-emerald-400/10 dark:text-emerald-300">
                  PSA/DNA Authenticated
                </Badge>
              )}
            </div>
          )}

          {/* Population Stats */}
          {(psaData.population != null || psaData.popHigher != null) && (
            <div className="grid grid-cols-2 gap-4 mb-6">
              {psaData.population != null && (
                <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Population (at this grade)</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{psaData.population.toLocaleString()}</p>
                </div>
              )}
              {psaData.popHigher != null && (
                <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Pop Higher</p>
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{psaData.popHigher.toLocaleString()}</p>
                </div>
              )}
              {psaData.populationWithQualifier != null
                && psaData.populationWithQualifier !== psaData.population && (
                <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Pop (with qualifier)</p>
                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">{psaData.populationWithQualifier.toLocaleString()}</p>
                </div>
              )}
            </div>
          )}

          {/* PSA Estimate (USD & AUD) */}
          {psaData.psaEstimate != null && (
            <div className="mb-6 space-y-3">
              <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">PSA Estimate (USD)</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                  USD ${psaData.psaEstimate.toFixed(2)}
                </p>
              </div>

              {psaData.psaEstimateAud != null && (
                <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">PSA Estimate (AUD)</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                    AUD ${psaData.psaEstimateAud.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Exchange rate: 1 USD = {psaData.exchangeRate ? `${psaData.exchangeRate.toFixed(4)} AUD` : 'N/A'}
                  </p>
                </div>
              )}

              <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  <span className="font-bold">Exchange Rate Disclaimer:</span> AUD price is updated daily and reflects the most recent USD/AUD exchange rate available. Prices based on PSA's most recent comparable sales data. Actual value may vary based on market conditions.
                  {psaData.lastExchangeRateUpdate && (
                    <span className="block mt-1 text-[11px] text-muted-foreground">
                      Last updated: {new Date(psaData.lastExchangeRateUpdate).toLocaleString()}
                    </span>
                  )}
                </p>
              </div>

              <p className="text-xs text-muted-foreground">Estimate based on PSA's recent comparable sales data</p>
            </div>
          )}

          {/* Card Images */}
          {(psaData.frontImage || psaData.backImage) && (
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Card Images</p>
              <div className="grid grid-cols-2 gap-4">
                {psaData.frontImage && (
                  <div className="rounded-lg overflow-hidden border border-border">
                    <img
                      src={psaData.frontImage}
                      alt="Card Front"
                      className="w-full h-auto object-contain"
                    />
                    <p className="text-xs text-center text-muted-foreground py-2 bg-muted/30">Front</p>
                  </div>
                )}
                {psaData.backImage && (
                  <div className="rounded-lg overflow-hidden border border-border">
                    <img
                      src={psaData.backImage}
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
          {(psaData.variant || psaData.condition) && (
            <div className="p-4 bg-muted/30 rounded-lg border border-border">
              {psaData.variant && (
                <div className={psaData.condition ? 'mb-3' : ''}>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Variant</p>
                  <p className="text-sm text-foreground">{psaData.variant}</p>
                </div>
              )}
              {psaData.condition && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Condition Notes</p>
                  <p className="text-sm text-foreground">{psaData.condition}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CertificationVerificationSection;
