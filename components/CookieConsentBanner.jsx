import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CONSENT_ALL, CONSENT_ESSENTIAL, getConsent, onConsentChange, setConsent } from '@/lib/consent.js';

// Routes where a sticky bar would get in the way of the thing the visitor is
// doing (paying, scanning a card) — the banner waits for the next page.
export const QUIET_PREFIXES = ['/checkout', '/checkout-success', '/success', '/scan', '/admin', '/launch'];

// Small bottom bar: "Accept all" turns on the advertising tags (Google Ads
// conversion tracking, Meta Pixel); "Essentials only" keeps just the first-party
// analytics and the cookies the site needs to work. GA4 runs either way with
// Consent Mode ad-storage denied until accepted — see lib/analytics.js.
const CookieConsentBanner = () => {
  const { pathname } = useLocation();
  const [decided, setDecided] = useState(() => getConsent() !== null);

  useEffect(() => onConsentChange((v) => setDecided(v !== null)), []);

  if (decided) return null;
  if (QUIET_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  return (
    <div
      role="region"
      aria-label="Cookie preferences"
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/90 shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.25)]"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-6">
        <p className="text-sm text-muted-foreground sm:flex-1">
          We use cookies to run the site and measure what works. With your OK we also use
          Google Ads and Meta cookies to see which ads bring collectors here.{' '}
          <Link to="/privacy#cookies" className="font-medium text-primary hover:underline">
            Cookie details
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 rounded-lg"
            onClick={() => setConsent(CONSENT_ESSENTIAL)}
          >
            Essentials only
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-10 rounded-lg font-semibold"
            onClick={() => setConsent(CONSENT_ALL)}
          >
            Accept all
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsentBanner;
