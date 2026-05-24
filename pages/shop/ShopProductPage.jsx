import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient';
import { formatCurrency } from '@/api/EcommerceApi';
import { useCart } from '@/hooks/useCart';
import { Button } from '@/components/ui/button';
import { ShoppingCart, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

const ShopProductPage = () => {
  const { id } = useParams();
  const { addToCart } = useCart();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await pb.collection('shop_products').getOne(id, { $autoCancel: false });
        setProduct(res);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  const handleAddToCart = () => {
    if (product) {
      addToCart(product, null, 1, product.stockQuantity || 1);
      toast.success('Added to cart');
    }
  };

  if (loading) return <div className="container-default section-padding"><Skeleton className="h-[600px] rounded-2xl" /></div>;
  if (!product) return <div className="container-default section-padding text-center">Product not found</div>;

  return (
    <div className="container-default section-padding min-h-[80vh]">
      <Helmet><title>{product.name} | Shop</title></Helmet>
      
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
        <Link to="/shop">Shop</Link>
        <span>/</span>
        <Link to={`/shop/${product.category}`}>{product.category}</Link>
        <span>/</span>
        <span className="text-foreground">{product.name}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="bg-secondary/30 rounded-3xl p-8 flex items-center justify-center border border-border">
           {product.images?.length > 0 ? (
             <img src={pb.files.getUrl(product, product.images[0])} alt={product.name} className="w-full max-w-md object-contain mix-blend-multiply" />
           ) : (
             <div className="text-muted-foreground">No image available</div>
           )}
        </div>

        <div className="flex flex-col">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary text-sm font-medium rounded-full w-fit mb-4">
            <ShieldCheck className="w-4 h-4" />
            Verified Authentic
          </div>
          
          <h1 className="text-3xl md:text-4xl font-bold mb-4">{product.name}</h1>
          <p className="text-3xl font-bold text-primary mb-6">{formatCurrency(product.price)}</p>
          
          <div className="prose prose-slate dark:prose-invert mb-8">
            <p>{product.description || 'No description provided.'}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="p-4 bg-muted rounded-xl">
              <span className="text-sm text-muted-foreground block mb-1">Condition</span>
              <span className="font-semibold">{product.condition || 'N/A'}</span>
            </div>
            <div className="p-4 bg-muted rounded-xl">
              <span className="text-sm text-muted-foreground block mb-1">Grade</span>
              <span className="font-semibold">{product.grade || 'Raw'}</span>
            </div>
          </div>

          <div className="mt-auto">
            <Button size="lg" className="w-full text-lg h-14 radius-btn" onClick={handleAddToCart}>
              <ShoppingCart className="w-5 h-5 mr-2" />
              Add to Cart
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShopProductPage;