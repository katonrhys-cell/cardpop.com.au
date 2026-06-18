
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, ShieldCheck, ImageOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/api/EcommerceApi.js';

const FeaturedProductCard = ({ product, seller }) => {
  const navigate = useNavigate();
  const [imageError, setImageError] = useState(false);

  if (!product || !product.id) return null;

  // Safely extract text fields with fallbacks
  const title = product.name || product.title || product.cardName || 'Unknown Product';
  const category = product.collectionType || product.category || 'Trading Card';
  const condition = product.condition || 'Ungraded';
  const grade = product.grade || product.gradeText || product.gradeScore;
  const priceVal = product.price || product.estimatedValue || product.askingPrice || product.salePrice || 0;

  // Formatting price via shared ECommerce logic
  const priceInCents = Math.round(priceVal * 100);
  const formattedPrice = formatCurrency(priceInCents, null) || `$${(priceInCents / 100).toFixed(2)}`;

  // Handle both vault_items (images) and set_cards (image/cardImage) fields
  let imageUrl = null;
  try {
    if (!imageError) {
      const pickUrl = (val) => {
        if (!val) return null;
        const f = Array.isArray(val) ? val[0] : val;
        return f && typeof f === 'string' && f.startsWith('http') ? f : null;
      };
      imageUrl = pickUrl(product.images) || pickUrl(product.image) || pickUrl(product.cardImage) || null;
    }
  } catch (err) {
    console.warn('Error generating image URL for product:', product.id, err);
  }

  const handleCardClick = () => {
    if (product.id) {
      // Unified product route requires a source segment (/product/:source/:id);
      // featured cards come from vault_items, so default the source to 'vault'.
      navigate(`/product/${product.source || 'vault'}/${product.id}`);
    }
  };

  const renderStars = (rating) => {
    const numRating = Number(rating) || 5; 
    return (
      <div className="flex items-center gap-0.5">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`w-3 h-3 ${i < numRating ? 'fill-primary text-primary' : 'fill-muted text-muted-foreground'}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div 
      onClick={handleCardClick}
      className="group flex flex-col h-full bg-card rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:border-primary/40 hover:-translate-y-1 border border-border cursor-pointer"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick(); }}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-muted flex items-center justify-center border-b border-border/50">
        {imageUrl && !imageError ? (
          <img
            src={imageUrl}
            alt={title}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            decoding="async"
            width="300"
            height="400"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-muted-foreground/50">
            <ImageOff className="w-12 h-12 mb-2" />
            <span className="text-xs font-bold uppercase tracking-wider">No Image</span>
          </div>
        )}
        <div className="absolute top-3 left-3 flex flex-col gap-2 z-10 pointer-events-none">
          <Badge variant="secondary" className="bg-background/90 text-foreground backdrop-blur-sm font-bold shadow-sm">
            {condition}
          </Badge>
          {grade && (
            <Badge className="bg-primary/90 text-primary-foreground backdrop-blur-sm flex items-center gap-1 font-bold shadow-sm border-none">
              <ShieldCheck className="w-3 h-3" />
              {grade}
            </Badge>
          )}
        </div>
      </div>

      <div className="p-5 flex flex-col flex-grow bg-card">
        <div className="mb-1 text-xs font-bold text-muted-foreground tracking-wider uppercase line-clamp-1">
          {category}
        </div>
        
        <h3 className="font-serif text-lg font-bold leading-tight mb-4 text-balance text-card-foreground group-hover:text-primary transition-colors line-clamp-2">
          {title}
        </h3>
        
        <div className="mt-auto pt-4 flex items-end justify-between border-t border-border">
          <div>
            <p className="text-[10px] text-muted-foreground mb-1 font-bold uppercase tracking-widest">Seller</p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold truncate max-w-[100px] text-card-foreground">
                {seller?.name || 'Vault Member'}
              </span>
              {renderStars(seller?.rating || 5)}
            </div>
          </div>
          
          <div className="text-right flex flex-col">
            <span className="text-xl font-extrabold tabular-nums tracking-tight text-card-foreground">
              {formattedPrice}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeaturedProductCard;
