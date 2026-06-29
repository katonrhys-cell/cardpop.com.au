
import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App.jsx';
import '@/index.css';
import '@/global.css';

// Lazy-load Analytics and SpeedInsights to defer their JS loading
const Analytics = React.lazy(() => import('@vercel/analytics/react').then(m => ({ default: m.Analytics })));
const SpeedInsights = React.lazy(() => import('@vercel/speed-insights/react').then(m => ({ default: m.SpeedInsights })));

ReactDOM.createRoot(document.getElementById('root')).render(
  <>
    <App />
    <Suspense fallback={null}>
      <Analytics />
    </Suspense>
    <Suspense fallback={null}>
      <SpeedInsights />
    </Suspense>
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
