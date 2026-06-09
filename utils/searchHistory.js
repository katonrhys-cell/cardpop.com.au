// Search history management utilities

const SEARCH_HISTORY_KEY = 'cardpop_search_history';
const MAX_HISTORY_ITEMS = 10;

/**
 * Get search history from localStorage
 */
export const getSearchHistory = () => {
  try {
    const history = localStorage.getItem(SEARCH_HISTORY_KEY);
    return history ? JSON.parse(history) : [];
  } catch (error) {
    console.error('Error reading search history:', error);
    return [];
  }
};

/**
 * Add a search term to history
 */
export const addToSearchHistory = (term) => {
  if (!term || term.trim().length < 2) return;

  try {
    const history = getSearchHistory();
    
    // Remove if already exists (to move to top)
    const filteredHistory = history.filter(item => item !== term);
    
    // Add new term to the beginning
    const newHistory = [term, ...filteredHistory].slice(0, MAX_HISTORY_ITEMS);
    
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
    return newHistory;
  } catch (error) {
    console.error('Error saving search history:', error);
    return getSearchHistory();
  }
};

/**
 * Clear search history
 */
export const clearSearchHistory = () => {
  try {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
    return [];
  } catch (error) {
    console.error('Error clearing search history:', error);
    return [];
  }
};

/**
 * Remove a specific item from search history
 */
export const removeFromSearchHistory = (term) => {
  try {
    const history = getSearchHistory();
    const newHistory = history.filter(item => item !== term);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
    return newHistory;
  } catch (error) {
    console.error('Error removing from search history:', error);
    return getSearchHistory();
  }
};
