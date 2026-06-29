import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Shield, Smartphone, CheckCircle2, Loader2, KeyRound, Copy, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import Breadcrumb from '@/components/Breadcrumb.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

// ── TOTP Setup Wizard ─────────────────────────────────────────────────────────

const TOTPSetup = ({ onComplete, onCancel }) => {
  const { enrollTOTP, confirmTOTP } = useAuth();
  const [step, setStep] = useState('qr');   // 'qr' | 'verify'
  const [enrollment, setEnrollment] = useState(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await enrollTOTP();
        if (!cancelled) setEnrollment(data);
      } catch (e) {
        if (!cancelled) {
          toast.error(e.message || 'Failed to start 2FA setup');
          onCancel();
        }
      }
    })();
    return () => { cancelled = true; };
  }, [enrollTOTP, onCancel]);

  const copySecret = async () => {
    await navigator.clipboard.writeText(enrollment.totp.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast.error('Enter the 6-digit code from your app.');
      return;
    }
    setLoading(true);
    try {
      await confirmTOTP(enrollment.id, code);
      toast.success('Authenticator app linked successfully!');
      onComplete();
    } catch (e) {
      setCode('');
      toast.error(e.message || 'Invalid code — try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!enrollment) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-4">
        <Loader2 className="w-4 h-4 animate-spin" /> Generating setup code…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {step === 'qr' && (
        <>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Open <strong>Google Authenticator</strong>, <strong>Authy</strong>, or any TOTP app
              and scan this QR code. All are free to download.
            </p>
            {/* QR code returned as SVG string from Supabase */}
            <div
              className="w-48 h-48 mx-auto border rounded-xl p-2 bg-white"
              dangerouslySetInnerHTML={{ __html: enrollment.totp.qr_code }}
            />
            <p className="text-xs text-center text-muted-foreground">
              Can't scan?{' '}
              <button
                type="button"
                onClick={copySecret}
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy secret key</>}
              </button>
            </p>
          </div>
          <Button className="w-full" onClick={() => setStep('verify')}>
            I've scanned it → Enter the code
          </Button>
          <Button variant="ghost" className="w-full" onClick={onCancel}>Cancel</Button>
        </>
      )}

      {step === 'verify' && (
        <form onSubmit={handleVerify} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code your authenticator app is showing right now.
          </p>
          <div className="space-y-2">
            <Label htmlFor="totp-code" className="sr-only">6-digit code</Label>
            <Input
              id="totp-code"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="text-center text-2xl tracking-[0.5em] h-14 font-mono"
              autoFocus
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm & Enable 2FA'}
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => setStep('qr')}>
            Back
          </Button>
        </form>
      )}
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const AccountSecurity = () => {
  const { listMFAFactors, unenrollTOTP } = useAuth();
  const [factors, setFactors] = useState(null);
  const [showSetup, setShowSetup] = useState(false);
  const [disabling, setDisabling] = useState(false);

  const loadFactors = useCallback(async () => {
    try {
      const data = await listMFAFactors();
      setFactors(data);
    } catch (e) {
    }
  }, [listMFAFactors]);

  useEffect(() => { loadFactors(); }, [loadFactors]);

  const verifiedFactor = factors?.totp?.find(f => f.status === 'verified');
  const mfaEnabled = !!verifiedFactor;

  const handleDisable = async () => {
    if (!verifiedFactor) return;
    setDisabling(true);
    try {
      await unenrollTOTP(verifiedFactor.id);
      toast.success('Two-factor authentication disabled.');
      await loadFactors();
    } catch (e) {
      toast.error(e.message || 'Failed to disable 2FA.');
    } finally {
      setDisabling(false);
    }
  };

  const handleSetupComplete = async () => {
    setShowSetup(false);
    await loadFactors();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Helmet>
        <title>Security Settings | CardPop</title>
      </Helmet>

      <Breadcrumb items={[{ label: 'Account', path: '/account' }, { label: 'Security' }]} />

      <div>
        <h1 className="text-3xl font-bold font-heading mb-2">Security Settings</h1>
        <p className="text-muted-foreground">Manage your password and account security.</p>
      </div>

      {/* Password */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="w-4 h-4" /> Password
          </CardTitle>
          <CardDescription>Change your password to keep your account secure.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link to="/reset-password">Change Password</Link>
          </Button>
        </CardContent>
      </Card>

      {/* Two-Factor Authentication */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <CardTitle>Two-Factor Authentication (2FA)</CardTitle>
            </div>
            {factors !== null && (
              <Badge variant={mfaEnabled ? 'default' : 'secondary'}>
                {mfaEnabled ? 'Enabled' : 'Disabled'}
              </Badge>
            )}
          </div>
          <CardDescription>
            Add an extra layer of security with a free authenticator app like{' '}
            <strong>Google Authenticator</strong> or <strong>Authy</strong>.
            After setup, you'll need a 6-digit code from your phone each time you log in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {factors === null ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : mfaEnabled && !showSetup ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Authenticator app linked
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Smartphone className="w-4 h-4 shrink-0" />
                Open your authenticator app to get your login code.
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDisable}
                disabled={disabling}
              >
                {disabling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Disable 2FA
              </Button>
            </div>
          ) : showSetup ? (
            <TOTPSetup
              onComplete={handleSetupComplete}
              onCancel={() => setShowSetup(false)}
            />
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Protect your account by linking a free authenticator app. Works with:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Google Authenticator (iOS &amp; Android)</li>
                <li>Authy (iOS, Android &amp; desktop)</li>
                <li>Microsoft Authenticator</li>
                <li>1Password, Bitwarden, and others</li>
              </ul>
              <Button onClick={() => setShowSetup(true)}>
                Set Up Authenticator App
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountSecurity;
