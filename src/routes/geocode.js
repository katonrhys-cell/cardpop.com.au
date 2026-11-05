import { Router } from 'express';
import logger from '../utils/logger.js';
import { geocodeQueries } from '../utils/geocodeCache.js';

// POST /geocode/batch — coordinates for the Local Map's stores and events.
// Body: { queries: string[] } (address strings built by lib/geocode.js).
// Answers { results: { [normalisedQuery]: [lat, lng] | null }, pending: [] };
// pending queries have no answer yet and are looked up on a later request.
const router = Router();
const MAX_QUERIES = 400;

router.post('/batch', async (req, res) => {
  const queries = Array.isArray(req.body?.queries) ? req.body.queries : null;
  if (!queries || queries.length > MAX_QUERIES || !queries.every((q) => typeof q === 'string' && q.length <= 200)) {
    return res.status(400).json({ error: `queries must be an array of at most ${MAX_QUERIES} strings` });
  }
  try {
    return res.json(await geocodeQueries(queries));
  } catch (error) {
    logger.error(`[GEOCODE] batch failed: ${error.message}`);
    return res.status(502).json({ error: 'Geocoding unavailable' });
  }
});

export default router;
