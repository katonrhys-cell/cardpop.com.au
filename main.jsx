
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import App from '@/App.jsx';
import '@/index.css';
import '@/global.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <>
    <App />
    <Analytics />
    <SpeedInsights />
  </>
);

// Error monitoring is deferred until the browser is idle so the ~87 kB (gzip)
// Sentry SDK — replay + tracing included — never blocks first paint. The React
// ErrorBoundary still catches render crashes during the brief pre-init window.
const initSentry = () => {
  import('@sentry/react')
    .then((Sentry) => {
      Sentry.init({
        dsn: import.meta.env.VITE_SENTRY_DSN || 'https://7dfd1130af7b40d7d508a4902e85a1d9@o4511534905884672.ingest.us.sentry.io/4511534921416704',
        integrations: [
          Sentry.browserTracingIntegration(),
          Sentry.replayIntegration(),
        ],
        tracesSampleRate: 0.2,
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
        environment: import.meta.env.MODE || 'production',
      });
    })
    .catch(() => { /* monitoring is non-critical — never block the app on it */ });
};

if (typeof window !== 'undefined') {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(initSentry, { timeout: 5000 });
  } else {
    window.setTimeout(initSentry, 3000);
  }
}
