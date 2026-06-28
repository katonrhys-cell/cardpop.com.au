import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, User } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { isVerified } from '@/utils/verification.js';
import { Button } from '@/components/ui/button';

const SellerCard = ({ seller }) => {
  const navigate = useNavigate();

  const soldCount = seller.successful_sales || seller.total_sales || 0;
  const listedCount = seller.total_purchases || 0;

  const positivePercentage = seller.positive_feedback_pct ? Math.round(seller.positive_feedback_pct) : 100;
  const reviewCount = seller.reviews_count || 0;

  const memberSinceDate = seller.created_at
    ? new Date(seller.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    : 'Unknown';

  const avatarUrl = seller.avatar_url || null;
  const sellerName = seller.display_name || seller.name || 'Anonymous Seller';
  const location = seller.location_suburb && seller.location_state
    ? `${seller.location_suburb}, ${seller.location_state}`
    : seller.location_state || null;

  const handleCardClick = (e) => {
    // Prevent navigation if the user is selecting text or explicitly clicking a nested link/button
    if (e.target.closest('button') || e.target.closest('a')) return;
    navigate(`/seller/${seller.id}`);
  };

  return (
    <div
      onClick={handleCardClick}
      className="group bg-card rounded-2xl border border-border/50 p-6 flex flex-col items-center text-center shadow-sm hover:shadow-lg hover:border-primary/40 transition-all duration-200 cursor-pointer h-full"
    >
      {/* Avatar */}
      <div className="shrink-0 relative mb-4">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={`${sellerName} avatar`}
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
      {isVerified(seller.is_verified) && (
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
          {seller.rating ? '★'.repeat(Math.round(seller.rating)) : '★★★★★'}
        </div>
        <span className="text-xs text-muted-foreground">
          ({reviewCount})
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4 w-full text-xs">
        <div className="bg-muted/50 rounded-lg p-2">
          <div className="text-muted-foreground font-normal text-[10px] mb-0.5">Sold</div>
          <div className="text-foreground font-bold">{soldCount}</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-2">
          <div className="text-muted-foreground font-normal text-[10px] mb-0.5">Listed</div>
          <div className="text-foreground font-bold">{listedCount}</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-2">
          <div className="text-muted-foreground font-normal text-[10px] mb-0.5">Positive</div>
          <div className="text-foreground font-bold">{positivePercentage}%</div>
        </div>
      </div>

      {/* View Store Button */}
      <Button
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/seller/${seller.id}`);
        }}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg py-2 shadow-sm active:scale-[0.98] transition-transform text-sm"
      >
        View Store
      </Button>
    </div>
  );
};

export default SellerCard;