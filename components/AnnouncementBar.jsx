import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sparkles, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { WELCOME_DISCOUNT_PCT } from '@/config/welcomeOffer.js';

// The first-order offer, said to the people it's for. Every new account gets a
// unique code worth WELCOME_DISCOUNT_PCT% off their first order
// (config/welcomeOffer.js), but until now a logged-out visitor was never told —
// the only mention sat inside checkout, behind a sign-in. This slim bar sits
// above the header for signed-out visitors, dismisses for the session, and
// stays out of the way on checkout and the pre-launch page.
const STORAGE_KEY = 'cardpop_announcement_dismissed';
const QUIET_PREFIXES = ['/checkout', '/checkout-success', '/success', '/launch', '/admin', '/login', '/signup', '/welcome', '/verify-identity'];

const readDismissed = () => {
  try { return window.sessionStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
};

const AnnouncementBar = () => {
  const { pathname } = useLocation();
  const { isAuthenticated, loading } = useAuth();
  const [dismissed, setDismissed] = useState(readDismissed);

  useEffect(() => {
    if (!dismissed) return;
    try { window.sessionStorage.setItem(STORAGE_KEY, '1'); } catch { /* private mode */ }
  }, [dismissed]);

  if (dismissed || loading || isAuthenticated) return null;
  if (QUIET_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  return (
    <div className="relative z-40 bg-brand-charcoal text-white" data-testid="announcement-bar">
      <div className="mx-auto flex max-w-[90rem] items-center justify-center gap-2 px-10 py-2 text-center text-xs font-semibold sm:text-sm">
        <Sparkles className="hidden h-4 w-4 shrink-0 text-red-400 sm:block" aria-hidden="true" />
        <p>
          {/* red-400 (#f87171), not brand-red: #CE1126 on charcoal is 2.6:1 and
              fails WCAG AA (4.5:1) — the e2e a11y audit catches it. */}
          <span className="text-red-400">{WELCOME_DISCOUNT_PCT}% off your first order</span> when you join free
          {' · '}
          <Link to="/signup" className="underline underline-offset-2 hover:text-red-400">Create your account</Link>
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export default AnnouncementBar;
