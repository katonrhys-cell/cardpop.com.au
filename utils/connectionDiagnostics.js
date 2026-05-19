
import apiServerClient from '@/lib/apiServerClient.js';
import pb from '@/lib/pocketbaseClient.js';

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
      pocketbase: {
        name: 'PocketBase Database & Auth',
        status: 'pending',
        url: pb.baseUrl || '/hcgi/platform',
        latency: 0,
        error: null,
        details: []
      },
      apiServer: {
        name: 'Express.js API Server',
        status: 'pending',
        url: '/hcgi/api', // Static based on apiServerClient configuration
        latency: 0,
        error: null,
        details: []
      },
      network: {
        name: 'Network & Environment',
        status: 'pending',
        corsIssues: false,
        mixedContent: window.location.protocol === 'https:' && pb.baseUrl.startsWith('http://') && !pb.baseUrl.includes('localhost'),
        details: []
      }
    }
  };

  let hasErrors = false;
  let hasWarnings = false;

  // 1. Test PocketBase Connection
  try {
    const pbStartTime = performance.now();
    // Using health check endpoint
    const health = await pb.health.check({ $autoCancel: false });
    const latency = Math.round(performance.now() - pbStartTime);
    
    report.services.pocketbase.status = 'connected';
    report.services.pocketbase.latency = latency;
    report.services.pocketbase.details.push(`Health check passed in ${latency}ms`);
    report.services.pocketbase.details.push(`Server reported status: ${health.code === 200 ? 'OK' : health.code}`);
    
    // Quick auth store check
    report.services.pocketbase.details.push(`Auth store state: ${pb.authStore.isValid ? 'Valid Session' : 'No Session'}`);
    
  } catch (error) {
    report.services.pocketbase.status = 'failed';
    report.services.pocketbase.error = error.message || 'Connection refused or timed out';
    report.services.pocketbase.details.push(`Failed to reach PocketBase at ${report.services.pocketbase.url}`);
    if (error.status === 0) {
      report.services.pocketbase.details.push('Status 0: Possible CORS issue, firewall block, or server is offline.');
      report.services.network.corsIssues = true;
    }
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
  if (report.services.network.mixedContent) {
    report.services.network.status = 'warning';
    report.services.network.details.push('Mixed Content Warning: You are on HTTPS but attempting to connect to HTTP APIs. Browsers will block this.');
    hasWarnings = true;
  } else if (report.services.network.corsIssues) {
    report.services.network.status = 'warning';
    report.services.network.details.push('Potential CORS or Network issues detected based on failed fetch requests (Status 0).');
    hasWarnings = true;
  } else {
    report.services.network.status = 'healthy';
    report.services.network.details.push('No obvious mixed content or protocol issues detected.');
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
