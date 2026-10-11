import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Star, MapPin, Calendar, Package, MessageSquare, CalendarDays, Store, Users, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { VAULT_ITEM_CARD_SELECT } from '@/lib/listingCardColumns.js';
import { PUBLIC_PROFILE_COLUMNS } from '@/lib/profileColumns.js';
import { fetchUserEvents } from '@/lib/eventRsvp.js';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import ProductCard from '@/components/ProductCard';
import { Badge } from '@/components/ui/badge';
import BackButton from '@/components/BackButton.jsx';
import { cardThumbUrl } from '@/utils/imageUrl.js';
import { eventPath, eventTypeLabel, eventTypeStyle, formatEventDate, formatEventLocation } from '@/lib/eventSeo.js';

const SellerProfilePage = () => {
  const { sellerId } = useParams();
  const { currentUser } = useAuth();
  const [seller, setSeller] = useState(null);
  const [products, setProducts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchSellerData = async () => {
      try {
        const { data: sellerData } = await supabase
          .from('profiles')
          .select(PUBLIC_PROFILE_COLUMNS)
          .eq('id', sellerId)
          .single();
        if (cancelled) return;
        setSeller(sellerData);

        const { data: items } = await supabase
          .from('vault_items')
          .select(VAULT_ITEM_CARD_SELECT)
          .eq('owner_id', sellerId)
          .neq('listing_type', 'Private')
          .eq('is_public', true)
          .order('created_at', { ascending: false })
          .limit(50);

        if (cancelled) return;
        const mappedProducts = (items ?? []).map(c => {
          const imgPath = c.card_image || c.vault_images?.[0]?.storage_path || null;
          const imgSrc = cardThumbUrl(imgPath);
          return {
          id: c.id,
          source: 'vault',
          name: c.card_name || 'Vault Card',
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

        // Reviews come from the canonical seller_ratings pipeline (same source
        // as the marketplace rating widgets), read through the public API.
        const ratingsBody = await fetch(`/api/seller-ratings/${sellerId}`)
          .then(r => (r.ok ? r.json() : null))
          .catch(() => null);
        if (!cancelled) setReviews((ratingsBody?.ratings ?? []).slice(0, 10));

        // Events this collector has RSVP'd to (which show, and in what
        // capacity — attending as a buyer or selling as a vendor).
        const rsvpEvents = await fetchUserEvents(sellerId).catch(() => []);
        if (!cancelled) setEvents(rsvpEvents);
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

  // Break active listings down by intent. "For Sale & Trade" items carry their
  // own badge so they live under For Sale (they have a price) rather than being
  // duplicated into both sections.
  const forSaleListings = products.filter(
    (p) => p.listing_type === 'For Sale' || p.listing_type === 'For Sale & Trade'
  );
  const forTradeListings = products.filter(
    (p) => p.listing_type === 'For Trade' || p.listing_type === 'Expression of Interest'
  );

  return (
    <>
      <Helmet>
        <title>{`${seller.display_name || seller.username} - Seller Profile - Card Pop Australia`}</title>
        <meta name="description" content={`View ${seller.display_name || seller.username}'s trading card collection and seller profile.`} />
      </Helmet>
      <div className="flex flex-col font-sans bg-background min-h-screen">
        <div className="flex-1 py-12">
          <div className="container mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 max-w-[90rem]">
            <BackButton fallback="/community" className="mb-8" />
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

            {products.length === 0 ? (
              <section className="mb-16">
                <h2 className="font-serif text-2xl md:text-3xl font-bold mb-8 text-foreground">Active Listings</h2>
                <div className="bg-card p-12 text-center rounded-3xl border border-border border-dashed shadow-sm">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-foreground font-bold">No active listings at the moment</p>
                </div>
              </section>
            ) : (
              <>
                {forSaleListings.length > 0 && (
                  <section className="mb-16">
                    <h2 className="font-serif text-2xl md:text-3xl font-bold mb-8 text-foreground">For Sale</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {forSaleListings.map((product, i) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          priority={i < 2}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {forTradeListings.length > 0 && (
                  <section className="mb-16">
                    <h2 className="font-serif text-2xl md:text-3xl font-bold mb-8 text-foreground">For Trade or Expression of Interest</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {forTradeListings.map((product, i) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          priority={i < 2}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}

            <section className="mb-16">
              <h2 className="font-serif text-2xl md:text-3xl font-bold mb-8 text-foreground">Events</h2>
              {events.length === 0 ? (
                <div className="bg-card p-12 text-center rounded-3xl border border-border border-dashed shadow-sm">
                  <CalendarDays className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-foreground font-bold">Not attending any events yet</p>
                  <p className="text-muted-foreground text-sm mt-1">
                    Events this collector is attending or selling at will appear here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {events.map((event) => {
                    const isVendor = event.rsvpRole === 'vendor';
                    const style = eventTypeStyle(event);
                    return (
                      <Link
                        key={event.id}
                        to={eventPath(event)}
                        className="group bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex flex-col gap-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          {style ? (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r ${style.gradient} text-white text-[10px] font-bold uppercase tracking-wide shadow-sm`}>
                              <style.Icon className="w-3 h-3" />
                              {eventTypeLabel(event)}
                            </span>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] font-semibold uppercase tracking-wide">
                              {eventTypeLabel(event)}
                            </Badge>
                          )}
                          <Badge
                            className={`gap-1 font-bold border-none ${
                              isVendor
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                                : 'bg-primary/10 text-primary'
                            }`}
                          >
                            {isVendor ? <Store className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                            {isVendor ? 'Selling as Vendor' : 'Attending'}
                          </Badge>
                        </div>
                        <h3 className="font-bold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                          {event.title}
                        </h3>
                        <div className="mt-auto space-y-1.5 text-sm text-muted-foreground font-medium">
                          <span className="flex items-center gap-1.5">
                            <CalendarDays className="w-4 h-4 shrink-0" /> {formatEventDate(event)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 shrink-0" />
                            <span className="truncate">{formatEventLocation(event)}</span>
                          </span>
                        </div>
                        <span className="flex items-center gap-1 text-xs font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                          View event <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </Link>
                    );
                  })}
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