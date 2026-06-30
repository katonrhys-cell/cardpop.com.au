import 'dotenv/config';
import express from 'express';
import { callEbayApi } from '../utils/ebayClient.js';
import { getMarketData, getCardDetails } from '../utils/ebayMarketData.js';
import { getSalesData, getStatistics } from '../utils/ebaySalesStats.js';
import { POPULAR_CARDS } from '../utils/ebayPopularCards.js';
import * as ebayCache from '../utils/ebayCache.js';
import { getUsdToAudRate } from '../utils/exchangeRates.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /ebay/search
 * Search for active eBay AU listings matching a card name.
 *
 * Query params:
 *   cardName (required) — e.g. "Charizard Base Set"
 *   limit    (optional) — 1–200, default 20
 *
 * Response: array of listing objects (NOT wrapped in an envelope)
 */
router.get('/search', async (req, res) => {
  const { cardName, limit = '20' } = req.query;

  if (!cardName?.trim()) {
    return res.status(400).json({ error: 'cardName query parameter is required' });
  }

  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 20));
  const query = cardName.trim();

  logger.info(`[EBAY_SEARCH] Searching for: "${query}", limit: ${limitNum}`);

  try {
    const params = new URLSearchParams({
      q: query,
      filter: 'buyingOptions:{AUCTION|FIXED_PRICE},itemLocationCountry:AU',
      limit: limitNum,
      sort: 'newlyListed',
    });

    const data = await callEbayApi(`/buy/browse/v1/item_summary/search?${params}`);
    logger.info(`[EBAY_SEARCH] API returned ${data.itemSummaries?.length ?? 0} items`);

    const listings = (data.itemSummaries || []).map(item => ({
      itemId:       item.itemId,
      title:        item.title,
      price:        item.price?.value ? parseFloat(item.price.value) : 0,
      condition:    parseCondition(item.condition),
      sellerUsername: item.seller?.username || 'Unknown',
      sellerRating:   item.seller?.feedbackPercentage || 0,
      feedbackCount:  item.seller?.feedbackScore || 0,
      listingUrl:     item.itemWebUrl || '',
      thumbnailUrl:   item.image?.imageUrl || '',
    }));

    res.json(listings);
  } catch (error) {
    logger.error(`[EBAY_SEARCH] Error: ${error.message}`);
    res.status(502).json({ error: 'eBay API unavailable. Please try again later.' });
  }
});

/**
 * GET /ebay/price-estimate
 * Estimate current AUD market price for a specific card, optionally graded.
 *
 * Query params:
 *   name           (required) — card name
 *   set            (optional) — set name
 *   gradingService (optional) — PSA | BGS | CGC | ACE | None
 *   gradeScore     (optional) — 10 | 9.5 | 9 | etc.
 *
 * Response:
 *   { count, avgPrice, minPrice, maxPrice, listings[] }
 */
router.get('/price-estimate', async (req, res) => {
  const { name, set, gradingService, gradeScore } = req.query;

  if (!name?.trim()) {
    return res.status(400).json({ error: 'name query parameter is required' });
  }

  // Build a targeted search query
  const parts = [name.trim()];
  if (set?.trim()) parts.push(set.trim());
  if (gradingService && gradingService !== 'None') {
    parts.push(gradingService.trim());
    if (gradeScore) parts.push(String(gradeScore).trim());
  }
  const query = parts.join(' ');

  logger.info(`[EBAY_PRICE_ESTIMATE] Query: "${query}"`);

  try {
    // Fetch from both eBay AU and eBay US in parallel
    const [auResult, usResult] = await Promise.allSettled([
      // eBay.com.au (Australian listings)
      callEbayApi(
        `/buy/browse/v1/item_summary/search?${new URLSearchParams({
          q: query,
          filter: 'buyingOptions:{AUCTION|FIXED_PRICE},itemLocationCountry:AU',
          limit: 15,
          sort: 'newlyListed',
        })}`,
        { headers: { 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_AU' } }
      ),
      // eBay.com (US listings)
      callEbayApi(
        `/buy/browse/v1/item_summary/search?${new URLSearchParams({
          q: query,
          filter: 'buyingOptions:{AUCTION|FIXED_PRICE}',
          limit: 15,
          sort: 'newlyListed',
        })}`,
        { headers: { 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' } }
      ),
    ]);

    // Promise.allSettled never rejects, so a total outage (both marketplaces
    // failed) would otherwise fall through as an empty result with a 200 — making
    // "eBay is down" indistinguishable from "no listings found". Signal it.
    // A single-marketplace failure still degrades gracefully to the other's data.
    if (auResult.status === 'rejected' && usResult.status === 'rejected') {
      logger.error(`[EBAY_PRICE_ESTIMATE] Both marketplaces failed: ${auResult.reason?.message || usResult.reason?.message}`);
      return res.status(502).json({ error: 'eBay API unavailable. Please try again later.' });
    }

    // Extract results, marking with marketplace
    let allItems = [];
    if (auResult.status === 'fulfilled' && auResult.value.itemSummaries?.length > 0) {
      auResult.value.itemSummaries.forEach(i => {
        allItems.push({ ...i, marketplace: 'AU', currency: 'AUD' });
      });
      logger.info(`[EBAY_PRICE_ESTIMATE] Found ${auResult.value.itemSummaries.length} AU listings`);
    } else if (auResult.status === 'rejected') {
      logger.warn(`[EBAY_PRICE_ESTIMATE] AU API failed: ${auResult.reason?.message}`);
    }
    if (usResult.status === 'fulfilled' && usResult.value.itemSummaries?.length > 0) {
      usResult.value.itemSummaries.forEach(i => {
        allItems.push({ ...i, marketplace: 'US', currency: 'USD' });
      });
      logger.info(`[EBAY_PRICE_ESTIMATE] Found ${usResult.value.itemSummaries.length} US listings`);
    } else if (usResult.status === 'rejected') {
      logger.warn(`[EBAY_PRICE_ESTIMATE] US API failed: ${usResult.reason?.message}`);
    }

    // If both marketplaces failed, throw error
    if (auResult.status === 'rejected' && usResult.status === 'rejected') {
      throw new Error('Both eBay API calls failed');
    }

    // Filter to only include listings with valid prices
    allItems = allItems.filter(i => {
      const price = parseFloat(i.price?.value);
      return !isNaN(price) && price > 0;
    });

    logger.info(`[EBAY_PRICE_ESTIMATE] After price filter: ${allItems.length} valid listings`);

    // Separate base cards from graded versions
    const gradingKeywords = ['psa', 'bgs', 'cgc', 'sgc', 'autograph', 'auto'];
    const baseCards = [];
    const gradedCards = [];

    // Classify each listing
    for (const item of allItems) {
      const titleLower = item.title.toLowerCase();
      const isGraded = gradingKeywords.some(kw => titleLower.includes(kw));
      if (isGraded) {
        gradedCards.push(item);
      } else {
        baseCards.push(item);
      }
    }

    // Score and sort each group by relevance
    const scoreListing = (item, cardNameLower) => {
      const title = item.title.toLowerCase();
      const exactMatch = title === cardNameLower ? 10 : 0;
      const containsCardName = title.includes(cardNameLower) ? 3 : 0;
      return exactMatch + containsCardName;
    };

    const cardNameLower = name.toLowerCase();
    baseCards.sort((a, b) => scoreListing(b, cardNameLower) - scoreListing(a, cardNameLower));
    gradedCards.sort((a, b) => scoreListing(b, cardNameLower) - scoreListing(a, cardNameLower));

    // Convert all prices to AUD using the live (24h-cached) rate, with a safe
    // fallback inside getUsdToAudRate. A hardcoded 1.50 skewed every
    // cross-marketplace average that feeds the card valuations users see.
    const USD_TO_AUD = await getUsdToAudRate();

    const calculatePrices = (items) => {
      return items.map(i => {
        const basePrice = parseFloat(i.price?.value || 0);
        return i.currency === 'USD' ? basePrice * USD_TO_AUD : basePrice;
      }).filter(p => p > 0);
    };

    const baseCardPrices = calculatePrices(baseCards);
    const gradedCardPrices = calculatePrices(gradedCards);
    const allPrices = [...baseCardPrices, ...gradedCardPrices];

    const avgPrice = allPrices.length > 0
      ? Math.round((allPrices.reduce((a, b) => a + b, 0) / allPrices.length) * 100) / 100
      : 0;

    const formatListing = (item) => ({
      itemId:      item.itemId,
      title:       item.title,
      price:       parseFloat(item.price?.value || 0),
      currency:    item.currency,
      priceInAUD:  item.currency === 'USD' ? parseFloat(item.price?.value || 0) * USD_TO_AUD : parseFloat(item.price?.value || 0),
      condition:   parseCondition(item.condition),
      marketplace: item.marketplace,
      listingUrl:  item.itemWebUrl || '',
      thumbnailUrl: item.image?.imageUrl || '',
    });

    const baseListings = baseCards.slice(0, 8).map(formatListing);
    const gradedListings = gradedCards.slice(0, 8).map(formatListing);

    logger.info(`[EBAY_PRICE_ESTIMATE] ${baseCards.length} base cards, ${gradedCards.length} graded, avg AUD: $${avgPrice}`);

    res.json({
      count: allPrices.length,
      avgPrice,
      minPrice: allPrices.length > 0 ? Math.min(...allPrices) : 0,
      maxPrice: allPrices.length > 0 ? Math.max(...allPrices) : 0,
      baseListings,
      gradedListings,
      baseCount: baseCardPrices.length,
      gradedCount: gradedCardPrices.length,
      exchangeRate: USD_TO_AUD,
    });
  } catch (error) {
    logger.error(`[EBAY_PRICE_ESTIMATE] Error: ${error.message}`);
    res.status(502).json({ error: 'eBay API unavailable. Please try again later.' });
  }
});

/**
 * GET /ebay/listings
 * Fetch live eBay AU listings with optional filters.
 *
 * Query params: keywords, category, condition, sort, limit (max 200), offset
 */
router.get('/listings', async (req, res) => {
  const {
    keywords = '',
    category = '',
    condition = '',
    sort = 'newlyListed',
    limit = '50',
    offset = '0',
  } = req.query;

  const limitNum  = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  const offsetNum = Math.max(0, parseInt(offset, 10) || 0);

  logger.info(`[EBAY_LISTINGS] keywords="${keywords}" category="${category}" limit=${limitNum} offset=${offsetNum}`);

  try {
    let searchQuery = keywords || 'trading card';
    if (category) searchQuery = `${searchQuery} ${category}`;

    const filters = ['buyingOptions:{AUCTION|FIXED_PRICE}', 'itemLocationCountry:AU'];
    const conditionMap = { 'new': '3000', 'like new': '3010', 'good': '3020', 'fair': '3030', 'used': '4000' };
    const conditionId = conditionMap[condition.toLowerCase()];
    if (conditionId) filters.push(`conditionIds:{${conditionId}}`);

    const params = new URLSearchParams({
      q: searchQuery,
      filter: filters.join(','),
      limit: limitNum,
      offset: offsetNum,
      sort,
    });

    const data = await callEbayApi(`/buy/browse/v1/item_summary/search?${params}`);

    const listings = (data.itemSummaries || []).map(item => ({
      itemId:       item.itemId,
      title:        item.title,
      price:        item.price?.value ? parseFloat(item.price.value) : 0,
      condition:    parseCondition(item.condition),
      imageUrl:     item.image?.imageUrl || '',
      sellerName:   item.seller?.username || 'Unknown',
      sellerRating: item.seller?.feedbackPercentage || 0,
      listingUrl:   item.itemWebUrl || '',
      category:     item.categories?.[0] || 'Uncategorized',
      shippingPrice: item.shippingOptions?.[0]?.shippingCost?.value
        ? parseFloat(item.shippingOptions[0].shippingCost.value)
        : 0,
      itemLocation: item.itemLocation?.country || 'Unknown',
    }));

    res.json({ success: true, listings, total: data.total || 0, limit: limitNum, offset: offsetNum, lastUpdated: new Date().toISOString() });
  } catch (error) {
    logger.error(`[EBAY_LISTINGS] Error: ${error.message}`);
    res.status(502).json({ error: 'eBay API unavailable. Please try again later.' });
  }
});

/**
 * GET /ebay/market-data
 * Aggregated market data across all tracked collections.
 */
router.get('/market-data', async (req, res) => {
  logger.info('[EBAY_MARKET_DATA] Fetching market data');
  try {
    const data = await getMarketData();
    logger.info(`[EBAY_MARKET_DATA] ${data.cards.length} cards retrieved`);
    res.json(data);
  } catch (error) {
    logger.error(`[EBAY_MARKET_DATA] Error: ${error.message}`);
    res.status(502).json({ error: 'eBay market data unavailable. Please try again later.' });
  }
});

/**
 * GET /ebay/card-details/:cardId
 * Detailed price data for a single card (by eBay item ID).
 */
router.get('/card-details/:cardId', async (req, res) => {
  const { cardId } = req.params;
  if (!cardId?.trim()) {
    return res.status(400).json({ error: 'cardId parameter is required' });
  }

  logger.info(`[EBAY_CARD_DETAILS] Fetching: ${cardId}`);
  try {
    const data = await getCardDetails(cardId);
    res.json(data);
  } catch (error) {
    logger.error(`[EBAY_CARD_DETAILS] Error: ${error.message}`);
    res.status(502).json({ error: 'eBay card details unavailable. Please try again later.' });
  }
});

/**
 * GET /ebay/sales
 * Sales data with filters (collection, dateRange, price range, condition, pagination).
 */
router.get('/sales', async (req, res) => {
  const {
    collection, dateRange = '7d', priceMin, priceMax, condition,
    page = '1', limit = '50',
  } = req.query;

  const pageNum  = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));

  logger.info(`[EBAY_SALES] collection=${collection} dateRange=${dateRange} page=${pageNum} limit=${limitNum}`);

  try {
    const salesData = await getSalesData({
      collection, dateRange,
      priceMin:  priceMin  ? parseFloat(priceMin)  : undefined,
      priceMax:  priceMax  ? parseFloat(priceMax)  : undefined,
      condition, page: pageNum, limit: limitNum,
    });
    res.json(salesData);
  } catch (error) {
    logger.error(`[EBAY_SALES] Error: ${error.message}`);
    res.status(502).json({ error: 'eBay sales data unavailable. Please try again later.' });
  }
});

/**
 * GET /ebay/statistics
 * Market statistics for a given timeframe and optional collection.
 */
router.get('/statistics', async (req, res) => {
  const { timeframe = '7d', collection } = req.query;
  logger.info(`[EBAY_STATISTICS] timeframe=${timeframe} collection=${collection}`);

  try {
    const statistics = await getStatistics({ timeframe, collection });
    res.json(statistics);
  } catch (error) {
    logger.error(`[EBAY_STATISTICS] Error: ${error.message}`);
    res.status(502).json({ error: 'eBay statistics unavailable. Please try again later.' });
  }
});

/**
 * GET /ebay/popular-cards
 * Live eBay AU prices for the 16 curated popular cards. Cached for 1 hour.
 */
router.get('/popular-cards', async (req, res) => {
  const CACHE_KEY = 'popular-cards';
  const cached = ebayCache.get(CACHE_KEY);
  if (cached) {
    logger.info('[POPULAR_CARDS] Returning cached result');
    return res.json(cached);
  }

  logger.info(`[POPULAR_CARDS] Fetching live prices for ${POPULAR_CARDS.length} cards`);

  try {
    const results = await Promise.allSettled(
      POPULAR_CARDS.map(async (card) => {
        const params = new URLSearchParams({
          q: card.searchQuery,
          filter: 'buyingOptions:{AUCTION|FIXED_PRICE},itemLocationCountry:AU',
          limit: 10,
          sort: 'newlyListed',
        });

        const data  = await callEbayApi(`/buy/browse/v1/item_summary/search?${params}`);
        const items = data.itemSummaries || [];
        const prices = items.map(i => parseFloat(i.price?.value || 0)).filter(p => p > 0);

        const avgPrice = prices.length > 0
          ? Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100
          : 0;

        return {
          id:   card.id,
          name: card.name,
          set:  card.set,
          collection: card.collection,
          avgPrice,
          minPrice: prices.length > 0 ? Math.min(...prices) : 0,
          maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
          volume: items.length,
          listings: items.slice(0, 4).map(i => ({
            title:       i.title,
            price:       parseFloat(i.price?.value || 0),
            condition:   i.condition || 'Unknown',
            listingUrl:  i.itemWebUrl || '',
            thumbnailUrl: i.image?.imageUrl || '',
          })),
          liveAt: new Date().toISOString(),
        };
      })
    );

    const output = results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      logger.warn(`[POPULAR_CARDS] Failed for "${POPULAR_CARDS[i].name}": ${r.reason?.message}`);
      return {
        id: POPULAR_CARDS[i].id, name: POPULAR_CARDS[i].name,
        set: POPULAR_CARDS[i].set, collection: POPULAR_CARDS[i].collection,
        avgPrice: null, minPrice: null, maxPrice: null, volume: 0, listings: [],
        error: r.reason?.message || 'Failed to fetch',
      };
    });

    ebayCache.set(CACHE_KEY, output);
    logger.info(`[POPULAR_CARDS] Returning ${output.length} cards`);
    res.json(output);
  } catch (error) {
    logger.error(`[POPULAR_CARDS] Error: ${error.message}`);
    res.status(502).json({ error: 'Popular cards data unavailable. Please try again later.' });
  }
});

function parseCondition(conditionId) {
  const map = {
    'NEW':                    'New',
    'NEW_OTHER':              'New (Other)',
    'NEW_WITH_DEFECTS':       'New (With Defects)',
    'MANUFACTURER_REFURBISHED': 'Refurbished',
    'SELLER_REFURBISHED':     'Refurbished',
    'USED':                   'Used',
    'FOR_PARTS_OR_NOT_WORKING': 'For Parts or Not Working',
  };
  return map[conditionId] || conditionId || 'Unknown';
}

export default router;
