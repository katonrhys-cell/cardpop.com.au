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
 * GET /categories
 * Fetch all categories with pagination
 *
 * Query Parameters:
 * - page (optional): Page number (default: 1)
 * - limit (optional): Items per page (default: 20, max: 100)
 * - sort (optional): Sort field (default: 'name')
 *
 * Response:
 * {
 *   "categories": [
 *     {
 *       "id": "category_id",
 *       "name": "Category Name",
 *       "description": "Category description",
 *       "icon": "icon_url",
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
router.get('/', async (req, res) => {
  const { page = '1', limit = '20', sort = 'name' } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  logger.info(`[CATEGORIES] Fetching categories - page: ${pageNum}, limit: ${limitNum}, sort: ${sort}`);

  try {
    // Get total count
    const allCategories = await pb.collection('categories').getFullList();
    const total = allCategories.length;

    // Get paginated results
    const categories = await pb.collection('categories').getList(pageNum, limitNum, {
      sort: sort === 'name' ? '+name' : sort === '-name' ? '-name' : '+created',
    });

    logger.info(`[CATEGORIES] Retrieved ${categories.items.length} categories`);

    res.json({
      categories: categories.items.map(cat => ({
        id: cat.id,
        name: cat.name,
        description: cat.description || '',
        icon: cat.icon || '',
        created: cat.created,
        updated: cat.updated,
      })),
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    logger.error(`[CATEGORIES] Error fetching categories: ${error.message}`);
    throw error;
  }
});

/**
 * GET /categories/:id
 * Fetch single category by ID
 *
 * Response:
 * {
 *   "id": "category_id",
 *   "name": "Category Name",
 *   "description": "Category description",
 *   "icon": "icon_url",
 *   "created": "2026-05-08T12:00:00.000Z",
 *   "updated": "2026-05-08T12:00:00.000Z"
 * }
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  if (!id || !id.trim()) {
    return res.status(400).json({ error: 'Category ID is required' });
  }

  logger.info(`[CATEGORIES] Fetching category: ${id}`);

  try {
    const category = await pb.collection('categories').getOne(id);

    logger.info(`[CATEGORIES] Category found: ${id}`);

    res.json({
      id: category.id,
      name: category.name,
      description: category.description || '',
      icon: category.icon || '',
      created: category.created,
      updated: category.updated,
    });
  } catch (error) {
    if (error.status === 404) {
      logger.warn(`[CATEGORIES] Category not found: ${id}`);
      return res.status(404).json({ error: 'Category not found' });
    }
    logger.error(`[CATEGORIES] Error fetching category: ${error.message}`);
    throw error;
  }
});

/**
 * POST /categories
 * Create new category (admin only)
 *
 * Request body:
 * {
 *   "name": "Category Name",
 *   "description": "Category description",
 *   "icon": "icon_url"
 * }
 *
 * Response: Created category object
 */
router.post('/', authMiddleware, async (req, res) => {
  const { name, description, icon } = req.body;

  // Check admin permission
  if (!isAdmin(req.user)) {
    logger.warn(`[CATEGORIES] Unauthorized category creation attempt by user ${req.user.id}`);
    return res.status(403).json({ error: 'Admin access required' });
  }

  // Validate required fields
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  const trimmedName = name.trim();

  logger.info(`[CATEGORIES] Creating new category: ${trimmedName}`);

  try {
    // Check if category with same name already exists
    const existing = await pb.collection('categories').getFullList({
      filter: `name = "${trimmedName}"`,
    });

    if (existing.length > 0) {
      logger.warn(`[CATEGORIES] Category already exists: ${trimmedName}`);
      return res.status(400).json({ error: 'Category with this name already exists' });
    }

    // Create category
    const category = await pb.collection('categories').create({
      name: trimmedName,
      description: description || '',
      icon: icon || '',
    });

    logger.info(`[CATEGORIES] Category created: ${category.id}`);

    // Log to audit logs
    try {
      await pb.collection('auditLogs').create({
        userId: req.user.id,
        eventType: 'category_created',
        description: `Created category: ${trimmedName}`,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        status: 'success',
        timestamp: new Date().toISOString(),
      });
    } catch (auditError) {
      logger.warn(`[CATEGORIES] Failed to create audit log: ${auditError.message}`);
    }

    res.status(201).json({
      id: category.id,
      name: category.name,
      description: category.description || '',
      icon: category.icon || '',
      created: category.created,
      updated: category.updated,
    });
  } catch (error) {
    logger.error(`[CATEGORIES] Error creating category: ${error.message}`);
    throw error;
  }
});

/**
 * PUT /categories/:id
 * Update category (admin only)
 *
 * Request body:
 * {
 *   "name": "Updated Name",
 *   "description": "Updated description",
 *   "icon": "updated_icon_url"
 * }
 *
 * Response: Updated category object
 */
router.put('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { name, description, icon } = req.body;

  // Check admin permission
  if (!isAdmin(req.user)) {
    logger.warn(`[CATEGORIES] Unauthorized category update attempt by user ${req.user.id}`);
    return res.status(403).json({ error: 'Admin access required' });
  }

  if (!id || !id.trim()) {
    return res.status(400).json({ error: 'Category ID is required' });
  }

  logger.info(`[CATEGORIES] Updating category: ${id}`);

  try {
    // Get existing category
    const existing = await pb.collection('categories').getOne(id);

    // Prepare update data
    const updateData = {};
    if (name !== undefined && name !== null) {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return res.status(400).json({ error: 'Category name cannot be empty' });
      }
      updateData.name = trimmedName;
    }
    if (description !== undefined) {
      updateData.description = description || '';
    }
    if (icon !== undefined) {
      updateData.icon = icon || '';
    }

    // Update category
    const updated = await pb.collection('categories').update(id, updateData);

    logger.info(`[CATEGORIES] Category updated: ${id}`);

    // Log to audit logs
    try {
      await pb.collection('auditLogs').create({
        userId: req.user.id,
        eventType: 'category_updated',
        description: `Updated category: ${updated.name}`,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        status: 'success',
        timestamp: new Date().toISOString(),
      });
    } catch (auditError) {
      logger.warn(`[CATEGORIES] Failed to create audit log: ${auditError.message}`);
    }

    res.json({
      id: updated.id,
      name: updated.name,
      description: updated.description || '',
      icon: updated.icon || '',
      created: updated.created,
      updated: updated.updated,
    });
  } catch (error) {
    if (error.status === 404) {
      logger.warn(`[CATEGORIES] Category not found: ${id}`);
      return res.status(404).json({ error: 'Category not found' });
    }
    logger.error(`[CATEGORIES] Error updating category: ${error.message}`);
    throw error;
  }
});

/**
 * DELETE /categories/:id
 * Delete category (admin only)
 * Checks for dependent subcategories before deletion
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Category deleted successfully"
 * }
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  // Check admin permission
  if (!isAdmin(req.user)) {
    logger.warn(`[CATEGORIES] Unauthorized category deletion attempt by user ${req.user.id}`);
    return res.status(403).json({ error: 'Admin access required' });
  }

  if (!id || !id.trim()) {
    return res.status(400).json({ error: 'Category ID is required' });
  }

  logger.info(`[CATEGORIES] Deleting category: ${id}`);

  try {
    // Get category to delete
    const category = await pb.collection('categories').getOne(id);

    // Check for dependent subcategories
    const dependentSubcategories = await pb.collection('subcategories').getFullList({
      filter: `parentCategory = "${id}"`,
    });

    if (dependentSubcategories.length > 0) {
      logger.warn(`[CATEGORIES] Cannot delete category ${id} - has ${dependentSubcategories.length} dependent subcategories`);
      return res.status(400).json({
        error: `Cannot delete category with dependent subcategories. Please delete or reassign ${dependentSubcategories.length} subcategories first.`,
        dependentCount: dependentSubcategories.length,
      });
    }

    // Delete category
    await pb.collection('categories').delete(id);

    logger.info(`[CATEGORIES] Category deleted: ${id}`);

    // Log to audit logs
    try {
      await pb.collection('auditLogs').create({
        userId: req.user.id,
        eventType: 'category_deleted',
        description: `Deleted category: ${category.name}`,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        status: 'success',
        timestamp: new Date().toISOString(),
      });
    } catch (auditError) {
      logger.warn(`[CATEGORIES] Failed to create audit log: ${auditError.message}`);
    }

    res.json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error) {
    if (error.status === 404) {
      logger.warn(`[CATEGORIES] Category not found: ${id}`);
      return res.status(404).json({ error: 'Category not found' });
    }
    logger.error(`[CATEGORIES] Error deleting category: ${error.message}`);
    throw error;
  }
});

export default router;
