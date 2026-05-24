
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, Filter, SlidersHorizontal } from 'lucide-react';
import pb from '@/lib/pocketbaseClient.js';
import { useCart } from '@/hooks/useCart.jsx';
import ProductCard from '@/components/ProductCard.jsx';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const BrowseListingsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState(searchParams.get('category') || 'all');
  const [sort, setSort] = useState('-created');

  useEffect(() => {
    const fetchListings = async () => {
      setLoading(true);
      try {
        const filter = [];
        
        if (searchParams.get('q')) {
          const q = searchParams.get('q').replace(/"/g, '');
          filter.push(`name ~ "${q}"`);
        }
        
        if (category && category !== 'all') {
          filter.push(`collectionType = "${category}" || category = "${category}"`);
        }
        
        filter.push('(marketplaceStatus = "For Sale" || marketplaceStatus = "For Both" || visibility = "public")');

        const filterString = filter.join(' && ');

        const response = await pb.collection('shop_products').getList(1, 24, {
          filter: filterString,
          sort: sort,
          $autoCancel: false
        });
        
        setProducts(response.items || []);
      } catch (error) {
        console.error('Error fetching products:', error);
        toast.error('Failed to load listings');
      } finally {
        setLoading(false);
      }
    };

    fetchListings();
  }, [searchParams, category, sort]);

  const handleCategoryChange = (val) => {
    setCategory(val);
    const params = new URLSearchParams(searchParams);
    if (val !== 'all') params.set('category', val);
    else params.delete('category');
    setSearchParams(params);
  };

  const handleAddToCart = (product, variant) => {
    const priceInCents = product.price ? Math.round(product.price * 100) : 0;
    const cartProduct = {
      id: product.id,
      title: product.name,
      price: priceInCents / 100,
      image: product.images?.[0] ? pb.files.getUrl(product, product.images[0]) : null
    };

    const cartVariant = {
      id: product.id,
      price_in_cents: priceInCents,
      manage_inventory: product.stockQuantity !== null,
      inventory_quantity: product.stockQuantity
    };

    addToCart(cartProduct, cartVariant, 1, product.stockQuantity ?? 999);
    toast.success('Added to cart');
  };

  const handleViewDetails = (id) => {
    navigate(`/product/${id}`);
  };

  return (
    <div className="min-h-screen bg-background py-8 md:py-12">
      <Helmet><title>Browse Listings | CardPop</title></Helmet>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-serif font-bold tracking-tight text-foreground">Browse Cards</h1>
            <p className="text-muted-foreground mt-1">Discover rare cards from the official store and community vaults.</p>
          </div>
          
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Button variant="outline" size="icon" className="shrink-0 md:hidden border-border bg-card shadow-sm h-11 w-11">
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Filters */}
          <div className="hidden lg:block w-64 shrink-0 space-y-6">
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 font-bold mb-4 pb-3 border-b border-border text-foreground">
                <Filter className="w-4 h-4" /> Filters
              </div>
              
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground">Category</label>
                  <Select value={category} onValueChange={handleCategoryChange}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="Pokemon">Pokemon</SelectItem>
                      <SelectItem value="Magic">Magic: The Gathering</SelectItem>
                      <SelectItem value="Yu-Gi-Oh">Yu-Gi-Oh</SelectItem>
                      <SelectItem value="Sports">Sports Cards</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground">Sort By</label>
                  <Select value={sort} onValueChange={setSort}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="-created">Newest First</SelectItem>
                      <SelectItem value="price">Price: Low to High</SelectItem>
                      <SelectItem value="-price">Price: High to Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Product Grid */}
          <div className="flex-1">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="space-y-4 bg-card p-4 rounded-2xl border border-border shadow-sm">
                    <Skeleton className="aspect-[4/5] w-full rounded-xl bg-background" />
                    <Skeleton className="h-4 w-2/3 bg-background" />
                    <Skeleton className="h-4 w-1/2 bg-background" />
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-20 bg-card border border-border border-dashed rounded-2xl shadow-sm">
                <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-bold mb-2 text-foreground">No cards found</h3>
                <p className="text-muted-foreground mb-6">Try adjusting your search or filters.</p>
                <Button onClick={() => { setCategory('all'); setSearchParams({}); }}>
                  Clear Filters
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {products.map(product => (
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
        </div>
      </div>
    </div>
  );
};

export default BrowseListingsPage;
