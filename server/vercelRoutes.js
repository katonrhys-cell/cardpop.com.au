// Interprets the routing manifest (vercel.json) for the self-hosted server.
//
// The site spent its first year on Vercel, and every edge rule it needs —
// the www → apex and legacy-path redirects, the bot-only prerender rewrites,
// the /hcgi/api → /api proxy prefix, the per-path Cache-Control and security
// headers (including the CSP whose bootstrap hash vite.config.js verifies) —
// lives in vercel.json. Rather than hand-copy ~60 rules into Express and let
// the two drift while both hosts are live during the cutover, the VPS server
// reads the same file and applies the same semantics:
//
//   • `source` is a path-to-regexp v6 pattern, exactly what Vercel compiles it
//     with (@vercel/routing-utils). `/:path*`, `/:sub(a|b)`, `/(.*)` and the
//     negative-lookahead group in the SPA fallback all work unchanged.
//   • `has` conditions match the host, a header or a query value. Vercel's
//     regexes are Go/Rust-flavoured and may start with `(?i)`; JS has no
//     inline flags, so it is lifted into the RegExp `i` flag.
//   • Rewrites CHAIN: after a rule matches, later rules are tried against the
//     rewritten path (that is how `/hcgi/api/x` → `/api/x` → `/api/index`
//     resolves), and the chain stops as soon as the path names something the
//     server can actually serve — a function or a built file — which is
//     Vercel's `check: true` + filesystem step. Without that stop the
//     prerender rewrite (`/shop` → `/api/prerender?path=/shop`) would be
//     swallowed by the `/api/:path*` → `/api/index` catch-all.
//   • Every matching `headers` rule applies, in order, last value wins — the
//     property tests/backend/vercelHeaders.test.js pins (the catch-all comes
//     first so the long-cache rules override it).
//   • `permanent: true` redirects are 308, like Vercel's.
//
// Once Vercel is switched off the file can be renamed (server/routes.json)
// without touching this module — pass the path to loadRoutingConfig().
//
// Pure functions, no Express dependency: tests/backend/vercelRoutes.test.js.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { match } from 'path-to-regexp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CONFIG_PATH = path.resolve(__dirname, '..', 'vercel.json');

/** Read and compile the manifest. */
export function loadRoutingConfig(file = DEFAULT_CONFIG_PATH) {
  return compileRouting(JSON.parse(readFileSync(file, 'utf8')));
}

/**
 * Turn a Vercel `has` value regex into a JS RegExp. Vercel anchors the value
 * (the whole header has to match), and `(?i)` becomes the `i` flag.
 */
export function hasValueRegExp(value) {
  let source = String(value);
  let flags = '';
  const inlineFlags = /^\(\?([a-z]+)\)/.exec(source);
  if (inlineFlags) {
    source = source.slice(inlineFlags[0].length);
    if (inlineFlags[1].includes('i')) flags += 'i';
  }
  return new RegExp(`^(?:${source})$`, flags);
}

function compileHas(has) {
  if (!Array.isArray(has) || has.length === 0) return null;
  return has.map((cond) => {
    const type = cond.type;
    if (!['host', 'header', 'query', 'cookie'].includes(type)) {
      throw new Error(`vercel.json: unsupported has.type "${type}"`);
    }
    if (type !== 'host' && !cond.key) throw new Error(`vercel.json: has.${type} needs a key`);
    return {
      type,
      key: cond.key ? String(cond.key).toLowerCase() : null,
      // No value = "the key is present".
      value: cond.value === undefined ? null : hasValueRegExp(cond.value),
      exact: type === 'host' ? String(cond.value) : null,
    };
  });
}

const compileSource = (source) => {
  try {
    // decode is left as identity so params keep their raw encoding — the
    // prerender handler decodes (and guards) the path itself.
    return match(source, { decode: (x) => x });
  } catch (error) {
    throw new Error(`vercel.json: cannot compile source "${source}": ${error.message}`);
  }
};

export function compileRouting(config) {
  const compileRules = (rules, kind) => (rules || []).map((rule) => ({
    ...rule,
    kind,
    matcher: compileSource(rule.source),
    hasConditions: compileHas(rule.has),
  }));
  return {
    redirects: compileRules(config.redirects, 'redirect'),
    rewrites: compileRules(config.rewrites, 'rewrite'),
    headers: compileRules(config.headers, 'header'),
  };
}

/**
 * The request facts the matchers need, decoupled from Express so the module
 * can be tested with plain objects: `{ pathname, host, headers, query, cookies }`.
 */
export function requestFacts(req) {
  return {
    pathname: req.path ?? new URL(req.url, 'http://x').pathname,
    host: String(req.hostname || req.headers?.host || '').replace(/:\d+$/, '').toLowerCase(),
    headers: req.headers || {},
    query: req.query || {},
    cookies: req.cookies || {},
  };
}

export function hasMatches(conditions, facts) {
  if (!conditions) return true;
  return conditions.every((cond) => {
    let actual;
    if (cond.type === 'host') actual = facts.host;
    else if (cond.type === 'header') actual = facts.headers[cond.key];
    else if (cond.type === 'query') actual = facts.query[cond.key];
    else actual = facts.cookies[cond.key];
    if (Array.isArray(actual)) actual = actual.join(', ');
    if (actual === undefined || actual === null) return false;
    if (cond.type === 'host' && cond.exact) return String(actual).toLowerCase() === cond.exact.toLowerCase();
    if (!cond.value) return true;
    return cond.value.test(String(actual));
  });
}

/**
 * Fill `:name`, `:name*`, `:name+`, `:name?` in a destination with the params
 * a source matched. A repeated param (array) is re-joined with `/`; an absent
 * optional one takes the slash before it with it, so `/x/:slug*` → `/x`.
 */
export function substituteParams(template, params = {}) {
  let out = String(template).replace(
    /(\/?):([A-Za-z_][A-Za-z0-9_]*)([*+?]?)/g,
    (whole, slash, name, modifier) => {
      const value = params[name];
      const absent = value === undefined || value === null || (Array.isArray(value) && value.length === 0);
      if (absent) return modifier === '*' || modifier === '?' ? '' : slash;
      return slash + (Array.isArray(value) ? value.join('/') : String(value));
    },
  );
  if (out === '') out = '/';
  // `https://host/:path*` with nothing after the host still needs its slash.
  if (/^https?:\/\/[^/]+$/.test(out)) out += '/';
  return out;
}

const parseQueryString = (qs) => {
  const out = {};
  if (!qs) return out;
  for (const [key, value] of new URLSearchParams(qs)) out[key] = value;
  return out;
};

/** Split a destination into its path and query parts, with params filled in. */
export function resolveDestination(destination, params) {
  const filled = substituteParams(destination, params);
  const q = filled.indexOf('?');
  if (q === -1) return { pathname: filled, query: {} };
  return { pathname: filled.slice(0, q), query: parseQueryString(filled.slice(q + 1)) };
}

/** First redirect whose source and `has` match → `{ status, location }`, else null. */
export function matchRedirect(routing, facts) {
  for (const rule of routing.redirects) {
    if (!hasMatches(rule.hasConditions, facts)) continue;
    const m = rule.matcher(facts.pathname);
    if (!m) continue;
    const { pathname, query } = resolveDestination(rule.destination, m.params);
    // Pass the original query string along, like Vercel does.
    const merged = new URLSearchParams({ ...facts.query, ...query }).toString();
    return {
      status: rule.permanent === false ? 307 : rule.statusCode || 308,
      location: merged ? `${pathname}?${merged}` : pathname,
      source: rule.source,
    };
  }
  return null;
}

/**
 * Walk the rewrites in order. `isTerminal(pathname)` says whether a path is
 * something the server can serve (a function name or a built file); matching
 * stops there, as Vercel's filesystem check does. `skip(rule)` lets the caller
 * hold a rule back (the server applies the SPA fallback only after the static
 * files have had their turn).
 *
 * Returns `{ pathname, query, matched: [sources…] }` — `matched` is empty when
 * nothing applied and pathname is the original.
 */
export function resolveRewrite(routing, facts, { isTerminal = () => false, skip = () => false } = {}) {
  let pathname = facts.pathname;
  let query = { ...facts.query };
  const matched = [];
  for (const rule of routing.rewrites) {
    if (skip(rule)) continue;
    if (!hasMatches(rule.hasConditions, facts)) continue;
    const m = rule.matcher(pathname);
    if (!m) continue;
    const dest = resolveDestination(rule.destination, m.params);
    pathname = dest.pathname;
    query = { ...query, ...dest.query };
    matched.push(rule.source);
    if (isTerminal(pathname)) break;
  }
  return { pathname, query, matched };
}

/** Every header every matching rule sets, in order (so a later rule's value wins). */
export function headersFor(routing, facts) {
  const out = [];
  for (const rule of routing.headers) {
    if (!hasMatches(rule.hasConditions, facts)) continue;
    if (!rule.matcher(facts.pathname)) continue;
    for (const { key, value } of rule.headers || []) out.push([key, value]);
  }
  return out;
}

/** Is this the SPA fallback rule (the unconditional rewrite to app.html)? */
export const isSpaFallback = (rule) => rule.destination === '/app.html' && !rule.hasConditions;
