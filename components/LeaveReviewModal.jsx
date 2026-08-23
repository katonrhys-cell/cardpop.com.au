import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import apiServerClient from '@/lib/apiServerClient.js';
import { toast } from 'sonner';

const COMMENT_MAX = 1000;

const RATING_LABELS = {
  1: 'Poor',
  2: 'Below average',
  3: 'Okay',
  4: 'Good',
  5: 'Excellent',
};

// Post-purchase seller review: interactive star picker + optional comment,
// submitted through the order-verified /seller-ratings endpoint. `order` needs
// id, seller_id and (optionally) a seller profile embed for the heading.
const LeaveReviewModal = ({ order, onClose, onSuccess }) => {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const sellerName = order.seller?.display_name || order.seller?.username || 'this seller';
  const shown = hovered || rating;

  const handleSubmit = async () => {
    if (!rating) { toast.error('Please pick a star rating'); return; }
    setSaving(true);
    try {
      const res = await apiServerClient.fetch('/seller-ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seller_id: order.seller_id,
          order_id: order.id,
          rating,
          ...(comment.trim() ? { comment: comment.trim() } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to submit review');
      }

      toast.success('Review submitted — thanks for helping other collectors!');
      onSuccess?.(order.id);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to submit review');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading font-bold">Rate this seller</DialogTitle>
          <DialogDescription>
            How was your experience buying from {sellerName}? Your review is public and tied to this order.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Star picker */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-1" onMouseLeave={() => setHovered(0)}>
              {[1, 2, 3, 4, 5].map(i => (
                <button
                  key={i}
                  type="button"
                  aria-label={`${i} star${i !== 1 ? 's' : ''} — ${RATING_LABELS[i]}`}
                  onMouseEnter={() => setHovered(i)}
                  onFocus={() => setHovered(i)}
                  onBlur={() => setHovered(0)}
                  onClick={() => setRating(i)}
                  className="p-1 rounded-lg transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Star
                    className={`w-9 h-9 transition-colors ${
                      i <= shown
                        ? 'fill-[hsl(var(--rating-color,38_92%_50%))] text-[hsl(var(--rating-color,38_92%_50%))]'
                        : 'text-muted-foreground/30'
                    }`}
                  />
                </button>
              ))}
            </div>
            <p className="text-sm font-semibold text-muted-foreground h-5">
              {shown ? RATING_LABELS[shown] : 'Tap a star to rate'}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="font-semibold text-sm">
              Your review <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              placeholder="Fast shipping? Card as described? Tell other collectors what to expect..."
              value={comment}
              onChange={e => setComment(e.target.value.slice(0, COMMENT_MAX))}
              className="rounded-xl bg-background border-border resize-none"
              rows={4}
            />
            <p className="text-xs text-muted-foreground text-right tabular-nums">{comment.length}/{COMMENT_MAX}</p>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl font-bold" disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!rating || saving} className="flex-1 rounded-xl font-bold">
            {saving ? 'Submitting...' : 'Submit Review'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LeaveReviewModal;
