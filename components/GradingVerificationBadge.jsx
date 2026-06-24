import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { verifyGradingNumber } from '@/lib/gradingVerification.js';

const GradingVerificationBadge = ({ gradingNumber, company = 'psa' }) => {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!gradingNumber || !gradingNumber.trim()) {
      setResult(null);
      setError(null);
      return;
    }

    let cancelled = false;
    const verify = async () => {
      setLoading(true);
      setError(null);
      setResult(null);
      try {
        const data = await verifyGradingNumber(gradingNumber, company);
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

    const timer = setTimeout(verify, 500); // Debounce
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [gradingNumber, company]);

  if (!gradingNumber) return null;

  return (
    <div className="mt-2 flex items-center gap-2">
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Verifying...</span>
        </div>
      )}

      {result && !loading && (
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
            result.verified
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800'
              : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800'
          }`}
        >
          {result.verified ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Verified with {company.toUpperCase()}</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4" />
              <span>Not found on {company.toUpperCase()}</span>
            </>
          )}
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-800">
          <AlertCircle className="w-4 h-4" />
          <span>Verification error</span>
        </div>
      )}
    </div>
  );
};

export default GradingVerificationBadge;
