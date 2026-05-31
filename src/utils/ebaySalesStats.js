import 'dotenv/config';
import { getMarketData } from './ebayMarketData.js';
import * as ebayCache from './ebayCache.js';
import logger from './logger.js';

const COLLECTIONS = ['Pokemon', 'Magic', 'Yu-Gi-Oh', 'Dragonball Z', 'Digimon'];

/**
 * Get milliseconds for a given date range
 * @param {string} dateRange - Date range string (24h, 7d, 30d, 90d, 1y, all-time)
 * @returns {number} Milliseconds
 */
function getDateRangeMs(dateRange) {
  const ranges = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000,
    '1y': 365 * 24 * 60 * 60 * 1000,
    'all-time': Infinity,
  };
  return ranges[dateRange] || ranges['7d'];
}

/**
 * Filter sales by date range
 * @param {Array} cards - Array of card objects
 * @param {number} dateRangeMs - Date range in milliseconds
 * @returns {Array} Filtered cards
 */
function filterSalesByDateRange(cards, dateRangeMs) {
  if (dateRangeMs === Infinity) {
    return cards;
  }

  const cutoffDate = new Date(Date.now() - dateRangeMs);

  return cards.map(card => ({
    ...card,
    priceHistory: card.priceHistory.filter(entry => new Date(entry.date) >= cutoffDate),
  })).filter(card => card.priceHistory.length > 0);
}

/**
 * Filter sales by collection
 * @param {Array} cards - Array of card objects
 * @param {string} collection - Collection name
 * @returns {Array} Filtered cards
 */
function filterSalesByCollection(cards, collection) {
  if (!collection) {
    return cards;
  }
  return cards.filter(card => card.collection.toLowerCase() === collection.toLowerCase());
}

/**
 * Filter sales by price range
 * @param {Array} cards - Array of card objects
 * @param {number} priceMin - Minimum price
 * @param {number} priceMax - Maximum price
 * @returns {Array} Filtered cards
 */
function filterSalesByPrice(cards, priceMin, priceMax) {
  return cards.filter(card => {
    const price = card.recentPrice;
    if (priceMin !== undefined && price < priceMin) return false;
    if (priceMax !== undefined && price > priceMax) return false;
    return true;
  });
}

/**
 * Filter sales by condition
 * @param {Array} cards - Array of card objects
 * @param {string} condition - Condition name
 * @returns {Array} Filtered cards
 */
function filterSalesByCondition(cards, condition) {
  if (!condition) {
    return cards;
  }
  return cards.filter(card => card.condition.toLowerCase() === condition.toLowerCase());
}

/**
 * Build sales response with pagination
 * @param {Array} cards - Array of card objects
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Object} Sales response
 */
function buildSalesResponse(cards, page, limit) {
  const total = cards.length;
  const startIdx = (page - 1) * limit;
  const endIdx = startIdx + limit;
  const paginatedCards = cards.slice(startIdx, endIdx);

  const sales = paginatedCards.map(card => ({
    cardName: card.name,
    collectionType: card.collection,
    soldPrice: card.recentPrice,
    saleDate: card.lastSaleDate,
    condition: card.condition,
    grade: card.condition,
    sellerLocation: 'AU',
    ebayUrl: `https://www.ebay.com.au/itm/${card.id}`,
    sellerId: 'ebay-seller',
  }));

  return {
    sales,
    total,
    page,
    limit,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Get sales data with filters
 * @param {Object} filters - Filter options (dateRange, collection, priceMin, priceMax, condition, page, limit)
 * @returns {Promise<Object>} Sales data
 */
async function getSalesData(filters) {
  const cacheKey = `ebay_sales_${JSON.stringify(filters)}`;
  const cached = ebayCache.get(cacheKey);

  if (cached) {
    logger.info('[EBAY_SALES] Returning cached sales data');
    return cached;
  }

  logger.info('[EBAY_SALES] Fetching fresh sales data with filters:', filters);
  const marketData = await getMarketData();
  let cards = [...marketData.cards];

  const dateRangeMs = getDateRangeMs(filters.dateRange);
  cards = filterSalesByDateRange(cards, dateRangeMs);

  if (filters.collection) {
    cards = filterSalesByCollection(cards, filters.collection);
  }

  if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
    cards = filterSalesByPrice(cards, filters.priceMin, filters.priceMax);
  }

  if (filters.condition) {
    cards = filterSalesByCondition(cards, filters.condition);
  }

  const result = buildSalesResponse(cards, filters.page, filters.limit);
  ebayCache.set(cacheKey, result);

  logger.info(`[EBAY_SALES] Sales data prepared: ${result.sales.length} items, page ${result.page}/${Math.ceil(result.total / result.limit)}`);
  return result;
}

/**
 * Calculate market statistics
 * @param {Array} cards - Array of card objects
 * @returns {Object} Statistics
 */
function calculateStatistics(cards) {
  if (cards.length === 0) {
    return {
      totalSalesVolume: 0,
      totalSalesValue: 0,
      averagePrice: 0,
      medianPrice: 0,
      highestSale: { cardName: 'N/A', price: 0 },
      lowestSale: { cardName: 'N/A', price: 0 },
      byCollection: [],
      lastUpdated: new Date().toISOString(),
    };
  }

  const allPrices = cards.flatMap(c => c.priceHistory.map(p => p.price));
  const totalSalesVolume = allPrices.length;
  const totalSalesValue = allPrices.reduce((a, b) => a + b, 0);
  const averagePrice = totalSalesVolume > 0 ? totalSalesValue / totalSalesVolume : 0;

  const sortedPrices = [...allPrices].sort((a, b) => a - b);
  const medianPrice = sortedPrices.length % 2 === 0
    ? (sortedPrices[sortedPrices.length / 2 - 1] + sortedPrices[sortedPrices.length / 2]) / 2
    : sortedPrices[Math.floor(sortedPrices.length / 2)];

  const highestCard = cards.reduce((max, card) => {
    const cardMaxPrice = Math.max(...card.priceHistory.map(p => p.price));
    return cardMaxPrice > (max.price || 0) ? { cardName: card.name, price: cardMaxPrice } : max;
  }, { cardName: 'N/A', price: 0 });

  const lowestCard = cards.reduce((min, card) => {
    const minPrice = Math.min(...card.priceHistory.map(p => p.price));
    return minPrice < (min.price || Infinity) ? { cardName: card.name, price: minPrice } : min;
  }, { cardName: 'N/A', price: Infinity });

  const byCollection = COLLECTIONS.map(collectionName => {
    const collectionCards = cards.filter(c => c.collection === collectionName);
    const collectionPrices = collectionCards.flatMap(c => c.priceHistory.map(p => p.price));
    const salesCount = collectionPrices.length;
    const totalValue = collectionPrices.reduce((a, b) => a + b, 0);
    const avgPrice = salesCount > 0 ? totalValue / salesCount : 0;

    return {
      name: collectionName,
      salesCount,
      totalValue: parseFloat(totalValue.toFixed(2)),
      avgPrice: parseFloat(avgPrice.toFixed(2)),
      priceChange: 0,
    };
  }).filter(c => c.salesCount > 0);

  return {
    totalSalesVolume,
    totalSalesValue: parseFloat(totalSalesValue.toFixed(2)),
    averagePrice: parseFloat(averagePrice.toFixed(2)),
    medianPrice: parseFloat(medianPrice.toFixed(2)),
    highestSale: {
      cardName: highestCard.cardName,
      price: parseFloat(highestCard.price.toFixed(2)),
    },
    lowestSale: {
      cardName: lowestCard.cardName,
      price: parseFloat(lowestCard.price.toFixed(2)),
    },
    byCollection,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Get market statistics
 * @param {Object} filters - Filter options (timeframe, collection)
 * @returns {Promise<Object>} Statistics
 */
async function getStatistics(filters) {
  const cacheKey = `ebay_stats_${filters.timeframe}_${filters.collection || 'all'}`;
  const cached = ebayCache.get(cacheKey);

  if (cached) {
    logger.info('[EBAY_STATS] Returning cached statistics');
    return cached;
  }

  logger.info('[EBAY_STATS] Calculating fresh statistics with filters:', filters);
  const marketData = await getMarketData();
  let cards = [...marketData.cards];

  const dateRangeMs = getDateRangeMs(filters.timeframe);
  cards = filterSalesByDateRange(cards, dateRangeMs);

  if (filters.collection) {
    cards = filterSalesByCollection(cards, filters.collection);
  }

  const statistics = calculateStatistics(cards);
  ebayCache.set(cacheKey, statistics);

  logger.info(`[EBAY_STATS] Statistics calculated: ${statistics.totalSalesVolume} sales, avg price $${statistics.averagePrice}`);
  return statistics;
}

export { getSalesData, getStatistics, getDateRangeMs, filterSalesByDateRange, filterSalesByCollection, filterSalesByPrice, filterSalesByCondition, buildSalesResponse, calculateStatistics };
