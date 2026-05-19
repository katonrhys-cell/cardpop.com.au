import 'dotenv/config';
import express from 'express';
import pb from '../utils/pocketbaseClient.js';
import { authMiddleware } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * Check if user is admin
 * @param {Object} user - User object from auth
 * @returns {boolean} True if user is admin
 */
function isAdmin(user) {
  return user && user.role === 'admin';
}

/**
 * GET /vault/products
 * Fetch user's own vault products
 * Non-admin users see only their own products (userId = @request.auth.id)
 * Admin users see all products
 *
 * Query Parameters:
 * - page (optional): Page number (default: 1)
 * - limit (optional): Items per page (default: 20, max: 100)
 * - sort (optional): Sort field (default: 'created')
 *
 * Response:
 * {
 *   "products": [
 *     {
 *       "id": "product_id",
 *       "name": "Product Name",
 *       "description": "Product description",
 *       "price": 99.99,
 *       "userId": "user_id",
 *       "is_public": false,
 *       "created": "2026-05-08T12:00:00.000Z",
 *       "updated": "2026-05-08T12:00:00.000Z"
 *     }
 *   ],
 *   "total": 100,
 *   "page": 1,
 *   "limit": 20,
 *   "totalPages": 5
 * }
 */
router.get('/products', authMiddleware, async (req, res) => {
  const { page = '1', limit = '20', sort = 'created' } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  logger.info(`[VAULT] Fetching vault products for user ${req.user.id} - page: ${pageNum}, limit: ${limitNum}`);

  try {
    // Build filter based on user role
    let filter = '';
    if (!isAdmin(req.user)) {
      // Non-admin users see only their own products
      filter = `userId = "${req.user.id}"`;
      logger.debug(`[VAULT] Non-admin user - filtering by userId: ${req.user.id}`);
    } else {
      logger.debug(`[VAULT] Admin user - showing all products`);
    }

    // Get total count
    const allProducts = await pb.collection('vault_products').getFullList({
      filter: filter || undefined,
    });
    const total = allProducts.length;

    // Get paginated results
    const products = await pb.collection('vault_products').getList(pageNum, limitNum, {
      filter: filter || undefined,
      sort: sort === 'name' ? '+name' : sort === '-name' ? '-name' : sort === 'price' ? '+price' : sort === '-price' ? '-price' : '+created',
    });

    logger.info(`[VAULT] Retrieved ${products.items.length} vault products for user ${req.user.id}`);

    res.json({
      products: products.items.map(product => ({
        id: product.id,
        name: product.name,
        description: product.description || '',
        price: product.price || 0,
        userId: product.userId,
        is_public: product.is_public || false,
        created: product.created,
        updated: product.updated,
      })),
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    logger.error(`[VAULT] Error fetching vault products for user ${req.user.id}: ${error.message}`);
    throw error;
  }
});

/**
 * GET /vault/public
 * Fetch public vault products for marketplace display
 * Returns only products where is_public = true
 * No authentication required
 *
 * Query Parameters:
 * - page (optional): Page number (default: 1)
 * - limit (optional): Items per page (default: 20, max: 100)
 * - sort (optional): Sort field (default: 'created')
 * - userId (optional): Filter by specific user's public products
 *
 * Response:
 * {
 *   "products": [
 *     {
 *       "id": "product_id",
 *       "name": "Product Name",
 *       "description": "Product description",
 *       "price": 99.99,
 *       "userId": "user_id",
 *       "userName": "User Name",
 *       "created": "2026-05-08T12:00:00.000Z",
 *       "updated": "2026-05-08T12:00:00.000Z"
 *     }
 *   ],
 *   "total": 100,
 *   "page": 1,
 *   "limit": 20,
 *   "totalPages": 5
 * }
 */
router.get('/public', async (req, res) => {
  const { page = '1', limit = '20', sort = 'created', userId } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  logger.info(`[VAULT] Fetching public vault products - page: ${pageNum}, limit: ${limitNum}, userId: ${userId || 'all'}`);

  try {
    // Build filter for public products
    let filter = 'is_public = true';
    if (userId && userId.trim()) {
      filter += ` && userId = "${userId.trim()}"`;
      logger.debug(`[VAULT] Filtering public products by userId: ${userId}`);
    }

    // Get total count
    const allProducts = await pb.collection('vault_products').getFullList({
      filter,
    });
    const total = allProducts.length;

    // Get paginated results with user expansion
    const products = await pb.collection('vault_products').getList(pageNum, limitNum, {
      filter,
      sort: sort === 'name' ? '+name' : sort === '-name' ? '-name' : sort === 'price' ? '+price' : sort === '-price' ? '-price' : '+created',
      expand: 'userId',
    });

    logger.info(`[VAULT] Retrieved ${products.items.length} public vault products`);

    res.json({
      products: products.items.map(product => ({
        id: product.id,
        name: product.name,
        description: product.description || '',
        price: product.price || 0,
        userId: product.userId,
        userName: product.expand?.userId?.name || 'Unknown',
        created: product.created,
        updated: product.updated,
      })),
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    logger.error(`[VAULT] Error fetching public vault products: ${error.message}`);
    throw error;
  }
});

/**
 * GET /vault/:id
 * Fetch a single vault product
 * Verifies user is owner OR admin before returning
 * Throws 403 Unauthorized if user is neither owner nor admin and product is private
 *
 * Response:
 * {
 *   "id": "product_id",
 *   "name": "Product Name",
 *   "description": "Product description",
 *   "price": 99.99,
 *   "userId": "user_id",
 *   "userName": "User Name",
 *   "is_public": false,
 *   "created": "2026-05-08T12:00:00.000Z",
 *   "updated": "2026-05-08T12:00:00.000Z"
 * }
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  if (!id || !id.trim()) {
    logger.warn('[VAULT] GET /:id - Missing product ID');
    return res.status(400).json({ error: 'Product ID is required' });
  }

  const trimmedId = id.trim();
  logger.info(`[VAULT] Fetching vault product: ${trimmedId}`);

  try {
    // Fetch product with user expansion
    const product = await pb.collection('vault_products').getOne(trimmedId, {
      expand: 'userId',
    });

    if (!product) {
      logger.warn(`[VAULT] Product not found: ${trimmedId}`);
      throw new Error('Product not found');
    }

    logger.debug(`[VAULT] Product found: ${trimmedId}, is_public: ${product.is_public}, userId: ${product.userId}`);

    // Check authorization
    // Public products can be viewed by anyone
    if (product.is_public) {
      logger.info(`[VAULT] Public product accessed: ${trimmedId}`);
      return res.json({
        id: product.id,
        name: product.name,
        description: product.description || '',
        price: product.price || 0,
        userId: product.userId,
        userName: product.expand?.userId?.name || 'Unknown',
        is_public: product.is_public,
        created: product.created,
        updated: product.updated,
      });
    }

    // Private products require authentication
    if (!req.user) {
      logger.warn(`[VAULT] Unauthorized access attempt to private product ${trimmedId} - no auth`);
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Check if user is owner or admin
    const isOwner = product.userId === req.user.id;
    const isUserAdmin = isAdmin(req.user);

    if (!isOwner && !isUserAdmin) {
      logger.warn(`[VAULT] Unauthorized access attempt to private product ${trimmedId} by user ${req.user.id}`);
      return res.status(403).json({ error: 'Unauthorized' });
    }

    logger.info(`[VAULT] Private product accessed by ${isOwner ? 'owner' : 'admin'}: ${trimmedId}`);

    res.json({
      id: product.id,
      name: product.name,
      description: product.description || '',
      price: product.price || 0,
      userId: product.userId,
      userName: product.expand?.userId?.name || 'Unknown',
      is_public: product.is_public,
      created: product.created,
      updated: product.updated,
    });
  } catch (error) {
    if (error.status === 404) {
      logger.warn(`[VAULT] Product not found: ${trimmedId}`);
      return res.status(404).json({ error: 'Product not found' });
    }
    logger.error(`[VAULT] Error fetching vault product ${trimmedId}: ${error.message}`);
    throw error;
  }
});

export default router;
