
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { canViewVaultProduct } from '@/utils/vaultSecurityUtils.js';
import { useCart } from '@/hooks/useCart.jsx';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ShoppingCart, PackageX, Store, ArrowLeft, ShieldCheck, User, Lock, ArrowRightLeft, Layers } from 'lucide-react';
import ProductImageCarousel from '@/components/ProductImageCarousel.jsx';

const getStatusBadge = (listingType) => {
  switch (listingType) {
    case 'Private': return { className: 'badge-vault-private', icon: Lock };
    case 'For Sale': return { className: 'badge-vault-sale', icon: ShoppingCart };
    case 'For Trade': return { className: 'badge-vault-trade', icon: ArrowRightLeft };
    case 'For Sale & Trade': return { className: 'badge-vault-both', icon: Layers };
    default: return { className: 'bg-muted text-muted-foreground', icon: Lock };
  }
};

const ProductDetailPage = () => {
  const { source, id } = useParams();
  const navigate = useNavigate();
  const { addToCart, setIsCartOpen } = useCart();
  const { currentUser, isAdmin } = useAuth();
  
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [seller, setSeller] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchProduct = async () => {
      if (!id || !source) {
        if (isMounted) setError('Invalid product link.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const table = source === 'shop' ? 'listings' : 'vault_items';
        const { data, error: fetchError } = await supabase
          .from(table)
          .select('*, seller:profiles!seller_id(*)')
          .eq('id', id)
          .single();

        if (fetchError) throw fetchError;
        if (!isMounted) return;

        // Security check for Vault Products
        if (source === 'vault') {
          const userRole = isAdmin ? 'admin' : 'user';
          const isAuthorized = canViewVaultProduct(currentUser?.id, data.owner_id, data.is_public, userRole);

          if (!isAuthorized) {
            setError('403 Forbidden: You do not have permission to view this private vault item.');
            setLoading(false);
            return;
          }
        }

        setProduct(data);

        // Fetch seller details
        if (source === 'shop') {
          setSeller({ business_name: 'CardPop Official Store', is_verified: true, type: 'official' });
        } else if (data.seller) {
          setSeller({ business_name: data.seller.username || data.seller.full_name || 'Community Member', is_verified: false, type: 'user' });
        } else if (data.owner_id) {
          try {
            const { data: user } = await supabase.from('profiles').select('*').eq('id', data.owner_id).single();
            setSeller({ business_name: user?.username || user?.full_name || 'Community Member', is_verified: false, type: 'user' });
          } catch (e) {
            setSeller({ business_name: 'Community Member', is_verified: false, type: 'user' });
          }
        }
      } catch (err) {
        if (isMounted) setError('Product not found or unavailable.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchProduct();
    return () => { isMounted = false; };
  }, [id, source, currentUser, isAdmin]);

  const handleAddToCart = () => {
    if (!product) return;
    const priceInCents = Math.round((product.price || 0) * 100);
    const cartProduct = {
      id: product.id,
      title: product.name,
      price: priceInCents / 100,
      image: product.images?.[0] || null
    };
    const cartVariant = {
      id: product.id,
      price_in_cents: priceInCents,
      manage_inventory: product.stockQuantity !== null,
      inventory_quantity: product.stockQuantity
    };
    addToCart(cartProduct, cartVariant, 1, product.stockQuantity ?? 999)
      .then(() => {
        toast.success('Added to cart', {
          action: {
            label: 'View Cart',
            onClick: () => setIsCartOpen(true)
          }
        });
      })
      .catch(e => toast.error(e.message));
  };

  const handleSecondaryAction = (action) => {
    toast(`Coming soon: ${action}`);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <Skeleton className="h-6 w-32 mb-8 rounded-md" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          <div className="lg:col-span-7">
            <Skeleton className="aspect-[4/5] w-full rounded-3xl" />
          </div>
          <div className="lg:col-span-5 flex flex-col space-y-6">
            <Skeleton className="h-10 w-3/4 rounded-xl" />
            <Skeleton className="h-8 w-1/3 rounded-md" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4 bg-background">
        <div className="text-center bg-card p-10 rounded-[2rem] border border-border shadow-md max-w-md w-full">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
            {error?.includes('403') ? <Lock className="w-8 h-8 text-muted-foreground" /> : <PackageX className="w-8 h-8 text-muted-foreground" />}
          </div>
          <h2 className="text-2xl font-bold mb-2 text-foreground">Access Restricted</h2>
          <p className="text-muted-foreground mb-8 leading-relaxed text-balance">
            {error || "This item could not be found or has been removed."}
          </p>
          <Button onClick={() => navigate('/marketplace')} className="w-full rounded-xl h-12 font-bold">
            Return to Marketplace
          </Button>
        </div>
      </div>
    );
  }

  const isShop = source === 'shop';
  const outOfStock = isShop && product.stockQuantity !== null && product.stockQuantity <= 0;
  
  const statusBadge = isShop 
    ? { label: product.visibility === 'public' ? 'Shop + Marketplace' : 'Shop Only', config: { className: 'bg-primary text-primary-foreground', icon: Store } }
    : { label: product.listing_type || 'Private', config: getStatusBadge(product.listing_type) };
    
  const StatusIcon = statusBadge.config.icon;

  return (
    <div className="bg-background min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <Helmet><title>{`${product.name} | CardPop`}</title></Helmet>

        <Button variant="link" className="px-0 mb-8 text-muted-foreground hover:text-primary font-medium" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-6 xl:col-span-7">
            <ProductImageCarousel images={product.images} record={product} />
          </div>

          <div className="lg:col-span-6 xl:col-span-5 flex flex-col">
            <div className="flex flex-wrap gap-2 mb-4">
              {isShop ? (
                <Badge className="bg-primary text-primary-foreground border-none font-bold shadow-sm px-2.5 py-1">
                  Official Store
                </Badge>
              ) : (
                <Badge className="bg-accent text-accent-foreground border-none font-bold shadow-sm px-2.5 py-1">
                  Community Vault
                </Badge>
              )}
              
              <Badge className={`font-bold border-none shadow-sm px-2.5 py-1 ${statusBadge.config.className}`}>
                <StatusIcon className="w-3 h-3 mr-1.5 inline-block" />
                {statusBadge.label}
              </Badge>

              {product.condition && <Badge variant="secondary" className="font-bold">{product.condition}</Badge>}
              {product.grade && <Badge variant="outline" className="border-primary/40 text-primary font-bold">Grade: {product.grade}</Badge>}
            </div>

            <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-3 leading-tight text-balance">
              {product.name}
            </h1>
            
            <p className="text-muted-foreground font-medium text-sm mb-6">
              {product.category || product.collectionType}
            </p>

            <div className="mb-8">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Estimated Value / Price</p>
              <div className="flex items-end gap-3">
                <span className="text-4xl font-extrabold tabular-nums tracking-tight text-foreground">
                  ${(product.price || 0).toFixed(2)}
                </span>
                {isShop && <span className="text-sm font-medium text-muted-foreground pb-1">+ Shipping</span>}
              </div>
            </div>

            {seller && (
              <div className="flex items-center justify-between gap-4 mb-8 p-5 bg-card border border-border rounded-2xl shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    {seller.type === 'official' ? <Store className="w-6 h-6" /> : <User className="w-6 h-6" />}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-0.5">Owner / Seller</p>
                    <p className="font-bold text-base text-foreground flex items-center gap-1.5">
                      {seller.business_name}
                      {seller.is_verified && <ShieldCheck className="w-4 h-4 text-emerald-500" />}
                    </p>
                  </div>
                </div>
                {!isShop && (
                  <Button variant="outline" size="sm" className="rounded-full hidden sm:flex">View Profile</Button>
                )}
              </div>
            )}

            {isShop ? (
              <div className="flex flex-col gap-3 mb-8">
                <Button 
                  size="lg" 
                  className="w-full h-14 rounded-xl font-bold text-lg shadow-md hover:shadow-lg transition-all"
                  onClick={handleAddToCart}
                  disabled={outOfStock}
                >
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  {outOfStock ? 'Out of Stock' : 'Add to Cart'}
                </Button>
                {product.stockQuantity !== null && (
                  <p className="text-sm text-center font-medium text-muted-foreground">
                    {product.stockQuantity} available in stock
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3 mb-8">
                {product.listing_type === 'For Sale' || product.listing_type === 'For Sale & Trade' ? (
                  <Button size="lg" className="w-full h-14 rounded-xl font-bold text-lg shadow-md" onClick={handleAddToCart}>
                    Buy Now
                  </Button>
                ) : null}
                
                {product.listing_type === 'For Trade' || product.listing_type === 'For Sale & Trade' ? (
                  <Button size="lg" variant={product.listing_type === 'For Sale & Trade' ? 'outline' : 'default'} className="w-full h-14 rounded-xl font-bold text-lg" onClick={() => handleSecondaryAction('Propose Trade')}>
                    <ArrowRightLeft className="w-5 h-5 mr-2" /> Request Trade
                  </Button>
                ) : null}

                {product.listing_type === 'Private' && (
                  <Button size="lg" variant="secondary" className="w-full h-14 rounded-xl font-bold text-lg" disabled>
                    <Lock className="w-5 h-5 mr-2" /> Private Item
                  </Button>
                )}
              </div>
            )}

            <div className="space-y-4 pt-6 border-t border-border">
              <h3 className="font-bold text-lg text-foreground">Description</h3>
              {product.description ? (
                <div className="prose prose-sm dark:prose-invert text-muted-foreground leading-relaxed max-w-none">
                  {product.description}
                </div>
              ) : (
                <p className="text-muted-foreground italic text-sm">No detailed description provided.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;
