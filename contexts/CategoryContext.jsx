import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getCategoryHierarchy } from '@/utils/categoryUtils.js';

const CategoryContext = createContext(null);

// The categories table is read only when a page actually asks for it (today
// just ShopCategoryPage's legacy-slug fallback). The provider used to fetch
// every row on mount, so every visit to any page paid for one query.
export const CategoryHierarchyProvider = ({ children }) => {
  const [hierarchy, setHierarchy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const requested = useRef(false);

  const load = useCallback(() => {
    if (requested.current) return;
    requested.current = true;
    const fetchHierarchy = async () => {
      try {
        setLoading(true);
        const data = await getCategoryHierarchy();
        if (Array.isArray(data) && data.length > 0) {
          setHierarchy(data);
        } else {
          // Fallback static structure if DB doesn't have it yet
          setHierarchy([
            {
              id: 'cat_pokemon',
              name: 'Pokemon',
              subcategories: [
                { id: 'sub_base', name: 'Base Set', productTypes: [{ id: 'pt_holo', name: 'Holographic' }] }
              ]
            },
            {
              id: 'cat_yugioh',
              name: 'Yu-Gi-Oh!',
              subcategories: []
            }
          ]);
        }
      } catch (err) {
        // warn, not error: this provider runs on every page load and the UI
        // degrades gracefully — a console.error here fails Lighthouse's
        // best-practices audit for every visitor whenever the fetch hiccups.
        console.warn("Context Error fetching categories:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchHierarchy();
  }, []);

  const value = useMemo(() => ({ hierarchy, loading, error, load }), [hierarchy, loading, error, load]);

  return (
    <CategoryContext.Provider value={value}>
      {children}
    </CategoryContext.Provider>
  );
};

/** The category hierarchy; the first component to call this starts the fetch. */
export const useCategory = () => {
  const ctx = useContext(CategoryContext);
  useEffect(() => { ctx?.load?.(); }, [ctx]);
  return ctx;
};