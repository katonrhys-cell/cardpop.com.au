import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { verifyGradingNumber } from '@/lib/gradingVerification.js';

/**
 * Small badge for displaying grading verification status on listing cards
 * Shows checkmark if verified, warning if not found
 */
const GradingVerificationBadgeSmall = ({ gradingNumber, company = 'psa', size = 'sm' }) => {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!gradingNumber) {
      setResult(null);
      return;
    }

    let cancelled = false;
    const verify = async () => {
      setLoading(true);
      try {
        const data = await verifyGradingNumber(gradingNumber, company);
        if (!cancelled) {
          setResult(data);
        }
      } catch {
        // Silent fail - don't show error badge on listing cards
        if (!cancelled) {
          setResult(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    const timer = setTimeout(verify, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [gradingNumber, company]);

  if (!gradingNumber || !result) return null;

  const iconClass = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const tooltipText = result.verified
    ? `Verified with ${company.toUpperCase()}`
    : `Not found on ${company.toUpperCase()}`;

  return (
    <div
      className="inline-flex items-center gap-1"
      title={tooltipText}
      aria-label={tooltipText}
    >
      {result.verified ? (
        <CheckCircle2 className={`${iconClass} text-emerald-600 dark:text-emerald-400`} />
      ) : (
        <AlertCircle className={`${iconClass} text-amber-600 dark:text-amber-400`} />
      )}
    </div>
  );
};

export default GradingVerificationBadgeSmall;
