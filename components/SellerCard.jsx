import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, User } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
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
      role="button"
      tabIndex={0}
      className="group bg-card rounded-[12px] border border-border/50 p-[20px] flex flex-col sm:flex-row items-center sm:items-start gap-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer"
    >
      {/* 1. Circular Avatar (Left) */}
      <div className="shrink-0 relative">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={`${seller.name || 'Seller'} avatar`}
            className="w-[80px] h-[80px] rounded-full object-cover ring-2 ring-offset-2 ring-transparent group-hover:ring-primary/20 transition-all"
            width="80"
            height="80"
          />
        ) : (
          <div className="w-[80px] h-[80px] rounded-full bg-background flex items-center justify-center ring-2 ring-offset-2 ring-transparent group-hover:ring-primary/20 transition-all">
            <User className="w-8 h-8 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* 2. Seller Info (Center) */}
      <div className="flex-1 text-center sm:text-left min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-1">
          <h3 className="text-foreground font-bold text-lg leading-tight truncate group-hover:text-primary transition-colors">
            {sellerName}
          </h3>
          {seller.is_verified && (
            <span className="inline-flex items-center gap-1 text-green-600 text-xs font-bold bg-green-500/10 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Verified
            </span>
          )}
        </div>
        
        <p className="text-muted-foreground text-[11px] mb-2 font-medium">
          Member since {memberSinceDate}
        </p>

        <div className="flex items-center justify-center sm:justify-start gap-2 mb-3">
          <div className="flex text-primary text-sm tracking-widest">
            {seller.rating ? '★'.repeat(Math.round(seller.rating)) : '★★★★★'}
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-2 text-sm text-foreground font-bold">
          <div className="flex items-baseline gap-1">
            <span className="text-muted-foreground font-normal">Sold:</span>
            {soldCount}
          </div>
          <div className="w-1 h-1 rounded-full bg-border hidden sm:block" />
          <div className="flex items-baseline gap-1">
            <span className="text-muted-foreground font-normal">Listed:</span>
            {listedCount}
          </div>
          <div className="w-1 h-1 rounded-full bg-border hidden sm:block" />
          <div className="flex items-baseline gap-1">
            <span className="text-muted-foreground font-normal">Positive:</span>
            {positivePercentage}%
          </div>
        </div>
      </div>

      {/* 3. View Store Button (Right) */}
      <div className="shrink-0 w-full sm:w-auto mt-4 sm:mt-0 sm:self-center">
        <Button 
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/seller/${seller.id}`);
          }}
          className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg px-6 py-2.5 shadow-sm active:scale-[0.98] transition-transform"
        >
          View Store
        </Button>
      </div>
    </div>
  );
};

export default SellerCard;