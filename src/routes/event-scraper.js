import 'dotenv/config';
import express from 'express';
import logger from '../utils/logger.js';
import { stream } from '../api/integrated-ai.js';
import { EventScraperPrompt } from '../constants/prompts.js';
import supabase from '../utils/supabaseClient.js';
import { authMiddleware, isAdminUser } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAal2.js';
import { LargeBodyLimit } from '../constants/common.js';
import {
  fetchWebpageContent,
  extractTextFromHtml,
  isFetchableHttpUrl,
  ssrfSafeLookup,
} from '../utils/safeFetch.js';
import {
  parseAndValidateEventJson,
  validateAndNormalizeEventData,
} from '../utils/eventData.js';

// The SSRF guard (src/utils/safeFetch.js) and the extracted-event validator
// (src/utils/eventData.js) live in utils so the nightly event scanner uses the
// exact same code paths as this admin panel. Both are re-exported here because
// their unit tests address them through this module.
export { ssrfSafeLookup, validateAndNormalizeEventData };

const router = express.Router();
const AI_PROCESSING_TIMEOUT = 60000;

// Every endpoint on this router is admin-only, and one accepts a large pasted
// body. The global body parser (src/app.js) deliberately does NOT parse JSON
// for this router, so gate the whole thing here — authenticate, then authorize,
// and only THEN parse the (possibly 20 MB) body. This guarantees an
// unauthenticated or non-admin caller is rejected before any large allocation.
// The per-route authMiddleware / isAdminUser checks below are kept as
// defence-in-depth.
router.use(authMiddleware);
router.use(requireAdmin);
router.use(express.json({ limit: LargeBodyLimit }));

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
  if (!isFetchableHttpUrl(trimmedUrl)) {
    return res.status(400).json({ error: 'Invalid URL format. Please provide a valid HTTP/HTTPS URL.' });
  }

  try {
    const htmlContent = await fetchWebpageContent(trimmedUrl, { logPrefix: 'EVENT_SCRAPER' });
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
