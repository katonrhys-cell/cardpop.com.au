
import { useState, useEffect, useCallback, useRef } from 'react';
import apiServerClient from '@/lib/apiServerClient.js';

/**
 * Hook to continuously monitor the health of the Express API server.
 * Uses exponential backoff for retries if the connection fails.
 */
export const useApiHealth = () => {
  const [isHealthy, setIsHealthy] = useState(null);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);
  const timeoutRef = useRef(null);
  const isMounted = useRef(true);

  const checkHealth = useCallback(async (retryCount = 0) => {
    if (!isMounted.current) return;

    try {
      // 10-second timeout for the health check
      const controller = new AbortController();
      const fetchTimeout = setTimeout(() => controller.abort(), 10000);

      const response = await apiServerClient.fetch('/health', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      
      clearTimeout(fetchTimeout);

      if (response.ok) {
        if (isMounted.current) {
          setIsHealthy(true);
          setError(null);
          setLastChecked(new Date());
          console.log('[useApiHealth] Express API connection verified successfully.');
        }
      } else {
        throw new Error(`Server responded with HTTP ${response.status}`);
      }
    } catch (err) {
      if (!isMounted.current) return;

      const errorMessage = err.name === 'AbortError' 
        ? 'Health check request timed out' 
        : err.message;
        
      setIsHealthy(false);
      setError(errorMessage);
      setLastChecked(new Date());
      
      // Exponential backoff logic: 2s, 4s, 8s, 16s, 32s (max 5 retries)
      if (retryCount < 5) {
        const delay = Math.pow(2, retryCount) * 2000;
        console.warn(`[useApiHealth] Health check failed: ${errorMessage}. Retrying in ${delay / 1000}s...`);
        
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => checkHealth(retryCount + 1), delay);
      } else {
        console.error('[useApiHealth] Max retries reached. Express API is unreachable.');
      }
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    
    // Initial check
    checkHealth(0);

    return () => {
      isMounted.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [checkHealth]);

  const recheck = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    checkHealth(0);
  }, [checkHealth]);

  return { 
    isHealthy, 
    error, 
    lastChecked,
    recheck
  };
};
