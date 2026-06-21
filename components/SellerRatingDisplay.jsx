import React, { useState, useEffect } from 'react';
import { Star, Clock, ShoppingCart, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const SellerRatingDisplay = ({ sellerId, compact = false, showPerformance = false }) => {
  const [ratings, setRatings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRatings = async () => {
      if (!sellerId) return;

      setLoading(true);
      try {
        const response = await fetch(`/api/seller-ratings/${sellerId}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch ratings: ${response.status}`);
        }
        const data = await response.json();
        setRatings(data);
      } catch (error) {
        console.error('Error fetching seller ratings:', error);
        setRatings(null);
      } finally {
        setLoading(false);
      }
    };

    fetchRatings();
  }, [sellerId]);

  if (loading) {
    return <div className="animate-pulse bg-muted h-6 w-24 rounded" />;
  }

  if (!ratings || !ratings.stats || ratings.stats.total === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Star className="w-4 h-4" />
        <span>New Seller</span>
      </div>
    );
  }

  const renderStars = (rating) => {
    return Array(5).fill(0).map((_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < Math.floor(rating) 
            ? 'fill-yellow-400 text-yellow-400' 
            : 'text-gray-300'
        }`}
      />
    ));
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center">
          {renderStars(ratings.stats.average)}
        </div>
        <span className="font-semibold text-sm">{ratings.stats.average}</span>
        <span className="text-muted-foreground text-sm">({ratings.stats.total})</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Rating Summary */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="flex">
            {renderStars(ratings.stats.average)}
          </div>
          <span className="text-2xl font-bold">{ratings.stats.average}</span>
          <span className="text-muted-foreground">({ratings.stats.total} reviews)</span>
        </div>
      </div>

      {/* Rating Distribution */}
      <div className="space-y-2">
        {[5, 4, 3, 2, 1].map(star => (
          <div key={star} className="flex items-center gap-2 text-sm">
            <span className="w-8">{star} ★</span>
            <div className="flex-1 bg-muted rounded-full h-2">
              <div
                className="bg-yellow-400 h-2 rounded-full"
                style={{
                  width: `${ratings.stats.total > 0 
                    ? (ratings.stats.distribution[star] / ratings.stats.total) * 100 
                    : 0}%`
                }}
              />
            </div>
            <span className="w-8 text-muted-foreground">
              {ratings.stats.distribution[star] || 0}
            </span>
          </div>
        ))}
      </div>

      {/* Performance Metrics */}
      {showPerformance && ratings.performance && (
        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          {ratings.performance.response_time && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Response:</span>
              <span className="font-medium">{ratings.performance.response_time}h</span>
            </div>
          )}
          {ratings.performance.successful_sales !== undefined && (
            <div className="flex items-center gap-2 text-sm">
              <ShoppingCart className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Sales:</span>
              <span className="font-medium">{ratings.performance.successful_sales}</span>
            </div>
          )}
        </div>
      )}

      {/* Trust Badges */}
      {ratings.stats.average >= 4.5 && ratings.stats.total >= 10 && (
        <Badge variant="secondary" className="w-fit">
          <ShieldCheck className="w-3 h-3 mr-1" />
          Top Rated Seller
        </Badge>
      )}
    </div>
  );
};

export default SellerRatingDisplay;
