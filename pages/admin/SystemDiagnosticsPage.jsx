
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Activity, Database, Server, CheckCircle2, XCircle, AlertCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import apiServerClient from '@/lib/apiServerClient.js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

const TABLES_TO_CHECK = [
  'profiles', 'vault_items', 'vault_images', 'listings', 'orders',
  'reviews', 'trades', 'messages', 'events', 'event_rsvps',
  'categories', 'grading_companies', 'notifications',
  'shipping_addresses', 'blog_articles', 'market_data', 'media_assets', 'disputes',
];

const SystemDiagnosticsPage = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [lastRun, setLastRun] = useState(null);
  
  const [systemStatus, setSystemStatus] = useState({
    supabase: { status: 'idle', message: '', latency: 0 },
    apiServer: { status: 'idle', message: '', latency: 0 },
  });

  const [collectionResults, setCollectionResults] = useState([]);

  const runDiagnostics = async () => {
    setIsChecking(true);
    setCollectionResults([]);
    
    // 1. Check Supabase Core Connection
    const pbStartTime = performance.now();
    try {
      const { error } = await supabase.from('profiles').select('id').limit(1);
      setSystemStatus(prev => ({
        ...prev,
        supabase: {
          status: error ? 'error' : 'success',
          message: error ? (error.message || 'Query failed') : 'Connected successfully',
          latency: Math.round(performance.now() - pbStartTime),
        }
      }));
    } catch (err) {
      setSystemStatus(prev => ({
        ...prev,
        supabase: {
          status: 'error',
          message: err.message || 'Connection failed',
          latency: Math.round(performance.now() - pbStartTime),
        }
      }));
    }

    // 2. Check API Server Connection
    const apiStartTime = performance.now();
    try {
      // Attempting to hit a standard health check endpoint. 
      // If it 404s, the server is still reachable, just missing the route.
      const res = await apiServerClient.fetch('/health-check');
      setSystemStatus(prev => ({
        ...prev,
        apiServer: { 
          status: res.ok ? 'success' : 'warning', 
          message: res.ok ? 'Connected successfully' : `Responded with ${res.status}`, 
          latency: Math.round(performance.now() - apiStartTime) 
        }
      }));
    } catch (err) {
      setSystemStatus(prev => ({
        ...prev,
        apiServer: { 
          status: 'error', 
          message: err.message || 'Connection failed', 
          latency: Math.round(performance.now() - apiStartTime) 
        }
      }));
    }

    // 3. Check Tables
    const results = [];
    for (const table of TABLES_TO_CHECK) {
      try {
        const { error } = await supabase.from(table).select('id').limit(1);
        const isForbidden = error?.code === '42501' || error?.message?.includes('permission');
        results.push({
          name: table,
          status: error ? (isForbidden ? 'warning' : 'error') : 'success',
          message: error ? (isForbidden ? 'RLS protected (expected)' : error.message) : 'Accessible',
        });
      } catch (err) {
        results.push({ name: table, status: 'error', message: err.message || 'Error' });
      }
      setCollectionResults([...results]);
    }

    setLastRun(new Date());
    setIsChecking(false);
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const StatusIcon = ({ status, className = "w-5 h-5" }) => {
    switch (status) {
      case 'success': return <CheckCircle2 className={`${className} text-emerald-500`} />;
      case 'warning': return <AlertCircle className={`${className} text-amber-500`} />;
      case 'error': return <XCircle className={`${className} text-destructive`} />;
      default: return <Activity className={`${className} text-muted-foreground animate-pulse`} />;
    }
  };

  return (
    <div className="font-sans space-y-8">
      <Helmet><title>System Diagnostics | Admin</title></Helmet>

      <AdminPageHeader
        icon={Activity}
        title="System Diagnostics"
        subtitle="Real-time health check of backend services, APIs, and database collections."
      >
        <Button
          onClick={runDiagnostics}
          disabled={isChecking}
          variant="outline"
          className="rounded-xl font-bold border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
          {isChecking ? 'Running Checks...' : 'Run Diagnostics'}
        </Button>
      </AdminPageHeader>

      {/* Core Services Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card className="border-border shadow-sm bg-card">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-between text-lg">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                Supabase Database
              </div>
              <StatusIcon status={systemStatus.supabase.status} />
            </CardTitle>
            <CardDescription>Primary data store and authentication</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">Status</span>
                <Badge variant={systemStatus.supabase.status === 'success' ? 'default' : 'destructive'} className="font-bold">
                  {systemStatus.supabase.status.toUpperCase()}
                </Badge>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">Latency</span>
                <span className="font-mono">{systemStatus.supabase.latency}ms</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">Details</span>
                <span className="text-foreground truncate max-w-[200px]">{systemStatus.supabase.message || '-'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm bg-card">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-between text-lg">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-primary" />
                Express API Server
              </div>
              <StatusIcon status={systemStatus.apiServer.status} />
            </CardTitle>
            <CardDescription>External integrations and secure endpoints</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">Status</span>
                <Badge variant={systemStatus.apiServer.status === 'success' ? 'default' : systemStatus.apiServer.status === 'warning' ? 'secondary' : 'destructive'} className="font-bold">
                  {systemStatus.apiServer.status.toUpperCase()}
                </Badge>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">Latency</span>
                <span className="font-mono">{systemStatus.apiServer.latency}ms</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">Details</span>
                <span className="text-foreground truncate max-w-[200px]">{systemStatus.apiServer.message || '-'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Collections Audit */}
      <Card className="border-border shadow-sm bg-card">
        <CardHeader className="border-b border-border bg-muted/20">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="w-5 h-5 text-primary" />
                Collection Accessibility Audit
              </CardTitle>
              <CardDescription className="mt-1">
                Verifying existence and access rules for {TABLES_TO_CHECK.length} required collections.
              </CardDescription>
            </div>
            {lastRun && (
              <div className="text-xs text-muted-foreground font-medium text-right">
                Last checked:<br/>{lastRun.toLocaleTimeString()}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px] w-full rounded-b-xl">
            <div className="divide-y divide-border">
              {collectionResults.length === 0 && isChecking ? (
                <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center h-full">
                  <RefreshCw className="w-8 h-8 animate-spin mb-4 text-primary/50" />
                  <p className="font-medium">Scanning collections...</p>
                </div>
              ) : (
                collectionResults.map((result, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 hover:bg-muted/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <StatusIcon status={result.status} />
                      <span className="font-mono text-sm font-bold text-foreground">{result.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-sm font-medium ${
                        result.status === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 
                        result.status === 'warning' ? 'text-amber-600 dark:text-amber-400' : 
                        'text-destructive'
                      }`}>
                        {result.message}
                      </span>
                    </div>
                  </div>
                ))
              )}
              
              {/* Pending items that haven't been checked yet */}
              {isChecking && TABLES_TO_CHECK.slice(collectionResults.length).map((collection, idx) => (
                <div key={`pending-${idx}`} className="flex items-center justify-between p-4 opacity-50">
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-muted-foreground animate-pulse" />
                    <span className="font-mono text-sm font-bold text-foreground">{collection}</span>
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">Pending...</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemDiagnosticsPage;
