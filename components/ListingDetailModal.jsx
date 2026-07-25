import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Edit, Trash2, Power, History, Image as ImageIcon } from 'lucide-react';
import { publicImageUrl } from '@/utils/imageUrl.js';
import ListingEditForm from './ListingEditForm.jsx';
import ModerationPanel from './ModerationPanel.jsx';

// listings.price_aud is stored in whole dollars.
const formatAud = (dollars) => `$${(Number(dollars) || 0).toFixed(2)}`;

const ListingDetailModal = ({ isOpen, onClose, listing, onUpdate, onDelete, onStatusChange }) => {
  const [activeTab, setActiveTab] = useState('details');

  if (!listing) return null;

  const vi = listing.vault_item || {};
  const cardName = vi.card_name || 'Untitled listing';
  const rawImage = listing.image_url || vi.card_image || (Array.isArray(vi.card_images) ? vi.card_images[0] : null);
  const imageUrl = rawImage ? publicImageUrl(rawImage) : null;
  const isSold = listing.status === 'sold';

  const handleEditSuccess = (updated) => {
    if (onUpdate) onUpdate(updated);
    setActiveTab('details');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden bg-card text-foreground border-border">
        <DialogHeader className="px-6 pt-6 pb-2">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl font-bold">{cardName}</DialogTitle>
              <div className="flex gap-2 mt-2">
                {vi.set_name && <Badge variant="outline">{vi.set_name}</Badge>}
                {isSold ? (
                  <Badge variant="destructive">Sold</Badge>
                ) : (
                  <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20 capitalize">
                    {listing.status || 'active'}
                  </Badge>
                )}
                {listing.flagged && (
                  <Badge variant="secondary" className="text-orange-500 bg-orange-500/10">Flagged</Badge>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">{formatAud(listing.price_aud)}</div>
              {listing.id && <div className="text-xs text-muted-foreground mt-1">ID: {listing.id.slice(0,8)}</div>}
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-6 border-b border-border">
            <TabsList className="w-full justify-start h-auto p-0 bg-transparent gap-6">
              <TabsTrigger value="details" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-3 font-medium">
                Details
              </TabsTrigger>
              <TabsTrigger value="edit" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-3 font-medium">
                Edit
              </TabsTrigger>
              <TabsTrigger value="moderation" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-3 font-medium">
                Moderation
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-6 max-h-[60vh] overflow-y-auto">
            <TabsContent value="details" className="mt-0 space-y-6">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-1/3 aspect-[3/4] bg-muted rounded-xl border border-border flex items-center justify-center overflow-hidden shrink-0">
                  {imageUrl ? (
                    <img src={imageUrl} alt={cardName} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
                  )}
                </div>

                <div className="flex-1 space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Set</p>
                      <p className="font-medium">{vi.set_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Condition</p>
                      <p className="font-medium">{vi.condition || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Grade</p>
                      <p className="font-medium">{vi.grade || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Created At</p>
                      <p className="font-medium">{listing.created_at ? new Date(listing.created_at).toLocaleDateString() : 'N/A'}</p>
                    </div>
                  </div>

                  <Separator className="bg-border" />

                  <div>
                    <h4 className="font-semibold mb-2">Flag reason</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {listing.flag_reason || 'No moderation flags on this listing.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
                <Button variant="outline" onClick={() => onStatusChange(listing)} className="gap-2">
                  <Power className="w-4 h-4" />
                  Change Status
                </Button>
                <Button variant="destructive" onClick={() => onDelete(listing)} className="gap-2">
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
                <Button onClick={() => setActiveTab('edit')} className="gap-2">
                  <Edit className="w-4 h-4" />
                  Edit Listing
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="edit" className="mt-0">
              <ListingEditForm 
                listing={listing} 
                onSuccess={handleEditSuccess}
                onCancel={() => setActiveTab('details')}
              />
            </TabsContent>

            <TabsContent value="moderation" className="mt-0">
              <ModerationPanel 
                listing={listing}
                onUpdate={(updated) => {
                  if (onUpdate) onUpdate(updated);
                }}
              />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ListingDetailModal;