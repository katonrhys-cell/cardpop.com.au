
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient.js';
import SEOHead from '@/components/SEOHead.jsx';
import Breadcrumb from '@/components/Breadcrumb.jsx';
import { generateStructuredData } from '@/utils/seoUtils.js';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/hooks/useCart.jsx';
import { toast } from 'sonner';

const ShopProductDetailPage = () => {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();

  useEffect(() => {
    // Automatically redirect to the unified ProductDetailPage
    navigate(`/product/${itemId}`, { replace: true });
  }, [itemId, navigate]);

  return (
    <div className="container-default section-padding space-y-8">
      <Skeleton className="h-10 w-64" />
      <div className="grid md:grid-cols-2 gap-12">
        <Skeleton className="aspect-square rounded-2xl w-full" />
        <div className="space-y-6">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-8 w-1/4" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
};

export default ShopProductDetailPage;
