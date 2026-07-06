import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import apiServerClient from '@/lib/apiServerClient.js';
import { storeReferralCode } from '@/lib/referral.js';

/**
 * Captures ?ref=CODE partner referral links anywhere on the site: stores the
 * code for the session (checkout pre-fills it; the trial flow attributes the
 * signup) and bumps the partner's click counter. Renders nothing.
 */
const ReferralCapture = () => {
  const [searchParams] = useSearchParams();
  const ref = searchParams.get('ref');

  useEffect(() => {
    if (!ref) return;
    const code = storeReferralCode(ref);
    if (!code) return;
    apiServerClient.fetch('/partners/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    }).catch(() => {});
  }, [ref]);

  return null;
};

export default ReferralCapture;
