import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient.js';

// Admin quick-edit for a marketplace `listings` row. The card's descriptive
// fields (name, set, condition, grade, image) live on the joined `vault_items`
// row and are owned/edited by the seller via the vault — so this admin form
// edits only the listing-owned pricing, which admins are permitted to update
// (same path as the approve/archive/flag actions on the listings table).
const ListingEditForm = ({ listing, onSuccess, onCancel }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [price, setPrice] = useState(
    listing?.price_aud !== null && listing?.price_aud !== undefined ? String(listing.price_aud) : ''
  );

  const vi = listing?.vault_item || {};
  const cardName = vi.card_name || 'this listing';

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!listing?.id) {
      toast.error('New listings are created from a card in the vault, not here.');
      return;
    }

    const priceValue = price === '' ? null : Number(price);
    if (priceValue !== null && (Number.isNaN(priceValue) || priceValue < 0)) {
      toast.error('Enter a valid price');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: updated, error } = await supabase
        .from('listings')
        .update({ price_aud: priceValue })
        .eq('id', listing.id)
        .select('*, vault_item:vault_items(card_name, set_name, card_image, card_images, category_id, condition, grade)')
        .single();
      if (error || !updated) throw (error || new Error('No row updated'));

      toast.success('Listing price updated');
      if (onSuccess) onSuccess(updated);
    } catch (error) {
      console.error('Save failed:', error);
      toast.error(error.message || 'Failed to save listing');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label>Card</Label>
        <p className="text-sm font-medium text-foreground">{cardName}</p>
        {vi.set_name && <p className="text-xs text-muted-foreground">{vi.set_name}</p>}
      </div>

      <div className="space-y-2 max-w-xs">
        <Label htmlFor="price">Price (AUD)</Label>
        <Input
          id="price" name="price" type="number" min="0" step="0.01"
          value={price} onChange={(e) => setPrice(e.target.value)}
          placeholder="e.g. 49.99"
        />
        <p className="text-xs text-muted-foreground">
          Leave blank for an offers-only listing. Card details are edited by the seller in the vault.
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </form>
  );
};

export default ListingEditForm;
