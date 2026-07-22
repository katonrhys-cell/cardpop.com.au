import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Loader2, MailWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext.jsx';

// Post-email-confirmation callback.
//
// Supabase sends the signup confirmation link here (via `emailRedirectTo` set in
// AuthContext.signup). The Supabase client's `detectSessionInUrl` parses the
// tokens out of the URL and signs the user in, which AuthContext picks up. Once
// authenticated (now email-verified), we route into the onboarding chain:
//   ID verification (Stripe Identity) → add a card → account wallet.
//
// This is a PUBLIC route (not wrapped in ProtectedRoute) on purpose: the user
// arrives here mid-confirmation, before the session exists, so a guard would
// bounce them to /login before the token in the URL is processed.

const MAX_WAIT_MS = 8000; // give detectSessionInUrl time before declaring the link bad

const WelcomePage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isIdentityVerified, loading } = useAuth();
  const [timedOut, setTimedOut] = useState(false);
  const redirected = useRef(false);

  // Once the session lands, continue the onboarding chain. An already
  // ID-verified user (e.g. re-confirming an email) skips straight to the wallet.
  useEffect(() => {
    if (redirected.current || !isAuthenticated) return;
    redirected.current = true;
    navigate(isIdentityVerified ? '/account/wallet' : '/verify-identity?welcome=1', { replace: true });
  }, [isAuthenticated, isIdentityVerified, navigate]);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), MAX_WAIT_MS);
    return () => clearTimeout(t);
  }, []);

  const Panel = ({ children }) => (
    <div className="flex flex-col bg-background font-sans min-h-[calc(100vh-4rem)]">
      <Helmet><title>Confirming Your Email | Card Pop</title><meta name="robots" content="noindex, nofollow" /></Helmet>
      <div className="flex-1 flex items-center justify-center p-4 py-12 lg:py-20 bg-muted/20">
        <div className="w-full max-w-md bg-card p-8 md:p-10 text-center border border-border rounded-2xl shadow-lg animate-in fade-in zoom-in-95">
          {children}
        </div>
      </div>
    </div>
  );

  // Link was already used, expired, or opened without valid tokens — and no
  // session materialised within the wait window.
  if (!isAuthenticated && timedOut && !loading) {
    return (
      <Panel>
        <div className="w-16 h-16 bg-amber-500/10 mx-auto rounded-2xl flex items-center justify-center mb-6">
          <MailWarning className="w-8 h-8 text-amber-500" />
        </div>
        <h1 className="font-serif text-2xl font-bold mb-3">This link didn't sign you in</h1>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          Your confirmation link may have expired or already been used. Try signing in — if your email
          is confirmed you'll go straight through, and if not you can resend the link from there.
        </p>
        <Button asChild className="w-full h-12 font-bold"><Link to="/login">Go to Login</Link></Button>
      </Panel>
    );
  }

  return (
    <Panel>
      <div className="flex flex-col items-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-6" />
        <h1 className="font-serif text-2xl font-bold mb-2">Confirming your email…</h1>
        <p className="text-muted-foreground leading-relaxed">
          Hang tight — we're verifying your email and setting up your account.
        </p>
      </div>
    </Panel>
  );
};

export default WelcomePage;
