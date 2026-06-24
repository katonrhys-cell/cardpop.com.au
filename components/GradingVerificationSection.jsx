import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Loader2, ShieldCheck, BadgeCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { verifyGradingNumber } from '@/lib/gradingVerification.js';

const GradingVerificationSection = ({ gradingNumber, gradingCompany = 'psa', grade }) => {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!gradingNumber) return;

    let cancelled = false;
    const verify = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await verifyGradingNumber(gradingNumber, gradingCompany);
        if (!cancelled) {
          setResult(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    verify();
    return () => { cancelled = true; };
  }, [gradingNumber, gradingCompany]);

  if (!gradingNumber) return null;

  // Only assert verification once the lookup has actually confirmed the cert.
  // Showing "Verified by CardPop" for an unverified/not-found/errored cert would
  // mislead buyers on public listing pages.
  const isVerified = !loading && !error && result?.verified === true;

  return (
    <div className="pt-4 border-t border-border space-y-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
        <h4 className="font-bold text-sm uppercase tracking-wide">Certification Verification</h4>
        {isVerified && (
          <Badge
            variant="outline"
            className="ml-auto shrink-0 inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 text-[11px] font-semibold border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 shadow-sm"
          >
            <BadgeCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            Verified by CardPop
          </Badge>
        )}
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Company</span>
          <span className="font-medium uppercase">{gradingCompany}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground">Certificate Number</span>
          <span className="font-mono font-medium">{gradingNumber}</span>
        </div>

        {grade && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Grade</span>
            <span className="font-bold">{grade}</span>
          </div>
        )}

        <div className="flex justify-between items-center pt-2">
          <span className="text-muted-foreground">Status</span>
          <div className="flex items-center gap-2">
            {loading && (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Verifying...</span>
              </>
            )}

            {result && !loading && (
              <>
                {result.verified ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      Verified with {result.company.toUpperCase()}
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                      Not found on {result.company.toUpperCase()}
                    </span>
                  </>
                )}
              </>
            )}

            {error && !loading && (
              <>
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                <span className="text-sm font-medium text-red-600 dark:text-red-400">Verification error</span>
              </>
            )}
          </div>
        </div>
      </div>

      {isVerified ? (
        <p className="text-xs text-muted-foreground pt-2 border-t border-border/50">
          This certificate number has been verified against the official {gradingCompany.toUpperCase()} database to confirm authenticity and accuracy of the grade and card details.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground pt-2 border-t border-border/50">
          {error
            ? `We couldn't reach the ${gradingCompany.toUpperCase()} database to verify this certificate. Please try again later.`
            : result
              ? `This certificate number could not be found in the official ${gradingCompany.toUpperCase()} database. Confirm the details directly with ${gradingCompany.toUpperCase()} before purchasing.`
              : `Checking this certificate number against the official ${gradingCompany.toUpperCase()} database…`}
        </p>
      )}
    </div>
  );
};

export default GradingVerificationSection;
