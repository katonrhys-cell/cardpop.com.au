import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const WishlistButton = ({ itemId, itemType, className = '' }) => {
  const [inWishlist, setInWishlist] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkWishlist = async () => {
      try {
        const response = await fetch(`/api/wishlist/check/${itemId}/${itemType}`);
        const data = await response.json();
        setInWishlist(data.inWishlist);
      } catch (error) {
        console.error('Error checking wishlist:', error);
      }
    };

    if (itemId && itemType) {
      checkWishlist();
    }
  }, [itemId, itemType]);

  const toggleWishlist = async () => {
    if (!itemId || !itemType) return;

    setLoading(true);
    try {
      if (inWishlist) {
        // Remove from wishlist
        const response = await fetch(`/api/wishlist/${itemId}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          setInWishlist(false);
          toast.success('Removed from wishlist');
        } else {
          toast.error('Failed to remove from wishlist');
        }
      } else {
        // Add to wishlist
        const response = await fetch('/api/wishlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_id: itemId, item_type: itemType })
        });

        if (response.ok) {
          setInWishlist(true);
          toast.success('Added to wishlist');
        } else {
          const error = await response.json();
          toast.error(error.error || 'Failed to add to wishlist');
        }
      }
    } catch (error) {
      console.error('Error toggling wishlist:', error);
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleWishlist}
      disabled={loading}
      className={`rounded-full hover:bg-muted ${inWishlist ? 'text-red-500 hover:text-red-600' : 'text-muted-foreground'} ${className}`}
    >
      <Heart 
        className={`w-5 h-5 transition-all ${inWishlist ? 'fill-current' : ''}`} 
      />
    </Button>
  );
};

export default WishlistButton;
