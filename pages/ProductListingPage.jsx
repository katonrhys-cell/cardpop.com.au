
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Loader2, PackageX, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import ProductCard from '@/components/ProductCard.jsx';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ShopProductForm from '@/components/ShopProductForm.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';

const ProductListingPage = () => {
  const { isAdmin } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState('created_at_desc');
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [isFormOpen, setIsFormOpen] = useState(false);

  const fetchAllProducts = async () => {
    setLoading(true);
    try {
      const perPage = 12;
      const from = (page - 1) * perPage;

      const sortAsc = sortOrder === 'price_aud_asc';
      const sortDesc = sortOrder === 'price_aud_desc';

      let query = supabase
        .from('listings')
        .select('*', { count: 'exact' })
        .range(from, from + perPage - 1);

      if (sortAsc) query = query.order('price_aud', { ascending: true });
      else if (sortDesc) query = query.order('price_aud', { ascending: false });
      else query = query.order('created_at', { ascending: false });

      const { data, count, error } = await query;
      if (error) throw error;

      setProducts(data || []);
      setTotalItems(count || 0);
      setTotalPages(Math.ceil((count || 0) / perPage));
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllProducts();
  }, [sortOrder, page]);

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    fetchAllProducts();
  };

  return (
    <div className="space-y-6">
      <Helmet>
        <title>All Products | Marketplace</title>
      </Helmet>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-3xl font-bold font-heading">All Products</h1>
          <p className="text-muted-foreground mt-1">
            {totalItems} items available across all categories
          </p>
        </div>
        
        <div className="flex items-center gap-3">
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

          {isAdmin && (
            <Button onClick={() => setIsFormOpen(true)} className="font-bold rounded-xl">
              <Plus className="w-4 h-4 mr-2" /> Add Product
            </Button>
          )}
        </div>
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
            The marketplace is currently empty.
          </p>
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto bg-card border-border rounded-3xl p-8">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-serif font-bold text-foreground">
              Add New Product
            </DialogTitle>
          </DialogHeader>
          <ShopProductForm onSuccess={handleFormSuccess} onCancel={() => setIsFormOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductListingPage;
