
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Activity, AlertTriangle, CheckCircle2, XCircle, RefreshCw, Download, Server, Database, Globe, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { runDiagnostics } from '@/utils/connectionDiagnostics.js';

const DiagnosticsPage = () => {
  const [report, setReport] = useState(null);
  const [isChecking, setIsChecking] = useState(true);

  const executeDiagnostics = async () => {
    setIsChecking(true);
    try {
      const results = await runDiagnostics();
      setReport(results);
    } catch (error) {
      // Fallback report if the diagnostic script itself crashes
      setReport({
        timestamp: new Date().toISOString(),
        overallHealth: 'critical',
        services: {
          supabase: { status: 'failed', error: 'Diagnostic script failed to run' },
          apiServer: { status: 'failed', error: 'Diagnostic script failed to run' },
          network: { status: 'failed', error: 'Diagnostic script failed to run' }
        }
      });
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    executeDiagnostics();
  }, []);

  const handleExport = () => {
    if (!report) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `connection-diagnostics-${new Date().getTime()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const StatusIcon = ({ status, className = "w-6 h-6" }) => {
    if (isChecking) return <RefreshCw className={`${className} animate-spin text-muted-foreground`} />;
    switch (status) {
      case 'connected':
      case 'healthy':
        return <CheckCircle2 className={`${className} text-emerald-500`} />;
      case 'warning':
      case 'degraded':
        return <AlertTriangle className={`${className} text-amber-500`} />;
      case 'failed':
      case 'critical':
        return <XCircle className={`${className} text-destructive`} />;
      default:
        return <Activity className={`${className} text-muted-foreground`} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected':
      case 'healthy': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'warning':
      case 'degraded': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'failed':
      case 'critical': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-primary selection:text-primary-foreground">
      <Helmet>
        <title>System Diagnostics | Emergency Console</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-6 border-b border-white/10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-slate-300 mb-4">
              <Activity className="w-4 h-4 text-emerald-400" />
              Emergency Console
            </div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
              Connection Diagnostics
            </h1>
            <p className="text-slate-400 mt-2 text-lg max-w-xl">
              Real-time health check for frontend to backend API and Database connectivity.
            </p>
          </div>
          
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={handleExport}
              disabled={isChecking || !report}
              className="bg-transparent border-white/20 text-slate-300 hover:bg-white/5 hover:text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              Export JSON
            </Button>
            <Button 
              onClick={executeDiagnostics}
              disabled={isChecking}
              className="bg-emerald-600 hover:bg-emerald-500 text-white border-0"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
              Run Tests
            </Button>
          </div>
        </div>

        {/* Overall Status */}
        {!isChecking && report && (
          <div className={`p-6 rounded-2xl border ${getStatusColor(report.overallHealth)} flex items-center gap-4`}>
            <StatusIcon status={report.overallHealth} className="w-10 h-10 shrink-0" />
            <div>
              <h2 className="text-xl font-semibold capitalize">System is {report.overallHealth}</h2>
              <p className="opacity-80 text-sm mt-1">
                Last checked: {new Date(report.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* Skeleton Loader */}
        {isChecking && !report && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
            ))}
          </div>
        )}

        {/* Diagnostic Reports */}
        {!isChecking && report && (
          <div className="space-y-6">
            
            {/* API Server Card */}
            <Card className="bg-[#111111] border-white/10 shadow-none overflow-hidden">
              <CardHeader className="border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${getStatusColor(report.services.apiServer.status)}`}>
                      <Server className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-medium text-white">Express.js API Server</CardTitle>
                      <CardDescription className="text-slate-400">{report.services.apiServer.url}</CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className={`capitalize px-3 py-1 ${getStatusColor(report.services.apiServer.status)}`}>
                    {report.services.apiServer.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Response Latency</span>
                    <span className="font-mono text-slate-200">{report.services.apiServer.latency} ms</span>
                  </div>
                  
                  {report.services.apiServer.error && (
                    <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 mt-4">
                      <p className="text-sm font-medium text-destructive mb-1">Connection Error</p>
                      <p className="text-sm text-destructive/80 font-mono">{report.services.apiServer.error}</p>
                    </div>
                  )}

                  {report.services.apiServer.details?.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Diagnostic Logs</p>
                      <ScrollArea className="h-32 rounded-xl bg-black/50 border border-white/5 p-4">
                        <ul className="space-y-2 font-mono text-[13px] text-slate-300">
                          {report.services.apiServer.details.map((detail, idx) => (
                            <li key={idx} className="flex gap-2">
                              <span className="text-slate-600 shrink-0">&gt;</span>
                              <span>{detail}</span>
                            </li>
                          ))}
                        </ul>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              </CardContent>
              {report.services.apiServer.status === 'failed' && (
                <CardFooter className="bg-white/[0.02] border-t border-white/5 p-4">
                  <p className="text-sm text-slate-400">
                    <strong className="text-slate-200">Suggested fix:</strong> Ensure the Express.js server is running on port 3001 and CORS is configured to allow requests from your frontend origin. Check API console logs for startup errors.
                  </p>
                </CardFooter>
              )}
            </Card>

            {/* Supabase Card */}
            <Card className="bg-[#111111] border-white/10 shadow-none overflow-hidden">
              <CardHeader className="border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${getStatusColor(report.services.supabase.status)}`}>
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-medium text-white">Supabase Database</CardTitle>
                      <CardDescription className="text-slate-400">{report.services.supabase.url}</CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className={`capitalize px-3 py-1 ${getStatusColor(report.services.supabase.status)}`}>
                    {report.services.supabase.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Response Latency</span>
                    <span className="font-mono text-slate-200">{report.services.supabase.latency} ms</span>
                  </div>
                  
                  {report.services.supabase.error && (
                    <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 mt-4">
                      <p className="text-sm font-medium text-destructive mb-1">Connection Error</p>
                      <p className="text-sm text-destructive/80 font-mono">{report.services.supabase.error}</p>
                    </div>
                  )}

                  {report.services.supabase.details?.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Diagnostic Logs</p>
                      <ScrollArea className="h-32 rounded-xl bg-black/50 border border-white/5 p-4">
                        <ul className="space-y-2 font-mono text-[13px] text-slate-300">
                          {report.services.supabase.details.map((detail, idx) => (
                            <li key={idx} className="flex gap-2">
                              <span className="text-slate-600 shrink-0">&gt;</span>
                              <span>{detail}</span>
                            </li>
                          ))}
                        </ul>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              </CardContent>
              {report.services.supabase.status === 'failed' && (
                <CardFooter className="bg-white/[0.02] border-t border-white/5 p-4">
                  <p className="text-sm text-slate-400">
                    <strong className="text-slate-200">Suggested fix:</strong> Verify the Supabase project is active. Check if the URL <code>{report.services.supabase.url}</code> is correct and accessible. Look for proxy or firewall issues blocking the connection.
                  </p>
                </CardFooter>
              )}
            </Card>

            {/* Network Environment Card */}
            <Card className="bg-[#111111] border-white/10 shadow-none overflow-hidden">
              <CardHeader className="border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${getStatusColor(report.services.network.status)}`}>
                      <Globe className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-medium text-white">Network & Environment</CardTitle>
                      <CardDescription className="text-slate-400">Browser and protocol analysis</CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className={`capitalize px-3 py-1 ${getStatusColor(report.services.network.status)}`}>
                    {report.services.network.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="p-6 space-y-4">
                  {report.services.network.details?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Diagnostic Logs</p>
                      <ScrollArea className="h-32 rounded-xl bg-black/50 border border-white/5 p-4">
                        <ul className="space-y-2 font-mono text-[13px] text-slate-300">
                          {report.services.network.details.map((detail, idx) => (
                            <li key={idx} className="flex gap-2">
                              <span className="text-slate-600 shrink-0">&gt;</span>
                              <span className={detail.includes('Warning') || detail.includes('issues detected') ? 'text-amber-400' : ''}>
                                {detail}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

          </div>
        )}
      </div>
    </div>
  );
};

export default DiagnosticsPage;
