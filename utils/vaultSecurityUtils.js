
/**
 * Utility functions for Vault Security and Authorization
 */

/**
 * Determines if a user can view a specific vault product.
 * @param {string} userId - The ID of the currently authenticated user (can be null).
 * @param {string} productOwnerId - The ID of the user who owns the product.
 * @param {boolean} isPublic - Whether the product is marked as public.
 * @param {string} userRole - The role of the currently authenticated user ('user' | 'admin').
 * @returns {boolean} True if the user is authorized to view the product.
 */
export const canViewVaultProduct = (userId, productOwnerId, isPublic, userRole) => {
  // Public products are visible to everyone
  if (isPublic) return true;
  
  // Admins can view all products
  if (userRole === 'admin') return true;
  
  // Owners can view their own private products
  if (userId && userId === productOwnerId) return true;
  
  return false;
};

/**
 * Determines if a user can edit/modify a specific vault product.
 * @param {string} userId - The ID of the currently authenticated user.
 * @param {string} productOwnerId - The ID of the user who owns the product.
 * @param {string} userRole - The role of the currently authenticated user ('user' | 'admin').
 * @returns {boolean} True if the user is authorized to edit the product.
 */
export const canEditVaultProduct = (userId, productOwnerId, userRole) => {
  if (!userId) return false;
  
  // Admins have full access
  if (userRole === 'admin') return true;
  
  // Owners can edit their own products
  if (userId === productOwnerId) return true;
  
  return false;
};

/**
 * Generates a row-filter string to retrieve vault products securely.
 * @param {string} userId - The ID of the currently authenticated user.
 * @param {string} userRole - The role of the currently authenticated user ('user' | 'admin').
 * @returns {string} The filter string scoping the query to the user's own rows.
 */
export const getVaultProductsForUser = (userId, userRole) => {
  // Admins can fetch all vault products, no restrictive filter needed
  if (userRole === 'admin') return '';
  
  // Standard users can only fetch their own products in their vault view
  return `user_id="${userId}"`;
};
