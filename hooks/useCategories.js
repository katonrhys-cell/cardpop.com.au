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

  // Root (top-level) categories: Sports, TCG, Comics, Non-Sport, Collectibles
  const getRootCategories = useCallback(async () => {
    const all = await getCategories();
    return all.filter(c => c.parent_id === null);
  }, [getCategories]);

  // Franchises are categories whose parent_id = a root category id
  const getFranchisesByCategory = useCallback(async (categoryId) => {
    if (!categoryId) return [];
    const all = await getCategories();
    return all.filter(c => c.parent_id === categoryId);
  }, [getCategories]);

  // Manufacturers linked to a specific franchise
  const getManufacturersByFranchise = useCallback(async (franchiseId) => {
    if (!franchiseId) return [];
    const { data } = await supabase
      .from('manufacturers')
      .select('*')
      .eq('franchise_id', franchiseId)
      .eq('is_active', true)
      .order('sort_order');
    return data ?? [];
  }, []);

  // Sets for a franchise+manufacturer combo, grouped by series
  const getSetsByFranchiseAndManufacturer = useCallback(async (franchiseId, manufacturerId) => {
    if (!franchiseId) return [];
    let query = supabase
      .from('sets')
      .select('*')
      .eq('category_id', franchiseId)
      .eq('is_active', true)
      .order('name', { ascending: false });
    if (manufacturerId) query = query.eq('manufacturer_id', manufacturerId);
    const { data } = await query;
    return data ?? [];
  }, []);

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
    getRootCategories,
    getFranchisesByCategory,
    getManufacturersByFranchise,
    getSetsByFranchiseAndManufacturer,
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
