import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, X, ImagePlus } from 'lucide-react';

const INITIAL_STATE = {
  title: '',
  description: '',
  price_aud: '',
  stock_quantity: '1',
  category: '',
  product_type: 'sealed',
  status: 'active',
};

const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20MB

const ShopProductForm = ({ product = null, onSuccess, onCancel }) => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(INITIAL_STATE);
  // Each entry is either a File (new upload) or { isExisting: true, url } (kept).
  const [images, setImages] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (product) {
      setFormData({
        title: product.title || '',
        description: product.description || '',
        price_aud: product.price_aud != null ? String(product.price_aud) : '',
        stock_quantity: product.stock_quantity != null ? String(product.stock_quantity) : '0',
        category: product.category || '',
        product_type: product.product_type || 'sealed',
        status: product.status || 'active',
      });
      const existing = Array.isArray(product.images) && product.images.length
        ? product.images
        : (product.image_url ? [product.image_url] : []);
      setImages(existing.map(url => ({ isExisting: true, url })));
      setPreviewUrls(existing);
    } else {
      setFormData(INITIAL_STATE);
      setImages([]);
      setPreviewUrls([]);
    }
  }, [product]);

  const handleInputChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const valid = [];
    const urls = [];
    for (const file of files) {
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(`Image ${file.name} exceeds the 20MB limit.`);
        continue;
      }
      valid.push(file);
      urls.push(URL.createObjectURL(file));
    }
    setImages(prev => [...prev, ...valid]);
    setPreviewUrls(prev => [...prev, ...urls]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const uploadNewImages = async () => {
    const urls = [];
    for (const entry of images) {
      if (entry.isExisting) {
        urls.push(entry.url);
        continue;
      }
      const ext = entry.name?.split('.').pop() || 'jpg';
      const path = `shop-products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('media').upload(path, entry, { upsert: true });
      if (upErr) throw new Error(`Image upload failed: ${upErr.message}`);
      urls.push(supabase.storage.from('media').getPublicUrl(path).data.publicUrl);
    }
    return urls;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return toast.error('Product Name is required');
    const price = Number(formData.price_aud);
    if (formData.price_aud === '' || Number.isNaN(price) || price < 0) {
      return toast.error('A valid price is required');
    }
    const stock = parseInt(formData.stock_quantity, 10);

    setLoading(true);
    try {
      const imageUrls = await uploadNewImages();

      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        price_aud: price,
        stock_quantity: Number.isNaN(stock) ? 0 : Math.max(0, stock),
        category: formData.category.trim() || null,
        product_type: formData.product_type || null,
        status: formData.status,
        image_url: imageUrls[0] || null,
        images: imageUrls,
      };

      if (product) {
        const { error } = await supabase
          .from('shop_products')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', product.id);
        if (error) throw error;
        toast.success('Shop product updated.');
      } else {
        const { error } = await supabase
          .from('shop_products')
          .insert({ ...payload, created_by: currentUser?.id ?? null });
        if (error) throw error;
        toast.success('Product added to the shop.');
      }

      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Shop product save error:', error);
      toast.error(error.message || 'Failed to save product.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="space-y-4 bg-muted/20 p-6 rounded-2xl border border-border">
        <Label className="text-base font-bold text-foreground">Product Images</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {previewUrls.map((url, index) => (
            <div key={index} className="relative aspect-[3/4] rounded-xl overflow-hidden border border-border bg-background shadow-sm group">
              <img src={url} alt={`Preview ${index}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute top-2 right-2 bg-black/60 hover:bg-destructive text-white p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
              >
                <X size={16} />
              </button>
            </div>
          ))}

          {previewUrls.length < 10 && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="aspect-[3/4] border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/50 transition-all rounded-xl flex flex-col items-center justify-center cursor-pointer bg-background"
            >
              <ImagePlus className="w-8 h-8 mb-2 opacity-50" />
              <p className="font-bold text-xs">Add Image</p>
            </div>
          )}
        </div>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" multiple className="hidden" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Product Name <span className="text-destructive">*</span></Label>
            <Input required value={formData.title} onChange={(e) => handleInputChange('title', e.target.value)} className="bg-background" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Price ($AUD) <span className="text-destructive">*</span></Label>
              <Input required type="number" step="0.01" min="0" value={formData.price_aud} onChange={(e) => handleInputChange('price_aud', e.target.value)} className="bg-background tabular-nums" />
            </div>
            <div className="space-y-2">
              <Label>Stock Quantity</Label>
              <Input type="number" min="0" value={formData.stock_quantity} onChange={(e) => handleInputChange('stock_quantity', e.target.value)} className="bg-background tabular-nums" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={formData.description} onChange={(e) => handleInputChange('description', e.target.value)} className="bg-background min-h-[120px]" />
          </div>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Category</Label>
            <Input value={formData.category} onChange={(e) => handleInputChange('category', e.target.value)} placeholder="e.g. Pokémon, NBA" className="bg-background" />
          </div>

          <div className="space-y-2">
            <Label>Product Type</Label>
            <Select value={formData.product_type} onValueChange={(v) => handleInputChange('product_type', v)}>
              <SelectTrigger className="bg-background font-medium h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sealed">Sealed Box</SelectItem>
                <SelectItem value="single">Single Card</SelectItem>
                <SelectItem value="accessory">Accessory</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 pt-4 border-t border-border">
            <Label>Status</Label>
            <Select value={formData.status} onValueChange={(v) => handleInputChange('status', v)}>
              <SelectTrigger className="bg-background font-medium h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active (visible in shop)</SelectItem>
                <SelectItem value="draft">Draft (hidden)</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-6 border-t border-border">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel} disabled={loading} className="rounded-xl">Cancel</Button>}
        <Button type="submit" disabled={loading} className="font-bold rounded-xl active:scale-[0.98]">
          {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          {product ? 'Update Product' : 'Create Product'}
        </Button>
      </div>
    </form>
  );
};

export default ShopProductForm;
