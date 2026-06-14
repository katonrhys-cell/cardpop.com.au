
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { toast } from 'sonner';
import { Loader2, ArrowRight, Lock, LockOpen, Smartphone } from 'lucide-react';

// ─── Lock animation variants ─────────────────────────────────────────────────
const lockContainerVariants = {
  locked:    { backgroundColor: 'hsl(var(--primary) / 0.10)' },
  unlocking: { backgroundColor: 'hsl(var(--primary) / 0.10)' },
  unlocked:  { backgroundColor: 'rgb(16 185 129 / 0.12)' },  // emerald-500/12
  error:     { backgroundColor: 'hsl(var(--primary) / 0.10)' },
};

const lockShakeVariants = {
  idle:  { x: 0 },
  error: { x: [0, -6, 6, -5, 5, -3, 3, 0], transition: { duration: 0.45, ease: 'easeInOut' } },
};

const lockBounceVariants = {
  idle:      { scale: 1, rotate: 0 },
  unlocking: {
    scale:  [1, 1.18, 0.92, 1.06, 1],
    rotate: [0, -10, 10, -4, 0],
    transition: { duration: 0.55, ease: 'easeInOut' },
  },
};

// ─── Login Page ───────────────────────────────────────────────────────────────
const LoginPage = () => {
  const { login, verifyMFACode, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);

  // MFA state
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaData, setMfaData] = useState(null);
  const [mfaCode, setMfaCode] = useState('');

  // Lock animation state: 'locked' | 'error' | 'unlocking' | 'unlocked'
  const [lockState, setLockState] = useState('locked');

  const from = location.state?.from?.pathname || '/account';

  // If user is already authenticated, skip the login page entirely.
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate, from]);

  const handleLogin = async (e) => {
    e.preventDefault();

    const trimmedEmail    = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      toast.error('Please enter both email and password');
      return;
    }

    setLoading(true);
    try {
      const result = await login(trimmedEmail, trimmedPassword);

      if (result.requiresMfa) {
        setMfaData(result);
        // Play unlock animation first, then reveal MFA form
        setLockState('unlocking');
        setTimeout(() => {
          setLockState('unlocked');
          setMfaStep(true);
          toast.info('Please check your email for the verification code.');
        }, 650);
      } else {
        // Play animation and navigate — don't gate navigate on animation timer
        setLockState('unlocking');
        toast.success('Welcome back!');
        navigate(from, { replace: true });
      }
    } catch (error) {
      console.error('[LoginPage] Login error:', error);
      // Shake the lock on failure
      setLockState('error');
      setTimeout(() => setLockState('locked'), 500);
      toast.error(error.message || 'Failed to log in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    if (mfaCode.length !== 6) {
      toast.error('Please enter the 6-digit code from your authenticator app.');
      return;
    }

    setLoading(true);
    try {
      await verifyMFACode(mfaData.factorId, mfaCode);
      toast.success('Verification successful. Welcome back!');
      navigate(from, { replace: true });
    } catch (error) {
      setMfaCode('');
      toast.error(error.message || 'Invalid verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isUnlocked = lockState === 'unlocked' || lockState === 'unlocking';

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-muted/10">
      <Helmet>
        <title>Log In | CardPop</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="w-full max-w-md space-y-6">

        {/* ── Lock icon ─────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-4">
          <motion.div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            variants={lockContainerVariants}
            animate={lockState}
            transition={{ duration: 0.4 }}
          >
            <motion.div
              variants={lockShakeVariants}
              animate={lockState === 'error' ? 'error' : 'idle'}
            >
              <motion.div
                variants={lockBounceVariants}
                animate={lockState === 'unlocking' ? 'unlocking' : 'idle'}
              >
                <AnimatePresence mode="wait">
                  {isUnlocked ? (
                    <motion.div
                      key="open"
                      initial={{ opacity: 0, y: 8, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.3, delay: 0.2 }}
                    >
                      <LockOpen className="w-8 h-8 text-emerald-500" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="closed"
                      initial={{ opacity: 0, y: -8, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.8 }}
                      transition={{ duration: 0.25 }}
                    >
                      <Lock
                        className={`w-8 h-8 transition-colors duration-300 ${
                          loading ? 'text-primary/50 animate-pulse' : 'text-primary'
                        }`}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* Title + subtitle */}
          <div className="text-center">
            <motion.h1
              key={mfaStep ? 'mfa-title' : 'login-title'}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="text-3xl font-serif font-bold tracking-tight text-foreground"
            >
              {mfaStep ? 'Two-Factor Verification' : 'Welcome Back'}
            </motion.h1>
            <motion.p
              key={mfaStep ? 'mfa-sub' : 'login-sub'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="mt-2 text-base text-muted-foreground"
            >
              {mfaStep
                ? 'Enter the 6-digit code from your authenticator app.'
                : 'Sign in to access your vault and marketplace.'}
            </motion.p>
          </div>
        </div>

        {/* ── Form card ─────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {!mfaStep ? (
            <motion.div
              key="login-form"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25 }}
            >
              <Card className="border-border shadow-lg rounded-2xl overflow-hidden">
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
                          to="/reset-password"
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
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="mfa-form"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="border-border shadow-lg rounded-2xl overflow-hidden border-emerald-500/20">
                <form onSubmit={handleMfaSubmit}>
                  <CardHeader className="space-y-1 pb-6 text-center">
                    <CardTitle className="text-xl">Security Check</CardTitle>
                    <CardDescription className="flex items-center justify-center gap-2">
                      <Smartphone className="w-4 h-4" /> Open your authenticator app
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="mfaCode" className="sr-only">Verification Code</Label>
                      <Input
                        id="mfaCode"
                        type="text"
                        inputMode="numeric"
                        pattern="\d{6}"
                        maxLength={6}
                        placeholder="••••••"
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                        required
                        className="bg-background text-center text-3xl tracking-[0.5em] h-16 font-mono"
                        disabled={loading}
                        autoFocus
                      />
                      <p className="text-xs text-center text-muted-foreground mt-2">
                        Enter the 6-digit code from Google Authenticator, Authy, or similar
                      </p>
                    </div>
                  </CardContent>
                  <CardFooter className="flex flex-col space-y-4 pt-2">
                    <Button
                      type="submit"
                      className="w-full font-bold h-12 text-base rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white"
                      disabled={loading || mfaCode.length !== 6}
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
                        setLockState('locked');
                      }}
                      disabled={loading}
                    >
                      Back to Login
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};

export default LoginPage;
