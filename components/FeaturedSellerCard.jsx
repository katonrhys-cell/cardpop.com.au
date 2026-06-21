
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

const FeaturedSellerCard = ({ seller }) => {
  const navigate = useNavigate();

  const rating = seller.rating || 0;
  const reviewCount = seller.reviews_count || 0;

  const memberSinceDate = seller.created_at
    ? new Date(seller.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    : 'Unknown';

  const avatarUrl = seller.business_logo_url || seller.avatar_url || null;
  const sellerName = seller.business_name || seller.display_name || seller.username || 'Anonymous Seller';
  const location = seller.location_suburb && seller.location_state
    ? `${seller.location_suburb}, ${seller.location_state}`
    : seller.location_state || null;

  const handleCardClick = (e) => {
    // Prevent navigation if the user is selecting text or explicitly clicking a nested link/button
    if (e.target.closest('button') || e.target.closest('a')) return;
    navigate(`/dealer/${seller.username}`);
  };

  return (
    <div
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      className="group bg-card rounded-2xl border border-border/50 p-6 flex flex-col items-center text-center shadow-sm hover:shadow-lg hover:border-primary/40 transition-all duration-200 cursor-pointer h-full"
    >
      {/* Avatar/Logo */}
      <div className="shrink-0 relative mb-4">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={`${sellerName} logo`}
            className="w-20 h-20 rounded-full object-cover ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all"
            width="80"
            height="80"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all">
            <User className="w-8 h-8 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Seller Name */}
      <h3 className="text-foreground font-bold text-base leading-tight mb-1 line-clamp-2 group-hover:text-primary transition-colors">
        {sellerName}
      </h3>

      {/* Verified Badge */}
      {seller.is_verified && (
        <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full mb-2">
          <CheckCircle2 className="w-3 h-3" />
          Verified
        </span>
      )}

      {/* Location */}
      {location && (
        <p className="text-muted-foreground text-xs mb-2">
          {location}
        </p>
      )}

      {/* Member Since */}
      <p className="text-muted-foreground text-xs font-medium mb-3">
        Member since {memberSinceDate}
      </p>

      {/* Rating */}
      <div className="flex items-center justify-center gap-1.5 mb-3">
        <div className="flex text-primary text-sm">
          {rating > 0 ? '★'.repeat(Math.round(rating)) : '★★★★★'}
        </div>
        <span className="text-xs text-muted-foreground">
          ({reviewCount})
        </span>
      </div>

      {/* View Store Button */}
      <Button
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/dealer/${seller.username}`);
        }}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg py-2 shadow-sm active:scale-[0.98] transition-transform text-sm mt-auto"
      >
        View Store
      </Button>
    </div>
  );
};

export default FeaturedSellerCard;
