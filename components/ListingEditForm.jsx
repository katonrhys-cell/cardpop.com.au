import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient.js';

const TCG_COLLECTIONS = ['Pokemon', 'Magic', 'Yu-Gi-Oh', 'Digimon', 'Riftbound', 'Disney Lorcana', 'One Piece'];

const ListingEditForm = ({ listing, onSuccess, onCancel }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  
  const [formData, setFormData] = useState({
    name: listing?.name || '',
    productId: listing?.productId || '',
    collectionType: listing?.collectionType || '',
    condition: listing?.condition || '',
    grade: listing?.grade || '',
    price: listing?.price || 0,
    description: listing?.description || '',
    stockQuantity: listing?.stockQuantity || 0,
  });

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.price || !formData.collectionType) {
      toast.error('Please fill all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = new FormData();
      Object.keys(formData).forEach(key => {
        data.append(key, formData[key]);
      });
      
      if (imageFile) {
        data.append('image', imageFile);
      }

      let updated;
      // Build plain object from FormData
      const dataObj = {};
      data.forEach((value, key) => { dataObj[key] = value; });

      if (listing?.id) {
        const { data: updatedData, error } = await supabase
          .from('set_cards')
          .update(dataObj)
          .eq('id', listing.id)
          .select()
          .single();
        if (error) throw error;
        updated = updatedData;
        toast.success('Listing updated successfully');
      } else {
        const { data: createdData, error } = await supabase
          .from('set_cards')
          .insert(dataObj)
          .select()
          .single();
        if (error) throw error;
        updated = createdData;
        toast.success('Listing created successfully');
      }
      
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="name">Listing Title <span className="text-destructive">*</span></Label>
          <Input 
            id="name" name="name" 
            value={formData.name} onChange={handleChange} 
            placeholder="e.g. Charizard 1st Edition" required 
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="productId">Product ID</Label>
          <Input 
            id="productId" name="productId" 
            value={formData.productId} onChange={handleChange} 
            placeholder="SKU or internal ID" 
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="price">Price (USD) <span className="text-destructive">*</span></Label>
          <Input 
            id="price" name="price" type="number" min="0" step="0.01"
            value={formData.price} onChange={handleChange} required 
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="stockQuantity">Stock Quantity</Label>
          <Input 
            id="stockQuantity" name="stockQuantity" type="number" min="0"
            value={formData.stockQuantity} onChange={handleChange} 
          />
        </div>

        <div className="space-y-2">
          <Label>Category / Collection <span className="text-destructive">*</span></Label>
          <Select value={formData.collectionType} onValueChange={(v) => handleSelectChange('collectionType', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select collection" />
            </SelectTrigger>
            <SelectContent>
              {TCG_COLLECTIONS.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Condition</Label>
          <Select value={formData.condition} onValueChange={(v) => handleSelectChange('condition', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select condition" />
            </SelectTrigger>
            <SelectContent>
              {['Mint', 'Near Mint', 'Excellent', 'Good', 'Fair'].map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="grade">Grade (Optional)</Label>
          <Input 
            id="grade" name="grade" 
            value={formData.grade} onChange={handleChange} 
            placeholder="e.g. PSA 10" 
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label>Description</Label>
          <Textarea 
            name="description"
            value={formData.description} onChange={handleChange}
            placeholder="Detailed description of the item..."
            className="min-h-[120px]"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label>Upload Image</Label>
          <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:bg-muted/50 transition-colors">
            <Input 
              type="file" id="image" accept="image/*" 
              onChange={handleImageChange} className="hidden" 
            />
            <Label htmlFor="image" className="cursor-pointer flex flex-col items-center">
              <UploadCloud className="w-8 h-8 text-muted-foreground mb-2" />
              <span className="font-medium text-foreground">Click to upload image</span>
              <span className="text-xs text-muted-foreground mt-1">JPEG, PNG or WEBP (Max 20MB)</span>
              {imageFile && <span className="text-sm font-semibold text-primary mt-2">{imageFile.name} selected</span>}
            </Label>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {listing ? 'Save Changes' : 'Create Listing'}
        </Button>
      </div>
    </form>
  );
};

export default ListingEditForm;