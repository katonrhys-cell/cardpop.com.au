import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Loader2, MailWarning, Compass, Tag, ShieldCheck, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext.jsx';

// Post-email-confirmation callback.
//
// Supabase sends the signup confirmation link here (via `emailRedirectTo` set in
// AuthContext.signup). The Supabase client's `detectSessionInUrl` parses the
// tokens out of the URL and signs the user in, which AuthContext picks up.
//
// Once confirmed, the user picks what they came for: browse, start selling
// (which enters the ID-verification → card-on-file chain), or add a first
// card. Previously everyone was funneled straight into ID verification —
// a passport-and-selfie check before they'd seen a single card.
//
// This is a PUBLIC route (not wrapped in ProtectedRoute) on purpose: the user
// arrives here mid-confirmation, before the session exists, so a guard would
// bounce them to /login before the token in the URL is processed.

const MAX_WAIT_MS = 8000; // give detectSessionInUrl time before declaring the link bad

const WelcomePage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isIdentityVerified, loading } = useAuth();
  const { settings } = usePlatformSettings();
  const [timedOut, setTimedOut] = useState(false);
  const redirected = useRef(false);

  // An already ID-verified user re-confirming an email doesn't need the intent
  // fork — send them to their dashboard.
  useEffect(() => {
    if (redirected.current || !isAuthenticated || !isIdentityVerified) return;
    redirected.current = true;
    navigate('/account', { replace: true });
  }, [isAuthenticated, isIdentityVerified, navigate]);

  const browsePath = settings.enable_marketplace === false ? '/shop' : '/marketplace';

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

  // Confirmed and signed in (not already ID-verified): pick a starting point.
  if (isAuthenticated) {
    const Choice = ({ to, icon: Icon, title, desc, primary }) => (
      <Link
        to={to}
        className={`group flex items-center gap-4 rounded-2xl border p-4 text-left transition-colors ${
          primary
            ? 'border-primary/40 bg-primary/5 hover:bg-primary/10'
            : 'border-border hover:border-primary/30 hover:bg-muted/40'
        }`}
      >
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${primary ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'}`}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-foreground">{title}</span>
          <span className="block text-xs text-muted-foreground mt-0.5">{desc}</span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </Link>
    );

    return (
      <Panel>
        <div className="text-center mb-6">
          <h1 className="font-serif text-2xl font-bold mb-2">You're in — welcome to CardPop</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Email confirmed. Where do you want to start?
          </p>
        </div>
        <div className="space-y-3 text-left">
          <Choice
            to={browsePath}
            icon={Compass}
            primary
            title="Browse cards"
            desc="See what collectors across Australia are listing right now"
          />
          <Choice
            to="/vault/add"
            icon={Tag}
            title="Add your first card"
            desc="Start your collection — list it for sale whenever you're ready"
          />
          <Choice
            to="/verify-identity?welcome=1"
            icon={ShieldCheck}
            title="Set up selling"
            desc="Verify your ID and add payout details — about 3 minutes"
          />
        </div>
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
