
import { useState, useEffect, useMemo } from 'react';
import pb from '@/lib/pocketbaseClient.js';
import { toast } from 'sonner';

export function useProductSelectors(initialValues = {}) {
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [productLines, setProductLines] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedBrand, setSelectedBrand] = useState(initialValues.brandId || '');
  const [selectedCategory, setSelectedCategory] = useState(initialValues.categoryId || '');
  const [selectedSubcategory, setSelectedSubcategory] = useState(initialValues.subcategoryId || '');
  const [selectedProductLine, setSelectedProductLine] = useState(initialValues.productLineId || '');

  useEffect(() => {
    if (initialValues.brandId) setSelectedBrand(initialValues.brandId);
    if (initialValues.categoryId) setSelectedCategory(initialValues.categoryId);
    if (initialValues.subcategoryId) setSelectedSubcategory(initialValues.subcategoryId);
    if (initialValues.productLineId) setSelectedProductLine(initialValues.productLineId);
  }, [initialValues.brandId, initialValues.categoryId, initialValues.subcategoryId, initialValues.productLineId]);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        const [brandsRes, categoriesRes, subcategoriesRes, productLinesRes] = await Promise.all([
          pb.collection('brands').getFullList({ sort: 'name', $autoCancel: false }),
          pb.collection('categories').getFullList({ sort: 'name', $autoCancel: false }),
          pb.collection('subcategories').getFullList({ sort: 'name', $autoCancel: false }),
          pb.collection('productLines').getFullList({ sort: 'name', $autoCancel: false })
        ]);
        
        if (isMounted) {
          setBrands(brandsRes);
          setCategories(categoriesRes);
          setSubcategories(subcategoriesRes);
          setProductLines(productLinesRes);
        }
      } catch (error) {
        console.error('Failed to fetch product selectors data:', error);
        console.error('Error details:', error.data);
        if (isMounted) {
          toast.error(`Failed to load taxonomy data: ${error.message}`);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    fetchData();
    return () => { isMounted = false; };
  }, []);

  const filteredSubcategories = useMemo(() => {
    if (!selectedCategory) return [];
    return subcategories.filter(sub => sub.parentCategory === selectedCategory);
  }, [subcategories, selectedCategory]);

  const filteredProductLines = useMemo(() => {
    if (!selectedBrand) return [];
    return productLines.filter(pl => pl.brand === selectedBrand);
  }, [productLines, selectedBrand]);

  const handleSetBrand = (brandId) => {
    setSelectedBrand(brandId);
    setSelectedProductLine('');
  };

  const handleSetCategory = (categoryId) => {
    setSelectedCategory(categoryId);
    setSelectedSubcategory('');
  };

  return {
    brands,
    categories,
    subcategories,
    productLines,
    filteredSubcategories,
    filteredProductLines,
    selectedBrand,
    selectedCategory,
    selectedSubcategory,
    selectedProductLine,
    setBrand: handleSetBrand,
    setCategory: handleSetCategory,
    setSubcategory: setSelectedSubcategory,
    setProductLine: setSelectedProductLine,
    clearSubcategory: () => setSelectedSubcategory(''),
    clearProductLine: () => setSelectedProductLine(''),
    loading
  };
}
