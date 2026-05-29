
import apiServerClient from '@/lib/apiServerClient.js';
import { supabase } from '@/lib/supabaseClient.js';

/**
 * Runs a comprehensive suite of diagnostic tests to verify connection health
 * across all major backend services.
 *
 * @returns {Promise<Object>} Diagnostic report object
 */
export const runDiagnostics = async () => {
  const report = {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    overallHealth: 'pending',
    services: {
      supabase: {
        name: 'Supabase Database & Auth',
        status: 'pending',
        url: import.meta.env.VITE_SUPABASE_URL || 'https://supabase.io',
        latency: 0,
        error: null,
        details: []
      },
      apiServer: {
        name: 'Express.js API Server',
        status: 'pending',
        url: '/hcgi/api',
        latency: 0,
        error: null,
        details: []
      },
      network: {
        name: 'Network & Environment',
        status: 'pending',
        corsIssues: false,
        mixedContent: false,
        details: []
      }
    }
  };

  let hasErrors = false;
  let hasWarnings = false;

  // 1. Test Supabase Connection
  try {
    const startTime = performance.now();
    const { error } = await supabase.from('categories').select('id').limit(1);
    const latency = Math.round(performance.now() - startTime);

    if (error) throw error;

    report.services.supabase.status = 'connected';
    report.services.supabase.latency = latency;
    report.services.supabase.details.push(`Health check passed in ${latency}ms`);

    const { data: { session } } = await supabase.auth.getSession();
    report.services.supabase.details.push(`Auth state: ${session ? 'Valid Session' : 'No Session'}`);
  } catch (error) {
    report.services.supabase.status = 'failed';
    report.services.supabase.error = error.message || 'Connection refused or timed out';
    report.services.supabase.details.push(`Failed to reach Supabase`);
    hasErrors = true;
  }

  // 2. Test Express API Server Connection
  try {
    const apiStartTime = performance.now();
    const res = await apiServerClient.fetch('/health');
    const latency = Math.round(performance.now() - apiStartTime);

    report.services.apiServer.latency = latency;
    report.services.apiServer.details.push(`Request completed in ${latency}ms`);

    if (res.ok) {
      report.services.apiServer.status = 'connected';
      try {
        const data = await res.json();
        report.services.apiServer.details.push(`Server status: ${data.status || 'OK'}`);
      } catch (e) {
        report.services.apiServer.details.push('Warning: Response was not valid JSON');
      }
    } else {
      report.services.apiServer.status = 'warning';
      report.services.apiServer.error = `HTTP Error ${res.status}: ${res.statusText}`;
      report.services.apiServer.details.push(`Endpoint returned non-200 status code.`);
      hasWarnings = true;
    }
  } catch (error) {
    report.services.apiServer.status = 'failed';
    report.services.apiServer.error = error.message || 'Fetch failed';
    report.services.apiServer.details.push('Failed to execute fetch request to Express server.');
    if (error.message.toLowerCase().includes('failed to fetch') || error.message.toLowerCase().includes('network error')) {
      report.services.apiServer.details.push('Possible causes: Server is offline, CORS policy blocking request, or network connectivity issue.');
      report.services.network.corsIssues = true;
    }
    hasErrors = true;
  }

  // 3. Network & Configuration Assessment
  if (report.services.network.corsIssues) {
    report.services.network.status = 'warning';
    report.services.network.details.push('Potential CORS or Network issues detected based on failed fetch requests (Status 0).');
    hasWarnings = true;
  } else {
    report.services.network.status = 'healthy';
    report.services.network.details.push('No obvious network issues detected.');
    report.services.network.details.push(`Operating on protocol: ${window.location.protocol}`);
  }

  // Determine overall health
  if (hasErrors) {
    report.overallHealth = 'critical';
  } else if (hasWarnings) {
    report.overallHealth = 'degraded';
  } else {
    report.overallHealth = 'healthy';
  }

  return report;
};
