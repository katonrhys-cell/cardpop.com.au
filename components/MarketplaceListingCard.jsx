
import React from 'react';
import { Link } from 'react-router-dom';
import { Star, ShieldCheck, Tag } from 'lucide-react';
import pb from '@/lib/pocketbaseClient.js';
import { Badge } from '@/components/ui/badge';
import { slugify } from '@/lib/slugify.js';

const MarketplaceListingCard = ({ listing }) => {
  const imageUrl = listing.images?.[0];
  const imgSrc = imageUrl ? pb.files.getUrl(listing, imageUrl) : null;
  const sellerId = listing.seller;
  const sellerObj = listing.expand?.seller;
  const titleSlug = slugify(listing.title || 'card');
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
        <div className="absolute top-3 right-3 z-10">
          <Badge className="shadow-sm font-bold bg-secondary text-secondary-foreground">
            <Tag className="w-3 h-3 mr-1" /> Marketplace
          </Badge>
        </div>
      </Link>
      
      <div className="p-5 flex flex-col flex-1">
        <Link to={detailPath} className="block mb-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
            {listing.category || 'Trading Card'}
          </p>
          <h3 className="font-bold text-base leading-snug line-clamp-2 text-foreground group-hover:text-primary transition-colors">
            {listing.title || 'Untitled Listing'}
          </h3>
        </Link>
        
        <div className="mt-auto pt-4 flex flex-col gap-3 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-xl tabular-nums text-foreground">
              ${(listing.price || 0).toFixed(2)}
            </span>
          </div>
          
          {sellerId && (
            <Link 
              to={`/seller/${sellerId}`} 
              className="flex items-center gap-2 group/seller p-2 -mx-2 rounded-xl hover:bg-muted/50 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                {sellerObj?.profile_photo_or_character ? (
                  <img src={pb.files.getUrl(sellerObj, sellerObj.profile_photo_or_character)} alt={sellerObj.display_name || 'Seller'} className="w-full h-full object-cover" />
                ) : (
                  (sellerObj?.display_name || sellerObj?.name || 'S')[0].toUpperCase()
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-foreground truncate group-hover/seller:text-primary transition-colors">
                    {sellerObj?.display_name || sellerObj?.name || 'Community Seller'}
                  </span>
                  {sellerObj?.is_verified === 'true' && (
                    <ShieldCheck className="w-3.5 h-3.5 text-[hsl(var(--verified-badge))] shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <Star className="w-3 h-3 fill-[hsl(var(--rating-color))] text-[hsl(var(--rating-color))]" />
                  <span>{sellerObj?.rating ? sellerObj.rating.toFixed(1) : 'New'}</span>
                  {sellerObj?.reviewsCount > 0 && <span>({sellerObj.reviewsCount})</span>}
                </div>
              </div>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default MarketplaceListingCard;
