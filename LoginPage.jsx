
import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, ArrowRight, Mail } from 'lucide-react';

const LoginPage = () => {
  const { login, verifyMFACode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // MFA State
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaData, setMfaData] = useState(null);
  const [mfaCode, setMfaCode] = useState('');

  const from = location.state?.from?.pathname || '/account';

  const handleLogin = async (e) => {
    e.preventDefault();
    
    // Client-side validation to ensure non-empty strings
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    
    if (!trimmedEmail || !trimmedPassword) {
      toast.error('Please enter both email and password');
      return;
    }

    setLoading(true);
    try {
      // Pass the validated, trimmed values to the login function
      const result = await login(trimmedEmail, trimmedPassword);
      
      if (result.requiresMfa) {
        setMfaData(result);
        setMfaStep(true);
        toast.info('Please check your email for the verification code.');
      } else {
        toast.success('Welcome back!');
        // Note: AuthContext handles the redirect via window.location.href,
        // but we keep this here as a fallback
        navigate(from, { replace: true });
      }
    } catch (error) {
      // Display the exact error message from the backend
      console.error('[LoginPage] Login error caught:', error);
      toast.error(error.message || 'Failed to log in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    if (mfaCode.length !== 8) {
      toast.error('Please enter the 8-digit code sent to your email.');
      return;
    }

    setLoading(true);
    try {
      await verifyMFACode(mfaData.mfaId, mfaData.otpId, mfaCode);
      toast.success('Verification successful. Welcome back!');
      navigate(from, { replace: true });
    } catch (error) {
      toast.error(error.message || 'Invalid verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-muted/10">
      <Helmet>
        <title>Log In | CardPop</title>
      </Helmet>

      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-serif font-bold tracking-tight text-foreground">
            {mfaStep ? 'Two-Factor Verification' : 'Welcome Back'}
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            {mfaStep 
              ? 'Enter the 8-digit code sent to your email address.' 
              : 'Sign in to access your vault and marketplace.'}
          </p>
        </div>

        <Card className="border-border shadow-lg rounded-2xl overflow-hidden">
          {!mfaStep ? (
            <form onSubmit={handleLogin}>
              <CardHeader className="space-y-1 pb-6">
                <CardTitle className="text-xl">Sign In</CardTitle>
                <CardDescription>Enter your email and password to continue</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-background"
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link 
                      to="/password-reset" 
                      className="text-sm font-medium text-primary hover:underline"
                      tabIndex={-1}
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-background"
                    disabled={loading}
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col space-y-4 pt-2">
                <Button 
                  type="submit" 
                  className="w-full font-bold h-12 text-base rounded-xl" 
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>Sign In <ArrowRight className="w-5 h-5 ml-2" /></>
                  )}
                </Button>
                <div className="text-center text-sm text-muted-foreground">
                  Don't have an account?{' '}
                  <Link to="/signup" className="font-bold text-primary hover:underline">
                    Create one now
                  </Link>
                </div>
              </CardFooter>
            </form>
          ) : (
            <form onSubmit={handleMfaSubmit}>
              <CardHeader className="space-y-1 pb-6 text-center">
                <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <ShieldCheck className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Security Check</CardTitle>
                <CardDescription className="flex items-center justify-center gap-2">
                  <Mail className="w-4 h-4" /> Code sent to {email}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="mfaCode" className="sr-only">Verification Code</Label>
                  <Input
                    id="mfaCode"
                    type="text"
                    inputMode="numeric"
                    pattern="\d{8}"
                    maxLength={8}
                    placeholder="••••••••"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                    required
                    className="bg-background text-center text-3xl tracking-[0.5em] h-16 font-mono"
                    disabled={loading}
                    autoFocus
                  />
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    Enter the 8-digit code from your email
                  </p>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col space-y-4 pt-2">
                <Button 
                  type="submit" 
                  className="w-full font-bold h-12 text-base rounded-xl" 
                  disabled={loading || mfaCode.length !== 8}
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Verify & Continue'
                  )}
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="w-full"
                  onClick={() => {
                    setMfaStep(false);
                    setMfaCode('');
                    setPassword('');
                  }}
                  disabled={loading}
                >
                  Back to Login
                </Button>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
