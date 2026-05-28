import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { toast } from 'sonner';

// Simple in-memory cache to avoid redundant fetches across components
const cache = { categories: null };

export const useCategories = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const getCategories = useCallback(async (forceRefresh = false) => {
    if (cache.categories && !forceRefresh) return cache.categories;
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (err) throw err;
      cache.categories = data ?? [];
      return cache.categories;
    } catch (err) {
      setError(err.message);
      toast.error('Failed to load categories');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Returns categories filtered by group ('tcg' | 'sports')
  const getCategoriesByGroup = useCallback(async (group, forceRefresh = false) => {
    const all = await getCategories(forceRefresh);
    return all.filter(c => c.category_group === group);
  }, [getCategories]);

  // Subcategories are now represented as categories with parent_id set
  const getSubcategoriesByCategory = useCallback(async (categoryId) => {
    if (!categoryId) return [];
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('parent_id', categoryId)
      .order('sort_order');
    return data ?? [];
  }, []);

  // Admin CRUD
  const createCategory = async (data) => {
    setLoading(true);
    try {
      const { data: record, error: err } = await supabase
        .from('categories').insert(data).select().single();
      if (err) throw err;
      cache.categories = null; // invalidate cache
      toast.success('Category created');
      return record;
    } catch (err) {
      toast.error(err.message || 'Failed to create');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateCategory = async (id, data) => {
    setLoading(true);
    try {
      const { data: record, error: err } = await supabase
        .from('categories').update(data).eq('id', id).select().single();
      if (err) throw err;
      cache.categories = null;
      toast.success('Category updated');
      return record;
    } catch (err) {
      toast.error(err.message || 'Failed to update');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteCategory = async (id) => {
    setLoading(true);
    try {
      const { error: err } = await supabase.from('categories').delete().eq('id', id);
      if (err) throw err;
      cache.categories = null;
      toast.success('Category deleted');
      return true;
    } catch (err) {
      toast.error(err.message || 'Failed to delete');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Legacy compat shims used by admin pages that called createNode('categories', data)
  const createNode = (collection, data) => createCategory(data);
  const updateNode = (collection, id, data) => updateCategory(id, data);
  const deleteNode = (collection, id) => deleteCategory(id);

  // Build a flat id→name map for display (categories only now)
  const buildNameMap = useCallback(async () => {
    try {
      const cats = await getCategories();
      const map = {};
      cats.forEach(c => { map[c.id] = c.name; });
      return map;
    } catch { return {}; }
  }, [getCategories]);

  return {
    loading,
    error,
    getCategories,
    getCategoriesByGroup,
    getSubcategoriesByCategory,
    // Legacy aliases
    getBrandsBySubcategory:  async () => [],
    getSeriesByBrand:        async () => [],
    createNode,
    updateNode,
    deleteNode,
    buildNameMap,
  };
};
