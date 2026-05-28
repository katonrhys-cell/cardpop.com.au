import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext.jsx';
import apiServerClient from '@/lib/apiServerClient.js';
import AuditLog from '@/components/AuditLog.jsx';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ShieldCheck, ShieldAlert, KeyRound, Smartphone, LogOut, Download } from 'lucide-react';
import { toast } from 'sonner';

const SecuritySettingsPage = () => {
  const { currentUser, enableMFA, disableMFA } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [backupCodes, setBackupCodes] = useState([]);
  const [generatingCodes, setGeneratingCodes] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await apiServerClient.fetch('/auth/sessions');
      const data = await res.json();
      if (data.sessions) {
        setSessions(data.sessions);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleMfaToggle = async (checked) => {
    try {
      if (checked) {
        await enableMFA();
        toast.success('Two-Factor Authentication enabled.');
      } else {
        if (window.confirm('Are you sure you want to disable Two-Factor Authentication? This severely reduces account security.')) {
          await disableMFA();
          toast.success('Two-Factor Authentication disabled.');
        }
      }
    } catch (error) {
      toast.error('Failed to update MFA settings.');
    }
  };

  const handleLogoutSession = async (sessionId) => {
    try {
      await apiServerClient.fetch('/auth/sessions/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      toast.success('Session terminated successfully.');
      fetchSessions();
    } catch (err) {
      toast.error('Failed to terminate session.');
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
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground mb-2">Security Center</h1>
            <p className="text-muted-foreground">Manage your account security, passwords, and active sessions.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1 space-y-6">
              {/* MFA Status Card */}
              <Card className={`border-2 ${currentUser?.mfaEnabled ? 'border-[hsl(var(--success))]' : 'border-[hsl(var(--warning))]'}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {currentUser?.mfaEnabled ? (
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
                      <p className="font-semibold text-foreground">{currentUser?.mfaEnabled ? 'Enabled' : 'Disabled'}</p>
                      <p className="text-sm text-muted-foreground">Extra layer of security</p>
                    </div>
                    <Switch checked={currentUser?.mfaEnabled} onCheckedChange={handleMfaToggle} />
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
                  <Button variant="outline" className="w-full font-bold" onClick={() => window.location.href = '/reset-password'}>
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
                  <CardDescription>Devices currently logged into your account</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingSessions ? (
                    <p className="text-sm text-muted-foreground">Loading sessions...</p>
                  ) : sessions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No external sessions found.</p>
                  ) : (
                    <div className="space-y-4">
                      {sessions.map((session) => (
                        <div key={session.sessionId} className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border border-border">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-background rounded-lg shadow-sm shrink-0">
                              <Smartphone className="w-5 h-5 text-secondary" />
                            </div>
                            <div>
                              <p className="font-semibold text-foreground tracking-wide text-sm">{session.deviceName || 'Unknown Device'}</p>
                              <p className="text-xs text-muted-foreground">{session.ipAddress}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Started: {new Date(session.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleLogoutSession(session.sessionId)}>
                            <LogOut className="w-4 h-4 mr-2" /> Revoke
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
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