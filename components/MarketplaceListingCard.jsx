
import React from 'react';
import { Link } from 'react-router-dom';
import { Star, ShieldCheck, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { slugify } from '@/lib/slugify.js';
import { supabase } from '@/lib/supabaseClient.js';
import SellerRatingDisplay from '@/components/SellerRatingDisplay.jsx';
import WishlistButton from '@/components/WishlistButton.jsx';

const GRADE_BADGE = {
  psa:   'bg-red-600 text-white',
  bgs:   'bg-blue-700 text-white',
  cgc:   'bg-green-600 text-white',
  ace:   'bg-orange-500 text-white',
  sgc:   'bg-purple-600 text-white',
  other: 'bg-slate-600 text-white',
};

const MarketplaceListingCard = ({ listing }) => {
  const vaultItem = listing.vault_item;
  // vault_images stores storage_path; card_image may be a full URL or storage path
  const imgPath = vaultItem?.card_image || vaultItem?.vault_images?.[0]?.storage_path || null;
  const imgSrc = imgPath
    ? (imgPath.startsWith('http') ? imgPath : supabase.storage.from('vault-images').getPublicUrl(imgPath).data.publicUrl)
    : null;
  const sellerObj = listing.seller;
  const sellerId = listing.seller_id || sellerObj?.id;
  const titleSlug = slugify(vaultItem?.card_name || listing.title || 'card');
  const detailPath = `/product/marketplace/${listing.id}/${titleSlug}`;

  return (
    <div className="group flex flex-col h-full bg-card rounded-2xl border border-border overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
      <Link to={detailPath} className="block relative aspect-[4/5] bg-muted/30 overflow-hidden">
        {imgSrc ? (
          <img 
            src={imgSrc} 
            alt={listing.title || 'Listing Image'} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm font-medium">
            No Image
          </div>
        )}
        {/* Marketplace label — top right */}
        <div className="absolute top-3 right-3 z-10 flex gap-2">
          <Badge className="shadow-sm font-bold bg-secondary text-secondary-foreground">
            <Tag className="w-3 h-3 mr-1" /> Marketplace
          </Badge>
          <WishlistButton itemId={listing.id} itemType="listing" className="bg-white/90 backdrop-blur-sm shadow-sm" />
        </div>

        {/* Rookie badge — top left */}
        {vaultItem?.is_rookie && (
          <div className="absolute top-3 left-3 z-10 px-2 py-1 rounded-md text-[11px] font-extrabold tracking-wide bg-amber-400 text-amber-900 shadow-md">
            RC
          </div>
        )}

        {/* Grade badge — bottom left (only for graded slabs) */}
        {vaultItem?.grading_company && vaultItem.grading_company !== 'raw' && vaultItem?.grade && (
          <div className={`absolute bottom-3 left-3 z-10 px-2.5 py-1 rounded-md text-[11px] font-extrabold tracking-wide shadow-lg ${GRADE_BADGE[vaultItem.grading_company] || GRADE_BADGE.other}`}>
            {vaultItem.grading_company.toUpperCase()} {vaultItem.grade}
          </div>
        )}
      </Link>
      
      <div className="p-5 flex flex-col flex-1">
        <Link to={detailPath} className="block mb-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
            {listing.category || 'Trading Card'}
          </p>
          <h3 className="font-bold text-base leading-snug line-clamp-2 text-foreground group-hover:text-primary transition-colors">
            {vaultItem?.card_name || listing.title || 'Untitled Listing'}
          </h3>
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
                  <img src={sellerObj.avatar_url} alt={sellerObj.display_name || 'Seller'} className="w-full h-full object-cover" />
                ) : (
                  (sellerObj?.display_name || sellerObj?.username || 'S')[0].toUpperCase()
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-foreground truncate group-hover/seller:text-primary transition-colors">
                    {sellerObj?.display_name || sellerObj?.username || 'Community Seller'}
                  </span>
                  {sellerObj?.is_verified && (
                    <ShieldCheck className="w-3.5 h-3.5 text-[hsl(var(--verified-badge))] shrink-0" />
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
