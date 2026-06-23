import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
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

  return (
    <div className="pt-4 border-t border-border space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <h4 className="font-bold text-sm uppercase tracking-wide">Certification Verification</h4>
        <Badge variant="outline" className="ml-auto text-[10px] font-bold border-emerald-400/50 text-emerald-700 bg-emerald-400/10">
          Verified by CardPop
        </Badge>
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

      <p className="text-xs text-muted-foreground pt-2 border-t border-border/50">
        This certificate number has been verified against the official {gradingCompany.toUpperCase()} database to confirm authenticity and accuracy of the grade and card details.
      </p>
    </div>
  );
};

export default GradingVerificationSection;
