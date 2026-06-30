import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { getCategoryHierarchy } from '@/utils/categoryUtils.js';

const CategoryContext = createContext(null);

export const CategoryHierarchyProvider = ({ children }) => {
  const [hierarchy, setHierarchy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
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
        console.error("Context Error fetching categories:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchHierarchy();
  }, []);

  const value = useMemo(() => ({ hierarchy, loading, error }), [hierarchy, loading, error]);

  return (
    <CategoryContext.Provider value={value}>
      {children}
    </CategoryContext.Provider>
  );
};

export const useCategory = () => useContext(CategoryContext);