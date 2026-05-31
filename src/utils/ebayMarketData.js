import 'dotenv/config';
import { callEbayApi } from './ebayClient.js';
import * as ebayCache from './ebayCache.js';
import logger from './logger.js';

const TRADING_CARD_CATEGORIES = {
  'Pokemon': '38083',
  'Magic': '38084',
  'Yu-Gi-Oh': '38085',
  'Dragonball Z': '38086',
  'Digimon': '38087',
};

const COLLECTIONS = Object.keys(TRADING_CARD_CATEGORIES);

/**
 * Fetch completed sales with retry logic
 * @param {string} query - Search query
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Promise<Array>} Array of item summaries
 */
async function fetchCompletedSalesWithRetry(query, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`[EBAY_MARKET] Fetching sales data for query: "${query}" (attempt ${attempt}/${maxRetries})`);
      
      const endpoint = '/buy/browse/v1/item_summary/search';
      const params = new URLSearchParams({
        q: query,
        filter: 'buyingOptions:{AUCTION},conditionIds:{3000|3010|3020|3030|4000},itemLocationCountry:AU',
        limit: 200,
        sort: 'newlyListed',
      });

      const data = await callEbayApi(`${endpoint}?${params}`);
      logger.info(`[EBAY_MARKET] Successfully fetched ${data.itemSummaries?.length || 0} items for query: "${query}"`);
      return data.itemSummaries || [];
    } catch (error) {
      lastError = error;
      const delay = Math.pow(2, attempt - 1) * 1000;
      logger.warn(`[EBAY_MARKET] Attempt ${attempt}/${maxRetries} failed: ${error.message}. Retrying in ${delay}ms...`);
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  logger.error(`[EBAY_MARKET] Failed to fetch sales data after ${maxRetries} attempts`);
  throw lastError || new Error('Failed to fetch eBay data after retries');
}

/**
 * Parse condition ID to human-readable condition string
 * @param {string} conditionId - eBay condition ID
 * @returns {string} Condition name
 */
function parseCondition(conditionId) {
  const conditions = {
    '3000': 'New',
    '3010': 'Like New',
    '3020': 'Good',
    '3030': 'Fair',
    '4000': 'Used',
  };
  return conditions[conditionId] || 'Unknown';
}

/**
 * Extract card information from eBay item
 * @param {Object} item - eBay item object
 * @returns {Object} Extracted card info
 */
function extractCardInfo(item) {
  const title = item.title || '';
  const price = item.price?.value ? parseFloat(item.price.value) : 0;
  const soldDate = item.itemWebUrl ? new Date(item.itemWebUrl).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
  const condition = parseCondition(item.condition || '3000');
  
  return {
    id: item.itemId,
    name: title,
    price,
    soldDate,
    condition,
    quantity: 1,
  };
}

/**
 * Aggregate card data from multiple items
 * @param {Array} allItems - Array of eBay items
 * @returns {Array} Aggregated card data
 */
function aggregateCardData(allItems) {
  const cardMap = new Map();

  allItems.forEach(item => {
    const cardInfo = extractCardInfo(item);
    const key = `${cardInfo.name}-${cardInfo.condition}`;

    if (!cardMap.has(key)) {
      cardMap.set(key, {
        id: cardInfo.id,
        name: cardInfo.name,
        condition: cardInfo.condition,
        prices: [],
        dates: [],
        totalQuantity: 0,
      });
    }

    const card = cardMap.get(key);
    card.prices.push(cardInfo.price);
    card.dates.push(cardInfo.soldDate);
    card.totalQuantity += cardInfo.quantity;
  });

  const cards = Array.from(cardMap.values()).map(card => {
    const avgPrice = card.prices.length > 0 
      ? (card.prices.reduce((a, b) => a + b, 0) / card.prices.length).toFixed(2)
      : 0;
    
    const priceHistory = card.prices.map((price, idx) => ({
      date: card.dates[idx],
      price: parseFloat(price.toFixed(2)),
    })).sort((a, b) => new Date(a.date) - new Date(b.date));

    return {
      id: card.id,
      name: card.name,
      collection: COLLECTIONS.find(c => card.name.toLowerCase().includes(c.toLowerCase())) || 'Unknown',
      condition: card.condition,
      recentPrice: card.prices.length > 0 ? parseFloat(card.prices[card.prices.length - 1].toFixed(2)) : 0,
      avgPrice: parseFloat(avgPrice),
      salesCount: card.prices.length,
      lastSaleDate: card.dates[card.dates.length - 1] || new Date().toISOString().split('T')[0],
      priceHistory,
    };
  });

  return cards;
}

/**
 * Calculate market statistics from cards
 * @param {Array} cards - Array of card objects
 * @returns {Object} Market statistics
 */
function calculateStats(cards) {
  const allPrices = cards.flatMap(c => c.priceHistory.map(p => p.price));
  
  if (allPrices.length === 0) {
    return {
      avgPrice: 0,
      highestSale: 0,
      lowestSale: 0,
      totalVolume: 0,
      priceChangePercent: 0,
    };
  }

  const avgPrice = (allPrices.reduce((a, b) => a + b, 0) / allPrices.length).toFixed(2);
  const highestSale = Math.max(...allPrices).toFixed(2);
  const lowestSale = Math.min(...allPrices).toFixed(2);
  const totalVolume = allPrices.length;
  
  const oldestPrice = allPrices[0];
  const newestPrice = allPrices[allPrices.length - 1];
  const priceChangePercent = oldestPrice > 0 
    ? (((newestPrice - oldestPrice) / oldestPrice) * 100).toFixed(2)
    : 0;

  return {
    avgPrice: parseFloat(avgPrice),
    highestSale: parseFloat(highestSale),
    lowestSale: parseFloat(lowestSale),
    totalVolume,
    priceChangePercent: parseFloat(priceChangePercent),
  };
}

/**
 * Get market data for all trading card collections
 * @returns {Promise<Object>} Market data with cards and statistics
 */
async function getMarketData() {
  const cacheKey = 'ebay_market_data';
  const cached = ebayCache.get(cacheKey);
  
  if (cached) {
    logger.info('[EBAY_MARKET] Returning cached market data');
    return cached;
  }

  logger.info('[EBAY_MARKET] Fetching fresh market data for all collections');
  const allItems = [];

  for (const collection of COLLECTIONS) {
    try {
      logger.info(`[EBAY_MARKET] Fetching data for ${collection}...`);
      const items = await fetchCompletedSalesWithRetry(`${collection} trading card`);
      allItems.push(...items);
      logger.info(`[EBAY_MARKET] Successfully fetched ${items.length} items for ${collection}`);
    } catch (error) {
      logger.warn(`[EBAY_MARKET] Failed to fetch ${collection} data: ${error.message}`);
    }
  }

  logger.info(`[EBAY_MARKET] Total items fetched: ${allItems.length}`);
  const cards = aggregateCardData(allItems);
  const stats = calculateStats(cards);

  const result = { cards, stats };
  ebayCache.set(cacheKey, result);
  
  logger.info(`[EBAY_MARKET] Market data cached: ${cards.length} unique cards`);
  return result;
}

/**
 * Get details for a specific card
 * @param {string} cardId - eBay item ID
 * @returns {Promise<Object>} Card details with price history
 */
async function getCardDetails(cardId) {
  const cacheKey = `ebay_card_${cardId}`;
  const cached = ebayCache.get(cacheKey);
  
  if (cached) {
    logger.info(`[EBAY_MARKET] Returning cached card details for ${cardId}`);
    return cached;
  }

  try {
    logger.info(`[EBAY_MARKET] Fetching card details for ${cardId}`);
    const endpoint = `/buy/browse/v1/item/${cardId}`;
    const itemData = await callEbayApi(endpoint);

    const card = {
      id: itemData.itemId,
      name: itemData.title,
      collection: COLLECTIONS.find(c => itemData.title.toLowerCase().includes(c.toLowerCase())) || 'Unknown',
    };

    const priceHistory = [
      {
        date: new Date().toISOString().split('T')[0],
        price: parseFloat(itemData.price?.value || 0),
      },
    ];

    const salesData = [
      {
        soldPrice: parseFloat(itemData.price?.value || 0),
        saleDate: new Date().toISOString().split('T')[0],
        condition: parseCondition(itemData.condition || '3000'),
        quantity: 1,
      },
    ];

    const gradingBreakdown = {
      [parseCondition(itemData.condition || '3000')]: 1,
    };

    const result = {
      card,
      priceHistory,
      salesData,
      gradingBreakdown,
      insights: {
        trend: 'stable',
        comparableSales: 1,
      },
    };

    ebayCache.set(cacheKey, result);
    logger.info(`[EBAY_MARKET] Card details cached for ${cardId}`);
    return result;
  } catch (error) {
    logger.error(`[EBAY_MARKET] Failed to fetch card details for ${cardId}: ${error.message}`);
    throw new Error(`Failed to fetch card details for ${cardId}: ${error.message}`);
  }
}

export { getMarketData, getCardDetails, parseCondition, extractCardInfo, aggregateCardData, calculateStats };
