import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import apiServerClient from '@/lib/apiServerClient.js';
import AuditLog from '@/components/AuditLog.jsx';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ShieldCheck, ShieldAlert, KeyRound, Smartphone, LogOut, Download } from 'lucide-react';
import { toast } from 'sonner';

const SecuritySettingsPage = () => {
  const { listMFAFactors, unenrollTOTP } = useAuth();
  const navigate = useNavigate();
  const [backupCodes, setBackupCodes] = useState([]);
  const [generatingCodes, setGeneratingCodes] = useState(false);
  const [mfaFactor, setMfaFactor] = useState(null);
  const [loggingOutOthers, setLoggingOutOthers] = useState(false);

  // Reflect the real MFA state from Supabase rather than a non-existent field.
  useEffect(() => {
    let cancelled = false;
    listMFAFactors()
      .then((data) => {
        if (cancelled) return;
        setMfaFactor(data?.totp?.find(f => f.status === 'verified') ?? null);
      })
      .catch(() => { if (!cancelled) setMfaFactor(null); });
    return () => { cancelled = true; };
  }, [listMFAFactors]);

  const mfaEnabled = !!mfaFactor;

  const handleMfaToggle = async (checked) => {
    // Enabling MFA requires the authenticator-app QR/enrollment flow, which
    // lives on the dedicated security page — send the user there instead of
    // pretending it happened here.
    if (checked) {
      navigate('/account/security');
      return;
    }
    if (!mfaFactor) return;
    if (!window.confirm('Are you sure you want to disable Two-Factor Authentication? This severely reduces account security.')) return;
    try {
      await unenrollTOTP(mfaFactor.id);
      setMfaFactor(null);
      toast.success('Two-Factor Authentication disabled.');
    } catch (error) {
      toast.error(error.message || 'Failed to update MFA settings.');
    }
  };

  // Signs out every other session for this account via Supabase's own
  // 'others' scope — the only revocation Supabase actually supports without
  // storing raw access tokens or reaching into its internal auth schema.
  const handleLogoutOthers = async () => {
    if (!window.confirm('Log out of all other devices? Any other browser or app currently signed in will be signed out.')) return;
    setLoggingOutOthers(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: 'others' });
      if (error) throw error;
      toast.success('Logged out of all other devices.');
    } catch (err) {
      toast.error(err.message || 'Failed to log out other devices.');
    } finally {
      setLoggingOutOthers(false);
    }
  };

  const handleGenerateBackupCodes = async () => {
    if (!window.confirm('Generating new codes will invalidate all existing backup codes. Continue?')) return;
    
    setGeneratingCodes(true);
    try {
      const res = await apiServerClient.fetch('/auth/backup-codes/generate', { method: 'POST' });
      const data = await res.json();
      if (data.codes) {
        setBackupCodes(data.codes);
        toast.success('New backup codes generated.');
      }
    } catch (err) {
      toast.error('Failed to generate backup codes.');
    } finally {
      setGeneratingCodes(false);
    }
  };

  return (
    <div className="flex flex-col bg-background font-sans">
      <Helmet><title>Security Settings | Card Pop</title></Helmet>
      
      <div className="flex-1 py-12 bg-muted/20">
        <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground mb-2">Security Center</h1>
            <p className="text-muted-foreground">Manage your account security, passwords, and active sessions.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1 space-y-6">
              {/* MFA Status Card */}
              <Card className={`border-2 ${mfaEnabled ? 'border-[hsl(var(--success))]' : 'border-[hsl(var(--warning))]'}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {mfaEnabled ? (
                      <ShieldCheck className="w-5 h-5 text-[hsl(var(--success))]" />
                    ) : (
                      <ShieldAlert className="w-5 h-5 text-[hsl(var(--warning))]" />
                    )}
                    2-Step Verification
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{mfaEnabled ? 'Enabled' : 'Disabled'}</p>
                      <p className="text-sm text-muted-foreground">Extra layer of security</p>
                    </div>
                    <Switch checked={mfaEnabled} onCheckedChange={handleMfaToggle} />
                  </div>
                </CardContent>
              </Card>

              {/* Password Action */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <KeyRound className="w-5 h-5 text-primary" /> Master Password
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Change your password regularly to keep your account secure.
                  </p>
                  <Button variant="outline" className="w-full font-bold" onClick={() => navigate('/reset-password')}>
                    Update Password
                  </Button>
                </CardContent>
              </Card>

              {/* Backup Codes */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recovery Codes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Generate new offline codes to recover your account if you lose access to your email.
                  </p>
                  
                  {backupCodes.length > 0 ? (
                    <div className="bg-muted p-4 rounded-xl mb-4 font-mono text-sm grid grid-cols-2 gap-2 text-center">
                      {backupCodes.map((code, i) => (
                        <div key={i} className="bg-background py-1 rounded border border-border">{code}</div>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1 font-semibold" onClick={handleGenerateBackupCodes} disabled={generatingCodes}>
                      {generatingCodes ? 'Generating...' : 'Generate New'}
                    </Button>
                    {backupCodes.length > 0 && (
                      <Button variant="outline" size="icon" title="Download" onClick={() => {
                        const blob = new Blob([`Card Pop Backup Codes\n\n${backupCodes.join('\n')}`], { type: 'text/plain' });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'card-pop-backup-codes.txt';
                        a.click();
                      }}>
                        <Download className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="md:col-span-2 space-y-8">
              {/* Active Sessions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-primary" /> Active Sessions
                  </CardTitle>
                  <CardDescription>You're currently signed in on this device.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    If you've signed in on another browser or device and want to make sure it's signed out, you can end every other session at once.
                  </p>
                  <Button
                    variant="outline"
                    className="font-bold text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                    onClick={handleLogoutOthers}
                    disabled={loggingOutOthers}
                  >
                    <LogOut className="w-4 h-4 mr-2" /> {loggingOutOthers ? 'Logging out...' : 'Log out of all other devices'}
                  </Button>
                </CardContent>
              </Card>

              {/* Audit Log component */}
              <AuditLog />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecuritySettingsPage;