import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { KeyRound, ShieldCheck, Mail, ArrowRight } from 'lucide-react';
import apiServerClient from '@/lib/apiServerClient.js';

const PasswordResetPage = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const navigate = useNavigate();

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiServerClient.fetch('/auth/password/reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to request reset');
      
      if (data.resetToken) {
        setToken(data.resetToken);
      }
      
      setStep(2);
      toast.success('Recovery link sent to your email.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyToken = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiServerClient.fetch('/auth/password/reset/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken: token })
      });
      if (!res.ok) throw new Error('Invalid or expired recovery code');
      
      setStep(3);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiServerClient.fetch('/auth/password/reset/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken: token, newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Password update failed');
      
      toast.success('Password successfully reset! Please login.');
      navigate('/login');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col bg-background font-sans">
      <Helmet><title>Recover Account | Card Pop</title></Helmet>
      
      <div className="flex-1 flex items-center justify-center p-4 py-20 bg-muted/30">
        <div className="w-full max-w-md premium-card p-8 md:p-10 bg-card">
          
          {step === 1 && (
            <>
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-primary/10 mx-auto rounded-2xl flex items-center justify-center mb-6">
                  <KeyRound className="w-8 h-8 text-primary" />
                </div>
                <h1 className="font-serif text-3xl font-bold mb-2">Account Recovery</h1>
                <p className="text-muted-foreground font-medium text-sm">
                  Enter your email to receive a password reset code.
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
            </>
          )}

          {step === 2 && (
            <>
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-primary/10 mx-auto rounded-2xl flex items-center justify-center mb-6">
                  <Mail className="w-8 h-8 text-primary" />
                </div>
                <h1 className="font-serif text-2xl font-bold mb-2">Enter Recovery Code</h1>
                <p className="text-muted-foreground font-medium text-sm">
                  Check your inbox. Code expires in 15 minutes.
                </p>
              </div>
              
              <form onSubmit={handleVerifyToken} className="space-y-6">
                <div className="space-y-2">
                  <Input 
                    required 
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Enter reset token"
                    className="bg-background text-foreground h-12 rounded-xl text-center tracking-wider font-medium border-border focus-visible:ring-primary"
                  />
                </div>
                <Button type="submit" className="w-full h-12 rounded-full font-bold shadow-sm" disabled={loading || !token}>
                  {loading ? 'Verifying...' : 'Verify Code'} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </form>
            </>
          )}

          {step === 3 && (
            <>
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-[hsl(var(--success))]/10 mx-auto rounded-2xl flex items-center justify-center mb-6">
                  <ShieldCheck className="w-8 h-8 text-[hsl(var(--success))]" />
                </div>
                <h1 className="font-serif text-2xl font-bold mb-2">Set New Password</h1>
                <p className="text-muted-foreground font-medium text-sm">
                  Must be at least 8 characters with numbers and symbols.
                </p>
              </div>
              
              <form onSubmit={handleCompleteReset} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="font-bold text-xs uppercase tracking-wide">New Secure Password</Label>
                  <Input 
                    id="newPassword"
                    type="password"
                    required 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-background text-foreground h-12 rounded-xl font-medium border-border focus-visible:ring-primary"
                  />
                </div>
                <Button type="submit" className="w-full h-12 rounded-full font-bold shadow-sm bg-primary hover:brightness-110" disabled={loading || !newPassword}>
                  {loading ? 'Updating...' : 'Update Password & Login'}
                </Button>
              </form>
            </>
          )}

          {step === 1 && (
            <div className="mt-8 text-center text-sm font-medium text-muted-foreground pt-6 border-t border-border">
              Remember your password? <Link to="/login" className="text-primary hover:underline font-bold ml-1">Sign In</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PasswordResetPage;