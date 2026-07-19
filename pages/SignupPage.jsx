
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/contexts/AuthContext.jsx';
import OAuthButtons from '@/components/OAuthButtons.jsx';
import apiServerClient from '@/lib/apiServerClient.js';
import Turnstile from '@/components/Turnstile.jsx';
import { TURNSTILE_ENABLED } from '@/lib/turnstile.js';
import { isPasswordPwned } from '@/utils/pwnedPassword.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { BadgeCheck, CheckCircle2, Circle, KeyRound, Loader2, MailCheck, ScrollText, ShieldCheck, Smartphone, Vault } from 'lucide-react';

// Security copy is deliberately accurate to what we actually run (see
// TrustSafetyPage): Stripe PCI-DSS checkout, Stripe Identity ID checks,
// HaveIBeenPwned breach screening (in this page's submit handler) and
// optional authenticator-app MFA.
const SECURITY_FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Bank-grade payment security',
    body: 'Every order runs through Stripe’s PCI-DSS Level 1 checkout — your card details never touch CardPop’s servers.',
  },
  {
    icon: BadgeCheck,
    title: 'Verified members only',
    body: 'Sellers confirm their identity with a government ID and selfie through Stripe Identity, so you only ever deal with a verified person.',
  },
  {
    icon: KeyRound,
    title: 'Breach-checked passwords',
    body: 'Your password is screened against known data breaches before it’s accepted — without it ever leaving your browser.',
  },
  {
    icon: Smartphone,
    title: 'Two-factor authentication',
    body: 'Add an authenticator app after signup for a second lock on your vault every time you sign in.',
  },
];

const SignupPage = () => {
  const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '' });
  const [newsletterOptIn, setNewsletterOptIn] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const turnstileRef = useRef(null);

  const [passwordValidation, setPasswordValidation] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
  });

  const { signup } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const p = formData.password;
    setPasswordValidation({
      length: p.length >= 8,
      uppercase: /[A-Z]/.test(p),
      lowercase: /[a-z]/.test(p),
      number: /[0-9]/.test(p),
      special: /[^A-Za-z0-9]/.test(p),
    });
  }, [formData.password]);

  const score = Object.values(passwordValidation).filter(Boolean).length;
  const isPasswordValid = score === 5;
  const passwordsMatch = formData.confirmPassword !== '' && formData.password === formData.confirmPassword;
  const isFormValid = formData.firstName.trim() !== '' && formData.lastName.trim() !== '' && formData.email.trim() !== '' && isPasswordValid && passwordsMatch && termsAccepted && (!TURNSTILE_ENABLED || Boolean(captchaToken));

  const handleAccountSubmit = async (e) => {
    e.preventDefault();
    if (!isPasswordValid) {
      toast.error('Please meet all password requirements to continue.');
      return;
    }
    if (!passwordsMatch) {
      toast.error('Passwords do not match. Please re-enter them.');
      return;
    }

    setLoading(true);
    try {
      // Reject passwords found in known data breaches (HaveIBeenPwned, checked
      // via k-anonymity so the password never leaves the browser). Fails open.
      if (await isPasswordPwned(formData.password)) {
        toast.error('This password has appeared in a known data breach. Please choose a different one to keep your account secure.');
        return;
      }

      // Turnstile token (when enabled) is verified server-side by Supabase Auth.
      const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();
      const result = await signup(formData.email, formData.password, fullName, captchaToken);
      const user = result?.user;
      const session = result?.session;

      // Newsletter opt-in (fire-and-forget — never blocks registration).
      if (newsletterOptIn) {
        apiServerClient.fetch('/newsletter/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formData.email, firstName: formData.firstName.trim() }),
        });
      }

      // Issue the welcome offer (unique code → 30-day trial + 10% off first
      // order) — arrives as its own email, separate from verification.
      // Fire-and-forget: never blocks registration.
      if (user?.id) {
        apiServerClient.fetch('/welcome-offer/issue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        }).catch(() => {});
      }

      // Send the verification email regardless of the newsletter choice.
      if (user?.id) {
        try {
          await apiServerClient.fetch('/send-verification-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id })
          });
        } catch (emailErr) {
          // Non-fatal: the account exists; surface it but continue.
          toast.error('Account created, but the verification email failed to send. You can resend it from Login.');
        }
      }

      toast.success('Account created successfully!');

      // If email confirmation is disabled the user already has a live session,
      // so the signup flow continues straight into Stripe Identity ID
      // verification, then on to the membership page (card at registration).
      // Otherwise they must verify their email first; ID verification and the
      // card are collected on their first sign-in.
      if (session?.access_token) {
        navigate('/verify-identity?welcome=1');
      } else {
        setSuccess(true);
      }
    } catch (error) {
      // Turnstile tokens are single-use; reset so the user can submit again.
      turnstileRef.current?.reset();
      setCaptchaToken('');
      toast.error(error.message || 'Registration failed. Email may already be in use.');
    } finally {
      setLoading(false);
    }
  };

  const getProgressColor = () => {
    if (score === 0) return 'bg-muted';
    if (score < 5) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const ValidationItem = ({ met, text }) => (
    <li className={`flex items-center gap-2 text-sm transition-colors duration-300 ${met ? 'text-green-600 dark:text-green-500 font-medium' : 'text-muted-foreground'}`}>
      {met ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <Circle className="w-4 h-4 shrink-0" />}
      <span>{text}</span>
    </li>
  );

  if (success) {
    return (
      <div className="flex flex-col bg-background font-sans min-h-[calc(100vh-4rem)]">
        <Helmet><title>Check Your Email | Card Pop</title><meta name="robots" content="noindex, nofollow" /></Helmet>
        <div className="flex-1 flex items-center justify-center p-4 py-12 lg:py-20 bg-muted/20">
          <div className="w-full max-w-md bg-card p-8 md:p-10 text-center border border-border rounded-2xl shadow-lg animate-in fade-in zoom-in-95">
            <div className="w-16 h-16 bg-primary/10 mx-auto rounded-2xl flex items-center justify-center mb-6">
              <MailCheck className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-serif text-2xl font-bold mb-4">Check Your Email</h2>
            <p className="text-muted-foreground mb-4 leading-relaxed">
              We've sent a verification link to <span className="text-foreground font-bold">{formData.email}</span>.
              Check your email to verify your account and complete your profile.
            </p>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              Once you sign in, verify your <span className="text-foreground font-bold">ID</span> (a quick photo of
              your licence or passport, handled securely by Stripe), then start your{' '}
              <span className="text-foreground font-bold">30-day free trial</span> to list and sell cards — add a
              card or PayPal to begin, and cancel anytime before the trial ends.
            </p>
            <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
              We've also sent your <span className="text-foreground font-bold">welcome code</span> in a separate
              email — redeem it on the Membership page to claim your trial, plus take{' '}
              <span className="text-foreground font-bold">10% off your first order</span> at checkout.
            </p>
            <Button asChild className="w-full h-12 font-bold">
              <Link to="/login">Go to Login</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-background font-sans min-h-[calc(100vh-4rem)]">
      <Helmet><title>Join | Card Pop</title><meta name="robots" content="noindex, nofollow" /></Helmet>

      <div className="flex-1 py-12 lg:py-20 bg-muted/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:grid-rows-[auto_1fr] gap-10 lg:gap-x-16 items-start">

          {/* ── Heading + vault icon ────────────────────────────────────── */}
          <div className="text-center lg:text-left">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto lg:mx-0 mb-6">
              <Vault className="w-8 h-8 text-primary" />
            </div>
            <h1 className="font-serif text-3xl lg:text-4xl font-bold tracking-tight mb-3">Create Your Vault</h1>
            <p className="text-muted-foreground text-base leading-relaxed">
              Join the elite collector network securely. One account unlocks your vault,
              the marketplace and live market analytics.
            </p>
          </div>

          {/* ── Security summary ────────────────────────────────────────── */}
          <div className="order-3 lg:order-none lg:col-start-1 lg:row-start-2">
            <h2 className="font-bold text-xs uppercase tracking-wide text-muted-foreground mb-5 text-center lg:text-left">
              Why your vault is secure
            </h2>
            <ul className="space-y-5">
              {SECURITY_FEATURES.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex items-start gap-4">
                  <span className="w-10 h-10 shrink-0 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </span>
                  <div>
                    <h3 className="font-bold text-sm text-foreground mb-0.5">{title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-muted-foreground text-center lg:text-left">
              Read more about how we protect you in our{' '}
              <Link to="/trust-safety" className="text-primary hover:underline font-medium">
                Trust &amp; Safety
              </Link>{' '}
              hub.
            </p>
          </div>

          {/* ── Signup form ─────────────────────────────────────────────── */}
          <div className="order-2 lg:order-none w-full bg-card p-6 sm:p-8 border border-border rounded-2xl shadow-lg lg:col-start-2 lg:row-start-1 lg:row-span-2">
            <form onSubmit={handleAccountSubmit} className="space-y-5">
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="font-bold text-xs uppercase tracking-wide">First Name</Label>
                    <Input
                      id="firstName"
                      required
                      value={formData.firstName}
                      onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                      className="bg-background h-12"
                      placeholder="e.g. Maya"
                      autoComplete="given-name"
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="font-bold text-xs uppercase tracking-wide">Last Name</Label>
                    <Input
                      id="lastName"
                      required
                      value={formData.lastName}
                      onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                      className="bg-background h-12"
                      placeholder="e.g. Chen"
                      autoComplete="family-name"
                      disabled={loading}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Must match the identification you provide</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="font-bold text-xs uppercase tracking-wide">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="bg-background h-12"
                  placeholder="you@example.com"
                  disabled={loading}
                />
              </div>
              <div className="space-y-3 pb-2">
                <Label htmlFor="password" className="font-bold text-xs uppercase tracking-wide">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="bg-background h-12"
                  placeholder="Create a strong password"
                  disabled={loading}
                />

                <div className="flex gap-1 h-1.5 mt-3">
                  {[1, 2, 3, 4, 5].map(idx => (
                    <div
                      key={idx}
                      className={`flex-1 rounded-full transition-colors duration-300 ${idx <= score ? getProgressColor() : 'bg-muted'}`}
                    />
                  ))}
                </div>

                <ul className="space-y-2 mt-4 bg-muted/30 p-4 rounded-xl border border-border/50">
                  <ValidationItem met={passwordValidation.length} text="At least 8 characters" />
                  <ValidationItem met={passwordValidation.uppercase} text="One uppercase letter" />
                  <ValidationItem met={passwordValidation.lowercase} text="One lowercase letter" />
                  <ValidationItem met={passwordValidation.number} text="One number" />
                  <ValidationItem met={passwordValidation.special} text="One special character" />
                </ul>
              </div>
              <div className="space-y-2 pb-2">
                <Label htmlFor="confirmPassword" className="font-bold text-xs uppercase tracking-wide">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  required
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  className="bg-background h-12"
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  disabled={loading}
                />
                {formData.confirmPassword !== '' && (
                  passwordsMatch ? (
                    <p className="flex items-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-500">
                      <CheckCircle2 className="w-4 h-4 shrink-0" /> Passwords match
                    </p>
                  ) : (
                    <p className="text-sm font-medium text-destructive">Passwords do not match</p>
                  )
                )}
              </div>

              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={newsletterOptIn}
                  onChange={(e) => setNewsletterOptIn(e.target.checked)}
                  disabled={loading}
                  className="mt-0.5 w-4 h-4 rounded border-border accent-primary"
                />
                <span className="text-sm text-muted-foreground leading-snug">
                  Subscribe to the CardPop newsletter for market insights, new card releases, and community news.
                </span>
              </label>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ScrollText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <Label className="font-bold text-xs uppercase tracking-wide">Terms &amp; Conditions</Label>
                </div>
                <div className="h-40 overflow-y-auto rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground space-y-3 leading-relaxed">
                  <p className="text-xs text-muted-foreground/70">Last Updated: May 10, 2026</p>
                  <p><strong className="text-foreground">1. Acceptance of Terms</strong><br />By accessing or using CardPop, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our platform.</p>
                  <p><strong className="text-foreground">2. User Accounts</strong><br />You must be at least 18 years old to create an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p>
                  <p><strong className="text-foreground">3. Marketplace Rules</strong><br />Users agree to provide accurate descriptions and images of items listed for sale. CardPop reserves the right to remove listings that violate our policies or appear fraudulent.</p>
                  <p><strong className="text-foreground">4. Fees and Payments</strong><br />CardPop charges fees for certain services, including sales commissions. All fees are clearly displayed before you commit to a transaction. You agree to pay all applicable fees.</p>
                  <p><strong className="text-foreground">5. Limitation of Liability</strong><br />CardPop is a marketplace facilitator. We are not responsible for the actions of individual users, though we provide protection programs as outlined in our Trust &amp; Safety policy.</p>
                </div>
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    required
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    disabled={loading}
                    className="mt-0.5 w-4 h-4 rounded border-border accent-primary"
                  />
                  <span className="text-sm text-muted-foreground leading-snug">
                    I have read and agree to the{' '}
                    <Link to="/terms" className="text-primary hover:underline font-medium" target="_blank" rel="noopener noreferrer">
                      Terms &amp; Conditions
                    </Link>
                  </span>
                </label>
              </div>

              <Turnstile
                ref={turnstileRef}
                onVerify={setCaptchaToken}
                onExpire={() => setCaptchaToken('')}
                className="flex justify-center"
              />

              <Button
                type="submit"
                className="w-full h-12 font-bold text-base mt-4 transition-all"
                disabled={loading || !isFormValid}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                {loading ? 'Creating Account...' : 'Create Secure Account'}
              </Button>
            </form>

            <div className="mt-6">
              <OAuthButtons redirectTo={`${window.location.origin}/account`} disabled={loading} />
            </div>

            <div className="mt-8 text-center text-sm text-muted-foreground pt-6 border-t border-border">
              Already have an account? <Link to="/login" className="text-primary hover:underline font-bold ml-1">Sign In</Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SignupPage;
