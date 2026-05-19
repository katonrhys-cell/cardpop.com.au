import 'dotenv/config';
import express from 'express';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * POST /migrate/products
 * Fetches all products from Online Store integration and creates marketplace listings
 * 
 * Request body (optional):
 * {
 *   "dryRun": false,  // If true, validates but doesn't create records
 *   "limit": null     // If set, only migrate first N products
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "summary": {
 *     "totalProducts": 100,
 *     "successCount": 98,
 *     "failureCount": 2,
 *     "dryRun": false,
 *     "duration": "2.5s"
 *   },
 *   "errors": [
 *     {
 *       "productId": "prod_123",
 *       "productName": "Product Name",
 *       "error": "Error message"
 *     }
 *   ]
 * }
 */
router.post('/products', async (req, res) => {
  const startTime = Date.now();
  const { dryRun = false, limit = null } = req.body || {};

  logger.info('[MIGRATE] Starting product migration');
  logger.info(`[MIGRATE] Options: dryRun=${dryRun}, limit=${limit}`);

  // Fetch products from Online Store integration
  logger.info('[MIGRATE] Fetching products from Online Store integration');
  const products = await getProducts();

  if (!Array.isArray(products)) {
    logger.error('[MIGRATE] Products response is not an array');
    throw new Error('Invalid products response: expected array');
  }

  logger.info(`[MIGRATE] Fetched ${products.length} products from Online Store`);

  // Apply limit if specified
  const productsToMigrate = limit ? products.slice(0, limit) : products;
  logger.info(`[MIGRATE] Processing ${productsToMigrate.length} products for migration`);

  const results = {
    successCount: 0,
    failureCount: 0,
    errors: [],
  };

  // Process each product
  for (const product of productsToMigrate) {
    try {
      logger.debug(`[MIGRATE] Processing product: ${product.id} - ${product.name}`);

      // Transform product to listing format
      const listing = transformProductToListing(product);

      // Validate listing
      const validation = validateListing(listing);
      if (!validation.isValid) {
        logger.warn(`[MIGRATE] Validation failed for product ${product.id}: ${validation.errors.join(', ')}`);
        results.failureCount += 1;
        results.errors.push({
          productId: product.id,
          productName: product.name,
          error: `Validation failed: ${validation.errors.join(', ')}`,
        });
        continue;
      }

      // Create listing record in database (unless dry run)
      if (!dryRun) {
        logger.debug(`[MIGRATE] Creating listing record for product ${product.id}`);
        const createdListing = await pb.collection('listings').create(listing);
        logger.info(`[MIGRATE] Successfully created listing: ${createdListing.id}`);
      } else {
        logger.debug(`[MIGRATE] Dry run: would create listing for product ${product.id}`);
      }

      results.successCount += 1;
    } catch (error) {
      logger.error(`[MIGRATE] Error processing product ${product.id}: ${error.message}`);
      results.failureCount += 1;
      results.errors.push({
        productId: product.id,
        productName: product.name || 'Unknown',
        error: error.message,
      });
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  logger.info(`[MIGRATE] Migration completed: ${results.successCount} success, ${results.failureCount} failures in ${duration}s`);

  // Log migration to audit logs
  try {
    await pb.collection('auditLogs').create({
      eventType: 'product_migration',
      description: `Migrated ${results.successCount} products from Online Store integration (${results.failureCount} failures)`,
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      status: results.failureCount === 0 ? 'success' : 'partial',
      timestamp: new Date().toISOString(),
    });
    logger.info('[MIGRATE] Migration audit log created');
  } catch (auditError) {
    logger.warn(`[MIGRATE] Failed to create audit log: ${auditError.message}`);
  }

  res.json({
    success: true,
    summary: {
      totalProducts: productsToMigrate.length,
      successCount: results.successCount,
      failureCount: results.failureCount,
      dryRun,
      duration: `${duration}s`,
    },
    errors: results.errors.length > 0 ? results.errors : undefined,
  });
});

/**
 * POST /migrate/copy-card-sets-to-series
 * Copy card_sets collection to series collection with field mapping
 * 
 * Request body (optional):
 * {
 *   "dryRun": false,  // If true, validates but doesn't create records
 *   "limit": null     // If set, only migrate first N records
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "summary": {
 *     "totalCardSets": 50,
 *     "successCount": 48,
 *     "failureCount": 2,
 *     "dryRun": false,
 *     "duration": "1.2s"
 *   },
 *   "errors": [
 *     {
 *       "cardSetId": "set_123",
 *       "cardSetName": "Set Name",
 *       "error": "Error message"
 *     }
 *   ]
 * }
 */
router.post('/copy-card-sets-to-series', async (req, res) => {
  const startTime = Date.now();
  const { dryRun = false, limit = null } = req.body || {};

  logger.info('[MIGRATE] Starting card_sets to series migration');
  logger.info(`[MIGRATE] Options: dryRun=${dryRun}, limit=${limit}`);

  // Fetch all card_sets from PocketBase
  logger.info('[MIGRATE] Fetching card_sets from PocketBase');
  const cardSets = await pb.collection('card_sets').getFullList();

  if (!Array.isArray(cardSets)) {
    logger.error('[MIGRATE] card_sets response is not an array');
    throw new Error('Invalid card_sets response: expected array');
  }

  logger.info(`[MIGRATE] Fetched ${cardSets.length} card_sets from PocketBase`);

  // Apply limit if specified
  const cardSetsToMigrate = limit ? cardSets.slice(0, limit) : cardSets;
  logger.info(`[MIGRATE] Processing ${cardSetsToMigrate.length} card_sets for migration`);

  const results = {
    successCount: 0,
    failureCount: 0,
    errors: [],
  };

  // Process each card_set
  for (const cardSet of cardSetsToMigrate) {
    try {
      logger.debug(`[MIGRATE] Processing card_set: ${cardSet.id} - ${cardSet.name}`);

      // Validate required fields
      if (!cardSet.name || !cardSet.name.trim()) {
        throw new Error('card_set name is required');
      }

      if (!cardSet.brand_id || !cardSet.brand_id.trim()) {
        throw new Error('card_set brand_id is required');
      }

      // Verify brand exists
      logger.debug(`[MIGRATE] Verifying brand exists: ${cardSet.brand_id}`);
      let brandRecord;
      try {
        brandRecord = await pb.collection('brands').getOne(cardSet.brand_id);
      } catch (error) {
        logger.warn(`[MIGRATE] Brand not found: ${cardSet.brand_id}`);
        throw new Error(`Brand not found: ${cardSet.brand_id}`);
      }

      // Create series record
      const seriesData = {
        name: cardSet.name.trim(),
        description: cardSet.description || '',
        releaseYear: cardSet.release_year || null,
        parentBrand: cardSet.brand_id,
      };

      logger.debug(`[MIGRATE] Series data prepared: ${JSON.stringify(seriesData)}`);

      // Create series record in database (unless dry run)
      if (!dryRun) {
        logger.debug(`[MIGRATE] Creating series record for card_set ${cardSet.id}`);
        const createdSeries = await pb.collection('series').create(seriesData);
        logger.info(`[MIGRATE] Successfully created series: ${createdSeries.id}`);
      } else {
        logger.debug(`[MIGRATE] Dry run: would create series for card_set ${cardSet.id}`);
      }

      results.successCount += 1;
    } catch (error) {
      logger.error(`[MIGRATE] Error processing card_set ${cardSet.id}: ${error.message}`);
      results.failureCount += 1;
      results.errors.push({
        cardSetId: cardSet.id,
        cardSetName: cardSet.name || 'Unknown',
        error: error.message,
      });
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  logger.info(`[MIGRATE] card_sets to series migration completed: ${results.successCount} success, ${results.failureCount} failures in ${duration}s`);

  // Log migration to audit logs
  try {
    await pb.collection('auditLogs').create({
      eventType: 'card_sets_to_series_migration',
      description: `Migrated ${results.successCount} card_sets to series (${results.failureCount} failures)`,
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      status: results.failureCount === 0 ? 'success' : 'partial',
      timestamp: new Date().toISOString(),
    });
    logger.info('[MIGRATE] card_sets to series migration audit log created');
  } catch (auditError) {
    logger.warn(`[MIGRATE] Failed to create audit log: ${auditError.message}`);
  }

  res.json({
    success: true,
    summary: {
      totalCardSets: cardSetsToMigrate.length,
      successCount: results.successCount,
      failureCount: results.failureCount,
      dryRun,
      duration: `${duration}s`,
    },
    errors: results.errors.length > 0 ? results.errors : undefined,
  });
});

/**
 * POST /migrate/copy-brands-to-hierarchy
 * Copy brands collection to brands collection with hierarchy linking
 * 
 * Request body (optional):
 * {
 *   "dryRun": false,  // If true, validates but doesn't create records
 *   "limit": null     // If set, only migrate first N records
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "summary": {
 *     "totalBrands": 30,
 *     "createdCount": 28,
 *     "skippedCount": 2,
 *     "failureCount": 0,
 *     "dryRun": false,
 *     "duration": "0.8s"
 *   },
 *   "errors": []
 * }
 */
router.post('/copy-brands-to-hierarchy', async (req, res) => {
  const startTime = Date.now();
  const { dryRun = false, limit = null } = req.body || {};

  logger.info('[MIGRATE] Starting brands to hierarchy migration');
  logger.info(`[MIGRATE] Options: dryRun=${dryRun}, limit=${limit}`);

  // Fetch all brands from PocketBase
  logger.info('[MIGRATE] Fetching brands from PocketBase');
  const brands = await pb.collection('brands').getFullList();

  if (!Array.isArray(brands)) {
    logger.error('[MIGRATE] brands response is not an array');
    throw new Error('Invalid brands response: expected array');
  }

  logger.info(`[MIGRATE] Fetched ${brands.length} brands from PocketBase`);

  // Apply limit if specified
  const brandsToMigrate = limit ? brands.slice(0, limit) : brands;
  logger.info(`[MIGRATE] Processing ${brandsToMigrate.length} brands for migration`);

  const results = {
    createdCount: 0,
    skippedCount: 0,
    failureCount: 0,
    errors: [],
  };

  // Process each brand
  for (const brand of brandsToMigrate) {
    try {
      logger.debug(`[MIGRATE] Processing brand: ${brand.id} - ${brand.name}`);

      // Validate required fields
      if (!brand.name || !brand.name.trim()) {
        throw new Error('brand name is required');
      }

      // Check if brand already exists by name or ID
      logger.debug(`[MIGRATE] Checking if brand already exists: ${brand.name}`);
      const existingBrands = await pb.collection('brands').getFullList({
        filter: `name = "${brand.name.trim()}" || id = "${brand.id}"`,
      });

      if (existingBrands.length > 0) {
        logger.info(`[MIGRATE] Brand already exists, skipping: ${brand.name}`);
        results.skippedCount += 1;
        continue;
      }

      // Verify parentSubcategory exists if provided
      let parentSubcategoryId = null;
      if (brand.parentSubcategory && brand.parentSubcategory.trim()) {
        logger.debug(`[MIGRATE] Verifying subcategory exists: ${brand.parentSubcategory}`);
        try {
          await pb.collection('subcategories').getOne(brand.parentSubcategory);
          parentSubcategoryId = brand.parentSubcategory;
        } catch (error) {
          logger.warn(`[MIGRATE] Subcategory not found: ${brand.parentSubcategory}`);
          throw new Error(`Subcategory not found: ${brand.parentSubcategory}`);
        }
      }

      // Create brand record
      const brandData = {
        name: brand.name.trim(),
        description: brand.description || '',
        logo_url: brand.logo_url || '',
        website_url: brand.website_url || '',
      };

      if (parentSubcategoryId) {
        brandData.parentSubcategory = parentSubcategoryId;
      }

      logger.debug(`[MIGRATE] Brand data prepared: ${JSON.stringify(brandData)}`);

      // Create brand record in database (unless dry run)
      if (!dryRun) {
        logger.debug(`[MIGRATE] Creating brand record for brand ${brand.id}`);
        const createdBrand = await pb.collection('brands').create(brandData);
        logger.info(`[MIGRATE] Successfully created brand: ${createdBrand.id}`);
      } else {
        logger.debug(`[MIGRATE] Dry run: would create brand for brand ${brand.id}`);
      }

      results.createdCount += 1;
    } catch (error) {
      logger.error(`[MIGRATE] Error processing brand ${brand.id}: ${error.message}`);
      results.failureCount += 1;
      results.errors.push({
        brandId: brand.id,
        brandName: brand.name || 'Unknown',
        error: error.message,
      });
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  logger.info(`[MIGRATE] brands to hierarchy migration completed: ${results.createdCount} created, ${results.skippedCount} skipped, ${results.failureCount} failures in ${duration}s`);

  // Log migration to audit logs
  try {
    await pb.collection('auditLogs').create({
      eventType: 'brands_to_hierarchy_migration',
      description: `Migrated ${results.createdCount} brands to hierarchy (${results.skippedCount} skipped, ${results.failureCount} failures)`,
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      status: results.failureCount === 0 ? 'success' : 'partial',
      timestamp: new Date().toISOString(),
    });
    logger.info('[MIGRATE] brands to hierarchy migration audit log created');
  } catch (auditError) {
    logger.warn(`[MIGRATE] Failed to create audit log: ${auditError.message}`);
  }

  res.json({
    success: true,
    summary: {
      totalBrands: brandsToMigrate.length,
      createdCount: results.createdCount,
      skippedCount: results.skippedCount,
      failureCount: results.failureCount,
      dryRun,
      duration: `${duration}s`,
    },
    errors: results.errors.length > 0 ? results.errors : undefined,
  });
});

/**
 * POST /migrate/verify-hierarchy-integrity
 * Verify the integrity of the category/subcategory/brand/series hierarchy
 * 
 * Response:
 * {
 *   "success": true,
 *   "integrity": {
 *     "totalCategories": 10,
 *     "totalSubcategories": 50,
 *     "totalBrands": 100,
 *     "totalSeries": 500,
 *     "orphanedSeries": 5,
 *     "orphanedBrands": 2,
 *     "duplicates": 0,
 *     "issues": []
 *   },
 *   "hierarchy": {
 *     "categories": [
 *       {
 *         "id": "cat_1",
 *         "name": "Category Name",
 *         "subcategories": [
 *           {
 *             "id": "subcat_1",
 *             "name": "Subcategory Name",
 *             "brands": [
 *               {
 *                 "id": "brand_1",
 *                 "name": "Brand Name",
 *                 "seriesCount": 10
 *               }
 *             ]
 *           }
 *         ]
 *       }
 *     ]
 *   }
 * }
 */
router.post('/verify-hierarchy-integrity', async (req, res) => {
  const startTime = Date.now();

  logger.info('[MIGRATE] Starting hierarchy integrity verification');

  // Fetch all collections
  logger.info('[MIGRATE] Fetching all collections for integrity check');
  const categories = await pb.collection('categories').getFullList();
  const subcategories = await pb.collection('subcategories').getFullList();
  const brands = await pb.collection('brands').getFullList();
  const series = await pb.collection('series').getFullList();

  logger.info(`[MIGRATE] Fetched: ${categories.length} categories, ${subcategories.length} subcategories, ${brands.length} brands, ${series.length} series`);

  const integrity = {
    totalCategories: categories.length,
    totalSubcategories: subcategories.length,
    totalBrands: brands.length,
    totalSeries: series.length,
    orphanedSeries: 0,
    orphanedBrands: 0,
    duplicates: 0,
    issues: [],
  };

  // Check for orphaned series (series without valid parentBrand)
  logger.info('[MIGRATE] Checking for orphaned series');
  const brandIds = new Set(brands.map(b => b.id));
  for (const s of series) {
    if (!s.parentBrand || !brandIds.has(s.parentBrand)) {
      logger.warn(`[MIGRATE] Orphaned series found: ${s.id} (${s.name})`);
      integrity.orphanedSeries += 1;
      integrity.issues.push({
        type: 'orphaned_series',
        id: s.id,
        name: s.name,
        message: `Series has no valid parentBrand: ${s.parentBrand || 'null'}`,
      });
    }
  }

  // Check for orphaned brands (brands without valid parentSubcategory)
  logger.info('[MIGRATE] Checking for orphaned brands');
  const subcategoryIds = new Set(subcategories.map(sc => sc.id));
  for (const b of brands) {
    if (b.parentSubcategory && !subcategoryIds.has(b.parentSubcategory)) {
      logger.warn(`[MIGRATE] Orphaned brand found: ${b.id} (${b.name})`);
      integrity.orphanedBrands += 1;
      integrity.issues.push({
        type: 'orphaned_brand',
        id: b.id,
        name: b.name,
        message: `Brand has invalid parentSubcategory: ${b.parentSubcategory}`,
      });
    }
  }

  // Check for duplicates (same name in brands collection)
  logger.info('[MIGRATE] Checking for duplicate brands');
  const brandNames = new Map();
  for (const b of brands) {
    if (brandNames.has(b.name)) {
      logger.warn(`[MIGRATE] Duplicate brand name found: ${b.name}`);
      integrity.duplicates += 1;
      integrity.issues.push({
        type: 'duplicate_brand',
        ids: [brandNames.get(b.name), b.id],
        name: b.name,
        message: `Duplicate brand name: ${b.name}`,
      });
    } else {
      brandNames.set(b.name, b.id);
    }
  }

  // Build hierarchy tree
  logger.info('[MIGRATE] Building hierarchy tree');
  const hierarchy = {
    categories: [],
  };

  for (const category of categories) {
    const categoryNode = {
      id: category.id,
      name: category.name,
      subcategories: [],
    };

    // Find subcategories for this category
    const categorySubcategories = subcategories.filter(sc => sc.parentCategory === category.id);
    for (const subcategory of categorySubcategories) {
      const subcategoryNode = {
        id: subcategory.id,
        name: subcategory.name,
        brands: [],
      };

      // Find brands for this subcategory
      const subcategoryBrands = brands.filter(b => b.parentSubcategory === subcategory.id);
      for (const brand of subcategoryBrands) {
        const brandSeries = series.filter(s => s.parentBrand === brand.id);
        subcategoryNode.brands.push({
          id: brand.id,
          name: brand.name,
          seriesCount: brandSeries.length,
        });
      }

      categoryNode.subcategories.push(subcategoryNode);
    }

    hierarchy.categories.push(categoryNode);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  logger.info(`[MIGRATE] Hierarchy integrity verification completed in ${duration}s`);
  logger.info(`[MIGRATE] Issues found: ${integrity.issues.length}`);

  // Log verification to audit logs
  try {
    await pb.collection('auditLogs').create({
      eventType: 'hierarchy_integrity_check',
      description: `Hierarchy integrity check completed: ${integrity.issues.length} issues found`,
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      status: integrity.issues.length === 0 ? 'success' : 'warning',
      timestamp: new Date().toISOString(),
    });
    logger.info('[MIGRATE] Hierarchy integrity check audit log created');
  } catch (auditError) {
    logger.warn(`[MIGRATE] Failed to create audit log: ${auditError.message}`);
  }

  res.json({
    success: true,
    integrity,
    hierarchy,
    duration: `${duration}s`,
  });
});

/**
 * Helper function to fetch products from Online Store integration
 * @returns {Promise<Array>} Array of product objects
 */
async function getProducts() {
  const ECOMMERCE_API_URL = process.env.ECOMMERCE_API_URL || 'http://localhost:8000';
  const ECOMMERCE_API_KEY = process.env.ECOMMERCE_API_KEY;

  logger.info('[MIGRATE] Fetching products from Online Store integration');

  const response = await fetch(`${ECOMMERCE_API_URL}/api/products`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ECOMMERCE_API_KEY}`,
    },
  });

  if (!response.ok) {
    logger.error(`[MIGRATE] Failed to fetch products: ${response.status} ${response.statusText}`);
    throw new Error(`Failed to fetch products from Online Store: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  logger.info(`[MIGRATE] Successfully fetched ${data.products?.length || 0} products`);

  return data.products || [];
}

/**
 * Helper function to transform product to listing format
 * @param {Object} product - Product object
 * @returns {Object} Transformed listing object
 */
function transformProductToListing(product) {
  if (!product) {
    throw new Error('Product object is required');
  }

  if (!product.name || !product.name.trim()) {
    throw new Error('Product name is required');
  }

  if (product.price === undefined || product.price === null) {
    throw new Error('Product price is required');
  }

  logger.debug(`[MIGRATE] Transforming product: ${product.name}`);

  const listing = {
    title: product.name.trim(),
    description: product.description || '',
    price: parseFloat(product.price),
    images: Array.isArray(product.images) ? product.images : [],
    category: product.category || 'Uncategorized',
    quantity: parseInt(product.stock || product.quantity || 0, 10),
    sku: product.sku || product.id || '',
    sourceProductId: product.id,
    sourceIntegration: 'online-store',
    createdAt: new Date().toISOString(),
  };

  // Validate transformed listing
  if (!listing.title) {
    throw new Error('Listing title is required');
  }

  if (listing.price < 0) {
    throw new Error('Listing price cannot be negative');
  }

  if (listing.quantity < 0) {
    throw new Error('Listing quantity cannot be negative');
  }

  logger.debug(`[MIGRATE] Successfully transformed: ${listing.title}`);

  return listing;
}

/**
 * Helper function to validate listing object
 * @param {Object} listing - Listing object to validate
 * @returns {Object} Validation result with isValid and errors array
 */
function validateListing(listing) {
  const errors = [];

  if (!listing.title || !listing.title.trim()) {
    errors.push('Title is required');
  }

  if (listing.price === undefined || listing.price === null) {
    errors.push('Price is required');
  } else if (typeof listing.price !== 'number' || listing.price < 0) {
    errors.push('Price must be a non-negative number');
  }

  if (listing.quantity === undefined || listing.quantity === null) {
    errors.push('Quantity is required');
  } else if (typeof listing.quantity !== 'number' || listing.quantity < 0) {
    errors.push('Quantity must be a non-negative number');
  }

  if (!listing.category || !listing.category.trim()) {
    errors.push('Category is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export default router;
