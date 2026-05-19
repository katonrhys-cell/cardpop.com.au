
import { useState, useCallback, useRef } from 'react';
import pb from '@/lib/pocketbaseClient.js';
import { toast } from 'sonner';

// Simple in-memory cache to avoid redundant fetches across components
const cache = {
  categories: null,
  subcategories: {},
  brands: {},
  series: {}
};

export const useCategories = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getCategories = useCallback(async (forceRefresh = false) => {
    if (cache.categories && !forceRefresh) return cache.categories;
    setLoading(true);
    try {
      const records = await pb.collection('categories').getFullList({ sort: 'name', $autoCancel: false });
      cache.categories = records;
      return records;
    } catch (err) {
      setError(err.message);
      toast.error('Failed to load categories');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getSubcategoriesByCategory = useCallback(async (categoryId, forceRefresh = false) => {
    if (!categoryId) return [];
    if (cache.subcategories[categoryId] && !forceRefresh) return cache.subcategories[categoryId];
    setLoading(true);
    try {
      const records = await pb.collection('subcategories').getFullList({
        filter: `parentCategory="${categoryId}"`,
        sort: 'name',
        $autoCancel: false
      });
      cache.subcategories[categoryId] = records;
      return records;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getBrandsBySubcategory = useCallback(async (subcategoryId, forceRefresh = false) => {
    if (!subcategoryId) return [];
    if (cache.brands[subcategoryId] && !forceRefresh) return cache.brands[subcategoryId];
    setLoading(true);
    try {
      const records = await pb.collection('brands').getFullList({
        filter: `parentSubcategory="${subcategoryId}"`,
        sort: 'name',
        $autoCancel: false
      });
      cache.brands[subcategoryId] = records;
      return records;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getSeriesByBrand = useCallback(async (brandId, forceRefresh = false) => {
    if (!brandId) return [];
    if (cache.series[brandId] && !forceRefresh) return cache.series[brandId];
    setLoading(true);
    try {
      const records = await pb.collection('series').getFullList({
        filter: `parentBrand="${brandId}"`,
        sort: '-releaseYear,name',
        $autoCancel: false
      });
      cache.series[brandId] = records;
      return records;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Admin CRUD operations
  const createNode = async (collection, data) => {
    setLoading(true);
    try {
      const record = await pb.collection(collection).create(data, { $autoCancel: false });
      toast.success('Successfully created');
      return record;
    } catch (err) {
      toast.error(err.message || 'Failed to create');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateNode = async (collection, id, data) => {
    setLoading(true);
    try {
      const record = await pb.collection(collection).update(id, data, { $autoCancel: false });
      toast.success('Successfully updated');
      return record;
    } catch (err) {
      toast.error(err.message || 'Failed to update');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteNode = async (collection, id) => {
    setLoading(true);
    try {
      await pb.collection(collection).delete(id, { $autoCancel: false });
      toast.success('Successfully deleted');
      return true;
    } catch (err) {
      toast.error(err.message || 'Failed to delete');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Helper to fetch all name maps for display
  const buildNameMap = useCallback(async () => {
    try {
      const [cats, subcats, brs, srs] = await Promise.all([
        pb.collection('categories').getFullList({ fields: 'id,name', $autoCancel: false }),
        pb.collection('subcategories').getFullList({ fields: 'id,name', $autoCancel: false }),
        pb.collection('brands').getFullList({ fields: 'id,name', $autoCancel: false }),
        pb.collection('series').getFullList({ fields: 'id,name', $autoCancel: false })
      ]);
      const map = {};
      cats.forEach(c => map[c.id] = c.name);
      subcats.forEach(c => map[c.id] = c.name);
      brs.forEach(c => map[c.id] = c.name);
      srs.forEach(c => map[c.id] = c.name);
      return map;
    } catch (err) {
      console.error(err);
      return {};
    }
  }, []);

  return {
    loading,
    error,
    getCategories,
    getSubcategoriesByCategory,
    getBrandsBySubcategory,
    getSeriesByBrand,
    createNode,
    updateNode,
    deleteNode,
    buildNameMap
  };
};
