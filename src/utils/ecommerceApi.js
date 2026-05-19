import 'dotenv/config';
import logger from './logger.js';

const ECOMMERCE_API_URL = process.env.ECOMMERCE_API_URL || 'http://localhost:8000';
const ECOMMERCE_API_KEY = process.env.ECOMMERCE_API_KEY;

if (!ECOMMERCE_API_KEY) {
  logger.warn('[ECOMMERCE_API] ECOMMERCE_API_KEY not configured in environment');
}

/**
 * Fetch all products from the Online Store integration
 * @returns {Promise<Array>} Array of product objects
 */
async function getProducts() {
  logger.info('[ECOMMERCE_API] Fetching products from Online Store integration');

  const response = await fetch(`${ECOMMERCE_API_URL}/api/products`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ECOMMERCE_API_KEY}`,
    },
  });

  if (!response.ok) {
    logger.error(`[ECOMMERCE_API] Failed to fetch products: ${response.status} ${response.statusText}`);
    throw new Error(`Failed to fetch products from Online Store: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  logger.info(`[ECOMMERCE_API] Successfully fetched ${data.products?.length || 0} products`);

  return data.products || [];
}

/**
 * Fetch a single product by ID
 * @param {string} productId - Product ID
 * @returns {Promise<Object>} Product object
 */
async function getProductById(productId) {
  logger.debug(`[ECOMMERCE_API] Fetching product: ${productId}`);

  const response = await fetch(`${ECOMMERCE_API_URL}/api/products/${productId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ECOMMERCE_API_KEY}`,
    },
  });

  if (!response.ok) {
    logger.error(`[ECOMMERCE_API] Failed to fetch product ${productId}: ${response.status}`);
    throw new Error(`Failed to fetch product ${productId}: ${response.status}`);
  }

  return response.json();
}

export { getProducts, getProductById };