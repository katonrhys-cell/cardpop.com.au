import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import apiServerClient from '@/lib/apiServerClient.js';
import { toast } from 'sonner';
import { REVIEW_BODY_MAX, REVIEW_TITLE_MAX, REVIEW_RATING_LABELS } from '@/utils/productReviews.js';

// Review one product from a shipped order. Submitted through /shop-reviews,
// where the DB verifies the order and holds the review for moderation.
// `target` = { orderId, productId, title }.
const WriteProductReviewModal = ({ target, onClose, onSuccess }) => {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const shown = hovered || rating;

  const handleSubmit = async () => {
    if (!rating) { toast.error('Please pick a star rating'); return; }
    setSaving(true);
    try {
      const res = await apiServerClient.fetch('/shop-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: target.orderId,
          product_id: target.productId,
          rating,
          ...(title.trim() ? { title: title.trim() } : {}),
          ...(body.trim() ? { body: body.trim() } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to submit review');
      }
      toast.success('Thanks! Your review will appear once it has been checked.');
      onSuccess?.(target);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to submit review');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading font-bold">Review this product</DialogTitle>
          <DialogDescription>
            {target.title}. Your review is public, marked as a verified purchase, and checked by CardPop before it appears.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-1" onMouseLeave={() => setHovered(0)}>
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`${i} star${i !== 1 ? 's' : ''} — ${REVIEW_RATING_LABELS[i]}`}
                  onMouseEnter={() => setHovered(i)}
                  onFocus={() => setHovered(i)}
                  onBlur={() => setHovered(0)}
                  onClick={() => setRating(i)}
                  className="p-1 rounded-lg transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Star className={`w-9 h-9 transition-colors ${i <= shown
                    ? 'fill-[hsl(var(--rating-color,38_92%_50%))] text-[hsl(var(--rating-color,38_92%_50%))]'
                    : 'text-muted-foreground/30'}`}
                  />
                </button>
              ))}
            </div>
            <p className="text-sm font-semibold text-muted-foreground h-5">{shown ? REVIEW_RATING_LABELS[shown] : 'Tap a star to rate'}</p>
          </div>

          <div className="space-y-2">
            <Label className="font-semibold text-sm">Headline <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, REVIEW_TITLE_MAX))}
              placeholder="Sums it up in a few words"
              className="rounded-xl bg-background border-border"
            />
          </div>

          <div className="space-y-2">
            <Label className="font-semibold text-sm">Your review <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, REVIEW_BODY_MAX))}
              placeholder="Quality, fit, how it holds your cards — what should other collectors know?"
              className="rounded-xl bg-background border-border resize-none"
              rows={4}
            />
            <p className="text-xs text-muted-foreground text-right tabular-nums">{body.length}/{REVIEW_BODY_MAX}</p>
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

export default WriteProductReviewModal;
