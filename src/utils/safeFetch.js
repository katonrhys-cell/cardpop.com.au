import dns from 'dns/promises';
import net from 'net';
import ipaddr from 'ipaddr.js';
import { Agent, fetch as undiciFetch } from 'undici';
import logger from './logger.js';

// SSRF-safe outbound page fetching, shared by the admin event scraper
// (src/routes/event-scraper.js) and the nightly event scanner
// (src/utils/eventScanner.js).
//
// Both fetch URLs that ultimately came from outside the application — one from
// an admin's paste box, one from a web-search result — so both need the same
// guard. Keeping one implementation means a fix to the guard can't apply to
// only half the callers.

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_TEXT_LENGTH = 8000;
// Hard cap on how much of a page we will read. Everything downstream truncates
// to a few KB of text anyway; reading an attacker's multi-hundred-MB body into
// memory first just pins the function until the platform kills it.
const DEFAULT_MAX_BODY_BYTES = 2 * 1024 * 1024;

/**
 * True if an IP literal is in a private / loopback / link-local / reserved
 * range — i.e. anything that is not plain public unicast.
 *
 * Parsed with ipaddr.js rather than by hand: the previous string-prefix
 * checks understood `::ffff:127.0.0.1` but not the hex form `::ffff:7f00:1`
 * that the WHATWG URL parser normalises bracketed IPv4-mapped literals to, so
 * `http://[::ffff:127.0.0.1]/` sailed through. ipaddr.js's range() classifies
 * every special-purpose block (loopback, private, link-local, CGNAT, unique
 * local, multicast, unspecified, 6to4/teredo/NAT64 embeddings…) and unwraps
 * IPv4-mapped addresses before classifying. Anything unparsable is treated as
 * private (fail closed).
 */
export function isPrivateIp(ip) {
  let addr;
  try {
    addr = ipaddr.process(String(ip).trim());
  } catch {
    return true;
  }
  if (addr.kind() === 'ipv4') {
    // ipaddr.js labels 100.64.0.0/10 (CGNAT) as 'carrierGradeNat' and every
    // other special block by name; only 'unicast' is routable public space.
    return addr.range() !== 'unicast';
  }
  const range = addr.range();
  if (range !== 'unicast') return true;
  // NAT64 (64:ff9b::/96) embeds an IPv4 address that ipaddr.js does not
  // unwrap — classify the embedded IPv4 as well.
  const parts = addr.parts;
  if (parts[0] === 0x64 && parts[1] === 0xff9b && parts.slice(2, 6).every((p) => p === 0)) {
    const v4 = [parts[6] >> 8, parts[6] & 0xff, parts[7] >> 8, parts[7] & 0xff].join('.');
    return isPrivateIp(v4);
  }
  return false;
}

/**
 * The hostname of a URL with IPv6 brackets removed, so an IP literal can be
 * recognised as one. `new URL('http://[::1]/').hostname` is the string
 * `"[::1]"` — brackets included — which net.isIP() does not recognise, so a
 * bracketed literal used to be treated as a *hostname* and skipped the
 * literal-address check; undici then strips the brackets itself and connects
 * to the IP directly, and Node never runs the custom lookup for IP literals,
 * so the second guard never saw it either.
 */
export function urlHost(url) {
  return new URL(url).hostname.replace(/^\[|\]$/g, '');
}

export function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/** True for a syntactically valid http(s) URL — the only thing worth fetching. */
export function isFetchableHttpUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return false;
  const trimmed = url.trim();
  if (!isValidUrl(trimmed)) return false;
  const { protocol } = new URL(trimmed);
  return protocol === 'http:' || protocol === 'https:';
}

/**
 * Reject direct IP-literal or localhost hosts up front. Cheap and
 * deterministic — no DNS involved, so it can't be raced. Hostnames that go
 * through actual DNS resolution are protected separately by ssrfSafeLookup
 * below, which pins the connection to the address it validates.
 */
export function assertNotLiteralPrivateAddress(url) {
  const hostname = urlHost(url);
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error('Blocked: private address');
    return;
  }
  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower.endsWith('.localhost')) throw new Error('Blocked: localhost');
}

/**
 * Custom DNS lookup used by the dispatcher below. A prior implementation
 * resolved the hostname once to validate it, then let fetch() re-resolve the
 * same hostname independently for the actual connection — a DNS-rebinding
 * attacker (short-TTL record) could pass the check with a public IP and
 * connect to a private one (e.g. cloud metadata 169.254.169.254) moments
 * later. Running the check *as* the lookup that undici connects with closes
 * that window: whatever address is validated here is the exact address the
 * socket connects to.
 */
export function ssrfSafeLookup(hostname, options, callback) {
  const opts = typeof options === 'function' ? {} : options;
  const cb = typeof options === 'function' ? options : callback;
  dns.lookup(hostname, { ...opts, all: true })
    .then((addresses) => {
      if (!addresses.length) return cb(new Error(`Blocked: ${hostname} has no DNS records`));
      if (addresses.some((a) => isPrivateIp(a.address))) {
        return cb(new Error(`Blocked: ${hostname} resolves to a private address`));
      }
      if (opts.all) return cb(null, addresses);
      const { address, family } = addresses[0];
      return cb(null, address, family);
    })
    .catch(cb);
}

export const ssrfSafeDispatcher = new Agent({ connect: { lookup: ssrfSafeLookup } });

// Redirects must be followed by hand, one hop at a time.
//
// ssrfSafeLookup only guards hostnames that actually go through DNS: Node's
// net.connect skips the `lookup` callback entirely when the host is an IP
// literal, so a URL like http://169.254.169.254/ reaches the socket with no
// check at all. assertNotLiteralPrivateAddress covers that — but it only ever
// ran on the URL the caller passed in, while fetch() follows redirects itself
// (redirect: 'follow' is the default). A page could therefore answer 302 to an
// IP-literal private address and be fetched unguarded: both callers here fetch
// URLs that came from outside the app (an admin's paste box, and web-search
// results in the nightly scanner), so that redirect is attacker-reachable.
//
// Taking redirects manually means assertNotLiteralPrivateAddress runs on EVERY
// hop, so the literal-IP path is closed the whole way down the chain.
const MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** Read a response body as text, stopping (and closing the socket) after maxBytes. */
async function readBodyCapped(response, maxBytes) {
  // Non-streaming bodies (and test doubles) still get the cap applied.
  if (typeof response.body?.getReader !== 'function') {
    const text = typeof response.text === 'function' ? await response.text() : '';
    return text.length > maxBytes ? text.slice(0, maxBytes) : text;
  }
  const chunks = [];
  let total = 0;
  const reader = response.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        chunks.push(value.subarray(0, value.byteLength - (total - maxBytes)));
        await reader.cancel().catch(() => {});
        break;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock?.();
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Fetch a page's HTML with the SSRF guard applied and a hard timeout.
 * `logPrefix` just tags the log lines with the calling subsystem.
 */
export async function fetchWebpageContent(url, { timeoutMs = DEFAULT_TIMEOUT_MS, maxBodyBytes = DEFAULT_MAX_BODY_BYTES, logPrefix = 'SAFE_FETCH' } = {}) {
  // Log the parsed form: new URL() strips CR/LF, so logging the raw string
  // would let a crafted URL forge extra log lines.
  logger.info(`[${logPrefix}] Fetching content from URL: ${new URL(url).href}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let currentUrl = url;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      // SSRF guard, re-applied per hop: literal IP/localhost checked here;
      // DNS-resolved hostnames are pinned to their validated address by
      // ssrfSafeDispatcher.
      assertNotLiteralPrivateAddress(currentUrl);

      const response = await undiciFetch(currentUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        dispatcher: ssrfSafeDispatcher,
        redirect: 'manual',
        signal: controller.signal,
      });

      if (REDIRECT_STATUSES.has(response.status)) {
        const location = response.headers.get('location');
        // Drain the body so the connection can be reused rather than leaked.
        await response.body?.cancel().catch(() => {});
        if (!location) {
          throw new Error(`Failed to fetch webpage: ${response.status} with no Location header`);
        }
        const next = new URL(location, currentUrl).toString();
        if (!isFetchableHttpUrl(next)) {
          throw new Error('Blocked: redirect to a non-HTTP(S) URL');
        }
        logger.info(`[${logPrefix}] Following redirect ${currentUrl} → ${next}`);
        currentUrl = next;
        continue;
      }

      if (!response.ok) {
        clearTimeout(timeoutId);
        await response.body?.cancel().catch(() => {});
        throw new Error(`Failed to fetch webpage: ${response.status} ${response.statusText}`);
      }

      // The timeout stays armed until the body has been read: clearing it
      // before response.text() left the body read uncovered, so a slow-drip
      // server could hold the function open indefinitely.
      const content = await readBodyCapped(response, maxBodyBytes);
      clearTimeout(timeoutId);
      logger.info(`[${logPrefix}] Successfully fetched ${content.length} bytes from ${currentUrl}`);
      return content;
    }

    throw new Error(`Blocked: more than ${MAX_REDIRECTS} redirects`);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Fetch request timed out');
    }
    throw error;
  }
}

/** Strip tags and entities down to the plain text an extraction prompt needs. */
export function extractTextFromHtml(html, { maxLength = DEFAULT_MAX_TEXT_LENGTH } = {}) {
  let text = html.replace(/<script[^>]*>.*?<\/script>/gis, '');
  text = text.replace(/<style[^>]*>.*?<\/style>/gis, '');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length > maxLength) {
    text = text.substring(0, maxLength) + '...';
  }
  return text;
}
