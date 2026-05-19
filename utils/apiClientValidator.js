
import apiServerClient from '@/lib/apiServerClient.js';

/**
 * Validates the apiServerClient configuration and connectivity.
 * Logs findings to the console and returns a detailed diagnostic report.
 * @returns {Promise<Object>} Diagnostic report
 */
export const validateApiClient = async () => {
  console.log('=== API Client Configuration Diagnostic Started ===');
  
  const report = {
    timestamp: new Date().toISOString(),
    baseUrl: '/hcgi/api', // Known from reading the client configuration
    isReachable: false,
    status: null,
    latency: null,
    headers: {},
    errorHandling: {
      throwsOnNetworkError: false,
      throwsOnHttpError: false,
    },
    errors: [],
    recommendations: []
  };

  console.log(`[Check 1/4] Base URL configured as: ${report.baseUrl}`);

  try {
    const startTime = performance.now();
    
    // Test 1: Successful connection to /health
    console.log(`[Check 2/4] Testing connectivity to ${report.baseUrl}/health...`);
    
    // Creating AbortController to simulate a timeout test (30s)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await apiServerClient.fetch('/health', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    const endTime = performance.now();
    report.latency = Math.round(endTime - startTime);
    report.status = response.status;
    report.isReachable = true;

    // Log Headers
    console.log(`[Check 3/4] Analyzing response headers...`);
    response.headers.forEach((value, key) => {
      report.headers[key] = value;
      console.log(`  -> ${key}: ${value}`);
    });

    if (!report.headers['access-control-allow-origin']) {
      console.warn('  -> Warning: CORS headers (access-control-allow-origin) may not be explicitly exposed or present on /health.');
    }

    console.log(`[Success] API Server reached in ${report.latency}ms with status ${report.status}`);

    // Test 2: Error Handling Validation
    console.log(`[Check 4/4] Validating error handling behavior...`);
    try {
      const badResponse = await apiServerClient.fetch('/invalid-endpoint-testing-404');
      if (!badResponse.ok) {
        console.warn('[Warning] apiServerClient.fetch() does NOT automatically throw exceptions for non-2xx HTTP errors (e.g., 404, 500). Implementing code must manually check response.ok and throw.');
        report.errorHandling.throwsOnHttpError = false;
        report.recommendations.push('Implement manual `!response.ok` checks in all API calls.');
      }
    } catch (e) {
      console.log('[Info] apiServerClient successfully threw an error on non-2xx response.');
      report.errorHandling.throwsOnHttpError = true;
    }

  } catch (error) {
    report.errors.push(error.message);
    report.errorHandling.throwsOnNetworkError = true;
    
    if (error.name === 'AbortError') {
      console.error('[Error] Request timed out after 30 seconds.');
    } else {
      console.error(`[Error] API Server fetch failed: ${error.message}`);
      report.recommendations.push('Check CORS configuration, ensure Express server is running on port 3001, and verify network connectivity.');
    }
  }

  console.log('=== API Client Configuration Diagnostic Complete ===', report);
  return report;
};
