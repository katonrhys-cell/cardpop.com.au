import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { KeyRound, ShieldCheck, Mail } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { supabase } from '@/lib/supabaseClient.js';

const PasswordResetPage = () => {
  // 'request' = ask for the recovery email; 'update' = arrived via the email
  // link and can now set a new password.
  const [mode, setMode] = useState('request');
  const [requestSent, setRequestSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const navigate = useNavigate();
  const { resetPassword, updatePassword } = useAuth();

  // Supabase establishes a recovery session from the link in the email and
  // fires a PASSWORD_RECOVERY event (detectSessionInUrl is enabled). Detect it
  // so we show the "set new password" form instead of the email request form.
  useEffect(() => {
    if (window.location.hash.includes('type=recovery')) setMode('update');
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setMode('update');
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await resetPassword(email);
      setRequestSent(true);
      toast.success('If an account exists for this email, a recovery link is on its way.');
    } catch (error) {
      toast.error(error.message || 'Failed to send recovery email.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteReset = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await updatePassword(newPassword);
      toast.success('Password updated successfully.');
      navigate('/account');
    } catch (error) {
      toast.error(error.message || 'Password update failed. The recovery link may have expired — request a new one.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col bg-background font-sans">
      <Helmet><title>Recover Account | Card Pop</title><meta name="robots" content="noindex, nofollow" /></Helmet>

      <div className="flex-1 flex items-center justify-center p-4 py-20 bg-muted/30">
        <div className="w-full max-w-md premium-card p-8 md:p-10 bg-card">

          {mode === 'request' && !requestSent && (
            <>
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-primary/10 mx-auto rounded-2xl flex items-center justify-center mb-6">
                  <KeyRound className="w-8 h-8 text-primary" />
                </div>
                <h1 className="font-serif text-3xl font-bold mb-2">Account Recovery</h1>
                <p className="text-muted-foreground font-medium text-sm">
                  Enter your email and we'll send you a secure link to reset your password.
                </p>
              </div>

              <form onSubmit={handleRequestReset} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="font-bold text-xs uppercase tracking-wide">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="bg-background text-foreground h-12 rounded-xl font-medium border-border focus-visible:ring-primary"
                  />
                </div>
                <Button type="submit" className="w-full h-12 rounded-full font-bold shadow-sm" disabled={loading || !email}>
                  {loading ? 'Sending...' : 'Send Recovery Link'}
                </Button>
              </form>

              <div className="mt-8 text-center text-sm font-medium text-muted-foreground pt-6 border-t border-border">
                Remember your password? <Link to="/login" className="text-primary hover:underline font-bold ml-1">Sign In</Link>
              </div>
            </>
          )}

          {mode === 'request' && requestSent && (
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 mx-auto rounded-2xl flex items-center justify-center mb-6">
                <Mail className="w-8 h-8 text-primary" />
              </div>
              <h1 className="font-serif text-2xl font-bold mb-2">Check Your Inbox</h1>
              <p className="text-muted-foreground font-medium text-sm mb-8">
                If an account exists for <span className="font-bold text-foreground">{email}</span>, we've sent a link
                to reset your password. The link expires shortly, so use it soon.
              </p>
              <Button asChild variant="outline" className="w-full h-12 rounded-full font-bold">
                <Link to="/login">Back to Sign In</Link>
              </Button>
            </div>
          )}

          {mode === 'update' && (
            <>
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-[hsl(var(--success))]/10 mx-auto rounded-2xl flex items-center justify-center mb-6">
                  <ShieldCheck className="w-8 h-8 text-[hsl(var(--success))]" />
                </div>
                <h1 className="font-serif text-2xl font-bold mb-2">Set New Password</h1>
                <p className="text-muted-foreground font-medium text-sm">
                  Choose a strong password — at least 8 characters.
                </p>
              </div>

              <form onSubmit={handleCompleteReset} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="font-bold text-xs uppercase tracking-wide">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-background text-foreground h-12 rounded-xl font-medium border-border focus-visible:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="font-bold text-xs uppercase tracking-wide">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`bg-background text-foreground h-12 rounded-xl font-medium border-border focus-visible:ring-primary ${confirmPassword && confirmPassword !== newPassword ? 'border-destructive' : ''}`}
                  />
                  {confirmPassword && confirmPassword !== newPassword && (
                    <p className="text-xs text-destructive font-medium">Passwords do not match</p>
                  )}
                </div>
                <Button type="submit" className="w-full h-12 rounded-full font-bold shadow-sm bg-primary hover:brightness-110" disabled={loading || !newPassword || !confirmPassword}>
                  {loading ? 'Updating...' : 'Update Password'}
                </Button>
              </form>
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default PasswordResetPage;
