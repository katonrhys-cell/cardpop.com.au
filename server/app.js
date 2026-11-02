// The self-hosted CardPop server: one Node process that does everything the
// Vercel deployment did — serves the Vite build in dist/, runs the Express API
// (src/app.js) and the standalone functions (api/*.js), and applies the
// redirects, rewrites and headers from the routing manifest (vercel.json,
// interpreted by ./vercelRoutes.js). Runbook: docs/vultr-rollout.md.
//
// Request order, which mirrors what the manifest meant on Vercel:
//
//   1. redirects            www → apex, legacy paths (308)
//   2. headers              every matching `headers` rule, last value wins; a
//                           function's own setHeader() later overrides it
//   3. exact static file    anything that exists in dist/ (robots.txt,
//                           /assets/*, /.well-known/*) — served as-is
//   4. rewrites             bot-only prerender, /sitemap.xml, /hcgi/api → API,
//                           the cron and grade-estimate functions
//   5. SPA fallback         "/" → index.html (hero shell); everything else →
//                           app.html, except a missing /images or /assets
//                           file, which is a 404 (a cached shell under an
//                           immutable image URL would stick for a year)
//
// Nothing here parses a body: the Stripe webhook inside src/app.js needs the
// raw stream for its signature check, and every function does its own parsing.
//
// createServer() takes the function table as an argument so the tests can run
// the routing with stubs instead of importing the prerenderer and the API.

import express from 'express';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isCloudflareIp } from '../src/utils/cloudflareIps.js';
import {
  loadRoutingConfig, requestFacts, matchRedirect, resolveRewrite, headersFor, isSpaFallback,
} from './vercelRoutes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_DIST_DIR = path.resolve(__dirname, '..', 'dist');

// The api/*.js functions Vercel deployed, keyed by the path the manifest
// rewrites to. `app` entries are Express apps and are invoked with the
// ORIGINAL request url (both mount every spelling they can be reached by —
// /api, /hcgi/api, /grade-estimate — which is what Vercel handed them).
// `handler` entries are (req, res) functions that read the manifest's
// destination query (`?path=` for the prerenderer, `?mode=` for the scan).
export const FUNCTION_MODULES = Object.freeze({
  '/api/index': { kind: 'app', module: '../src/app.js' },
  '/api/grade-estimate': { kind: 'app', module: '../api/grade-estimate.js' },
  '/api/prerender': { kind: 'handler', module: '../api/prerender.js' },
  '/api/sitemap': { kind: 'handler', module: '../api/sitemap.js' },
  '/api/merchant-feed': { kind: 'handler', module: '../api/merchant-feed.js' },
  '/api/blog-generate': { kind: 'handler', module: '../api/blog-generate.js' },
  '/api/event-scan': { kind: 'handler', module: '../api/event-scan.js' },
});

// A rewrite chain stops on one of these — the functions above and the two
// HTML entries — the way Vercel's filesystem check stops it.
const TERMINALS = new Set([...Object.keys(FUNCTION_MODULES), '/app.html', '/index.html']);

/** Lazily import each function once; `server/index.js` warms them all at boot. */
export function createFunctionLoader(modules = FUNCTION_MODULES) {
  const cache = new Map();
  const load = (name) => {
    if (!cache.has(name)) {
      const spec = modules[name];
      if (!spec) return Promise.reject(new Error(`No function for ${name}`));
      cache.set(name, import(new URL(spec.module, import.meta.url)).then((m) => ({ kind: spec.kind, fn: m.default })));
    }
    return cache.get(name);
  };
  load.warm = () => Promise.all(Object.keys(modules).map(load));
  return load;
}

const setQuery = (req, query) => {
  // Express 5 defines req.query as a getter on the prototype; shadow it on
  // the instance so the function sees the manifest's destination params.
  Object.defineProperty(req, 'query', { value: query, writable: true, configurable: true, enumerable: true });
};

/**
 * @param {object} [options]
 * @param {string} [options.distDir]   Vite output (default ../dist)
 * @param {object} [options.routing]   compiled manifest (default vercel.json)
 * @param {(name: string) => Promise<{kind: string, fn: Function}>} [options.loadFunction]
 */
export function createServer({ distDir = DEFAULT_DIST_DIR, routing = loadRoutingConfig(), loadFunction = createFunctionLoader() } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('etag', 'weak');

  // Same proxy trust as src/app.js: the first TRUST_PROXY_HOPS hops are trusted
  // outright (default 1 for a local proxy; the production unit sets 0 because
  // Node faces Cloudflare directly), Cloudflare's edge ranges beyond that, and
  // nothing else — so req.ip / req.hostname cannot be spoofed by a request
  // that reaches the origin without going through Cloudflare.
  const trustProxyHops = (() => {
    const parsed = Number.parseInt(process.env.TRUST_PROXY_HOPS ?? '1', 10);
    return Number.isNaN(parsed) ? 1 : parsed;
  })();
  app.set('trust proxy', (addr, hop) => hop < trustProxyHops || isCloudflareIp(addr));

  const indexHtml = path.join(distDir, 'index.html');
  const appHtml = path.join(distDir, 'app.html');
  const spaFallback = routing.rewrites.find(isSpaFallback);
  const isTerminal = (p) => TERMINALS.has(p);

  // Liveness for deploy.sh and monitoring. Not a public page (never in the sitemap) and
  // cheaper than /api/health, which runs through the API's rate limiter.
  app.get('/healthz', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ status: 'ok', dist: existsSync(indexHtml) });
  });

  // 1 + 2. Redirects, then headers for everything that stays.
  app.use((req, res, next) => {
    const facts = requestFacts(req);
    req.routingFacts = facts;
    const redirect = matchRedirect(routing, facts);
    if (redirect) return res.redirect(redirect.status, redirect.location);
    for (const [key, value] of headersFor(routing, facts)) res.setHeader(key, value);
    return next();
  });

  // 3. Exact files from the build. index: false keeps "/" for step 5 (a bot
  // on "/" must still reach the prerenderer), redirect: false keeps a
  // directory path from bouncing to a trailing slash, dotfiles for /.well-known.
  app.use(express.static(distDir, { index: false, redirect: false, dotfiles: 'allow', fallthrough: true, cacheControl: false }));

  // 4. Rewrites → functions.
  app.use(async (req, res, next) => {
    const facts = req.routingFacts || requestFacts(req);
    const { pathname, query, matched } = resolveRewrite(routing, facts, { isTerminal, skip: isSpaFallback });
    if (matched.length === 0) return next();
    if (!FUNCTION_MODULES[pathname]) {
      // A chain that ends on something that is neither a function nor a
      // file (there is none in the manifest today; this keeps it loud).
      return res.status(404).type('text/plain').send('Not found');
    }
    try {
      const { kind, fn } = await loadFunction(pathname);
      if (kind === 'app') return fn(req, res, next);
      setQuery(req, query);
      await fn(req, res);
      // A handler that returned without answering (none should) falls to 404.
      if (!res.headersSent && !res.writableEnded) return next();
      return undefined;
    } catch (error) {
      return next(error);
    }
  });

  // 5. The two HTML entries.
  app.use((req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method)) return next();
    const pathname = req.routingFacts?.pathname ?? req.path;
    if (pathname === '/' || pathname === '') return res.sendFile(indexHtml);
    if (spaFallback && spaFallback.matcher(pathname)) return res.sendFile(appHtml);
    return next();
  });

  app.use((req, res) => {
    res.status(404).type('text/plain').send('Not found');
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(`[SERVER] ${req.method} ${req.originalUrl} → ${err?.stack || err}`);
    if (res.headersSent) return res.end();
    res.setHeader('Cache-Control', 'no-store');
    return res.status(err?.status >= 400 && err.status < 600 ? err.status : 500).type('text/plain').send('Something went wrong');
  });

  return app;
}

/** Whether the build the server would serve is present (both HTML entries). */
export function distIsBuilt(distDir = DEFAULT_DIST_DIR) {
  try {
    return statSync(path.join(distDir, 'index.html')).isFile() && statSync(path.join(distDir, 'app.html')).isFile();
  } catch {
    return false;
  }
}
