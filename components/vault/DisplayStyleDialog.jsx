import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import DisplayStylePicker from '@/components/vault/DisplayStylePicker.jsx';
import { normalizeStyle, normalizeTier } from '@/lib/displayStyles.js';
import { getCardImage, CARD_GRID_SIZES } from '@/utils/imageUrl.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import apiServerClient from '@/lib/apiServerClient.js';

/**
 * DisplayStyleDialog — change how a vault card is showcased without opening
 * the full edit form. Saves through the dedicated display-style endpoint
 * (PATCH /vault/items/:id/display-style), which re-checks the tier gate
 * server-side and touches nothing else on the card — the listing itself is
 * never re-synced by a cosmetic change.
 *
 * Props:
 *   open         — dialog visibility
 *   onOpenChange — (bool) => void
 *   card         — the vault_items row (id, card_image, display_style, …)
 *   onSaved      — (styleKey) => void, called after a successful save
 */
const DisplayStyleDialog = ({ open, onOpenChange, card, onSaved }) => {
  const { currentUser } = useAuth();
  const tier = normalizeTier(currentUser?.subscription_tier);
  const [selected, setSelected] = useState('classic');
  const [saving, setSaving] = useState(false);

  // Re-seed the selection each time the dialog opens on a card.
  useEffect(() => {
    if (open) setSelected(normalizeStyle(card?.display_style));
  }, [open, card?.id, card?.display_style]);

  if (!card) return null;

  const { src, srcSet, fallbackSrc } = getCardImage(card.card_image);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiServerClient.fetch(`/vault/items/${card.id}/display-style`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayStyle: selected }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not save the display style.');
      toast.success('Display style updated');
      onSaved?.(body.displayStyle || selected);
      onOpenChange?.(false);
    } catch (e) {
      toast.error(e.message || 'Could not save the display style.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>Display style</DialogTitle>
          <DialogDescription>
            Choose how {card.card_name ? `“${card.card_name}”` : 'this card'} is showcased in your vault and on the marketplace.
            The style applies to the card's first photo; any other photos on the listing stay plain.
          </DialogDescription>
        </DialogHeader>

        <DisplayStylePicker
          value={selected}
          onChange={setSelected}
          userTier={tier}
          previewSrc={src}
          previewSrcSet={srcSet}
          previewSizes={CARD_GRID_SIZES}
          previewFallback={fallbackSrc}
        />

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange?.(false)} disabled={saving}>
            Cancel
          </Button>
          <Button className="rounded-xl font-bold" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save style'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DisplayStyleDialog;
