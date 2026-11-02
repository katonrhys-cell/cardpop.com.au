// Entry point for the self-hosted deployment (Docker CMD / `npm start`).
// Loads .env, builds the server from ./app.js, warms every function module so
// the first request pays no import cost, and listens on PORT (default 3000).
// SIGTERM/SIGINT drain in-flight requests for up to SHUTDOWN_GRACE_MS before
// exiting, which is what lets `docker compose up -d` swap containers cleanly.

import dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { createServer, createFunctionLoader, distIsBuilt, DEFAULT_DIST_DIR } from './app.js';

const PORT = Number.parseInt(process.env.PORT ?? '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const SHUTDOWN_GRACE_MS = Number.parseInt(process.env.SHUTDOWN_GRACE_MS ?? '10000', 10);
const distDir = process.env.DIST_DIR || DEFAULT_DIST_DIR;

if (!distIsBuilt(distDir)) {
  console.error(`[SERVER] No build in ${distDir} (need index.html and app.html). Run \`npm run build\` first.`);
  process.exit(1);
}

const loadFunction = createFunctionLoader();
const app = createServer({ distDir, loadFunction });

const started = Date.now();
await loadFunction.warm();
console.log(`[SERVER] functions loaded in ${Date.now() - started} ms`);

const server = app.listen(PORT, HOST, () => {
  console.log(`[SERVER] CardPop listening on http://${HOST}:${PORT} (dist: ${distDir})`);
});
// Behind Caddy's keep-alive pool; longer than its default so the proxy, not
// Node, decides when an idle upstream connection closes.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

let shuttingDown = false;
const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[SERVER] ${signal} received — draining for up to ${SHUTDOWN_GRACE_MS} ms`);
  const timer = setTimeout(() => {
    console.error('[SERVER] drain timed out, exiting');
    process.exit(1);
  }, SHUTDOWN_GRACE_MS);
  timer.unref();
  server.close(() => {
    clearTimeout(timer);
    process.exit(0);
  });
  // Node ≥ 18.2: stop idle keep-alive sockets so close() can finish.
  server.closeIdleConnections?.();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
