import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { toast } from 'sonner';

const ListingStatusModal = ({ isOpen, onClose, listing, onStatusUpdated }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(
    listing?.stockQuantity > 0 ? 'active' : 'inactive'
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!listing?.id) return;
    
    setIsSubmitting(true);
    try {
      // Since officialCatalog lacks an explicit status field, 
      // we map active to stock=1 (if currently 0) and inactive/sold to stock=0.
      let newStock = listing.stockQuantity;
      
      if (selectedStatus === 'active' && listing.stockQuantity === 0) {
        newStock = 1; // Default to 1 if making active
      } else if (selectedStatus !== 'active') {
        newStock = 0;
      }

      const { error } = await supabase
        .from('set_cards')
        .update({ stockQuantity: newStock })
        .eq('id', listing.id);
      if (error) throw error;

      toast.success('Listing status updated successfully');
      if (onStatusUpdated) onStatusUpdated();
      onClose();
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Failed to update status');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!listing) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Change Status</DialogTitle>
          <DialogDescription>
            Update the visibility and availability of "{listing.name}".
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <RadioGroup value={selectedStatus} onValueChange={setSelectedStatus} className="gap-4">
            <div className="flex items-center space-x-3 border border-border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="active" id="active" />
              <Label htmlFor="active" className="flex-1 cursor-pointer font-medium">
                Active (In Stock)
                <span className="block text-xs text-muted-foreground font-normal mt-1">
                  Item is visible and available for purchase.
                </span>
              </Label>
            </div>
            
            <div className="flex items-center space-x-3 border border-border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="inactive" id="inactive" />
              <Label htmlFor="inactive" className="flex-1 cursor-pointer font-medium">
                Inactive (Out of Stock)
                <span className="block text-xs text-muted-foreground font-normal mt-1">
                  Item remains in catalog but cannot be purchased.
                </span>
              </Label>
            </div>

            <div className="flex items-center space-x-3 border border-border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="delisted" id="delisted" />
              <Label htmlFor="delisted" className="flex-1 cursor-pointer font-medium text-destructive">
                Delisted (Suspended)
                <span className="block text-xs text-muted-foreground font-normal mt-1">
                  Hide item completely due to policy violation or removal.
                </span>
              </Label>
            </div>
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