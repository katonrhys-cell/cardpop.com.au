import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient.js';

// brands, subcategories, productLines no longer exist as separate tables.
// categories is the single taxonomy table (with parent_id for hierarchy).
export function useProductSelectors(initialValues = {}) {
  const [categories, setCategories]   = useState([]);
  const [loading, setLoading]         = useState(true);

  const [selectedCategory,    setSelectedCategory]    = useState(initialValues.categoryId    || '');
  const [selectedSubcategory, setSelectedSubcategory] = useState(initialValues.subcategoryId || '');
  const [selectedBrand,       setSelectedBrand]       = useState(initialValues.brandId       || '');
  const [selectedProductLine, setSelectedProductLine] = useState(initialValues.productLineId  || '');

  useEffect(() => {
    if (initialValues.brandId)       setSelectedBrand(initialValues.brandId);
    if (initialValues.categoryId)    setSelectedCategory(initialValues.categoryId);
    if (initialValues.subcategoryId) setSelectedSubcategory(initialValues.subcategoryId);
    if (initialValues.productLineId) setSelectedProductLine(initialValues.productLineId);
  }, [initialValues.brandId, initialValues.categoryId, initialValues.subcategoryId, initialValues.productLineId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (mounted) {
        setCategories(data ?? []);
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Sub-categories are top-level categories with parent_id set
  const subcategories = useMemo(
    () => categories.filter(c => c.parent_id === selectedCategory),
    [categories, selectedCategory]
  );

  const handleSetCategory = (categoryId) => {
    setSelectedCategory(categoryId);
    setSelectedSubcategory('');
  };

  const handleSetBrand = (brandId) => {
    setSelectedBrand(brandId);
    setSelectedProductLine('');
  };

  return {
    brands:                [],          // no longer a separate table
    categories,
    subcategories,
    productLines:          [],          // no longer a separate table
    filteredSubcategories: subcategories,
    filteredProductLines:  [],
    selectedBrand,
    selectedCategory,
    selectedSubcategory,
    selectedProductLine,
    setBrand:        handleSetBrand,
    setCategory:     handleSetCategory,
    setSubcategory:  setSelectedSubcategory,
    setProductLine:  setSelectedProductLine,
    clearSubcategory:  () => setSelectedSubcategory(''),
    clearProductLine:  () => setSelectedProductLine(''),
    loading,
  };
}
