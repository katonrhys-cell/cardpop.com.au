import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { toast } from 'sonner';

// Marketplace listings live in the `listings` table with a `status` of
// active / sold / archived:
//   • active   — visible on the marketplace and purchasable
//   • sold     — visible on the marketplace, badged "Sold", not purchasable
//   • archived — hidden from the marketplace (used to clear out old sales)
const STATUS_OPTIONS = [
  {
    value: 'active',
    label: 'Active',
    description: 'Visible on the marketplace and available to buy.',
    className: 'font-medium',
  },
  {
    value: 'sold',
    label: 'Sold',
    description: 'Stays on the marketplace marked "Sold" — cannot be purchased.',
    className: 'font-medium',
  },
  {
    value: 'archived',
    label: 'Archived',
    description: 'Removed from the marketplace. Use this to clear out old sales.',
    className: 'font-medium text-destructive',
  },
];

const ListingStatusModal = ({ isOpen, onClose, listing, onStatusUpdated }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('active');

  useEffect(() => {
    if (listing?.status) setSelectedStatus(listing.status);
  }, [listing?.status]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!listing?.id) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('listings')
        .update({
          status: selectedStatus,
          // Stamp the sale time when moving to sold; clear it when reactivating.
          sold_at: selectedStatus === 'sold' ? new Date().toISOString() : null,
        })
        .eq('id', listing.id);
      if (error) throw error;

      toast.success('Listing status updated');
      if (onStatusUpdated) onStatusUpdated();
      onClose();
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error(error.message || 'Failed to update status');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!listing) return null;

  const cardName = listing.vault_item?.card_name || listing.title || 'this listing';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Change Status</DialogTitle>
          <DialogDescription>
            Update the marketplace visibility of &ldquo;{cardName}&rdquo;.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <RadioGroup value={selectedStatus} onValueChange={setSelectedStatus} className="gap-4">
            {STATUS_OPTIONS.map(opt => (
              <div key={opt.value} className="flex items-center space-x-3 border border-border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                <RadioGroupItem value={opt.value} id={opt.value} />
                <Label htmlFor={opt.value} className={`flex-1 cursor-pointer ${opt.className}`}>
                  {opt.label}
                  <span className="block text-xs text-muted-foreground font-normal mt-1">
                    {opt.description}
                  </span>
                </Label>
              </div>
            ))}
          </RadioGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ListingStatusModal;
