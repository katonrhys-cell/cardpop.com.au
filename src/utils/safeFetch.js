import dns from 'dns/promises';
import net from 'net';
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

/** True if an IP literal is in a private / loopback / link-local / reserved range. */
export function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0) return true;            // private / loopback / this-host
    if (a === 169 && b === 254) return true;                       // link-local (incl. cloud metadata 169.254.169.254)
    if (a === 172 && b >= 16 && b <= 31) return true;              // private
    if (a === 192 && b === 168) return true;                       // private
    if (a === 100 && b >= 64 && b <= 127) return true;             // CGNAT
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;              // loopback / unspecified
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique-local
  if (lower.startsWith('fe80')) return true;                       // link-local
  if (lower.startsWith('::ffff:')) return isPrivateIp(lower.slice(7)); // IPv4-mapped
  return false;
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
  const { hostname } = new URL(url);
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error('Blocked: private address');
    return;
  }
  if (hostname.toLowerCase() === 'localhost') throw new Error('Blocked: localhost');
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

const ssrfSafeDispatcher = new Agent({ connect: { lookup: ssrfSafeLookup } });

/**
 * Fetch a page's HTML with the SSRF guard applied and a hard timeout.
 * `logPrefix` just tags the log lines with the calling subsystem.
 */
export async function fetchWebpageContent(url, { timeoutMs = DEFAULT_TIMEOUT_MS, logPrefix = 'SAFE_FETCH' } = {}) {
  logger.info(`[${logPrefix}] Fetching content from URL: ${url}`);

  // SSRF guard: literal IP/localhost checked here; DNS-resolved hostnames are
  // pinned to their validated address via ssrfSafeDispatcher below.
  assertNotLiteralPrivateAddress(url);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await undiciFetch(url, {
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
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch webpage: ${response.status} ${response.statusText}`);
    }

    const content = await response.text();
    logger.info(`[${logPrefix}] Successfully fetched ${content.length} bytes from ${url}`);
    return content;
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
