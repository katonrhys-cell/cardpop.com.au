import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Star, MapPin, Calendar, Package, MessageSquare } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import ProductCard from '@/components/ProductCard';

const SellerProfilePage = () => {
  const { sellerId } = useParams();
  const { currentUser } = useAuth();
  const [seller, setSeller] = useState(null);
  const [products, setProducts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchSellerData = async () => {
      try {
        const { data: sellerData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', sellerId)
          .single();
        if (cancelled) return;
        setSeller(sellerData);

        const { data: items } = await supabase
          .from('vault_items')
          .select('*, vault_images(*)')
          .eq('owner_id', sellerId)
          .neq('listing_type', 'Private')
          .eq('is_public', true)
          .order('created_at', { ascending: false })
          .limit(50);

        if (cancelled) return;
        const mappedProducts = (items ?? []).map(c => {
          const imgPath = c.card_image || c.vault_images?.[0]?.storage_path || null;
          const imgSrc = imgPath
            ? (imgPath.startsWith('http') ? imgPath : supabase.storage.from('vault-images').getPublicUrl(imgPath).data.publicUrl)
            : null;
          return {
          id: c.id,
          source: 'vault',
          title: c.card_name || 'Vault Card',
          collectionType: c.collection,
          condition: c.condition,
          price: c.estimated_value_aud || 0,
          image: imgSrc,
          sellerName: sellerData?.display_name || sellerData?.username || 'Vault Collector',
          ...c,
          };
        });
        setProducts(mappedProducts);

        const { data: reviewsData } = await supabase
          .from('reviews')
          .select('*, reviewer:profiles!reviewer_id(id, username, display_name)')
          .eq('reviewee_id', sellerId)
          .order('created_at', { ascending: false })
          .limit(10);
        if (!cancelled) setReviews(reviewsData ?? []);
      } catch (error) {
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchSellerData();
    return () => { cancelled = true; };
  }, [sellerId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center font-sans min-h-screen bg-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground font-bold">Loading seller profile...</p>
        </div>
      </div>
    );
  }

  if (!seller) {
    return (
      <div className="flex items-center justify-center font-sans min-h-screen bg-background">
        <div className="bg-card border border-border p-12 rounded-3xl shadow-sm text-center">
          <p className="text-foreground font-bold text-xl">Seller not found</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{`${seller.display_name || seller.username} - Seller Profile - Card Pop Australia`}</title>
        <meta name="description" content={`View ${seller.display_name || seller.username}'s trading card collection and seller profile.`} />
      </Helmet>
      <div className="flex flex-col font-sans bg-background min-h-screen">
        <div className="flex-1 py-12">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
            <Card className="mb-12 rounded-3xl shadow-sm border-border bg-card">
              <CardContent className="p-8 md:p-10">
                <div className="flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left">
                  <div className="w-24 h-24 bg-background rounded-full flex items-center justify-center shrink-0 ring-4 ring-muted border border-border">
                    <span className="text-primary font-serif font-bold text-4xl">
                      {(seller.display_name || seller.username)?.charAt(0) || 'S'}
                    </span>
                  </div>

                  <div className="flex-1">
                    <h1 className="font-serif text-3xl font-bold mb-4 text-foreground">{seller.display_name || seller.username}</h1>
                    
                    <div className="flex flex-wrap justify-center md:justify-start gap-4 mb-6">
                      <div className="flex items-center gap-2 text-muted-foreground font-medium">
                        <Star className="h-5 w-5 fill-primary text-primary" />
                        <span>
                          {seller.seller_rating?.toFixed(1) || 'New Seller'}
                          {seller.seller_rating_count > 0 && ` (${seller.seller_rating_count} reviews)`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground font-medium">
                        <MapPin className="h-5 w-5" />
                        <span>{seller.location_city || seller.location || 'Australia'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground font-medium">
                        <Calendar className="h-5 w-5" />
                        <span>Member since {seller.created_at ? new Date(seller.created_at).getFullYear() : 'Unknown'}</span>
                      </div>
                    </div>

                    {seller.bio_text && (
                      <p className="text-muted-foreground leading-relaxed mb-6 font-medium max-w-3xl">
                        {seller.bio_text}
                      </p>
                    )}

                    <div className="flex items-center justify-center md:justify-start gap-4">
                      <div className="flex items-center gap-2 text-sm text-foreground font-bold bg-background border border-border shadow-sm px-4 py-2 rounded-full">
                        <Package className="h-4 w-4 text-primary" />
                        <span>{products.length} active listings</span>
                      </div>
                    </div>
                  </div>

                  {currentUser?.id !== seller.id && (
                    <div className="shrink-0 w-full md:w-auto mt-4 md:mt-0">
                      <Button size="lg" className="font-bold w-full rounded-xl shadow-md">
                        <MessageSquare className="h-5 w-5 mr-2" />
                        Contact Seller
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <section className="mb-16">
              <h2 className="font-serif text-2xl md:text-3xl font-bold mb-8 text-foreground">Active Listings</h2>
              {products.length === 0 ? (
                <div className="bg-card p-12 text-center rounded-3xl border border-border border-dashed shadow-sm">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-foreground font-bold">No active listings at the moment</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                    />
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="font-serif text-2xl md:text-3xl font-bold mb-8 text-foreground">Reviews</h2>
              {reviews.length === 0 ? (
                <div className="bg-card p-12 text-center rounded-3xl border border-border border-dashed shadow-sm">
                  <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-foreground font-bold">No reviews yet</p>
                </div>
              ) : (
                <div className="space-y-4 max-w-4xl">
                  {reviews.map((review) => (
                    <Card key={review.id} className="rounded-2xl border-border bg-card shadow-sm">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-bold text-foreground">
                              {review.reviewer?.display_name || review.reviewer?.username || 'Anonymous Collector'}
                            </p>
                            <div className="flex items-center gap-1 mt-1">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-4 w-4 ${
                                    i < review.rating
                                      ? 'fill-primary text-primary'
                                      : 'text-muted-foreground/30'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                          <span className="text-sm text-muted-foreground font-medium">
                            {new Date(review.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {review.comment && (
                          <p className="text-muted-foreground leading-relaxed font-medium">
                            {review.comment}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  );
};

export default SellerProfilePage;