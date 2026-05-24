
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Activity, Database, Server, CheckCircle2, XCircle, AlertCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import pb from '@/lib/pocketbaseClient.js';
import apiServerClient from '@/lib/apiServerClient.js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import Breadcrumb from '@/components/Breadcrumb.jsx';

const COLLECTIONS_TO_CHECK = [
  'users', 'cards', 'products', 'messages', 'reviews', 'tradeRequests', 
  'transactions', 'officialCatalog', 'cardListings', 'retailers', 'auditLogs', 
  'loginAttempts', 'passwordResetTokens', 'securityAlerts', 'featuredCards', 
  'featuredSellers', 'events', 'csvFiles', 'listings', 'importHistory', 
  'marketplaceStructure', 'accountContent', 'shop_products', 'marketplace_listings', 
  'market_data', 'grading_guides', 'community_content', 'blog_articles', 
  'media', 'articles', 'trade_requests', 'categories', 'subcategories'
];

const SystemDiagnosticsPage = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [lastRun, setLastRun] = useState(null);
  
  const [systemStatus, setSystemStatus] = useState({
    pocketbase: { status: 'idle', message: '', latency: 0 },
    apiServer: { status: 'idle', message: '', latency: 0 },
  });

  const [collectionResults, setCollectionResults] = useState([]);

  const runDiagnostics = async () => {
    setIsChecking(true);
    setCollectionResults([]);
    
    // 1. Check PocketBase Core Connection
    const pbStartTime = performance.now();
    try {
      await pb.health.check({ $autoCancel: false });
      setSystemStatus(prev => ({
        ...prev,
        pocketbase: { 
          status: 'success', 
          message: 'Connected successfully', 
          latency: Math.round(performance.now() - pbStartTime) 
        }
      }));
    } catch (err) {
      setSystemStatus(prev => ({
        ...prev,
        pocketbase: { 
          status: 'error', 
          message: err.message || 'Connection failed', 
          latency: Math.round(performance.now() - pbStartTime) 
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

    // 3. Check Collections
    const results = [];
    for (const collection of COLLECTIONS_TO_CHECK) {
      try {
        // Attempt to fetch 1 record to verify existence and access
        await pb.collection(collection).getList(1, 1, { $autoCancel: false });
        results.push({
          name: collection,
          status: 'success',
          message: 'Accessible'
        });
      } catch (err) {
        // 403 means it exists but we don't have permission (expected for some collections)
        // 404 means it doesn't exist
        const isForbidden = err.status === 403;
        results.push({
          name: collection,
          status: isForbidden ? 'warning' : 'error',
          message: isForbidden ? 'Access Forbidden (Expected based on rules)' : (err.message || 'Not Found / Error')
        });
      }
      // Update state incrementally for UI feedback
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
      <Helmet><title>System Diagnostics | Admin</title></Helmet>
      
      <Breadcrumb items={[
        { label: 'Admin', path: '/admin' },
        { label: 'System Diagnostics' }
      ]} />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold font-serif tracking-tight text-foreground flex items-center gap-3">
            <Activity className="w-8 h-8 text-primary" />
            System Diagnostics
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time health check of backend services, APIs, and database collections.
          </p>
        </div>
        <Button 
          onClick={runDiagnostics} 
          disabled={isChecking}
          className="rounded-xl font-bold shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
          {isChecking ? 'Running Checks...' : 'Run Diagnostics'}
        </Button>
      </div>

      {/* Core Services Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card className="border-border shadow-sm bg-card">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-between text-lg">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                PocketBase Database
              </div>
              <StatusIcon status={systemStatus.pocketbase.status} />
            </CardTitle>
            <CardDescription>Primary data store and authentication</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">Status</span>
                <Badge variant={systemStatus.pocketbase.status === 'success' ? 'default' : 'destructive'} className="font-bold">
                  {systemStatus.pocketbase.status.toUpperCase()}
                </Badge>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">Latency</span>
                <span className="font-mono">{systemStatus.pocketbase.latency}ms</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">Details</span>
                <span className="text-foreground truncate max-w-[200px]">{systemStatus.pocketbase.message || '-'}</span>
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
                Verifying existence and access rules for {COLLECTIONS_TO_CHECK.length} required collections.
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
              {isChecking && COLLECTIONS_TO_CHECK.slice(collectionResults.length).map((collection, idx) => (
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
