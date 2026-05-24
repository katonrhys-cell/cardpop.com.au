
import React, { useState } from 'react';
import pb from '@/lib/pocketbaseClient.js';
import { toast } from 'sonner';
import { Loader2, Lock, ShoppingCart, ArrowRightLeft, Layers } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const getStatusConfig = (listingType) => {
  switch (listingType) {
    case 'Private': return { className: 'badge-vault-private', icon: Lock, label: 'Private Vault' };
    case 'For Sale': return { className: 'badge-vault-sale', icon: ShoppingCart, label: 'For Sale' };
    case 'For Trade': return { className: 'badge-vault-trade', icon: ArrowRightLeft, label: 'For Trade' };
    case 'For Sale & Trade': return { className: 'badge-vault-both', icon: Layers, label: 'Sale & Trade' };
    default: return { className: 'bg-muted text-muted-foreground', icon: Lock, label: 'Unknown' };
  }
};

const VaultListingModal = ({ isOpen, onClose, product, onUpdate }) => {
  const [loading, setLoading] = useState(false);

  const handleUpdateStatus = async (newListingType, isPublic) => {
    if (!product) return;
    
    setLoading(true);
    try {
      await pb.collection('user_vaults').update(product.id, {
        listing_type: newListingType,
        is_public: isPublic
      }, { $autoCancel: false });
      
      toast.success(`Listing status updated to ${newListingType}`);
      if (onUpdate) onUpdate();
      onClose();
    } catch (error) {
      console.error('Failed to update listing status:', error);
      toast.error(error.message || 'Failed to update status.');
    } finally {
      setLoading(false);
    }
  };

  if (!product) return null;

  const currentStatus = getStatusConfig(product.listing_type || 'Private');
  const StatusIcon = currentStatus.icon;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] rounded-2xl border-border bg-background p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-2xl font-serif font-bold text-foreground">
            Manage Listing Status
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Update visibility and trading preferences for <span className="font-bold text-foreground">{product.name}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6">
          <div className="bg-muted/30 p-4 rounded-xl border border-border flex items-center justify-between">
            <span className="text-sm font-bold text-foreground">Current Status</span>
            <Badge className={`px-3 py-1 text-xs font-bold ${currentStatus.className}`}>
              <StatusIcon className="w-3 h-3 mr-1.5 inline-block" />
              {currentStatus.label}
            </Badge>
          </div>

          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start h-12 rounded-xl bg-background hover:bg-muted font-medium"
              onClick={() => handleUpdateStatus('Private', false)}
              disabled={loading || product.listing_type === 'Private'}
            >
              <Lock className="w-4 h-4 mr-3 text-muted-foreground" />
              Make Private (Vault Only)
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start h-12 rounded-xl bg-background hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/30 font-medium"
              onClick={() => handleUpdateStatus('For Sale', true)}
              disabled={loading || product.listing_type === 'For Sale'}
            >
              <ShoppingCart className="w-4 h-4 mr-3 text-emerald-500" />
              List for Sale
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start h-12 rounded-xl bg-background hover:bg-violet-500/10 hover:text-violet-600 hover:border-violet-500/30 font-medium"
              onClick={() => handleUpdateStatus('For Trade', true)}
              disabled={loading || product.listing_type === 'For Trade'}
            >
              <ArrowRightLeft className="w-4 h-4 mr-3 text-violet-500" />
              List for Trade
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start h-12 rounded-xl bg-background hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500/30 font-medium"
              onClick={() => handleUpdateStatus('For Sale & Trade', true)}
              disabled={loading || product.listing_type === 'For Sale & Trade'}
            >
              <Layers className="w-4 h-4 mr-3 text-amber-500" />
              List for Both (Sale & Trade)
            </Button>
          </div>
        </div>

        <DialogFooter className="mt-6 sm:justify-start">
          <Button variant="ghost" onClick={onClose} disabled={loading} className="w-full sm:w-auto rounded-xl">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Cancel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VaultListingModal;
