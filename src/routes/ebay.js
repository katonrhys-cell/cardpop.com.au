import 'dotenv/config';
import express from 'express';
import { callEbayApi } from '../utils/ebayClient.js';
import { getMarketData, getCardDetails } from '../utils/ebayMarketData.js';
import { getSalesData, getStatistics } from '../utils/ebaySalesStats.js';
import * as ebayCache from '../utils/ebayCache.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /ebay/search
 * Search for eBay listings matching a card name
 * 
 * Query Parameters:
 * - cardName (required): Card name to search for (e.g., "Pokemon Charizard")
 * - limit (optional): Number of results (default: 20, max: 200)
 * 
 * Response: Returns JSON array directly (NOT wrapped in object)
 * [
 *   {
 *     "itemId": "item_id",
 *     "title": "Product Title",
 *     "price": 99.99,
 *     "condition": "New",
 *     "sellerUsername": "seller_name",
 *     "sellerRating": 98.5,
 *     "feedbackCount": 1234,
 *     "listingUrl": "https://ebay.com/itm/...",
 *     "thumbnailUrl": "https://..."
 *   },
 *   ...
 * ]
 */
router.get('/search', async (req, res) => {
  const { cardName, limit = '20' } = req.query;

  // Validate cardName parameter
  if (!cardName || !cardName.trim()) {
    return res.status(400).json({ error: 'cardName query parameter is required' });
  }

  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 20));
  const trimmedCardName = cardName.trim();

  logger.info(`[EBAY_SEARCH] Searching for: "${trimmedCardName}", limit: ${limitNum}`);

  // Build search query
  const searchQuery = trimmedCardName;

  logger.debug(`[EBAY_SEARCH] Search query: "${searchQuery}"`);

  // Build filter string
  const filters = [];
  filters.push('buyingOptions:{AUCTION|FIXED_PRICE}');
  filters.push('itemLocationCountry:AU');

  // Build API request
  const params = new URLSearchParams({
    q: searchQuery,
    filter: filters.join(','),
    limit: limitNum,
    sort: 'newlyListed',
  });

  logger.debug(`[EBAY_SEARCH] Calling eBay API with params: ${params.toString()}`);

  // Call eBay API
  const endpoint = '/buy/browse/v1/item_summary/search';
  const data = await callEbayApi(`${endpoint}?${params}`);

  logger.info(`[EBAY_SEARCH] eBay API returned ${data.itemSummaries?.length || 0} items`);

  // Transform response to array format
  const listings = (data.itemSummaries || []).map(item => ({
    itemId: item.itemId,
    title: item.title,
    price: item.price?.value ? parseFloat(item.price.value) : 0,
    condition: parseCondition(item.condition),
    sellerUsername: item.seller?.username || 'Unknown',
    sellerRating: item.seller?.feedbackPercentage || 0,
    feedbackCount: item.seller?.feedbackScore || 0,
    listingUrl: item.itemWebUrl || '',
    thumbnailUrl: item.image?.imageUrl || '',
  }));

  logger.info(`[EBAY_SEARCH] Transformed ${listings.length} listings`);

  // Return array directly (NOT wrapped in object)
  res.json(listings);
});

/**
 * GET /ebay/listings
 * Fetch live eBay product listings
 * 
 * Query Parameters:
 * - keywords (optional): Search keywords (e.g., "Pokemon card")
 * - category (optional): eBay category ID or name
 * - condition (optional): Item condition (New, Like New, Good, Fair, Used)
 * - sort (optional): Sort order (newlyListed, endingSoonest, priceLowToHigh, priceHighToLow)
 * - limit (optional): Number of results (default: 50, max: 200)
 * - offset (optional): Pagination offset (default: 0)
 * 
 * Response:
 * {
 *   "success": true,
 *   "listings": [
 *     {
 *       "itemId": "item_id",
 *       "title": "Product Title",
 *       "price": 99.99,
 *       "condition": "New",
 *       "imageUrl": "https://...",
 *       "sellerName": "seller_name",
 *       "sellerRating": 98.5,
 *       "listingUrl": "https://ebay.com/itm/...",
 *       "category": "Trading Cards",
 *       "shippingPrice": 5.00,
 *       "itemLocation": "AU"
 *     }
 *   ],
 *   "total": 1000,
 *   "limit": 50,
 *   "offset": 0,
 *   "lastUpdated": "2026-05-08T12:00:00.000Z"
 * }
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

  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  const offsetNum = Math.max(0, parseInt(offset, 10) || 0);

  logger.info(`[EBAY_LISTINGS] Fetching listings - keywords: "${keywords}", category: "${category}", limit: ${limitNum}, offset: ${offsetNum}`);

  // Build search query
  let searchQuery = keywords || 'trading card';
  if (category) {
    searchQuery = `${searchQuery} ${category}`;
  }

  logger.debug(`[EBAY_LISTINGS] Search query: "${searchQuery}"`);

  // Build filter string
  const filters = [];
  filters.push('buyingOptions:{AUCTION|FIXED_PRICE}');
  filters.push('itemLocationCountry:AU');

  if (condition) {
    const conditionMap = {
      'new': '3000',
      'like new': '3010',
      'good': '3020',
      'fair': '3030',
      'used': '4000',
    };
    const conditionId = conditionMap[condition.toLowerCase()];
    if (conditionId) {
      filters.push(`conditionIds:{${conditionId}}`);
      logger.debug(`[EBAY_LISTINGS] Filtering by condition: ${condition} (${conditionId})`);
    }
  }

  // Build API request
  const params = new URLSearchParams({
    q: searchQuery,
    filter: filters.join(','),
    limit: limitNum,
    offset: offsetNum,
    sort: sort,
  });

  logger.debug(`[EBAY_LISTINGS] Calling eBay API with params: ${params.toString()}`);

  // Call eBay API
  const endpoint = '/buy/browse/v1/item_summary/search';
  const data = await callEbayApi(`${endpoint}?${params}`);

  logger.info(`[EBAY_LISTINGS] eBay API returned ${data.itemSummaries?.length || 0} items`);

  // Transform response
  const listings = (data.itemSummaries || []).map(item => ({
    itemId: item.itemId,
    title: item.title,
    price: item.price?.value ? parseFloat(item.price.value) : 0,
    condition: parseCondition(item.condition),
    imageUrl: item.image?.imageUrl || '',
    sellerName: item.seller?.username || 'Unknown',
    sellerRating: item.seller?.feedbackPercentage || 0,
    listingUrl: item.itemWebUrl || '',
    category: item.categories?.[0] || 'Uncategorized',
    shippingPrice: item.shippingOptions?.[0]?.shippingCost?.value ? parseFloat(item.shippingOptions[0].shippingCost.value) : 0,
    itemLocation: item.itemLocation?.country || 'Unknown',
  }));

  logger.info(`[EBAY_LISTINGS] Transformed ${listings.length} listings`);

  res.json({
    success: true,
    listings,
    total: data.total || 0,
    limit: limitNum,
    offset: offsetNum,
    lastUpdated: new Date().toISOString(),
  });
});

/**
 * GET /ebay/market-data
 * Get aggregated market data for trading cards
 */
router.get('/market-data', async (req, res) => {
  logger.info('[EBAY_MARKET_DATA] Fetching market data');
  const data = await getMarketData();
  logger.info(`[EBAY_MARKET_DATA] Market data retrieved: ${data.cards.length} cards`);
  res.json(data);
});

/**
 * GET /ebay/card-details/:cardId
 * Get details for a specific card
 */
router.get('/card-details/:cardId', async (req, res) => {
  const { cardId } = req.params;
  
  if (!cardId || cardId.trim() === '') {
    return res.status(400).json({ error: 'cardId parameter is required' });
  }

  logger.info(`[EBAY_CARD_DETAILS] Fetching card details for cardId: ${cardId}`);
  const data = await getCardDetails(cardId);
  logger.info(`[EBAY_CARD_DETAILS] Card details retrieved for ${cardId}`);
  res.json(data);
});

/**
 * GET /ebay/sales
 * Get sales data with filters
 */
router.get('/sales', async (req, res) => {
  const {
    collection,
    dateRange = '7d',
    priceMin,
    priceMax,
    condition,
    page = '1',
    limit = '50',
  } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));

  logger.info(`[EBAY_SALES] Fetching sales data - collection: ${collection}, dateRange: ${dateRange}, page: ${pageNum}, limit: ${limitNum}`);

  const salesData = await getSalesData({
    collection,
    dateRange,
    priceMin: priceMin ? parseFloat(priceMin) : undefined,
    priceMax: priceMax ? parseFloat(priceMax) : undefined,
    condition,
    page: pageNum,
    limit: limitNum,
  });

  logger.info(`[EBAY_SALES] Sales data retrieved: ${salesData.sales.length} items`);
  res.json(salesData);
});

/**
 * GET /ebay/statistics
 * Get market statistics
 */
router.get('/statistics', async (req, res) => {
  const { timeframe = '7d', collection } = req.query;

  logger.info(`[EBAY_STATISTICS] Fetching statistics - timeframe: ${timeframe}, collection: ${collection}`);

  const statistics = await getStatistics({
    timeframe,
    collection,
  });

  logger.info(`[EBAY_STATISTICS] Statistics retrieved: ${statistics.totalSalesVolume} sales`);
  res.json(statistics);
});

/**
 * GET /ebay/price-estimate
 * Estimate the market value of a card from current eBay AU listings.
 *
 * Query Parameters:
 * - name (required): Card name
 * - set (optional): Set or expansion name
 * - gradingService (optional): PSA | BGS | CGC | None
 * - gradeScore (optional): Numeric grade (e.g. 9.5)
 *
 * Response:
 * {
 *   "suggested": 45.00,
 *   "median": 45.00,
 *   "average": 47.50,
 *   "low": 30.00,
 *   "high": 65.00,
 *   "count": 12,
 *   "currency": "AUD",
 *   "searchQuery": "Charizard Base Set PSA 9",
 *   "sampleListings": [{ "title", "price", "url" }]
 * }
 */
router.get('/price-estimate', async (req, res) => {
  const { name, set, gradingService, gradeScore } = req.query;

  if (!name?.trim()) {
    return res.status(400).json({ error: 'name query parameter is required' });
  }

  const isGraded = gradingService && gradingService !== 'None';

  // Build a targeted search query
  const parts = [name.trim()];
  if (set?.trim() && !isGraded) parts.push(set.trim());
  if (isGraded) {
    parts.push(gradingService.trim());
    if (gradeScore) parts.push(gradeScore.trim());
  }
  const searchQuery = parts.join(' ');

  const cacheKey = `price-estimate:${searchQuery.toLowerCase()}`;
  const cached = ebayCache.get(cacheKey);
  if (cached) {
    logger.debug(`[EBAY_PRICE_ESTIMATE] Cache hit for: "${searchQuery}"`);
    return res.json(cached);
  }

  logger.info(`[EBAY_PRICE_ESTIMATE] Querying eBay AU for: "${searchQuery}"`);

  const params = new URLSearchParams({
    q: searchQuery,
    filter: 'buyingOptions:{AUCTION|FIXED_PRICE},itemLocationCountry:AU',
    limit: '50',
    sort: 'newlyListed',
  });

  const data = await callEbayApi(`/buy/browse/v1/item_summary/search?${params}`);

  const prices = (data.itemSummaries || [])
    .map(item => parseFloat(item.price?.value || 0))
    .filter(p => p > 0)
    .sort((a, b) => a - b);

  if (!prices.length) {
    const empty = { suggested: null, median: null, average: null, low: null, high: null, count: 0, currency: 'AUD', searchQuery, sampleListings: [] };
    ebayCache.set(cacheKey, empty);
    return res.json(empty);
  }

  // Trim top and bottom 10% outliers when we have enough data
  let trimmed = prices;
  if (prices.length >= 10) {
    const cut = Math.floor(prices.length * 0.1);
    trimmed = prices.slice(cut, prices.length - cut);
  }

  const round = v => Math.round(v * 100) / 100;
  const median = round(trimmed[Math.floor(trimmed.length / 2)]);
  const average = round(trimmed.reduce((s, p) => s + p, 0) / trimmed.length);
  const low = round(trimmed[0]);
  const high = round(trimmed[trimmed.length - 1]);

  const sampleListings = (data.itemSummaries || []).slice(0, 5).map(item => ({
    title: item.title,
    price: parseFloat(item.price?.value || 0),
    url: item.itemWebUrl || '',
  }));

  const result = {
    suggested: median,
    median,
    average,
    low,
    high,
    count: prices.length,
    currency: 'AUD',
    searchQuery,
    sampleListings,
  };

  ebayCache.set(cacheKey, result);
  logger.info(`[EBAY_PRICE_ESTIMATE] Estimated $${median} AUD (${prices.length} listings) for: "${searchQuery}"`);
  res.json(result);
});

/**
 * Parse condition ID to human-readable condition string
 * @param {string} conditionId - eBay condition ID
 * @returns {string} Condition name
 */
function parseCondition(conditionId) {
  const conditions = {
    'NEW': 'New',
    'NEW_OTHER': 'New (Other)',
    'NEW_WITH_DEFECTS': 'New (With Defects)',
    'MANUFACTURER_REFURBISHED': 'Refurbished',
    'SELLER_REFURBISHED': 'Refurbished',
    'USED': 'Used',
    'FOR_PARTS_OR_NOT_WORKING': 'For Parts or Not Working',
  };
  return conditions[conditionId] || 'Unknown';
}

export default router;