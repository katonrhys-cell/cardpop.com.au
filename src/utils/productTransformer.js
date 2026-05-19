import logger from './logger.js';

/**
 * Transform a product from Online Store format to marketplace listing format
 * Maps fields: name → title, description → description, price → price,
 * images → images, category → category, stock → quantity, sku → sku
 * 
 * @param {Object} product - Product object from Online Store
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

  logger.debug(`[PRODUCT_TRANSFORMER] Transforming product: ${product.name}`);

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

  logger.debug(`[PRODUCT_TRANSFORMER] Successfully transformed: ${listing.title}`);

  return listing;
}

/**
 * Validate listing object before creating in database
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

export { transformProductToListing, validateListing };