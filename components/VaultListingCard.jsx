
import React from 'react';
import { Link } from 'react-router-dom';
import { Star, ShieldCheck, Lock, ShoppingCart, ArrowRightLeft, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { slugify } from '@/lib/slugify.js';
import { VARIANT_BADGES } from '@/lib/cardVariants.js';

const getStatusBadge = (listingType) => {
  switch (listingType) {
    case 'Private': return { className: 'badge-vault-private', icon: Lock };
    case 'For Sale': return { className: 'badge-vault-sale', icon: ShoppingCart };
    case 'For Trade': return { className: 'badge-vault-trade', icon: ArrowRightLeft };
    case 'For Sale & Trade': return { className: 'badge-vault-both', icon: Layers };
    default: return { className: 'bg-muted text-muted-foreground', icon: Lock };
  }
};

const VaultListingCard = ({ vaultItem }) => {
  const imgSrc = vaultItem.vault_images?.[0]?.image_url || vaultItem.image_url || null;
  const sellerId = vaultItem.user_id || vaultItem.owner_id;
  const sellerObj = vaultItem.profiles || vaultItem.expand?.user_id || null;
  const titleSlug = slugify(vaultItem.card_name || vaultItem.name || vaultItem.title || 'card');
  const detailPath = `/product/vault/${vaultItem.id}/${titleSlug}`;

  const badgeConfig = getStatusBadge(vaultItem.listing_type);
  const StatusIcon = badgeConfig.icon;
  const variants = Array.isArray(vaultItem.cardVariants) ? vaultItem.cardVariants : [];
  const specialBadge = Object.entries(VARIANT_BADGES).find(([key]) => variants.includes(key));
  const extraVariants = variants.filter(v => !VARIANT_BADGES[v]).slice(0, 2);

  return (
    <div className="group flex flex-col h-full bg-card rounded-2xl border border-border overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
      <Link to={detailPath} className="block relative aspect-[4/5] bg-muted/30 overflow-hidden">
        {imgSrc ? (
          <img 
            src={imgSrc}
            alt={vaultItem.card_name || vaultItem.name || 'Vault Image'}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm font-medium">
            No Image
          </div>
        )}
        <div className="absolute top-3 left-3 z-10">
          <Badge className={`shadow-sm font-bold ${badgeConfig.className}`}>
            <StatusIcon className="w-3 h-3 mr-1.5" /> {vaultItem.listing_type || 'Private'}
          </Badge>
        </div>
        {specialBadge && (
          <div className={`absolute top-3 right-3 z-10 px-2 py-0.5 rounded-full text-[11px] font-extrabold shadow ${specialBadge[1].bg} ${specialBadge[1].text}`}>
            {specialBadge[1].label}
          </div>
        )}
      </Link>
      
      <div className="p-5 flex flex-col flex-1">
        <Link to={detailPath} className="block mb-3">
          <h3 className="font-bold text-base leading-snug line-clamp-2 text-foreground group-hover:text-primary transition-colors mb-2">
            {vaultItem.card_name || vaultItem.name || 'Untitled Vault Item'}
          </h3>
          
          <div className="flex flex-wrap gap-1.5">
            {vaultItem.category && (
              <Badge variant="secondary" className="text-[10px] font-medium bg-muted/50 text-muted-foreground">
                Cat: {vaultItem.category}
              </Badge>
            )}
            {vaultItem.subcategory && (
              <Badge variant="secondary" className="text-[10px] font-medium bg-muted/50 text-muted-foreground">
                Sub: {vaultItem.subcategory}
              </Badge>
            )}
            {vaultItem.brand && (
              <Badge variant="secondary" className="text-[10px] font-medium bg-muted/50 text-muted-foreground">
                Brand: {vaultItem.brand}
              </Badge>
            )}
            {vaultItem.series && (
              <Badge variant="secondary" className="text-[10px] font-medium bg-muted/50 text-muted-foreground">
                Series: {vaultItem.series}
              </Badge>
            )}
            {variants.slice(0, 3).map(v => (
              <Badge key={v} variant="outline" className="text-[10px] font-bold border-primary/30 text-primary bg-primary/5">
                {v}
              </Badge>
            ))}
          </div>
        </Link>
        
        <div className="mt-auto pt-4 flex flex-col gap-3 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-xl tabular-nums text-foreground">
              ${(vaultItem.estimated_value_aud || 0).toFixed(2)}
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
                  (sellerObj?.display_name || sellerObj?.name || 'U')[0].toUpperCase()
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-foreground truncate group-hover/seller:text-primary transition-colors">
                    {sellerObj?.display_name || sellerObj?.name || 'Vault Owner'}
                  </span>
                  {sellerObj?.is_verified === 'true' && (
                    <ShieldCheck className="w-3.5 h-3.5 text-[hsl(var(--verified-badge))] shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <Star className="w-3 h-3 fill-[hsl(var(--rating-color))] text-[hsl(var(--rating-color))]" />
                  <span>{sellerObj?.rating ? sellerObj.rating.toFixed(1) : 'New'}</span>
                  {sellerObj?.reviews_count > 0 && <span>({sellerObj.reviews_count})</span>}
                </div>
              </div>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default VaultListingCard;
