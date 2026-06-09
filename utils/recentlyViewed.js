// Recently viewed items management utilities

const RECENTLY_VIEWED_KEY = 'cardpop_recently_viewed';
const MAX_RECENT_ITEMS = 12;

/**
 * Get recently viewed items from localStorage
 */
export const getRecentlyViewed = () => {
  try {
    const viewed = localStorage.getItem(RECENTLY_VIEWED_KEY);
    return viewed ? JSON.parse(viewed) : [];
  } catch (error) {
    console.error('Error reading recently viewed:', error);
    return [];
  }
};

/**
 * Add an item to recently viewed
 */
export const addToRecentlyViewed = (item) => {
  if (!item || !item.id) return getRecentlyViewed();

  try {
    const viewed = getRecentlyViewed();
    
    // Create a minimal item object to save space
    const itemToSave = {
      id: item.id,
      title: item.title || item.cardName || item.name,
      image: item.image || item.images?.[0]?.url || item.featured_image_url,
      price: item.price || item.askingPrice || item.estimatedValue,
      type: item.type || 'card', // card, product, listing
      url: item.url || window.location.pathname,
      viewedAt: new Date().toISOString()
    };
    
    // Remove if already exists (to move to top)
    const filteredViewed = viewed.filter(i => i.id !== item.id);
    
    // Add new item to the beginning
    const newViewed = [itemToSave, ...filteredViewed].slice(0, MAX_RECENT_ITEMS);
    
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(newViewed));
    return newViewed;
  } catch (error) {
    console.error('Error saving recently viewed:', error);
    return getRecentlyViewed();
  }
};

/**
 * Clear recently viewed items
 */
export const clearRecentlyViewed = () => {
  try {
    localStorage.removeItem(RECENTLY_VIEWED_KEY);
    return [];
  } catch (error) {
    console.error('Error clearing recently viewed:', error);
    return [];
  }
};

/**
 * Remove a specific item from recently viewed
 */
export const removeFromRecentlyViewed = (itemId) => {
  try {
    const viewed = getRecentlyViewed();
    const newViewed = viewed.filter(item => item.id !== itemId);
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(newViewed));
    return newViewed;
  } catch (error) {
    console.error('Error removing from recently viewed:', error);
    return getRecentlyViewed();
  }
};
