
import * as Sentry from '@sentry/react';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import App from '@/App.jsx';
import '@/index.css';
import '@/global.css';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || 'https://7dfd1130af7b40d7d508a4902e85a1d9@o4511534905884672.ingest.us.sentry.io/4511534921416704',
  // Error capture + performance tracing load eagerly (lightweight). The heavy
  // Session Replay recorder (rrweb) is loaded on demand below so it stays off
  // the initial critical path — it was ~the single largest entry chunk.
  integrations: [
    Sentry.browserTracingIntegration(),
  ],
  tracesSampleRate: 0.2,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  environment: import.meta.env.MODE || 'production',
});

// Attach Session Replay after first paint, fetched on demand (not bundled).
Sentry.lazyLoadIntegration('replayIntegration')
  .then((replayIntegration) => {
    Sentry.getClient()?.addIntegration(replayIntegration());
  })
  .catch(() => { /* replay is best-effort; core error capture is unaffected */ });

ReactDOM.createRoot(document.getElementById('root')).render(
  <>
    <App />
    <Analytics />
    <SpeedInsights />
  </>
);
