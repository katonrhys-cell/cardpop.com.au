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
 * GET /subcategories
 * Fetch all subcategories with optional category filter
 *
 * Query Parameters:
 * - categoryId (optional): Filter by parent category ID
 * - page (optional): Page number (default: 1)
 * - limit (optional): Items per page (default: 20, max: 100)
 * - sort (optional): Sort field (default: 'name')
 *
 * Response:
 * {
 *   "subcategories": [
 *     {
 *       "id": "subcategory_id",
 *       "name": "Subcategory Name",
 *       "description": "Subcategory description",
 *       "parentCategory": "category_id",
 *       "parentCategoryName": "Category Name",
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
  const { categoryId, page = '1', limit = '20', sort = 'name' } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  logger.info(`[SUBCATEGORIES] Fetching subcategories - categoryId: ${categoryId || 'all'}, page: ${pageNum}, limit: ${limitNum}`);

  try {
    // Build filter
    let filter = '';
    if (categoryId && categoryId.trim()) {
      filter = `parentCategory = "${categoryId.trim()}"`;
    }

    // Get total count
    const allSubcategories = await pb.collection('subcategories').getFullList({
      filter: filter || undefined,
    });
    const total = allSubcategories.length;

    // Get paginated results
    const subcategories = await pb.collection('subcategories').getList(pageNum, limitNum, {
      filter: filter || undefined,
      sort: sort === 'name' ? '+name' : sort === '-name' ? '-name' : '+created',
      expand: 'parentCategory',
    });

    logger.info(`[SUBCATEGORIES] Retrieved ${subcategories.items.length} subcategories`);

    res.json({
      subcategories: subcategories.items.map(subcat => ({
        id: subcat.id,
        name: subcat.name,
        description: subcat.description || '',
        parentCategory: subcat.parentCategory,
        parentCategoryName: subcat.expand?.parentCategory?.name || 'Unknown',
        created: subcat.created,
        updated: subcat.updated,
      })),
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    logger.error(`[SUBCATEGORIES] Error fetching subcategories: ${error.message}`);
    throw error;
  }
});

/**
 * GET /subcategories/:id
 * Fetch single subcategory by ID
 *
 * Response:
 * {
 *   "id": "subcategory_id",
 *   "name": "Subcategory Name",
 *   "description": "Subcategory description",
 *   "parentCategory": "category_id",
 *   "parentCategoryName": "Category Name",
 *   "created": "2026-05-08T12:00:00.000Z",
 *   "updated": "2026-05-08T12:00:00.000Z"
 * }
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  if (!id || !id.trim()) {
    return res.status(400).json({ error: 'Subcategory ID is required' });
  }

  logger.info(`[SUBCATEGORIES] Fetching subcategory: ${id}`);

  try {
    const subcategory = await pb.collection('subcategories').getOne(id, {
      expand: 'parentCategory',
    });

    logger.info(`[SUBCATEGORIES] Subcategory found: ${id}`);

    res.json({
      id: subcategory.id,
      name: subcategory.name,
      description: subcategory.description || '',
      parentCategory: subcategory.parentCategory,
      parentCategoryName: subcategory.expand?.parentCategory?.name || 'Unknown',
      created: subcategory.created,
      updated: subcategory.updated,
    });
  } catch (error) {
    if (error.status === 404) {
      logger.warn(`[SUBCATEGORIES] Subcategory not found: ${id}`);
      return res.status(404).json({ error: 'Subcategory not found' });
    }
    logger.error(`[SUBCATEGORIES] Error fetching subcategory: ${error.message}`);
    throw error;
  }
});

/**
 * POST /subcategories
 * Create new subcategory (admin only)
 *
 * Request body:
 * {
 *   "name": "Subcategory Name",
 *   "description": "Subcategory description",
 *   "parentCategory": "category_id"
 * }
 *
 * Response: Created subcategory object
 */
router.post('/', authMiddleware, async (req, res) => {
  const { name, description, parentCategory } = req.body;

  // Check admin permission
  if (!isAdmin(req.user)) {
    logger.warn(`[SUBCATEGORIES] Unauthorized subcategory creation attempt by user ${req.user.id}`);
    return res.status(403).json({ error: 'Admin access required' });
  }

  // Validate required fields
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Subcategory name is required' });
  }

  if (!parentCategory || !parentCategory.trim()) {
    return res.status(400).json({ error: 'Parent category ID is required' });
  }

  const trimmedName = name.trim();
  const trimmedParentCategory = parentCategory.trim();

  logger.info(`[SUBCATEGORIES] Creating new subcategory: ${trimmedName}`);

  try {
    // Verify parent category exists
    let parentCategoryRecord;
    try {
      parentCategoryRecord = await pb.collection('categories').getOne(trimmedParentCategory);
    } catch (error) {
      logger.warn(`[SUBCATEGORIES] Parent category not found: ${trimmedParentCategory}`);
      return res.status(400).json({ error: 'Parent category not found' });
    }

    // Check if subcategory with same name already exists in this category
    const existing = await pb.collection('subcategories').getFullList({
      filter: `name = "${trimmedName}" && parentCategory = "${trimmedParentCategory}"`,
    });

    if (existing.length > 0) {
      logger.warn(`[SUBCATEGORIES] Subcategory already exists: ${trimmedName}`);
      return res.status(400).json({ error: 'Subcategory with this name already exists in this category' });
    }

    // Create subcategory
    const subcategory = await pb.collection('subcategories').create({
      name: trimmedName,
      description: description || '',
      parentCategory: trimmedParentCategory,
    });

    logger.info(`[SUBCATEGORIES] Subcategory created: ${subcategory.id}`);

    // Log to audit logs
    try {
      await pb.collection('auditLogs').create({
        userId: req.user.id,
        eventType: 'subcategory_created',
        description: `Created subcategory: ${trimmedName} under ${parentCategoryRecord.name}`,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        status: 'success',
        timestamp: new Date().toISOString(),
      });
    } catch (auditError) {
      logger.warn(`[SUBCATEGORIES] Failed to create audit log: ${auditError.message}`);
    }

    res.status(201).json({
      id: subcategory.id,
      name: subcategory.name,
      description: subcategory.description || '',
      parentCategory: subcategory.parentCategory,
      parentCategoryName: parentCategoryRecord.name,
      created: subcategory.created,
      updated: subcategory.updated,
    });
  } catch (error) {
    logger.error(`[SUBCATEGORIES] Error creating subcategory: ${error.message}`);
    throw error;
  }
});

/**
 * PUT /subcategories/:id
 * Update subcategory (admin only)
 *
 * Request body:
 * {
 *   "name": "Updated Name",
 *   "description": "Updated description",
 *   "parentCategory": "category_id"
 * }
 *
 * Response: Updated subcategory object
 */
router.put('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { name, description, parentCategory } = req.body;

  // Check admin permission
  if (!isAdmin(req.user)) {
    logger.warn(`[SUBCATEGORIES] Unauthorized subcategory update attempt by user ${req.user.id}`);
    return res.status(403).json({ error: 'Admin access required' });
  }

  if (!id || !id.trim()) {
    return res.status(400).json({ error: 'Subcategory ID is required' });
  }

  logger.info(`[SUBCATEGORIES] Updating subcategory: ${id}`);

  try {
    // Get existing subcategory
    const existing = await pb.collection('subcategories').getOne(id);

    // Prepare update data
    const updateData = {};
    if (name !== undefined && name !== null) {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return res.status(400).json({ error: 'Subcategory name cannot be empty' });
      }
      updateData.name = trimmedName;
    }
    if (description !== undefined) {
      updateData.description = description || '';
    }
    if (parentCategory !== undefined && parentCategory !== null) {
      const trimmedParentCategory = parentCategory.trim();
      if (!trimmedParentCategory) {
        return res.status(400).json({ error: 'Parent category cannot be empty' });
      }

      // Verify parent category exists
      try {
        await pb.collection('categories').getOne(trimmedParentCategory);
      } catch (error) {
        logger.warn(`[SUBCATEGORIES] Parent category not found: ${trimmedParentCategory}`);
        return res.status(400).json({ error: 'Parent category not found' });
      }

      updateData.parentCategory = trimmedParentCategory;
    }

    // Update subcategory
    const updated = await pb.collection('subcategories').update(id, updateData);

    logger.info(`[SUBCATEGORIES] Subcategory updated: ${id}`);

    // Get parent category name
    let parentCategoryName = 'Unknown';
    try {
      const parentCat = await pb.collection('categories').getOne(updated.parentCategory);
      parentCategoryName = parentCat.name;
    } catch (error) {
      logger.warn(`[SUBCATEGORIES] Could not fetch parent category name: ${updated.parentCategory}`);
    }

    // Log to audit logs
    try {
      await pb.collection('auditLogs').create({
        userId: req.user.id,
        eventType: 'subcategory_updated',
        description: `Updated subcategory: ${updated.name}`,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        status: 'success',
        timestamp: new Date().toISOString(),
      });
    } catch (auditError) {
      logger.warn(`[SUBCATEGORIES] Failed to create audit log: ${auditError.message}`);
    }

    res.json({
      id: updated.id,
      name: updated.name,
      description: updated.description || '',
      parentCategory: updated.parentCategory,
      parentCategoryName,
      created: updated.created,
      updated: updated.updated,
    });
  } catch (error) {
    if (error.status === 404) {
      logger.warn(`[SUBCATEGORIES] Subcategory not found: ${id}`);
      return res.status(404).json({ error: 'Subcategory not found' });
    }
    logger.error(`[SUBCATEGORIES] Error updating subcategory: ${error.message}`);
    throw error;
  }
});

/**
 * DELETE /subcategories/:id
 * Delete subcategory (admin only)
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Subcategory deleted successfully"
 * }
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  // Check admin permission
  if (!isAdmin(req.user)) {
    logger.warn(`[SUBCATEGORIES] Unauthorized subcategory deletion attempt by user ${req.user.id}`);
    return res.status(403).json({ error: 'Admin access required' });
  }

  if (!id || !id.trim()) {
    return res.status(400).json({ error: 'Subcategory ID is required' });
  }

  logger.info(`[SUBCATEGORIES] Deleting subcategory: ${id}`);

  try {
    // Get subcategory to delete
    const subcategory = await pb.collection('subcategories').getOne(id);

    // Delete subcategory
    await pb.collection('subcategories').delete(id);

    logger.info(`[SUBCATEGORIES] Subcategory deleted: ${id}`);

    // Log to audit logs
    try {
      await pb.collection('auditLogs').create({
        userId: req.user.id,
        eventType: 'subcategory_deleted',
        description: `Deleted subcategory: ${subcategory.name}`,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        status: 'success',
        timestamp: new Date().toISOString(),
      });
    } catch (auditError) {
      logger.warn(`[SUBCATEGORIES] Failed to create audit log: ${auditError.message}`);
    }

    res.json({
      success: true,
      message: 'Subcategory deleted successfully',
    });
  } catch (error) {
    if (error.status === 404) {
      logger.warn(`[SUBCATEGORIES] Subcategory not found: ${id}`);
      return res.status(404).json({ error: 'Subcategory not found' });
    }
    logger.error(`[SUBCATEGORIES] Error deleting subcategory: ${error.message}`);
    throw error;
  }
});

export default router;
