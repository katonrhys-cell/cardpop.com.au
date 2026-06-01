
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import SEOHead from '@/components/SEOHead.jsx';
import { ArrowLeft, MapPin, Calendar, ArrowRightLeft, CreditCard, Users, Search, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import ImageZoomModal from '@/components/ImageZoomModal.jsx';
import TradeOfferModal from '@/components/TradeOfferModal.jsx';

const CardDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [card, setCard] = useState(null);
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log(`[CardDetailsPage] Product ID from URL params: ${id}`);

        // Try vault_items first, then listings
        let data = null;
        let { data: vaultItem } = await supabase
          .from('vault_items')
          .select('*, vault_images(*), owner:profiles!owner_id(*)')
          .eq('id', id)
          .maybeSingle();

        if (vaultItem) {
          data = vaultItem;
        } else {
          const { data: listing } = await supabase
            .from('listings')
            .select('*, seller:profiles!seller_id(*)')
            .eq('id', id)
            .maybeSingle();
          data = listing;
        }

        if (!isMounted) return;

        if (!data) {
          throw new Error('Product not found.');
        }

        const imgUrl = data.vault_images?.[0]?.image_url
          ?? (data.image_url?.startsWith('http') ? data.image_url : null);

        const isForSale = ['for_sale', 'for_both', 'active'].includes(data.listing_status ?? data.status);
        const isForTrade = ['for_trade', 'for_both'].includes(data.listing_status ?? '');

        setCard({
          ...data,
          title: data.card_name || data.title || 'Unknown Card',
          description: data.description || '',
          salePrice: data.asking_price_aud ?? data.price_aud ?? data.estimated_value_aud ?? 0,
          tradeValue: data.trade_value_aud ?? data.estimated_value_aud ?? 0,
          condition: data.condition || 'Unknown',
          image: imgUrl,
          isForSale,
          isForTrade,
          collectionType: data.collection_type || data.category || 'Trading Card',
          grade: data.grade_score ? String(data.grade_score) : null,
        });

        const ownerProfile = data.owner ?? data.seller;
        if (ownerProfile) {
          setOwner(ownerProfile);
        } else {
          const ownerId = data.owner_id ?? data.seller_id;
          if (ownerId) {
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', ownerId).single();
            if (isMounted) setOwner(profile);
          }
        }

      } catch (err) {
        console.error("[CardDetailsPage] Error fetching card details:", err);
        if (isMounted) {
          setError(err.message || "Failed to load card details.");
          toast.error("Product not found or unavailable.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    fetchDetails();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleMakeOfferClick = () => {
    if (!currentUser) {
      toast.error("Please log in to make a trade offer.");
      navigate('/login');
      return;
    }
    setIsTradeModalOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <p className="font-bold text-muted-foreground tracking-wide animate-pulse">Loading listing details...</p>
      </div>
    );
  }
  
  if (error || !card) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center bg-background px-4">
        <div className="bg-destructive/10 text-destructive border border-destructive/20 p-8 rounded-3xl max-w-md text-center shadow-lg">
          <AlertCircle className="w-16 h-16 mx-auto mb-5 opacity-80" />
          <h2 className="text-2xl font-bold mb-3">Product Not Found</h2>
          <p className="opacity-90 mb-8 text-balance text-sm leading-relaxed">
            {error || 'This item could not be found. It may have been removed, sold, or the link is invalid.'}
          </p>
          <Button onClick={() => navigate('/marketplace')} className="w-full font-bold rounded-xl h-12">
            Browse Marketplace
          </Button>
        </div>
      </div>
    );
  }

  const isOwner = currentUser && owner && currentUser.id === owner.id;

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans w-full overflow-x-hidden">
      <SEOHead title={`${card.title} | CardPop`} description={card.description || `View ${card.title} details, pricing and listings on CardPop Australia.`} />
      
      <main className="flex-1 container-default py-8 md:py-16">
        <Button variant="ghost" className="mb-8 -ml-4 text-muted-foreground hover:text-primary transition-colors font-bold px-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>

        <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-start">
          {/* Left: Image */}
          <div className="lg:col-span-6 xl:col-span-5 flex flex-col gap-4">
            <div 
              className="aspect-[3/4] bg-muted/40 rounded-3xl overflow-hidden border border-border p-6 sm:p-10 relative group cursor-zoom-in flex items-center justify-center shadow-sm"
              onClick={() => {
                if (card.image) setIsZoomOpen(true);
              }}
            >
              {card.image ? (
                <img 
                  src={card.image} 
                  alt={card.title} 
                  className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105 drop-shadow-2xl" 
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-muted-foreground opacity-50">
                  <Search className="w-16 h-16 mb-4" />
                  <p className="font-bold tracking-widest uppercase text-sm">No Image</p>
                </div>
              )}
              
              <div className="absolute top-5 left-5 flex flex-col gap-2 z-20">
                <Badge className="bg-background/90 backdrop-blur-md text-foreground font-bold shadow-sm border-none text-xs px-3 py-1.5 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Marketplace
                </Badge>
                {card.featured && (
                  <Badge className="bg-primary text-primary-foreground font-bold shadow-md border-none text-xs px-3 py-1.5">
                    Featured
                  </Badge>
                )}
              </div>
              
              {card.image && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsZoomOpen(true);
                  }}
                  className="absolute bottom-5 right-5 p-3.5 bg-black/60 text-white rounded-2xl opacity-0 group-hover:opacity-100 hover:bg-black/80 hover:scale-105 transition-all duration-300 z-20 backdrop-blur-md shadow-lg"
                  aria-label="Zoom image"
                >
                  <Search size={22} />
                </button>
              )}
            </div>
          </div>

          {/* Right: Details */}
          <div className="lg:col-span-6 xl:col-span-7 flex flex-col">
            <div className="mb-8">
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant="secondary" className="bg-primary/10 text-primary border-none font-bold tracking-wider text-[11px] uppercase">
                  {card.collectionType}
                </Badge>
                {card.grade && (
                  <Badge variant="outline" className="font-bold border-border bg-background text-[11px] uppercase tracking-wider">
                    Grade: {card.grade}
                  </Badge>
                )}
                <Badge variant="outline" className="font-bold border-border bg-background text-[11px] uppercase tracking-wider">
                  {card.condition} Condition
                </Badge>
              </div>
              
              <h1 className="text-3xl md:text-5xl font-heading font-extrabold leading-tight mb-6 text-balance text-foreground">
                {card.title}
              </h1>
            </div>

            {/* Owner Info */}
            <div className="flex items-center justify-between p-5 mb-8 rounded-2xl bg-card border border-border shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary font-bold text-xl border border-primary/20">
                  {owner?.name?.charAt(0).toUpperCase() || owner?.username?.charAt(0).toUpperCase() || 'S'}
                </div>
                <div>
                  <p className="font-bold text-base md:text-lg leading-tight text-foreground">
                    {owner?.name || owner?.username || owner?.business_name || 'Anonymous Seller'}
                  </p>
                  <div className="flex items-center gap-3 text-xs md:text-sm text-muted-foreground mt-1 font-medium">
                    {owner?.location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5"/> 
                        {owner.location}
                      </span>
                    )}
                    {(owner?.memberSince || owner?.created) && (
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5"/> 
                        Joined {new Date(owner.memberSince || owner.created).getFullYear()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {!isOwner && owner?.id && (
                <Button variant="outline" size="sm" className="font-bold rounded-xl shadow-sm hidden sm:flex" asChild>
                  <Link to={`/community/user/${owner.id}`}>View Profile</Link>
                </Button>
              )}
            </div>

            {/* Pricing & Actions */}
            <div className="grid gap-5 mb-10">
              {card.isForSale && (
                <div className="bg-card shadow-md p-6 md:p-8 border border-border rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
                  <div className="pl-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Buy It Now</p>
                    <div className="flex items-end gap-3">
                      <p className="text-4xl md:text-5xl font-extrabold tabular-nums text-foreground tracking-tight">
                        ${Number(card.salePrice).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  {!isOwner && (
                    <Button size="lg" className="h-14 px-8 font-bold rounded-xl shadow-lg transition-all active:scale-[0.98] w-full md:w-auto text-base">
                      <CreditCard className="w-5 h-5 mr-2"/> Buy Now
                    </Button>
                  )}
                </div>
              )}

              {card.isForTrade && (
                <div className="bg-muted/50 p-6 md:p-8 border border-border rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden transition-colors hover:bg-muted/80">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-accent" />
                  <div className="pl-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Estimated Trade Value</p>
                    <p className="text-3xl font-bold tabular-nums text-foreground tracking-tight">
                      ${Number(card.tradeValue).toFixed(2)}
                    </p>
                  </div>
                  {!isOwner && (
                    <Button size="lg" variant="outline" className="h-14 px-8 font-bold rounded-xl transition-all active:scale-[0.98] w-full md:w-auto text-base bg-background" onClick={handleMakeOfferClick}>
                      <ArrowRightLeft className="w-5 h-5 mr-2"/> Make Trade Offer
                    </Button>
                  )}
                </div>
              )}

              {isOwner && (
                <div className="p-8 bg-muted/40 rounded-3xl text-center border border-border flex flex-col items-center shadow-sm">
                  <p className="font-bold text-muted-foreground mb-5">This is your listing.</p>
                  <Button variant="outline" className="font-bold rounded-xl shadow-sm h-12 px-8 bg-background" asChild>
                    <Link to={`/vault`}>Manage in Vault</Link>
                  </Button>
                </div>
              )}
            </div>
            
            {card.description && (
              <div className="pt-8 border-t border-border">
                <h3 className="text-xl font-heading font-bold mb-4 text-foreground">Item Description</h3>
                <div className="prose prose-slate dark:prose-invert max-w-none text-muted-foreground leading-relaxed">
                  <p className="whitespace-pre-wrap">{card.description}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {card.image && (
        <ImageZoomModal 
          isOpen={isZoomOpen} 
          onClose={() => setIsZoomOpen(false)} 
          imageUrl={card.image} 
          altText={card.title} 
        />
      )}

      {isTradeModalOpen && (
        <TradeOfferModal 
          isOpen={isTradeModalOpen} 
          onClose={() => setIsTradeModalOpen(false)} 
          targetCard={card} 
        />
      )}
    </div>
  );
};

export default CardDetailsPage;
