
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ZoomIn } from 'lucide-react';
import ImageZoomModal from '@/components/ImageZoomModal.jsx';
import { toast } from 'sonner';
import VerifiedBadge from '@/components/VerifiedBadge.jsx';
import SellerTierBadge from '@/components/SellerTierBadge.jsx';
import GradingVerificationBadgeSmall from '@/components/GradingVerificationBadgeSmall.jsx';
import { Badge } from '@/components/ui/badge';
import { slugify } from '@/lib/slugify.js';
import { VARIANT_BADGES } from '@/lib/cardVariants.js';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useWatchlist } from '@/hooks/useWatchlist.js';
import SellerRatingDisplay from '@/components/SellerRatingDisplay.jsx';

const GRADE_BADGE = {
  psa:   'bg-red-600 text-white',
  bgs:   'bg-blue-700 text-white',
  cgc:   'bg-green-600 text-white',
  ace:   'bg-orange-500 text-white',
  sgc:   'bg-purple-600 text-white',
  other: 'bg-slate-600 text-white',
};

const MarketplaceListingCard = ({ listing }) => {
  const [zoomOpen, setZoomOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const { isWatchlisted, toggle } = useWatchlist();
  const watchlisted = isWatchlisted(listing.id);

  const handleHeart = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      toast.error('Sign in to save listings to your watchlist');
      return;
    }
    const added = await toggle(listing.id);
    toast.success(added ? 'Added to watchlist' : 'Removed from watchlist');
  };

  const vaultItem = listing.vault_item;
  // vault_images stores storage_path; card_image may be a full URL or storage path
  const imgPath = vaultItem?.card_image || vaultItem?.vault_images?.[0]?.storage_path || null;
  const imgSrc = imgPath
    ? (imgPath.startsWith('http') ? imgPath : supabase.storage.from('vault-images').getPublicUrl(imgPath).data.publicUrl)
    : null;

  const rawVariants = vaultItem?.variant
    ? vaultItem.variant.split(',').map(s => s.trim()).filter(Boolean)
    : (Array.isArray(vaultItem?.cardVariants) ? vaultItem.cardVariants : (vaultItem?.cardVariants ? [vaultItem.cardVariants] : []));
  const variants = rawVariants;
  const specialBadge = Object.entries(VARIANT_BADGES).find(([key]) => variants.includes(key));
  const borderClass = specialBadge
    ? `${specialBadge[1].border} ${specialBadge[1].glow}`
    : 'border border-border';

  const sellerObj = listing.seller;
  const sellerId = listing.seller_id || sellerObj?.id;
  const titleSlug = slugify(vaultItem?.card_name || listing.title || 'card');
  const detailPath = `/marketplace/${listing.id}/${titleSlug}`;

  return (
    <div className={`group flex flex-col h-full bg-card rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 ${borderClass}`}>
      <Link to={detailPath} className="block relative aspect-[4/5] bg-muted/30 overflow-hidden">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={listing.title || 'Listing Image'}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            decoding="async"
            width="400"
            height="500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm font-medium">
            No Image
          </div>
        )}
        {/* Special variant badge (RC, Auto, 1st Ed) — top right */}
        {specialBadge && (
          <div className={`absolute top-3 right-3 z-10 px-2.5 py-1 rounded-full text-[11px] font-extrabold tracking-wide shadow-md ${specialBadge[1].bg} ${specialBadge[1].text}`}>
            {specialBadge[1].label}
          </div>
        )}

        {/* Grade badge + verification — bottom left (only for graded slabs) */}
        {vaultItem?.grading_company && vaultItem.grading_company !== 'raw' && vaultItem?.grade && (
          <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2">
            <div className={`px-2.5 py-1 rounded-md text-[11px] font-extrabold tracking-wide shadow-lg ${GRADE_BADGE[vaultItem.grading_company] || GRADE_BADGE.other}`}>
              {vaultItem.grading_company.toUpperCase()} {vaultItem.grade}
            </div>
            {listing.grading_number && (
              <GradingVerificationBadgeSmall
                gradingNumber={listing.grading_number}
                company={listing.grading_company || 'psa'}
                size="sm"
              />
            )}
          </div>
        )}

        {/* Serial number badge — bottom right, always visible */}
        {vaultItem?.serial_number && (
          <div className="absolute bottom-3 right-3 z-10 pointer-events-none">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold tracking-wide bg-black/70 text-white backdrop-blur-sm border border-white/10 shadow-md">
              <span className="opacity-60">#</span>{vaultItem.serial_number}
            </span>
          </div>
        )}

        {/* Watchlist heart — bottom right (shifts up when serial badge present) */}
        <button
          onClick={handleHeart}
          aria-label={watchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
          className={`absolute z-10 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-all duration-200 ${vaultItem?.serial_number ? 'bottom-11 right-3' : 'bottom-3 right-3'} ${
            watchlisted
              ? 'bg-rose-500 text-white scale-110'
              : 'bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-rose-500 hover:bg-background'
          }`}
        >
          <Heart className={`w-4 h-4 ${watchlisted ? 'fill-current' : ''}`} />
        </button>

        {/* Zoom button */}
        {imgSrc && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setZoomOpen(true); }}
            aria-label="Zoom image"
            className="absolute bottom-3 left-3 z-10 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm text-foreground flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-background"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        )}
      </Link>

      <ImageZoomModal
        isOpen={zoomOpen}
        onClose={() => setZoomOpen(false)}
        imageUrl={imgSrc}
        altText={listing.title || 'Card Image'}
      />
      
      <div className="p-5 flex flex-col flex-1">
        <Link to={detailPath} className="block mb-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
            {listing.category || vaultItem?.collection || 'Trading Card'}
          </p>
          <h3 className="font-bold text-base leading-snug line-clamp-2 text-foreground group-hover:text-primary transition-colors mb-1">
            {vaultItem?.card_name || listing.title || 'Untitled Listing'}
          </h3>
          {vaultItem?.set_name && (
            <p className="text-xs text-muted-foreground mb-2 truncate">{vaultItem.set_name}</p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {vaultItem?.parallel?.name && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 leading-none">
                {vaultItem.parallel.name}
              </span>
            )}
            {vaultItem?.subset?.name && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300 leading-none">
                {vaultItem.subset.name}
              </span>
            )}
            {vaultItem?.year && (
              <Badge variant="secondary" className="text-[10px] font-medium bg-muted/50 text-muted-foreground">{vaultItem.year}</Badge>
            )}
            {vaultItem?.card_number && (
              <Badge variant="secondary" className="text-[10px] font-medium bg-muted/50 text-muted-foreground">#{vaultItem.card_number}</Badge>
            )}
            {vaultItem?.condition && (
              <Badge variant="secondary" className="text-[10px] font-medium bg-muted/50 text-muted-foreground capitalize">{vaultItem.condition.replace(/_/g, ' ')}</Badge>
            )}
            {vaultItem?.is_foil && <Badge variant="outline" className="text-[10px] font-bold border-yellow-400/50 text-yellow-700 bg-yellow-400/10">Foil</Badge>}
            {vaultItem?.is_refractor && <Badge variant="outline" className="text-[10px] font-bold border-indigo-400/50 text-indigo-700 bg-indigo-400/10">Refractor</Badge>}
            {vaultItem?.is_auto && (
              <Badge variant="outline" className="text-[10px] font-bold border-blue-400/50 text-blue-700 bg-blue-400/10">
                {[
                  vaultItem.auto_signers > 1 ? ['','Dual','Triple','Quad'][vaultItem.auto_signers - 1] : null,
                  {on_card:'On-Card',sticker:'Sticker',cut:'Cut Sig',licensed:'Licensed',in_person:'IP'}[vaultItem.auto_type] ?? null,
                  'Auto',
                ].filter(Boolean).join(' ')}
              </Badge>
            )}
            {vaultItem?.is_rookie && <Badge variant="outline" className="text-[10px] font-bold border-amber-400/50 text-amber-700 bg-amber-400/10">RC</Badge>}
            {vaultItem?.is_sealed && <Badge variant="outline" className="text-[10px] font-bold border-green-400/50 text-green-700 bg-green-400/10">Sealed</Badge>}
            {variants.map(v => (
              <Badge key={v} variant="outline" className="text-[10px] font-bold border-primary/30 text-primary bg-primary/5">{v}</Badge>
            ))}
          </div>
        </Link>
        
        <div className="mt-auto pt-4 flex flex-col gap-3 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-xl tabular-nums text-foreground">
              ${(listing.price_aud || 0).toFixed(2)}
            </span>
          </div>
          
          {sellerId && (
            <Link 
              to={`/seller/${sellerId}`} 
              className="flex items-center gap-2 group/seller p-2 -mx-2 rounded-xl hover:bg-muted/50 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                {sellerObj?.avatar_url ? (
                  <img src={sellerObj.avatar_url} alt={sellerObj.display_name || 'Seller'} className="w-full h-full object-cover" width="32" height="32" decoding="async" />
                ) : (
                  (sellerObj?.display_name || sellerObj?.username || 'S')[0].toUpperCase()
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-bold text-foreground truncate group-hover/seller:text-primary transition-colors">
                    {sellerObj?.display_name || sellerObj?.username || 'Community Seller'}
                  </span>
                  {sellerObj?.is_verified && <VerifiedBadge size="sm" />}
                  {sellerObj?.seller_tier && sellerObj.seller_tier !== 'none' && (
                    <SellerTierBadge tier={sellerObj.seller_tier} size="xs" />
                  )}
                </div>
                <SellerRatingDisplay sellerId={sellerId} compact={true} />
              </div>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default MarketplaceListingCard;
