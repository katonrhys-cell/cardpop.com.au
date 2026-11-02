// Entry point for the self-hosted deployment (systemd unit deploy/cardpop.service,
// also `npm start`). Loads .env, builds the server from ./app.js, warms every
// function module so the first request pays no import cost, and listens.
//
// Two ways to listen:
//   • plain HTTP on PORT (default 3000) — local runs, or behind a proxy;
//   • HTTPS on HTTPS_PORT when TLS_CERT_FILE and TLS_KEY_FILE are set — the
//     production shape: Node terminates TLS itself with the Cloudflare Origin
//     CA certificate, Cloudflare's edge is the only client (firewall), and the
//     HTTP listener on PORT just 308s strays to https. With nothing between
//     Cloudflare and Node, set TRUST_PROXY_HOPS=0 so only Cloudflare edge
//     addresses are walked past in X-Forwarded-For (docs/vultr-rollout.md).
//
// SIGTERM/SIGINT drain in-flight requests for up to SHUTDOWN_GRACE_MS before
// exiting, which is how `systemctl restart cardpop` hands over cleanly.

import dotenv from 'dotenv';
dotenv.config({ quiet: true });

import http from 'node:http';
import https from 'node:https';
import { readFileSync } from 'node:fs';
import { createServer, createFunctionLoader, distIsBuilt, DEFAULT_DIST_DIR } from './app.js';

const PORT = Number.parseInt(process.env.PORT ?? '3000', 10);
const HTTPS_PORT = Number.parseInt(process.env.HTTPS_PORT ?? '443', 10);
const HOST = process.env.HOST || '0.0.0.0';
const SHUTDOWN_GRACE_MS = Number.parseInt(process.env.SHUTDOWN_GRACE_MS ?? '10000', 10);
const distDir = process.env.DIST_DIR || DEFAULT_DIST_DIR;
const tls = process.env.TLS_CERT_FILE && process.env.TLS_KEY_FILE
  ? { cert: readFileSync(process.env.TLS_CERT_FILE), key: readFileSync(process.env.TLS_KEY_FILE) }
  : null;

if (!distIsBuilt(distDir)) {
  console.error(`[SERVER] No build in ${distDir} (need index.html and app.html). Run \`npm run build\` first.`);
  process.exit(1);
}

const loadFunction = createFunctionLoader();
const app = createServer({ distDir, loadFunction });

const started = Date.now();
await loadFunction.warm();
console.log(`[SERVER] functions loaded in ${Date.now() - started} ms`);

/** 308 every plain-HTTP request to its https twin (only used alongside TLS). */
export function redirectToHttps(req, res) {
  const host = String(req.headers.host || '').replace(/:\d+$/, '');
  if (!host) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    return res.end('Bad request');
  }
  res.writeHead(308, { Location: `https://${host}${req.url}`, 'Cache-Control': 'no-store' });
  return res.end();
}

const tune = (server) => {
  // Cloudflare keeps upstream connections open; let it decide when an idle
  // one closes rather than Node's 5 s default churning them.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  return server;
};

const servers = [];
if (tls) {
  servers.push(tune(https.createServer(tls, app)).listen(HTTPS_PORT, HOST, () => {
    console.log(`[SERVER] CardPop listening on https://${HOST}:${HTTPS_PORT} (dist: ${distDir})`);
  }));
  servers.push(http.createServer(redirectToHttps).listen(PORT, HOST, () => {
    console.log(`[SERVER] http://${HOST}:${PORT} redirects to https`);
  }));
} else {
  servers.push(tune(http.createServer(app)).listen(PORT, HOST, () => {
    console.log(`[SERVER] CardPop listening on http://${HOST}:${PORT} (dist: ${distDir})`);
  }));
}

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
  let open = servers.length;
  for (const server of servers) {
    server.close(() => {
      if (--open === 0) {
        clearTimeout(timer);
        process.exit(0);
      }
    });
    // Node ≥ 18.2: stop idle keep-alive sockets so close() can finish.
    server.closeIdleConnections?.();
  }
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
