import React, { useState, useEffect, useRef } from 'react';
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
  const [sort, setSort] = useState('newest');
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const fetchRef = useRef(null);

  const pathInfo = getCategoryBySlug(hierarchy, categorySlug, subcategorySlug, productTypeSlug);
  const { category, subcategory, productType } = pathInfo || {};
  const categoryName = subcategory?.name || category?.name;

  // Reset to the first page whenever the category path or sort changes, so we
  // never land on an out-of-range page showing zero products.
  useEffect(() => {
    setPage(1);
  }, [categorySlug, subcategorySlug, productTypeSlug, sort]);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const perPage = 16;
        const from = (page - 1) * perPage;

        let query = supabase
          .from('shop_products')
          .select('*', { count: 'exact' })
          .eq('status', 'active');

        // shop_products stores a free-text category; match the resolved
        // subcategory/category name against it.
        if (categoryName) query = query.ilike('category', `%${categoryName}%`);

        if (sort === 'price_asc') query = query.order('price_aud', { ascending: true });
        else if (sort === 'price_desc') query = query.order('price_aud', { ascending: false });
        else if (sort === 'oldest') query = query.order('created_at', { ascending: true });
        else query = query.order('created_at', { ascending: false });

        query = query.range(from, from + perPage - 1);

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
      fetchRef.current = fetchProducts;
      fetchProducts();
    }
    // Depend on stable slug strings (not the derived path objects, which get new
    // identities every render and would re-run this effect needlessly).
  }, [categoryName, page, sort, contextLoading]);

  useEffect(() => {
    const channel = supabase
      .channel('shop-category-products')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shop_products' },
        () => { if (fetchRef.current) fetchRef.current(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

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
        <div className="md:w-56 shrink-0">
          <CategoryFilter
            filters={{ sort }}
            onChange={({ sort: nextSort }) => setSort(nextSort ?? 'newest')}
          />
        </div>
        
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