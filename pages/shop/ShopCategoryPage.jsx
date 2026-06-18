import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient.js';
import { useCategory } from '@/contexts/CategoryContext.jsx';
import { getCategoryBySlug, getBreadcrumbs } from '@/utils/categoryUtils.js';
import { generateMetaTitle, generateMetaDescription } from '@/utils/seoUtils.js';
import SEOHead from '@/components/SEOHead.jsx';
import Breadcrumb from '@/components/Breadcrumb.jsx';
import CategoryFilter from '@/components/CategoryFilter.jsx';
import ProductGrid from '@/components/ProductGrid.jsx';
import PaginationControls from '@/components/PaginationControls.jsx';

const ShopCategoryPage = () => {
  const { categorySlug, subcategorySlug, productTypeSlug } = useParams();
  const { hierarchy, loading: contextLoading } = useCategory();
  
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const pathInfo = getCategoryBySlug(hierarchy, categorySlug, subcategorySlug, productTypeSlug);
  const { category, subcategory, productType } = pathInfo || {};

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const perPage = 16;
        const from = (page - 1) * perPage;

        let query = supabase
          .from('shop_products')
          .select('*', { count: 'exact' })
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .range(from, from + perPage - 1);

        // shop_products stores a free-text category; match the resolved
        // subcategory/category name against it.
        const categoryName = subcategory?.name || category?.name;
        if (categoryName) query = query.ilike('category', `%${categoryName}%`);

        const { data, count, error } = await query;
        if (error) throw error;

        setProducts((data || []).map(p => ({ ...p, source: 'shop', type: 'shop' })));
        setTotalItems(count || 0);
        setTotalPages(Math.ceil((count || 0) / perPage));
      } catch (error) {
        console.error("Error fetching shop products:", error);
      } finally {
        setLoading(false);
      }
    };

    if (!contextLoading) {
      fetchProducts();
    }
  }, [category, subcategory, productType, page, contextLoading]);

  const breadcrumbs = getBreadcrumbs(category, subcategory, productType, '/shop');
  const metaTitle = generateMetaTitle(category, subcategory, productType) + " - Official Store";
  const metaDesc = generateMetaDescription(category, totalItems);

  return (
    <div className="container-default section-padding">
      <SEOHead 
        title={metaTitle} 
        description={metaDesc} 
        canonicalUrl={typeof window !== 'undefined' ? window.location.href : ''} 
      />
      
      <Breadcrumb items={breadcrumbs} />
      
      <div className="flex flex-col md:flex-row gap-8">
        <CategoryFilter 
          hierarchy={hierarchy} 
          currentCategory={category} 
          currentSubcategory={subcategory} 
          basePath="/shop" 
        />
        
        <div className="flex-1 min-w-0">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold font-heading text-foreground mb-2">
              {productType?.name || subcategory?.name || category?.name || 'Shop Products'}
            </h1>
            <p className="text-muted-foreground text-lg">
              {totalItems} products available
            </p>
          </div>
          
          <ProductGrid items={products} loading={loading || contextLoading} isVault={false} />
          
          <PaginationControls 
            currentPage={page} 
            totalPages={totalPages} 
            onPageChange={setPage} 
          />
        </div>
      </div>
    </div>
  );
};

export default ShopCategoryPage;