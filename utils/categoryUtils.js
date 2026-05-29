import { supabase } from '@/lib/supabaseClient.js';

export const generateSlug = (text) => {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')        // Replace spaces with -
    .replace(/[^\w-]+/g, '')     // Remove all non-word chars
    .replace(/--+/g, '-');       // Replace multiple - with single -
};

export const getCategoryHierarchy = async () => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order');
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching category hierarchy:', err);
    return null;
  }
};

export const findNodeBySlug = (tree, slug, type = 'category') => {
  if (!tree) return null;
  
  if (type === 'category') {
    return tree.find(c => generateSlug(c.name) === slug || c.id === slug);
  }
  return null;
};

export const getCategoryBySlug = (categories, categorySlug, subcategorySlug = null, productTypeSlug = null) => {
  if (!categories || !categorySlug) return null;
  
  const category = categories.find(c => generateSlug(c.name) === categorySlug || c.id === categorySlug);
  if (!category) return null;

  let result = { category };

  if (subcategorySlug && category.subcategories) {
    const subcategory = category.subcategories.find(s => generateSlug(s.name) === subcategorySlug || s.id === subcategorySlug);
    if (subcategory) {
      result.subcategory = subcategory;
      
      if (productTypeSlug && subcategory.productTypes) {
        const productType = subcategory.productTypes.find(p => generateSlug(p.name) === productTypeSlug || p.id === productTypeSlug);
        if (productType) {
          result.productType = productType;
        }
      }
    }
  }

  return result;
};

export const getBreadcrumbs = (category, subcategory = null, productType = null, basePath = '/vault') => {
  const breadcrumbs = [{ label: 'Home', path: '/' }, { label: basePath === '/vault' ? 'Vault' : 'Shop', path: basePath }];
  
  if (category) {
    const catSlug = generateSlug(category.name) || category.id;
    breadcrumbs.push({ label: category.name, path: `${basePath}/${catSlug}` });
    
    if (subcategory) {
      const subSlug = generateSlug(subcategory.name) || subcategory.id;
      breadcrumbs.push({ label: subcategory.name, path: `${basePath}/${catSlug}/${subSlug}` });
      
      if (productType) {
        const typeSlug = generateSlug(productType.name) || productType.id;
        breadcrumbs.push({ label: productType.name, path: `${basePath}/${catSlug}/${subSlug}/${typeSlug}` });
      }
    }
  }
  
  return breadcrumbs;
};

export const getFullCategoryPath = (tree, categoryId, subcategoryId = null, productTypeId = null) => {
  if (!tree) return null;
  
  const category = tree.find(c => c.id === categoryId);
  if (!category) return null;
  
  const path = { category };
  
  if (subcategoryId && category.subcategories) {
    const subcategory = category.subcategories.find(s => s.id === subcategoryId);
    if (subcategory) {
      path.subcategory = subcategory;
      
      if (productTypeId && subcategory.productTypes) {
        const productType = subcategory.productTypes.find(p => p.id === productTypeId);
        if (productType) {
          path.productType = productType;
        }
      }
    }
  }
  
  return path;
};