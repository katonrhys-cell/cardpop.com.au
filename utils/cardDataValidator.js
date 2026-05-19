/**
 * Validates card data before submission to ensure data integrity.
 */
export const validateCardData = (data, isOfficialCatalog = false) => {
  const errors = {};
  
  // Common required fields
  if (!data.cardName?.trim() && !data.name?.trim()) {
    errors.cardName = 'Card name is required';
  }
  
  if (!data.collectionType) {
    errors.collectionType = 'Collection type is required';
  }

  // Value validation
  const value = isOfficialCatalog ? data.price : data.estimatedValue;
  if (value === undefined || value === null || value === '' || isNaN(Number(value)) || Number(value) < 0) {
    errors.value = 'A valid estimated value or price is required';
  }

  // Condition validation
  if (!data.condition) {
    errors.condition = 'Condition is required';
  }

  // Specific to user cardListings
  if (!isOfficialCatalog && data.hasOwnProperty('cardNumber')) {
    if (!data.cardNumber?.trim()) {
      errors.cardNumber = 'Card number is required';
    }
    if (!data.category?.trim()) {
      errors.category = 'Category is required';
    }
    if (!data.brand?.trim()) {
      errors.brand = 'Brand is required';
    }
    if (!data.series?.trim()) {
      errors.series = 'Series is required';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};