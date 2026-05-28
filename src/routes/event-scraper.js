import 'dotenv/config';
import express from 'express';
import logger from '../utils/logger.js';
import { stream } from '../api/integrated-ai.js';
import { EventScraperPrompt } from '../constants/prompts.js';
import pb from '../utils/pocketbaseClient.js';

const router = express.Router();
const AI_PROCESSING_TIMEOUT = 60000; // 60 seconds

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid URL
 */
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Fetch webpage content from URL
 * @param {string} url - URL to fetch
 * @returns {Promise<string>} HTML/text content
 */
async function fetchWebpageContent(url) {
  logger.info(`[EVENT_SCRAPER] Fetching content from URL: ${url}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.error(`[EVENT_SCRAPER] Failed to fetch URL: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to fetch webpage: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    logger.debug(`[EVENT_SCRAPER] Content-Type: ${contentType}`);

    if (!contentType || (!contentType.includes('text/html') && !contentType.includes('text/plain') && !contentType.includes('application/json'))) {
      logger.warn(`[EVENT_SCRAPER] Unexpected content type: ${contentType}`);
    }

    const content = await response.text();
    logger.info(`[EVENT_SCRAPER] Successfully fetched ${content.length} bytes from ${url}`);

    return content;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      logger.error('[EVENT_SCRAPER] Fetch request timed out (10s)');
      throw new Error('Fetch request timed out');
    }
    logger.error(`[EVENT_SCRAPER] Fetch error: ${error.message}`);
    throw error;
  }
}

/**
 * Extract text content from HTML
 * Removes scripts, styles, and excessive whitespace
 * @param {string} html - HTML content
 * @returns {string} Extracted text
 */
function extractTextFromHtml(html) {
  logger.debug('[EVENT_SCRAPER] Extracting text from HTML');

  // Remove script and style elements
  let text = html.replace(/<script[^>]*>.*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>.*?<\/style>/gi, '');

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

  // Remove excessive whitespace
  text = text.replace(/\s+/g, ' ').trim();

  // Limit to first 8000 characters to avoid token limits
  if (text.length > 8000) {
    text = text.substring(0, 8000) + '...';
    logger.debug('[EVENT_SCRAPER] Text truncated to 8000 characters');
  }

  logger.debug(`[EVENT_SCRAPER] Extracted ${text.length} characters of text`);
  return text;
}

/**
 * Parse and validate JSON response from AI
 * Handles markdown code block wrappers and validates structure
 * @param {string} jsonString - JSON string to parse
 * @returns {Object} Parsed event data
 */
function parseAndValidateEventJson(jsonString) {
  logger.debug('[EVENT_SCRAPER] Parsing and validating event JSON');

  if (!jsonString || typeof jsonString !== 'string') {
    logger.error('[EVENT_SCRAPER] JSON string is empty or not a string');
    throw new Error('AI response is not a valid string');
  }

  let trimmedJson = jsonString.trim();

  // Remove markdown code block wrappers if present
  if (trimmedJson.startsWith('```json')) {
    logger.debug('[EVENT_SCRAPER] Removing ```json markdown wrapper');
    trimmedJson = trimmedJson.substring(7);
  } else if (trimmedJson.startsWith('```')) {
    logger.debug('[EVENT_SCRAPER] Removing ``` markdown wrapper');
    trimmedJson = trimmedJson.substring(3);
  }

  if (trimmedJson.endsWith('```')) {
    logger.debug('[EVENT_SCRAPER] Removing closing ``` markdown wrapper');
    trimmedJson = trimmedJson.substring(0, trimmedJson.length - 3);
  }

  trimmedJson = trimmedJson.trim();

  // Try to parse JSON
  let eventData;
  try {
    eventData = JSON.parse(trimmedJson);
    logger.debug('[EVENT_SCRAPER] JSON parsed successfully');
  } catch (parseError) {
    logger.error(`[EVENT_SCRAPER] JSON parse error: ${parseError.message}`);
    logger.debug(`[EVENT_SCRAPER] Invalid JSON string: ${trimmedJson.substring(0, 200)}...`);
    throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
  }

  // Validate event data has required name field
  if (!eventData.name || typeof eventData.name !== 'string' || !eventData.name.trim()) {
    logger.error('[EVENT_SCRAPER] Event data missing required name field');
    throw new Error('Event data must have a name field');
  }

  logger.info('[EVENT_SCRAPER] Event data validated successfully');
  logger.debug(`[EVENT_SCRAPER] Event name: ${eventData.name}`);

  return eventData;
}

/**
 * Validate and normalize event data for PocketBase storage
 * @param {Object} eventData - Raw event data from AI
 * @returns {Object} Validated and normalized event data
 */
function validateAndNormalizeEventData(eventData) {
  logger.debug('[EVENT_SCRAPER] Validating and normalizing event data');

  // Validate required fields
  if (!eventData.name || typeof eventData.name !== 'string' || !eventData.name.trim()) {
    throw new Error('Event name is required');
  }

  // Normalize and validate date format (YYYY-MM-DD)
  let normalizedDate = null;
  if (eventData.date) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (typeof eventData.date === 'string' && dateRegex.test(eventData.date)) {
      normalizedDate = eventData.date;
      logger.debug(`[EVENT_SCRAPER] Date validated: ${normalizedDate}`);
    } else {
      logger.warn(`[EVENT_SCRAPER] Invalid date format: ${eventData.date}`);
    }
  }

  // Normalize and validate time format (HH:MM)
  let normalizedTime = null;
  if (eventData.time) {
    const timeRegex = /^\d{2}:\d{2}$/;
    if (typeof eventData.time === 'string' && timeRegex.test(eventData.time)) {
      normalizedTime = eventData.time;
      logger.debug(`[EVENT_SCRAPER] Time validated: ${normalizedTime}`);
    } else {
      logger.warn(`[EVENT_SCRAPER] Invalid time format: ${eventData.time}`);
    }
  }

  // Validate and normalize price (must be number or null)
  let normalizedPrice = null;
  if (eventData.price !== null && eventData.price !== undefined) {
    const priceNum = typeof eventData.price === 'string' ? parseFloat(eventData.price) : eventData.price;
    if (!isNaN(priceNum) && priceNum >= 0) {
      normalizedPrice = priceNum;
      logger.debug(`[EVENT_SCRAPER] Price validated: ${normalizedPrice}`);
    } else {
      logger.warn(`[EVENT_SCRAPER] Invalid price: ${eventData.price}`);
    }
  }

  // Validate and normalize capacity (must be number or null)
  let normalizedCapacity = null;
  if (eventData.capacity !== null && eventData.capacity !== undefined) {
    const capacityNum = typeof eventData.capacity === 'string' ? parseInt(eventData.capacity, 10) : eventData.capacity;
    if (!isNaN(capacityNum) && capacityNum >= 0) {
      normalizedCapacity = capacityNum;
      logger.debug(`[EVENT_SCRAPER] Capacity validated: ${normalizedCapacity}`);
    } else {
      logger.warn(`[EVENT_SCRAPER] Invalid capacity: ${eventData.capacity}`);
    }
  }

  // Validate URL fields
  let normalizedImageUrl = null;
  if (eventData.imageUrl && typeof eventData.imageUrl === 'string') {
    if (isValidUrl(eventData.imageUrl)) {
      normalizedImageUrl = eventData.imageUrl;
      logger.debug(`[EVENT_SCRAPER] Image URL validated`);
    } else {
      logger.warn(`[EVENT_SCRAPER] Invalid image URL: ${eventData.imageUrl}`);
    }
  }

  let normalizedRegistrationLink = null;
  if (eventData.registrationLink && typeof eventData.registrationLink === 'string') {
    if (isValidUrl(eventData.registrationLink)) {
      normalizedRegistrationLink = eventData.registrationLink;
      logger.debug(`[EVENT_SCRAPER] Registration link validated`);
    } else {
      logger.warn(`[EVENT_SCRAPER] Invalid registration link: ${eventData.registrationLink}`);
    }
  }

  // Validate contact object
  let normalizedContact = {
    email: null,
    phone: null,
    website: null,
  };
  if (eventData.contact && typeof eventData.contact === 'object') {
    if (eventData.contact.email && typeof eventData.contact.email === 'string') {
      normalizedContact.email = eventData.contact.email;
    }
    if (eventData.contact.phone && typeof eventData.contact.phone === 'string') {
      normalizedContact.phone = eventData.contact.phone;
    }
    if (eventData.contact.website && typeof eventData.contact.website === 'string') {
      if (isValidUrl(eventData.contact.website)) {
        normalizedContact.website = eventData.contact.website;
      }
    }
  }

  // Validate arrays
  let normalizedSpeakers = null;
  if (Array.isArray(eventData.speakers) && eventData.speakers.length > 0) {
    normalizedSpeakers = eventData.speakers.filter(s => typeof s === 'string' && s.trim()).map(s => s.trim());
    if (normalizedSpeakers.length === 0) {
      normalizedSpeakers = null;
    }
  }

  let normalizedTags = null;
  if (Array.isArray(eventData.tags) && eventData.tags.length > 0) {
    normalizedTags = eventData.tags.filter(t => typeof t === 'string' && t.trim()).map(t => t.trim());
    if (normalizedTags.length === 0) {
      normalizedTags = null;
    }
  }

  const normalized = {
    name: eventData.name.trim(),
    description: eventData.description && typeof eventData.description === 'string' ? eventData.description.trim() : null,
    date: normalizedDate,
    time: normalizedTime,
    location: eventData.location && typeof eventData.location === 'string' ? eventData.location.trim() : null,
    category: eventData.category && typeof eventData.category === 'string' ? eventData.category.trim() : null,
    type: eventData.type && typeof eventData.type === 'string' ? eventData.type.trim() : null,
    price: normalizedPrice,
    capacity: normalizedCapacity,
    organizer: eventData.organizer && typeof eventData.organizer === 'string' ? eventData.organizer.trim() : null,
    contact: normalizedContact,
    imageUrl: normalizedImageUrl,
    registrationLink: normalizedRegistrationLink,
    duration: eventData.duration && typeof eventData.duration === 'string' ? eventData.duration.trim() : null,
    speakers: normalizedSpeakers,
    tags: normalizedTags,
  };

  logger.debug(`[EVENT_SCRAPER] Event data normalized: ${JSON.stringify(normalized)}`);
  return normalized;
}

/**
 * Format SSE event with proper JSON serialization
 * @param {Object} data - Data to send
 * @returns {string} Formatted SSE event
 */
function formatSSEEvent(data) {
  try {
    const jsonStr = JSON.stringify(data);
    logger.debug(`[EVENT_SCRAPER] Formatted SSE event: ${jsonStr.substring(0, 100)}...`);
    return `data: ${jsonStr}\n\n`;
  } catch (error) {
    logger.error(`[EVENT_SCRAPER] Error formatting SSE event: ${error.message}`);
    return `data: ${JSON.stringify({ error: 'Failed to format response' })}\n\n`;
  }
}

/**
 * POST /scrape-event-url
 * Fetch and extract text content from a webpage URL
 *
 * Request body:
 * {
 *   "url": "https://example.com/event"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "content": "Extracted text content from the webpage..."
 * }
 *
 * Error responses:
 * - 400 Bad Request: Invalid URL format
 * - 500 Internal Server Error: Network errors, timeouts
 */
router.post('/scrape-event-url', async (req, res) => {
  logger.info('[EVENT_SCRAPER] Received scrape-event-url request');

  // Validate request body
  if (!req.body) {
    logger.error('[EVENT_SCRAPER] Request body is empty or not parsed');
    return res.status(400).json({ error: 'Request body is required' });
  }

  logger.debug(`[EVENT_SCRAPER] Request body type: ${typeof req.body}, keys: ${Object.keys(req.body).join(', ')}`);

  // Extract and validate URL
  let url;
  try {
    url = req.body.url;
    logger.debug(`[EVENT_SCRAPER] Extracted URL from request body: ${url ? url.substring(0, 50) + '...' : 'undefined'}`);
  } catch (error) {
    logger.error(`[EVENT_SCRAPER] Error extracting URL from request body: ${error.message}`);
    return res.status(400).json({ error: 'Failed to parse request body' });
  }

  // Validate URL input
  if (!url || typeof url !== 'string' || !url.trim()) {
    logger.warn('[EVENT_SCRAPER] Missing or invalid URL in request');
    return res.status(400).json({ error: 'URL is required and must be a non-empty string' });
  }

  const trimmedUrl = url.trim();

  // Validate URL format
  if (!isValidUrl(trimmedUrl)) {
    logger.warn(`[EVENT_SCRAPER] Invalid URL format: ${trimmedUrl}`);
    return res.status(400).json({ error: 'Invalid URL format. Please provide a valid HTTP/HTTPS URL.' });
  }

  // Validate URL protocol
  if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
    logger.warn(`[EVENT_SCRAPER] URL must use HTTP/HTTPS protocol: ${trimmedUrl}`);
    return res.status(400).json({ error: 'URL must use HTTP or HTTPS protocol' });
  }

  logger.info(`[EVENT_SCRAPER] Processing scrape-event-url request for URL: ${trimmedUrl}`);

  // Fetch webpage content
  let htmlContent;
  try {
    logger.debug('[EVENT_SCRAPER] Fetching webpage content');
    htmlContent = await fetchWebpageContent(trimmedUrl);
  } catch (error) {
    logger.error(`[EVENT_SCRAPER] Error fetching webpage: ${error.message}`);
    throw error;
  }

  // Extract text from HTML
  let textContent;
  try {
    logger.debug('[EVENT_SCRAPER] Extracting text from HTML');
    textContent = extractTextFromHtml(htmlContent);
  } catch (error) {
    logger.error(`[EVENT_SCRAPER] Error extracting text: ${error.message}`);
    throw error;
  }

  logger.info('[EVENT_SCRAPER] Successfully scraped and extracted content from URL');

  res.json({
    success: true,
    content: textContent,
  });
});

/**
 * POST /extract-event-from-content
 * Extract event information from text content using AI
 *
 * Request body:
 * {
 *   "content": "Event page text content..."
 * }
 *
 * Response (SSE stream):
 * Streams AI-generated event extraction data as JSON
 * {
 *   "success": true,
 *   "eventData": {
 *     "name": "string",
 *     "description": "string or null",
 *     "date": "YYYY-MM-DD or null",
 *     "time": "HH:MM or null",
 *     "location": "string or null",
 *     "category": "string or null",
 *     "type": "In-Person|Virtual|Hybrid or null",
 *     "price": "number or null",
 *     "capacity": "number or null",
 *     "organizer": "string or null",
 *     "contact": { "email": "...", "phone": "...", "website": "..." },
 *     "imageUrl": "string or null",
 *     "registrationLink": "string or null",
 *     "duration": "string or null",
 *     "speakers": ["string", ...] or null,
 *     "tags": ["string", ...] or null
 *   }
 * }
 */
router.post('/extract-event-from-content', async (req, res) => {
  logger.info('[EVENT_SCRAPER] Received extract-event-from-content request');

  // Validate request body
  if (!req.body) {
    logger.error('[EVENT_SCRAPER] Request body is empty or not parsed');
    return res.status(400).json({ error: 'Request body is required' });
  }

  logger.debug(`[EVENT_SCRAPER] Request body type: ${typeof req.body}, keys: ${Object.keys(req.body).join(', ')}`);

  // Extract and validate content
  let content;
  try {
    content = req.body.content;
    logger.debug(`[EVENT_SCRAPER] Extracted content from request body: ${content ? content.substring(0, 50) + '...' : 'undefined'}`);
  } catch (error) {
    logger.error(`[EVENT_SCRAPER] Error extracting content from request body: ${error.message}`);
    return res.status(400).json({ error: 'Failed to parse request body' });
  }

  // Validate content input
  if (!content || typeof content !== 'string' || !content.trim()) {
    logger.warn('[EVENT_SCRAPER] Missing or invalid content in request');
    return res.status(400).json({ error: 'Content is required and must be a non-empty string' });
  }

  const trimmedContent = content.trim();
  logger.info(`[EVENT_SCRAPER] Processing extract-event-from-content request with ${trimmedContent.length} characters`);

  // Set SSE headers
  logger.debug('[EVENT_SCRAPER] Setting SSE response headers');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  logger.debug('[EVENT_SCRAPER] SSE headers set successfully');

  // Track if response has ended
  let responseEnded = false;

  /**
   * Send SSE error event
   * @param {string} errorMessage - Error message to send
   */
  function sendSSEError(errorMessage) {
    if (responseEnded) {
      logger.warn('[EVENT_SCRAPER] Attempted to send error after response ended');
      return;
    }

    try {
      const errorEvent = formatSSEEvent({ error: errorMessage });
      logger.debug(`[EVENT_SCRAPER] Sending SSE error event: ${errorEvent.substring(0, 100)}...`);
      res.write(errorEvent);
      responseEnded = true;
      res.end();
    } catch (writeError) {
      logger.error(`[EVENT_SCRAPER] Error writing SSE error event: ${writeError.message}`);
      if (!responseEnded) {
        responseEnded = true;
        res.end();
      }
    }
  }

  // Prepare message for AI
  let userMessage;
  try {
    const extractionPrompt = `Extract event information from the following page content. Identify and extract: event name/title, description, date, time, location/venue, category, type, ticket/entry price, capacity/attendance limit, organizer/host, contact information, event image URL, registration/ticket URL, duration, speakers, and tags. Return the data in a structured JSON format with fields: name, description, date, time, location, category, type, price, capacity, organizer, contact (with email, phone, website), imageUrl, registrationLink, duration, speakers, tags. If a field is not found, use null. Return ONLY valid JSON, no markdown or extra text.

Page content:
${trimmedContent}`;

    userMessage = [
      {
        type: 'text',
        text: extractionPrompt,
      },
    ];
    logger.info('[EVENT_SCRAPER] User message prepared for AI');
    logger.debug(`[EVENT_SCRAPER] Message length: ${userMessage[0].text.length} characters`);
  } catch (error) {
    logger.error(`[EVENT_SCRAPER] Error preparing user message: ${error.message}`);
    return sendSSEError(`Failed to prepare message for AI: ${error.message}`);
  }

  logger.info('[EVENT_SCRAPER] Sending content to AI for event extraction');

  // Stream AI response
  let sseStream;
  try {
    logger.debug('[EVENT_SCRAPER] Calling integrated AI stream function');
    sseStream = await stream({
      userId: 'event-scraper',
      systemPrompt: EventScraperPrompt,
      userMessage,
    });

    logger.info('[EVENT_SCRAPER] AI stream created successfully');
  } catch (error) {
    logger.error(`[EVENT_SCRAPER] Error creating AI stream: ${error.message}`, error);
    return sendSSEError(`Failed to initialize AI stream: ${error.message}`);
  }

  logger.info('[EVENT_SCRAPER] Starting SSE stream for event extraction');

  // Set up timeout for AI processing
  const timeoutId = setTimeout(() => {
    logger.warn('[EVENT_SCRAPER] AI processing timeout (60s)');
    if (!responseEnded) {
      responseEnded = true;
      sendSSEError('AI processing timeout');
    }
    sseStream.destroy();
  }, AI_PROCESSING_TIMEOUT);

  // Accumulate the AI-generated text content from integrated-ai SSE events
  let fullJsonResponse = '';

  // Each chunk from integrated-ai looks like:
  //   data: {"type":"content","data":{"content":"...partial text..."}}\n\n
  // We parse each line and collect only the text from 'content' type events.
  sseStream.on('data', (chunk) => {
    if (responseEnded) {
      logger.debug('[EVENT_SCRAPER] Ignoring data chunk after response ended');
      return;
    }

    const chunkStr = chunk.toString();
    logger.debug(`[EVENT_SCRAPER] Stream data chunk received: ${chunkStr.substring(0, 100)}...`);

    const lines = chunkStr.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine.startsWith('data: ')) continue;

      const jsonStr = trimmedLine.substring(6).trim();
      if (!jsonStr) continue;

      try {
        const event = JSON.parse(jsonStr);
        if (event.type === 'content' && event.data?.content) {
          fullJsonResponse += event.data.content;
          logger.debug('[EVENT_SCRAPER] Content chunk accumulated');
        }
      } catch (e) {
        logger.debug('[EVENT_SCRAPER] Skipping non-JSON SSE line');
      }
    }
  });

  // Pipe stream to response
  sseStream.pipe(res, { end: false });

  // Handle stream end
  sseStream.on('end', () => {
    logger.info('[EVENT_SCRAPER] AI stream ended');
    clearTimeout(timeoutId);

    if (!responseEnded) {
      // Final validation of collected JSON
      if (fullJsonResponse) {
        try {
          const validatedEventData = parseAndValidateEventJson(fullJsonResponse);
          logger.info('[EVENT_SCRAPER] Final event data validation successful');
          logger.debug(`[EVENT_SCRAPER] Extracted event: ${validatedEventData.name}`);

          // Normalize and validate event data
          const normalizedData = validateAndNormalizeEventData(validatedEventData);
          logger.debug(`[EVENT_SCRAPER] Normalized event data: ${JSON.stringify(normalizedData)}`);

          // Send final structured response
          const finalEvent = formatSSEEvent({
            success: true,
            eventData: normalizedData,
          });
          res.write(finalEvent);
        } catch (validationError) {
          logger.error(`[EVENT_SCRAPER] Final validation failed: ${validationError.message}`);
          // Send validation error as final event
          const errorEvent = formatSSEEvent({
            error: `Event data validation failed: ${validationError.message}`,
          });
          res.write(errorEvent);
        }
      } else {
        logger.warn('[EVENT_SCRAPER] No JSON response collected from AI stream');
        const errorEvent = formatSSEEvent({
          error: 'No event data extracted from AI response',
        });
        res.write(errorEvent);
      }

      responseEnded = true;
      res.end();
      logger.info('[EVENT_SCRAPER] SSE stream ended successfully');
    }
  });

  // Handle stream errors
  sseStream.on('error', (error) => {
    logger.error(`[EVENT_SCRAPER] Stream error: ${error.message}`, error);
    clearTimeout(timeoutId);
    if (!responseEnded) {
      responseEnded = true;
      sendSSEError(`Stream error: ${error.message}`);
    }
  });

  // Handle client disconnect
  res.on('close', () => {
    logger.info('[EVENT_SCRAPER] Client disconnected, destroying stream');
    clearTimeout(timeoutId);
    responseEnded = true;
    sseStream.destroy();
  });

  // Handle response errors
  res.on('error', (error) => {
    logger.error(`[EVENT_SCRAPER] Response error: ${error.message}`, error);
    clearTimeout(timeoutId);
    responseEnded = true;
    sseStream.destroy();
  });
});

/**
 * POST /create-event-from-data
 * Create an event record in PocketBase from extracted event data
 *
 * Request body:
 * {
 *   "eventData": { ... normalized event data ... }
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "eventId": "created_event_id",
 *   "event": { ... created event record ... }
 * }
 */
router.post('/create-event-from-data', async (req, res) => {
  logger.info('[EVENT_SCRAPER] Received create-event-from-data request');

  // Validate request body
  if (!req.body || !req.body.eventData) {
    logger.error('[EVENT_SCRAPER] Request body missing eventData');
    return res.status(400).json({ error: 'eventData is required' });
  }

  const eventData = req.body.eventData;
  logger.debug(`[EVENT_SCRAPER] Event data received: ${JSON.stringify(eventData)}`);

  try {
    // Validate event data
    if (!eventData.name || typeof eventData.name !== 'string' || !eventData.name.trim()) {
      logger.error('[EVENT_SCRAPER] Event name is required');
      return res.status(400).json({ error: 'Event name is required' });
    }

    logger.info(`[EVENT_SCRAPER] Creating event in PocketBase: ${eventData.name}`);

    // Create event record in PocketBase
    const createdEvent = await pb.collection('events').create({
      name: eventData.name,
      description: eventData.description || '',
      date: eventData.date || null,
      time: eventData.time || null,
      location: eventData.location || '',
      category: eventData.category || '',
      type: eventData.type || '',
      price: eventData.price || null,
      capacity: eventData.capacity || null,
      organizer: eventData.organizer || '',
      contact: eventData.contact || { email: null, phone: null, website: null },
      imageUrl: eventData.imageUrl || '',
      registrationLink: eventData.registrationLink || '',
      duration: eventData.duration || '',
      speakers: eventData.speakers || [],
      tags: eventData.tags || [],
      status: 'active',
      createdAt: new Date().toISOString(),
    });

    logger.info(`[EVENT_SCRAPER] Event created successfully: ${createdEvent.id}`);
    logger.debug(`[EVENT_SCRAPER] Created event: ${JSON.stringify(createdEvent)}`);

    res.status(201).json({
      success: true,
      eventId: createdEvent.id,
      event: createdEvent,
    });
  } catch (error) {
    logger.error(`[EVENT_SCRAPER] Error creating event: ${error.message}`);
    throw error;
  }
});

export default router;