import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import SEOHead from '@/components/SEOHead.jsx';
import { Loader2, PackageX } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { formatCurrency } from '@/utils/formatCurrency.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import ProductCard from '@/components/ProductCard.jsx';
import { Skeleton } from '@/components/ui/skeleton';

const CategoryPage = () => {
  const { categoryId } = useParams();
  const [searchParams] = useSearchParams();
  const subCategory = searchParams.get('sub');
  
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState('created_at_desc');
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Re-format categoryId from url slug back to roughly standard text for filtering
  // This depends heavily on how data was mapped in CSV.
  const categoryNameStr = categoryId.replace(/-/g, ' ');

  useEffect(() => {
    const fetchCategoryProducts = async () => {
      setLoading(true);
      try {
        const perPage = 12;
        const from = (page - 1) * perPage;

        let query = supabase
          .from('listings')
          .select('*, seller:profiles!seller_id(*)', { count: 'exact' })
          .ilike('category', `%${categoryNameStr}%`)
          .eq('status', 'active')
          .range(from, from + perPage - 1);

        if (sortOrder === 'price_aud_asc') query = query.order('price_aud', { ascending: true });
        else if (sortOrder === 'price_aud_desc') query = query.order('price_aud', { ascending: false });
        else query = query.order('created_at', { ascending: false });

        const { data, count, error } = await query;
        if (error) throw error;

        setProducts(data || []);
        setTotalItems(count || 0);
        setTotalPages(Math.ceil((count || 0) / perPage));
      } catch (error) {
      } finally {
        setLoading(false);
      }
    };

    fetchCategoryProducts();
  }, [categoryId, subCategory, sortOrder, page, categoryNameStr]);

  return (
    <div className="space-y-6">
      <SEOHead title="Browse by Category | CardPop" description="Browse trading cards by category on CardPop — TCG, sports cards and more." />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-3xl font-bold font-heading capitalize">{categoryNameStr}</h1>
          <p className="text-muted-foreground mt-1">
            {totalItems} {totalItems === 1 ? 'product' : 'products'} available
          </p>
        </div>
        
        <Select value={sortOrder} onValueChange={setSortOrder}>
          <SelectTrigger className="w-[180px] bg-card">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at_desc">Newest First</SelectItem>
            <SelectItem value="price_aud_asc">Price: Low to High</SelectItem>
            <SelectItem value="price_aud_desc">Price: High to Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-48 w-full rounded-2xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : products.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 pt-8">
              <Button 
                variant="outline" 
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-sm font-medium">Page {page} of {totalPages}</span>
              <Button 
                variant="outline" 
                disabled={page === totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-card rounded-2xl border border-border">
          <PackageX className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-xl font-bold mb-2">No products found</h3>
          <p className="text-muted-foreground max-w-md">
            We couldn't find any active listings in this category right now. Check back later!
          </p>
        </div>
      )}
    </div>
  );
};

export default CategoryPage;