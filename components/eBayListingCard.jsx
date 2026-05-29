
import React from 'react';
import { ExternalLink, Star, ImageOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const EbayListingCard = ({ listing }) => {
  if (!listing) return null;

  const handleViewOnEbay = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (listing.listingUrl) {
      window.open(listing.listingUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="group bg-card border border-border rounded-2xl overflow-hidden hover:shadow-xl hover:border-primary/40 transition-all duration-300 hover:-translate-y-1 flex flex-col h-full">
      <div className="aspect-[4/5] bg-muted/40 relative flex items-center justify-center overflow-hidden border-b border-border/50">
        {listing.thumbnailUrl || listing.imageUrl ? (
          <img 
            src={listing.thumbnailUrl || listing.imageUrl} 
            alt={listing.title || 'eBay Listing'} 
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-700 ease-out" 
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center text-muted-foreground opacity-50">
            <ImageOff className="w-12 h-12 mb-2" />
            <span className="text-xs font-bold uppercase tracking-wider">No Image</span>
          </div>
        )}
        
        <div className="absolute top-3 left-3 z-10 pointer-events-none">
          <Badge className="bg-white text-black hover:bg-white shadow-md font-bold tracking-tight border border-gray-200">
            <span className="text-[#CE1126]">e</span>
            <span className="text-[#0064d2]">B</span>
            <span className="text-[#f5af02]">a</span>
            <span className="text-[#86b817]">y</span>
          </Badge>
        </div>

        <div className="absolute top-3 right-3 z-10 pointer-events-none">
          <Badge variant="secondary" className="shadow-sm font-bold tracking-wider uppercase text-[10px] backdrop-blur-md bg-background/80">
            {listing.condition || 'Unknown'}
          </Badge>
        </div>
      </div>
      
      <div className="p-5 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-2 gap-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">
            Item #{listing.itemId || 'N/A'}
          </p>
          <div className="flex items-center gap-1 text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0">
            <Star className="w-3 h-3 fill-current" />
            {listing.sellerRating ? `${listing.sellerRating}%` : 'N/A'}
            <span className="text-muted-foreground ml-1">({listing.feedbackCount || 0})</span>
          </div>
        </div>
        
        <h3 className="font-serif font-bold text-lg line-clamp-2 mb-2 text-balance leading-tight group-hover:text-primary transition-colors" title={listing.title}>
          {listing.title || 'Unknown Item'}
        </h3>
        
        <div className="text-xs text-muted-foreground flex items-center gap-1.5 truncate mb-4">
          <span className="truncate font-medium">Sold by: <span className="text-foreground">{listing.sellerUsername || listing.sellerName || 'Unknown Seller'}</span></span>
        </div>
        
        <div className="mt-auto pt-4 border-t border-border flex items-center justify-between gap-4">
          <div className="flex flex-col relative">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-0.5">Price</span>
            <span className="font-extrabold text-xl tabular-nums tracking-tight text-foreground">
              ${Number(listing.price || 0).toFixed(2)}
            </span>
          </div>
          
          <Button 
            size="sm" 
            className="rounded-xl shadow-sm active:scale-95 transition-all hover:bg-primary/90" 
            onClick={handleViewOnEbay}
          >
            View
            <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EbayListingCard;
