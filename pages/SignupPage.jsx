
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext.jsx';
import apiServerClient from '@/lib/apiServerClient.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { CheckCircle2, Circle, Loader2, MailCheck, ScrollText } from 'lucide-react';

const SignupPage = () => {
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [newsletterOptIn, setNewsletterOptIn] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
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
  const isFormValid = formData.name.trim() !== '' && formData.email.trim() !== '' && isPasswordValid && termsAccepted;

  const handleAccountSubmit = async (e) => {
    e.preventDefault();
    if (!isPasswordValid) {
      toast.error('Please meet all password requirements to continue.');
      return;
    }
    
    setLoading(true);
    try {
      const user = await signup(formData.email, formData.password, formData.name);

      if (newsletterOptIn) {
        apiServerClient.fetch('/newsletter/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formData.email, firstName: formData.name.split(' ')[0] }),
        });

        try {
          await apiServerClient.fetch('/send-verification-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id })
          });
          setSuccess(true);
          toast.success('Account created successfully!');
        } catch (emailErr) {
          toast.error('Account created, but failed to send verification email. Please contact support.');
          navigate('/login');
        }
      }
    } catch (error) {
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
            <p className="text-muted-foreground mb-8 leading-relaxed">
              We've sent a verification link to <span className="text-foreground font-bold">{formData.email}</span>. 
              Check your email to verify your account and complete your profile.
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
      
      <div className="flex-1 flex items-center justify-center p-4 py-12 lg:py-20 bg-muted/20">
        <div className="w-full max-w-md bg-card p-8 border border-border rounded-2xl shadow-lg">
          <div className="text-center mb-8">
            <h1 className="font-serif text-3xl font-bold mb-2">Create Your Vault</h1>
            <p className="text-muted-foreground">Join the elite collector network securely</p>
          </div>
          
          <form onSubmit={handleAccountSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name" className="font-bold text-xs uppercase tracking-wide">Full Name</Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="bg-background h-12"
                placeholder="e.g. Maya Chen"
                disabled={loading}
              />
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
              <Label htmlFor="password" className="font-bold text-xs uppercase tracking-wide">Master Password</Label>
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

            <Button
              type="submit"
              className="w-full h-12 font-bold text-base mt-4 transition-all"
              disabled={loading || !isFormValid}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              {loading ? 'Creating Account...' : 'Create Secure Account'}
            </Button>
          </form>
          <div className="mt-8 text-center text-sm text-muted-foreground pt-6 border-t border-border">
            Already have an account? <Link to="/login" className="text-primary hover:underline font-bold ml-1">Sign In</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
