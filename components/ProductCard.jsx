
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, ShieldCheck, ZoomIn, ShoppingCart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { slugify } from '@/lib/slugify.js';
import { getAutographLabel, getRefractorLabel, getRefractorBadgeClass, genericVariantChips } from '@/lib/cardAttributeLabels.js';
import CardMicroscope from '@/components/CardMicroscope.jsx';
import CardImage from '@/components/CardImage.jsx';
import CardShowcase from '@/components/vault/CardShowcase.jsx';
import BnplMessage from '@/components/BnplMessage.jsx';
import { getCardImage, CARD_GRID_SIZES, toCdnUrl } from '@/utils/imageUrl.js';
import { isVerified } from '@/utils/verification.js';
import GradeBadge from '@/components/GradeBadge.jsx';
import { ROOKIE_VARIANT } from '@/lib/cardVariants.js';
import RookiePill from '@/components/RookiePill.jsx';

const ProductCard = ({ product, onAddToCart, priority = false }) => {
  const [zoomOpen, setZoomOpen] = useState(false);
  const variants = (product.variant || product.cardVariant || '').split(',').map(v => v.trim()).filter(Boolean);
  const isRookie = variants.includes(ROOKIE_VARIANT) || !!(product.is_rookie || product.isRookie);
  const autoLabel = getAutographLabel(product);
  const rawImg = product.images?.[0] || product.cardImage?.[0] || product.card_image || product.image_url || null;
  const { src: imgSrc, srcSet: imgSrcSet, fallbackSrc: imgFallback, thumbSrc: imgThumb } = getCardImage(rawImg);
  const sellerId = product.seller_id || product.seller || product.owner_id || product.owner || product.user_id;
  const sellerObj = product.expand?.seller_id || product.expand?.seller || product.expand?.owner || product.expand?.user_id;
  const titleSlug = slugify(product.name || product.cardName || product.title || 'card');
  const detailPath = product.source === 'marketplace'
    ? `/marketplace/${product.id}/${titleSlug}`
    : `/product/${product.source || 'vault'}/${product.id}/${titleSlug}`;
  const gradingCompany = product.grading_company || product.gradingCompany || '';
  const isGraded = gradingCompany && gradingCompany !== 'raw' && product.grade;
  // Vault listings render through the Card Showcase Engine (their chosen display
  // style); shop products show the full uncropped image (object-contain) so the
  // whole card scan is visible. display_style is a vault-only field, so its
  // presence reliably marks a vault item.
  const useShowcase = product.source === 'vault' || !!product.display_style;

  return (
    <div className="group flex flex-col h-full bg-card rounded-2xl border border-border overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
      <Link to={detailPath} className="block relative aspect-[4/5] bg-muted/30 overflow-hidden">
        {useShowcase ? (
          <CardShowcase
            src={imgSrc}
            srcSet={imgSrcSet}
            sizes={CARD_GRID_SIZES}
            fallbackSrc={imgFallback}
            thumbSrc={imgThumb}
            alt={product.name || product.cardName || product.title || 'Product Image'}
            displayStyle={product.display_style}
            width="400"
            height="500"
            priority={priority}
          />
        ) : (
          <CardImage
            src={imgSrc}
            srcSet={imgSrcSet}
            sizes={CARD_GRID_SIZES}
            fallbackSrc={imgFallback}
            alt={product.name || product.cardName || product.title || 'Product Image'}
            imgClassName="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-500"
            width="400"
            height="500"
            priority={priority}
          />
        )}
        {/* Condition badge — top left */}
        {product.condition && (
          <div className="absolute top-3 left-3 z-10">
            <Badge variant="secondary" className="shadow-sm font-bold backdrop-blur-md bg-background/80">
              {product.condition}
            </Badge>
          </div>
        )}

        {/* Grade badge — bottom left (only for graded slabs) */}
        {isGraded && (
          <GradeBadge grade={product.grade} gradingCompany={gradingCompany} />
        )}

        {/* Serial number badge — bottom right */}
        {(product.serial_number || product.serialNumber) && (
          <div className={`absolute z-10 pointer-events-none ${isGraded ? 'bottom-11 right-3' : 'bottom-3 right-3'}`}>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold tracking-wide bg-black/70 text-white backdrop-blur-sm border border-white/10 shadow-md">
              <span className="opacity-60">#</span>{product.serial_number || product.serialNumber}
            </span>
          </div>
        )}

        {/* Zoom button */}
        {imgSrc && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setZoomOpen(true); }}
            aria-label="Zoom image"
            className="absolute bottom-3 right-3 z-10 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm text-foreground flex items-center justify-center shadow-md opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200 hover:bg-background"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        )}
      </Link>

      <CardMicroscope
        isOpen={zoomOpen}
        onClose={() => setZoomOpen(false)}
        imageUrl={imgSrc}
        altText={product.name || product.cardName || product.title || 'Card Image'}
      />
      
      <div className="p-5 flex flex-col flex-1">
        <Link to={detailPath} className="block mb-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
            {product.category || product.collectionType || 'Trading Card'}
          </p>
          <h3 className="font-bold text-base leading-snug line-clamp-2 text-foreground group-hover:text-primary transition-colors mb-1">
            {product.name || product.cardName || product.title || 'Untitled Card'}
          </h3>
          {(product.set_name || product.setName) && (
            <p className="text-xs text-muted-foreground mb-2 truncate">{product.set_name || product.setName}</p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {(product.year) && (
              <Badge variant="secondary" className="text-[10px] font-medium bg-muted/50 text-muted-foreground">{product.year}</Badge>
            )}
            {(product.card_number || product.cardNumber) && (
              <Badge variant="secondary" className="text-[10px] font-medium bg-muted/50 text-muted-foreground">#{product.card_number || product.cardNumber}</Badge>
            )}
            {product.condition && (
              <Badge variant="secondary" className="text-[10px] font-medium bg-muted/50 text-muted-foreground capitalize">{product.condition.replace(/_/g, ' ')}</Badge>
            )}
            {(product.is_foil || product.isFoil) && <Badge variant="outline" className="text-[10px] font-bold border-yellow-400/50 text-yellow-800 bg-yellow-400/10">Foil</Badge>}
            {getRefractorLabel(product) && <Badge variant="outline" className={`text-[10px] font-bold ${getRefractorBadgeClass(product)}`}>{getRefractorLabel(product)}</Badge>}
            {autoLabel && <Badge variant="outline" className="text-[10px] font-bold border-blue-400/50 text-blue-700 bg-blue-400/10">{autoLabel}</Badge>}
            {isRookie && <RookiePill />}
            {(product.is_sealed || product.isSealed) && <Badge variant="outline" className="text-[10px] font-bold border-green-400/50 text-green-800 bg-green-400/10">Sealed</Badge>}
            {genericVariantChips(variants).map(v => (
              <Badge key={v} variant="outline" className="text-[10px] font-bold border-primary/30 text-primary bg-primary/5">{v}</Badge>
            ))}
          </div>
        </Link>
        
        <div className="mt-auto pt-4 flex flex-col gap-3 border-t border-border">
          <div className="flex items-center justify-between gap-2">
            {product.retail_price_aud && Number(product.price ?? product.price_aud) < Number(product.retail_price_aud) ? (
              <div className="flex items-baseline gap-2">
                <span className="font-extrabold text-xl tabular-nums text-foreground">
                  ${Number(product.price ?? product.price_aud ?? 0).toFixed(2)}
                </span>
                <span className="text-sm text-muted-foreground line-through">
                  ${Number(product.retail_price_aud).toFixed(2)}
                </span>
              </div>
            ) : (
              <span className="font-extrabold text-xl tabular-nums text-foreground">
                ${Number(product.price ?? product.price_aud ?? product.askingPrice ?? product.estimatedValue ?? 0).toFixed(2)}
              </span>
            )}
          </div>

          <BnplMessage amount={product.price ?? product.price_aud ?? product.askingPrice ?? product.estimatedValue} className="-mt-1" />

          {onAddToCart && (
            <Button
              size="sm"
              className="w-full rounded-xl font-bold"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAddToCart(product); }}
            >
              <ShoppingCart className="w-4 h-4 mr-2" /> Add to Cart
            </Button>
          )}

          {sellerId && (
            <Link 
              to={`/seller/${sellerId}`} 
              className="flex items-center gap-2 group/seller p-2 -mx-2 rounded-xl hover:bg-muted/50 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                {sellerObj?.profile_photo_or_character ? (
                  <img src={toCdnUrl(sellerObj.profile_photo_or_character)} alt={sellerObj.display_name || 'Seller'} className="w-full h-full object-cover" width="32" height="32" decoding="async" />
                ) : (
                  (sellerObj?.display_name || sellerObj?.name || 'S')[0].toUpperCase()
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-foreground truncate group-hover/seller:text-primary transition-colors">
                    {sellerObj?.display_name || sellerObj?.name || 'Community Seller'}
                  </span>
                  {isVerified(sellerObj?.is_verified) && (
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

export default ProductCard;
