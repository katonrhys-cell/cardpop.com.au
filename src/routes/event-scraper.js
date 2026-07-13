import 'dotenv/config';
import dns from 'dns/promises';
import net from 'net';
import express from 'express';
import { Agent, fetch as undiciFetch } from 'undici';
import logger from '../utils/logger.js';
import { stream } from '../api/integrated-ai.js';
import { EventScraperPrompt } from '../constants/prompts.js';
import supabase from '../utils/supabaseClient.js';
import { authMiddleware, isAdminUser } from '../middleware/auth.js';

const router = express.Router();
const AI_PROCESSING_TIMEOUT = 60000;

const VALID_EVENT_TYPES = ['card_show', 'trade_event', 'lgs_event', 'community_event'];
const VALID_STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT'];

function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/** True if an IP literal is in a private / loopback / link-local / reserved range. */
function isPrivateIp(ip) {
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

/**
 * Reject direct IP-literal or localhost hosts up front. Cheap and
 * deterministic — no DNS involved, so it can't be raced. Hostnames that go
 * through actual DNS resolution are protected separately by ssrfSafeLookup
 * below, which pins the connection to the address it validates.
 */
function assertNotLiteralPrivateAddress(url) {
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

async function fetchWebpageContent(url) {
  logger.info(`[EVENT_SCRAPER] Fetching content from URL: ${url}`);

  // SSRF guard: literal IP/localhost checked here; DNS-resolved hostnames are
  // pinned to their validated address via ssrfSafeDispatcher below.
  assertNotLiteralPrivateAddress(url);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

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
    logger.info(`[EVENT_SCRAPER] Successfully fetched ${content.length} bytes from ${url}`);
    return content;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Fetch request timed out');
    }
    throw error;
  }
}

function extractTextFromHtml(html) {
  let text = html.replace(/<script[^>]*>.*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>.*?<\/style>/gi, '');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length > 8000) {
    text = text.substring(0, 8000) + '...';
  }
  return text;
}

function parseAndValidateEventJson(jsonString) {
  if (!jsonString || typeof jsonString !== 'string') {
    throw new Error('AI response is not a valid string');
  }

  let trimmed = jsonString.trim();
  if (trimmed.startsWith('```json')) trimmed = trimmed.substring(7);
  else if (trimmed.startsWith('```')) trimmed = trimmed.substring(3);
  if (trimmed.endsWith('```')) trimmed = trimmed.substring(0, trimmed.length - 3);
  trimmed = trimmed.trim();

  let eventData;
  try {
    eventData = JSON.parse(trimmed);
  } catch (parseError) {
    throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
  }

  if (!eventData.title || typeof eventData.title !== 'string' || !eventData.title.trim()) {
    throw new Error('Event data must have a title field');
  }

  return eventData;
}

function validateAndNormalizeEventData(eventData) {
  if (!eventData.title || typeof eventData.title !== 'string' || !eventData.title.trim()) {
    throw new Error('Event title is required');
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const timeRegex = /^\d{2}:\d{2}$/;

  const startDate = typeof eventData.start_date === 'string' && dateRegex.test(eventData.start_date)
    ? eventData.start_date : null;
  const endDate = typeof eventData.end_date === 'string' && dateRegex.test(eventData.end_date)
    ? eventData.end_date : null;
  const startTime = typeof eventData.start_time === 'string' && timeRegex.test(eventData.start_time)
    ? eventData.start_time : null;
  const endTime = typeof eventData.end_time === 'string' && timeRegex.test(eventData.end_time)
    ? eventData.end_time : null;

  const entryFee = (eventData.entry_fee_aud !== null && eventData.entry_fee_aud !== undefined)
    ? (isNaN(Number(eventData.entry_fee_aud)) ? null : Number(eventData.entry_fee_aud))
    : null;

  const capacity = (eventData.capacity !== null && eventData.capacity !== undefined)
    ? (isNaN(parseInt(eventData.capacity, 10)) ? null : parseInt(eventData.capacity, 10))
    : null;

  const imageUrl = eventData.image_url && isValidUrl(eventData.image_url) ? eventData.image_url : null;
  const websiteUrl = eventData.website_url && isValidUrl(eventData.website_url) ? eventData.website_url : null;
  const ticketUrl = eventData.ticket_url && isValidUrl(eventData.ticket_url) ? eventData.ticket_url : null;

  const eventType = VALID_EVENT_TYPES.includes(eventData.event_type) ? eventData.event_type : null;
  const state = VALID_STATES.includes(eventData.state) ? eventData.state : null;

  const featuredCardGames = Array.isArray(eventData.featured_card_games) && eventData.featured_card_games.length > 0
    ? eventData.featured_card_games.filter(g => typeof g === 'string' && g.trim())
    : null;

  const seoKeywords = Array.isArray(eventData.seo_keywords) && eventData.seo_keywords.length > 0
    ? eventData.seo_keywords.filter(k => typeof k === 'string' && k.trim())
    : null;

  const tags = Array.isArray(eventData.tags) && eventData.tags.length > 0
    ? eventData.tags.filter(t => typeof t === 'string' && t.trim())
    : null;

  return {
    title: eventData.title.trim(),
    short_description: eventData.short_description || null,
    description: eventData.description || null,
    event_type: eventType,
    featured_card_games: featuredCardGames,
    venue_name: eventData.venue_name || null,
    address: eventData.address || null,
    suburb: eventData.suburb || null,
    state,
    postcode: eventData.postcode || null,
    start_date: startDate,
    end_date: endDate,
    start_time: startTime,
    end_time: endTime,
    organizer_name: eventData.organizer_name || null,
    organizer_email: eventData.organizer_email || null,
    organizer_phone: eventData.organizer_phone || null,
    website_url: websiteUrl,
    ticket_url: ticketUrl,
    entry_fee_aud: entryFee,
    is_free: typeof eventData.is_free === 'boolean' ? eventData.is_free : (entryFee === 0 || entryFee === null),
    capacity,
    registration_required: typeof eventData.registration_required === 'boolean' ? eventData.registration_required : false,
    image_url: imageUrl,
    seo_title: eventData.seo_title || null,
    seo_description: eventData.seo_description || null,
    seo_keywords: seoKeywords,
    tags,
    source_url: eventData.source_url || null,
  };
}

function formatSSEEvent(data) {
  try {
    return `data: ${JSON.stringify(data)}\n\n`;
  } catch {
    return `data: ${JSON.stringify({ error: 'Failed to format response' })}\n\n`;
  }
}

router.post('/scrape-event-url', authMiddleware, async (req, res) => {
  logger.info('[EVENT_SCRAPER] Received scrape-event-url request');

  // Admin-only: this endpoint fetches arbitrary server-side URLs, so restrict it
  // to admins (the scraper UI is an admin tool) on top of the SSRF guard below.
  if (!(await isAdminUser(req))) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const url = req.body?.url;
  if (!url || typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({ error: 'URL is required and must be a non-empty string' });
  }

  const trimmedUrl = url.trim();
  if (!isValidUrl(trimmedUrl) || (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://'))) {
    return res.status(400).json({ error: 'Invalid URL format. Please provide a valid HTTP/HTTPS URL.' });
  }

  try {
    const htmlContent = await fetchWebpageContent(trimmedUrl);
    const textContent = extractTextFromHtml(htmlContent);
    res.json({ success: true, content: textContent });
  } catch (err) {
    logger.warn(`[EVENT_SCRAPER] Fetch rejected for ${trimmedUrl}: ${err.message}`);
    return res.status(400).json({ error: 'Unable to fetch the provided URL.' });
  }
});

router.post('/extract-event-from-content', authMiddleware, async (req, res) => {
  logger.info('[EVENT_SCRAPER] Received extract-event-from-content request');

  // Admin-only: this triggers paid AI processing and is only used by the admin
  // scraper panel; gate it to prevent unauthenticated cost abuse.
  if (!(await isAdminUser(req))) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const content = req.body?.content;
  if (!content || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: 'Content is required and must be a non-empty string' });
  }

  const trimmedContent = content.trim();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  let responseEnded = false;

  function sendSSEError(errorMessage) {
    if (responseEnded) return;
    try {
      res.write(formatSSEEvent({ error: errorMessage }));
      responseEnded = true;
      res.end();
    } catch {
      if (!responseEnded) { responseEnded = true; res.end(); }
    }
  }

  const userMessage = [
    {
      type: 'text',
      text: `Extract all event information from the following page content and return it as a JSON object matching the schema specified in the system prompt.\n\nPage content:\n${trimmedContent}`,
    },
  ];

  let sseStream;
  try {
    sseStream = await stream({
      userId: 'event-scraper',
      systemPrompt: EventScraperPrompt,
      userMessage,
    });
  } catch (error) {
    logger.error(`[EVENT_SCRAPER] Error creating AI stream: ${error.message}`);
    return sendSSEError(`Failed to initialize AI stream: ${error.message}`);
  }

  const timeoutId = setTimeout(() => {
    // sendSSEError no-ops once responseEnded is set, so it must be called
    // FIRST — setting the flag before calling it left the response open
    // forever on an AI timeout (destroying the source stream doesn't end res,
    // since it's piped with end: false).
    sendSSEError('AI processing timeout');
    sseStream.destroy();
  }, AI_PROCESSING_TIMEOUT);

  let fullJsonResponse = '';

  sseStream.on('data', (chunk) => {
    if (responseEnded) return;
    const lines = chunk.toString().split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine.startsWith('data: ')) continue;
      const jsonStr = trimmedLine.substring(6).trim();
      if (!jsonStr) continue;
      try {
        const event = JSON.parse(jsonStr);
        if (event.type === 'content' && event.data?.content) {
          fullJsonResponse += event.data.content;
        }
      } catch { /* skip non-JSON SSE lines */ }
    }
  });

  sseStream.pipe(res, { end: false });

  sseStream.on('end', () => {
    clearTimeout(timeoutId);
    if (responseEnded) return;

    if (fullJsonResponse) {
      try {
        const parsed = parseAndValidateEventJson(fullJsonResponse);
        const normalized = validateAndNormalizeEventData(parsed);
        res.write(formatSSEEvent({ success: true, eventData: normalized }));
      } catch (err) {
        res.write(formatSSEEvent({ error: `Event data validation failed: ${err.message}` }));
      }
    } else {
      res.write(formatSSEEvent({ error: 'No event data extracted from AI response' }));
    }

    responseEnded = true;
    res.end();
  });

  sseStream.on('error', (error) => {
    clearTimeout(timeoutId);
    if (!responseEnded) {
      responseEnded = true;
      sendSSEError(`Stream error: ${error.message}`);
    }
  });

  res.on('close', () => {
    clearTimeout(timeoutId);
    responseEnded = true;
    sseStream.destroy();
  });
});

router.post('/create-event-from-data', authMiddleware, async (req, res) => {
  if (!(await isAdminUser(req))) return res.status(403).json({ error: 'Admin access required' });
  logger.info('[EVENT_SCRAPER] Received create-event-from-data request');

  if (!req.body?.eventData) {
    return res.status(400).json({ error: 'eventData is required' });
  }

  const eventData = req.body.eventData;

  if (!eventData.title || typeof eventData.title !== 'string' || !eventData.title.trim()) {
    return res.status(400).json({ error: 'Event title is required' });
  }

  const insertPayload = {
    ...eventData,
    status: 'pending_review',
  };

  // Remove source_url as it's filled by the server/frontend based on the scraped URL
  delete insertPayload.source_url;

  const { data: createdEvent, error } = await supabase
    .from('events')
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    logger.error(`[EVENT_SCRAPER] Error creating event: ${error.message}`);
    throw error;
  }

  logger.info(`[EVENT_SCRAPER] Event created successfully: ${createdEvent.id}`);

  res.status(201).json({
    success: true,
    eventId: createdEvent.id,
    event: createdEvent,
  });
});

export default router;
