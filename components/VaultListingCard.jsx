
import React, { useState, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { Star, ShieldCheck, ZoomIn } from 'lucide-react';
// Lazy: the zoom modal drags framer-motion (~110 kB) with it, and this card
// renders on the homepage — load the modal only when a zoom is opened.
const ImageZoomModal = lazy(() => import('@/components/ImageZoomModal.jsx'));
import CardShowcase from '@/components/vault/CardShowcase.jsx';
import { Badge } from '@/components/ui/badge';
import { slugify } from '@/lib/slugify.js';
import { VARIANT_BADGES, ROOKIE_VARIANT } from '@/lib/cardVariants.js';
import RookiePill from '@/components/RookiePill.jsx';
import { getAutographLabel, getRefractorLabel, getRefractorBadgeClass, genericVariantChips } from '@/lib/cardAttributeLabels.js';
import { getCardImage, CARD_GRID_SIZES } from '@/utils/imageUrl.js';
import ProfileAvatar from '@/components/ProfileAvatar.jsx';
import { vaultItemListing } from '@/lib/vaultItemListing.js';
import SoldBadge from '@/components/SoldBadge.jsx';
import { isVerified } from '@/utils/verification.js';
import GradeBadge, { GRADE_BADGE } from '@/components/GradeBadge.jsx';
import { getVaultListingBadge } from '@/utils/vaultListingBadge.js';

const VaultListingCard = ({ vaultItem, listing, priority = false }) => {
  const [zoomOpen, setZoomOpen] = useState(false);
  // A sold card keeps its place in the grid, badged "Sold" — same treatment as
  // MarketplaceListingCard. The vault row itself never records the sale (it
  // still says "For Sale"), so the listing embedded by VAULT_ITEM_CARD_SELECT
  // is the only source of truth; without it a sold card advertises itself as
  // available on the homepage and every seller store.
  const liveListing = vaultItemListing(vaultItem, listing);
  const isSold = liveListing?.status === 'sold';
  // Try every place a photo may be stored, in priority order. Featured cards
  // promoted onto the homepage often have their only photo in `card_image` (a
  // storage path) with no `vault_images` rows, and some carry extra shots in
  // the `card_images` array — so fall through all of them before giving up.
  const rawImg =
    vaultItem.vault_images?.[0]?.storage_path ||
    vaultItem.card_image ||
    vaultItem.card_images?.[0] ||
    vaultItem.vault_images?.[0]?.image_url ||
    vaultItem.image_url ||
    null;
  const { src: imgSrc, srcSet: imgSrcSet, fallbackSrc: imgFallback, canonicalSrc: imgCanonical, thumbSrc: imgThumb } = getCardImage(rawImg);
  const sellerObj = vaultItem.profiles || vaultItem.owner || vaultItem.seller || vaultItem.expand?.user_id || null;
  const sellerId = vaultItem.user_id || vaultItem.owner_id || sellerObj?.id;
  const titleSlug = slugify(vaultItem.card_name || vaultItem.name || vaultItem.title || 'card');

  // Link to marketplace listing if available, otherwise to vault detail
  const detailPath = liveListing
    ? `/marketplace/${liveListing.id}/${titleSlug}`
    : `/product/vault/${vaultItem.id}/${titleSlug}`;

  const badgeConfig = getVaultListingBadge(vaultItem.listing_type);
  const StatusIcon = badgeConfig.icon;
  const rawVariants = vaultItem.variant
    ? vaultItem.variant.split(',').map(s => s.trim()).filter(Boolean)
    : (Array.isArray(vaultItem.cardVariants) ? vaultItem.cardVariants : (vaultItem.cardVariants ? [vaultItem.cardVariants] : []));
  const variants = rawVariants;
  const specialBadge = Object.entries(VARIANT_BADGES).find(([key]) => variants.includes(key));
  // Image overlay badge — rookie is excluded (overlay: false): its one
  // reference is the RookiePill under the card.
  const overlayBadge = Object.entries(VARIANT_BADGES).find(([key, cfg]) => cfg.overlay !== false && variants.includes(key));
  const isRookie = variants.includes(ROOKIE_VARIANT) || !!vaultItem.is_rookie;
  const autoLabel = getAutographLabel(vaultItem);
  const borderClass = specialBadge
    ? `${specialBadge[1].border} ${specialBadge[1].glow}`
    : 'border border-border';

  return (
    <div className={`group flex flex-col h-full bg-card rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 ${borderClass} ${isSold ? 'opacity-95' : ''}`}>
      <Link to={detailPath} className="block relative aspect-[4/5] bg-muted/30 overflow-hidden">
        <CardShowcase
          src={imgSrc}
          srcSet={imgSrcSet}
          sizes={CARD_GRID_SIZES}
          fallbackSrc={imgFallback}
          canonicalSrc={imgCanonical}
          thumbSrc={imgThumb}
          alt={vaultItem.card_name || vaultItem.name || 'Vault Image'}
          displayStyle={vaultItem.display_style}
          width="400"
          height="500"
          priority={priority}
        />
        <div className="absolute top-3 left-3 z-10">
          {isSold ? (
            <SoldBadge />
          ) : (
            <Badge className={`shadow-sm font-bold ${badgeConfig.className}`}>
              <StatusIcon className="w-3 h-3 mr-1.5" /> {badgeConfig.label}
            </Badge>
          )}
        </div>
        {overlayBadge && (
          <div className={`absolute top-3 right-3 z-10 px-2.5 py-1 rounded-full text-[11px] font-extrabold tracking-wide shadow-md ${overlayBadge[1].bg} ${overlayBadge[1].text}`}>
            {overlayBadge[1].label}
          </div>
        )}

        {/* Grade badge — bottom left (only for graded slabs) */}
        {vaultItem?.grading_company && vaultItem.grading_company !== 'raw' && vaultItem?.grade && (
          <GradeBadge grade={vaultItem.grade} gradingCompany={vaultItem.grading_company} />
        )}

        {/* Serial number badge — bottom-right, always visible */}
        {vaultItem.serial_number && (
          <div className="absolute bottom-3 right-3 z-10 pointer-events-none">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold tracking-wide bg-black/70 text-white backdrop-blur-sm border border-white/10 shadow-md">
              <span className="opacity-60">#</span>{vaultItem.serial_number}
            </span>
          </div>
        )}

        {/* Zoom button */}
        {imgSrc && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setZoomOpen(true); }}
            aria-label="Zoom image"
            className={`absolute z-10 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm text-foreground flex items-center justify-center shadow-md opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200 hover:bg-background ${vaultItem.serial_number ? 'bottom-11 right-3' : 'bottom-3 right-3'}`}
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        )}
      </Link>

      {zoomOpen && (
        <Suspense fallback={null}>
          <ImageZoomModal
            isOpen={zoomOpen}
            onClose={() => setZoomOpen(false)}
            imageUrl={imgSrc}
            altText={vaultItem.card_name || vaultItem.name || 'Card Image'}
          />
        </Suspense>
      )}
      
      <div className="p-5 flex flex-col flex-1">
        <Link to={detailPath} className="block mb-3">
          <h3 className="font-bold text-base leading-snug line-clamp-2 text-foreground group-hover:text-primary transition-colors mb-1">
            {vaultItem.card_name || vaultItem.name || 'Untitled Vault Item'}
          </h3>
          {vaultItem.set_name && (
            <p className="text-xs text-muted-foreground mb-2 truncate">{vaultItem.set_name}</p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {vaultItem.year && (
              <Badge variant="secondary" className="text-[10px] font-medium bg-muted/50 text-muted-foreground">{vaultItem.year}</Badge>
            )}
            {vaultItem.card_number && (
              <Badge variant="secondary" className="text-[10px] font-medium bg-muted/50 text-muted-foreground">#{vaultItem.card_number}</Badge>
            )}
            {vaultItem.condition && (
              <Badge variant="secondary" className="text-[10px] font-medium bg-muted/50 text-muted-foreground capitalize">{vaultItem.condition.replace(/_/g, ' ')}</Badge>
            )}
            {vaultItem.is_foil && <Badge variant="outline" className="text-[10px] font-bold border-yellow-400/50 text-yellow-800 bg-yellow-400/10 dark:text-yellow-300">Foil</Badge>}
            {getRefractorLabel(vaultItem) && <Badge variant="outline" className={`text-[10px] font-bold ${getRefractorBadgeClass(vaultItem)}`}>{getRefractorLabel(vaultItem)}</Badge>}
            {autoLabel && (
              <Badge variant="outline" className="text-[10px] font-bold border-blue-400/50 text-blue-700 bg-blue-400/10">{autoLabel}</Badge>
            )}
            {isRookie && <RookiePill />}
            {vaultItem.is_sealed && <Badge variant="outline" className="text-[10px] font-bold border-green-400/50 text-green-800 bg-green-400/10">Sealed</Badge>}
            {genericVariantChips(variants).map(v => (
              <Badge key={v} variant="outline" className="text-[10px] font-bold border-primary/30 text-primary bg-primary/5">{v}</Badge>
            ))}
          </div>
        </Link>
        
        <div className="mt-auto pt-4 flex flex-col gap-3 border-t border-border">
          <div className="flex items-center justify-between">
            <span className={`font-extrabold text-xl tabular-nums ${isSold ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
              {/* Without a live listing the figure is the owner's estimate, not
                  an asking price — label it so a vault card can't read as buyable. */}
              {liveListing?.price_aud == null && !isSold && (
                <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground align-middle">Est. value</span>
              )}
              ${Number(liveListing?.price_aud ?? vaultItem.estimated_value_aud ?? 0).toFixed(2)}
            </span>
            {isSold && (
              <span className="text-xs font-bold uppercase tracking-wider text-brand-red">Sold</span>
            )}
          </div>
          
          {sellerId && (
            <Link 
              to={`/seller/${sellerId}`} 
              className="flex items-center gap-2 group/seller p-2 -mx-2 rounded-xl hover:bg-muted/50 transition-colors"
            >
              <ProfileAvatar profile={sellerObj} name="Seller" />
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-foreground truncate group-hover/seller:text-primary transition-colors">
                    {sellerObj?.display_name || sellerObj?.name || 'Vault Owner'}
                  </span>
                  {isVerified(sellerObj?.is_verified) && (
                    <ShieldCheck className="w-3.5 h-3.5 text-[hsl(var(--verified-badge))] shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <Star className="w-3 h-3 fill-[hsl(var(--rating-color))] text-[hsl(var(--rating-color))]" />
                  <span>{sellerObj?.rating ? Number(sellerObj.rating).toFixed(1) : 'New'}</span>
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
