
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProducts } from '@/api/EcommerceApi.js';
import { useCart } from '@/hooks/useCart.jsx';
import { AlertCircle, PackageX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import ProductCard from '@/components/ProductCard.jsx';

const ProductsList = ({ collectionFilter = null }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const { addToCart } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const fetchProducts = async () => {
      try {
        if (isMounted) {
          setLoading(true);
          setError(null);
        }
        
        const response = await getProducts({ limit: 50 });
        let filteredProducts = response.products || [];

        if (collectionFilter && collectionFilter !== 'All') {
          filteredProducts = filteredProducts.filter(product => {
            return product.title.toLowerCase().includes(collectionFilter.toLowerCase());
          });
        }

        if (isMounted) setProducts(filteredProducts);
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load products from the catalog.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchProducts();
    return () => { isMounted = false; };
  }, [collectionFilter]);

  const handleAddToCart = (product, variant) => {
    const selectedVariant = variant || product.variants?.[0] || product;
    const quantity = 1;
    const availableQuantity = selectedVariant.manage_inventory ? selectedVariant.inventory_quantity : 999;
    
    addToCart(product, selectedVariant, quantity, availableQuantity).catch(err => {
      // Silently handle cart errors
    });
  };

  const handleViewDetails = (productId) => {
    navigate(`/product/${productId}`);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
        {Array(8).fill(0).map((_, i) => (
          <div key={i} className="flex flex-col space-y-4">
            <Skeleton className="aspect-[4/5] w-full rounded-2xl" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <div className="flex justify-between items-center pt-4">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-10 w-24 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-destructive bg-destructive/5 rounded-3xl border border-destructive/20">
        <AlertCircle className="h-12 w-12 mb-4 opacity-80" />
        <p className="font-bold text-lg mb-2">Connection Error</p>
        <p className="text-sm opacity-80 max-w-md text-center">{error}</p>
        <Button variant="outline" className="mt-6" onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-muted/30 rounded-3xl border border-border border-dashed">
          <PackageX className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
          <p className="text-foreground text-xl font-bold mb-2">No products found</p>
          <p className="text-sm text-muted-foreground max-w-md text-center">
            {collectionFilter && collectionFilter !== 'All' 
              ? `We couldn't find any items matching "${collectionFilter}". Try adjusting your filters.` 
              : "The catalog is currently empty. Check back later for new arrivals."}
          </p>
          <Button variant="outline" className="mt-6" onClick={() => navigate('/shop')}>
            Clear Filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
          {products.map((product) => (
            <ProductCard 
              key={product.id} 
              product={product} 
              onAddToCart={handleAddToCart}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductsList;
