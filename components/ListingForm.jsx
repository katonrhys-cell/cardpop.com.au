import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

const ListingForm = ({ product, onSuccess, onCancel }) => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    playerName: product?.playerName || '',
    team: product?.team || '',
    year: product?.year || '',
    cardType: product?.cardType || 'Graded Cards',
    condition: product?.condition || 'Mint',
    grade: product?.grade || '',
    price: product?.price || '',
    status: product?.status || 'For Sale',
  });
  const [imageFile, setImageFile] = useState(null);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = new FormData();
      data.append('playerName', formData.playerName);
      data.append('team', formData.team);
      data.append('year', formData.year);
      data.append('cardType', formData.cardType);
      data.append('condition', formData.condition);
      data.append('grade', formData.grade);
      data.append('price', formData.price);
      data.append('status', formData.status);
      data.append('seller', currentUser.id);

      if (imageFile) {
        data.append('image', imageFile);
      }

      // Build plain object (images not supported in this simplified form)
      const listingData = {
        card_name: formData.playerName,
        team: formData.team,
        year: formData.year,
        card_type: formData.cardType,
        condition: formData.condition,
        grade: formData.grade,
        price_aud: formData.price,
        status: formData.status,
        seller_id: currentUser.id
      };

      if (product) {
        const { error } = await supabase.from('listings').update(listingData).eq('id', product.id).eq('seller_id', currentUser.id);
        if (error) throw error;
        toast('Listing updated successfully');
      } else {
        const { error } = await supabase.from('listings').insert(listingData);
        if (error) throw error;
        toast('Listing created successfully');
      }

      onSuccess?.();
    } catch (error) {
      toast('Failed to save listing. Please try again.');
      console.error('Error saving listing:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-card p-6 rounded-2xl border border-border">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="playerName">Player Name *</Label>
          <Input
            id="playerName"
            value={formData.playerName}
            onChange={(e) => handleChange('playerName', e.target.value)}
            required
            placeholder="Michael Jordan"
            className="bg-background border-border"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="team">Team *</Label>
          <Input
            id="team"
            value={formData.team}
            onChange={(e) => handleChange('team', e.target.value)}
            required
            placeholder="Chicago Bulls"
            className="bg-background border-border"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="year">Year *</Label>
          <Input
            id="year"
            type="number"
            value={formData.year}
            onChange={(e) => handleChange('year', e.target.value)}
            required
            placeholder="1997"
            className="bg-background border-border"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cardType">Card Type *</Label>
          <Select value={formData.cardType} onValueChange={(value) => handleChange('cardType', value)}>
            <SelectTrigger className="bg-background border-border">
              <SelectValue placeholder="Select card type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Graded Cards">Graded Cards</SelectItem>
              <SelectItem value="Raw Cards">Raw Cards</SelectItem>
              <SelectItem value="Sealed Products">Sealed Products</SelectItem>
              <SelectItem value="Trading Card Games">Trading Card Games</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="condition">Condition *</Label>
          <Select value={formData.condition} onValueChange={(value) => handleChange('condition', value)}>
            <SelectTrigger className="bg-background border-border">
              <SelectValue placeholder="Select condition" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Mint">Mint</SelectItem>
              <SelectItem value="Near Mint">Near Mint</SelectItem>
              <SelectItem value="Excellent">Excellent</SelectItem>
              <SelectItem value="Good">Good</SelectItem>
              <SelectItem value="Fair">Fair</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="grade">Grade (Optional)</Label>
          <Input
            id="grade"
            value={formData.grade}
            onChange={(e) => handleChange('grade', e.target.value)}
            placeholder="PSA 10, BGS 9.5, etc."
            className="bg-background border-border"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="price">Price ($) *</Label>
          <Input
            id="price"
            type="number"
            step="0.01"
            value={formData.price}
            onChange={(e) => handleChange('price', e.target.value)}
            required
            placeholder="149.99"
            className="bg-background border-border"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status *</Label>
          <Select value={formData.status} onValueChange={(value) => handleChange('status', value)}>
            <SelectTrigger className="bg-background border-border">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="For Sale">For Sale</SelectItem>
              <SelectItem value="For Trade">For Trade</SelectItem>
              <SelectItem value="Sold">Sold</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2 bg-secondary p-4 rounded-xl border border-border">
        <Label htmlFor="image">Product Image</Label>
        <Input
          id="image"
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={(e) => setImageFile(e.target.files[0])}
          className="bg-background border-border"
        />
        <p className="text-sm text-muted-foreground">
          Max file size: 20MB. Supported formats: JPG, PNG, GIF, WebP
        </p>
      </div>

      <div className="flex gap-4 pt-4 border-t border-border">
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? 'Saving...' : product ? 'Update Listing' : 'Create Listing'}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
};

export default ListingForm;