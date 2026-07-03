import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { compressImage } from '@/utils/compressImage.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2, X, ImagePlus, Truck } from 'lucide-react';
import { SUPPLY_CATEGORIES } from '@/utils/supplyCategories.js';

const INITIAL_STATE = {
  title: '',
  description: '',
  price_aud: '',
  stock_quantity: '1',
  category: '',
  product_type: 'sealed',
  status: 'active',
  is_supply: false,
  in_stock: true,
  featured: false,
};

const INITIAL_SOURCING = {
  supplier_id: '',
  supplier_sku: '',
  cost_price_aud: '',
  markup_pct: '',
};

const DEFAULT_MARKUP_PCT = 60;

// Mirrors the server's suggestRetailPriceAud: markup over cost, rounded UP to
// the nearest 5 cents (GST-inclusive retail).
const suggestPrice = (cost, markup) => {
  const c = Number(cost);
  if (!Number.isFinite(c) || c <= 0) return null;
  const pct = markup === '' || markup == null || Number.isNaN(Number(markup)) ? DEFAULT_MARKUP_PCT : Number(markup);
  const cents = (Math.round(c * 100) * (100 + pct)) / 100;
  return (Math.ceil(cents / 5 - 1e-9) * 5) / 100;
};

const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20MB

const ShopProductForm = ({ product = null, onSuccess, onCancel }) => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(INITIAL_STATE);
  // Each entry is either a File (new upload) or { isExisting: true, url } (kept).
  const [images, setImages] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [sourcing, setSourcing] = useState(INITIAL_SOURCING);
  const [suppliers, setSuppliers] = useState([]);
  const fileInputRef = useRef(null);

  // Suppliers list for the dropship section (admin-only RLS read).
  useEffect(() => {
    supabase.from('suppliers').select('id, name, status').order('name')
      .then(({ data }) => setSuppliers(data || []));
  }, []);

  // Sourcing (supplier, SKU, cost, markup) lives in the admin-only
  // shop_product_sourcing table so margins never leak through public reads.
  useEffect(() => {
    if (!product?.id) { setSourcing(INITIAL_SOURCING); return; }
    supabase.from('shop_product_sourcing').select('*').eq('product_id', product.id).maybeSingle()
      .then(({ data }) => setSourcing({
        supplier_id: data?.supplier_id || '',
        supplier_sku: data?.supplier_sku || '',
        cost_price_aud: data?.cost_price_aud != null ? String(data.cost_price_aud) : '',
        markup_pct: data?.markup_pct != null ? String(data.markup_pct) : '',
      }));
  }, [product?.id]);

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
        is_supply: product.is_supply === true,
        in_stock: product.in_stock !== false,
        featured: product.featured === true,
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
      const compressed = await compressImage(entry);
      const ext = compressed.name?.split('.').pop() || 'jpg';
      const path = `shop-products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('media').upload(path, compressed, { upsert: true });
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
        product_type: formData.is_supply ? 'accessory' : (formData.product_type || null),
        status: formData.status,
        image_url: imageUrls[0] || null,
        images: imageUrls,
        is_supply: formData.is_supply,
        in_stock: formData.in_stock,
        featured: formData.featured,
      };

      let productId = product?.id;
      if (product) {
        const { error } = await supabase
          .from('shop_products')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', product.id);
        if (error) throw error;
        toast.success('Shop product updated.');
      } else {
        const { data: created, error } = await supabase
          .from('shop_products')
          .insert({ ...payload, created_by: currentUser?.id ?? null })
          .select('id')
          .single();
        if (error) throw error;
        productId = created.id;
        toast.success('Product added to the shop.');
      }

      if (formData.is_supply && productId) {
        const { error: sourcingErr } = await supabase.from('shop_product_sourcing').upsert({
          product_id: productId,
          supplier_id: sourcing.supplier_id || null,
          supplier_sku: sourcing.supplier_sku.trim() || null,
          cost_price_aud: sourcing.cost_price_aud !== '' ? Number(sourcing.cost_price_aud) : null,
          markup_pct: sourcing.markup_pct !== '' ? Number(sourcing.markup_pct) : null,
          updated_at: new Date().toISOString(),
        });
        if (sourcingErr) throw new Error(`Product saved but sourcing details failed: ${sourcingErr.message}`);
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
                aria-label="Remove image"
                className="absolute top-2 right-2 bg-black/60 hover:bg-destructive text-white p-1.5 rounded-lg transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
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
            {formData.is_supply ? (
              <Select value={formData.category || undefined} onValueChange={(v) => handleInputChange('category', v)}>
                <SelectTrigger className="bg-background font-medium h-11"><SelectValue placeholder="Select supply category" /></SelectTrigger>
                <SelectContent>
                  {SUPPLY_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input value={formData.category} onChange={(e) => handleInputChange('category', e.target.value)} placeholder="e.g. Pokémon, NBA" className="bg-background" />
            )}
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

      <div className="space-y-5 bg-muted/20 p-6 rounded-2xl border border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Truck className="w-5 h-5 text-primary" />
            <div>
              <Label className="text-base font-bold text-foreground">Dropshipped Supply</Label>
              <p className="text-xs text-muted-foreground">Fulfilled by a supplier — availability uses the In Stock flag instead of counted stock.</p>
            </div>
          </div>
          <Switch checked={formData.is_supply} onCheckedChange={(v) => handleInputChange('is_supply', v)} aria-label="Dropshipped supply" />
        </div>

        {formData.is_supply && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            <div className="space-y-2">
              <Label>Supplier</Label>
              <Select value={sourcing.supplier_id || undefined} onValueChange={(v) => setSourcing(s => ({ ...s, supplier_id: v }))}>
                <SelectTrigger className="bg-background font-medium h-11"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}{s.status !== 'active' ? ' (inactive)' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {suppliers.length === 0 && (
                <p className="text-xs text-muted-foreground">No suppliers yet — add one under Admin → Suppliers.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Supplier SKU</Label>
              <Input value={sourcing.supplier_sku} onChange={(e) => setSourcing(s => ({ ...s, supplier_sku: e.target.value }))} placeholder="e.g. BCW-TL-25" className="bg-background" />
            </div>

            <div className="space-y-2">
              <Label>Cost Price ($AUD)</Label>
              <Input type="number" step="0.01" min="0" value={sourcing.cost_price_aud} onChange={(e) => setSourcing(s => ({ ...s, cost_price_aud: e.target.value }))} className="bg-background tabular-nums" />
            </div>

            <div className="space-y-2">
              <Label>Markup % <span className="text-muted-foreground font-normal">(blank = default {DEFAULT_MARKUP_PCT}%)</span></Label>
              <Input type="number" step="1" min="0" value={sourcing.markup_pct} onChange={(e) => setSourcing(s => ({ ...s, markup_pct: e.target.value }))} placeholder={String(DEFAULT_MARKUP_PCT)} className="bg-background tabular-nums" />
            </div>

            {suggestPrice(sourcing.cost_price_aud, sourcing.markup_pct) != null && (
              <div className="md:col-span-2 flex items-center justify-between bg-background border border-border rounded-xl px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Suggested retail (inc. GST):{' '}
                  <span className="font-bold text-foreground tabular-nums">
                    ${suggestPrice(sourcing.cost_price_aud, sourcing.markup_pct).toFixed(2)}
                  </span>
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg font-bold"
                  onClick={() => handleInputChange('price_aud', String(suggestPrice(sourcing.cost_price_aud, sourcing.markup_pct)))}
                >
                  Use as price
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between md:col-span-1">
              <div>
                <Label className="font-semibold">In Stock</Label>
                <p className="text-xs text-muted-foreground">Buyable right now</p>
              </div>
              <Switch checked={formData.in_stock} onCheckedChange={(v) => handleInputChange('in_stock', v)} aria-label="In stock" />
            </div>

            <div className="flex items-center justify-between md:col-span-1">
              <div>
                <Label className="font-semibold">Featured</Label>
                <p className="text-xs text-muted-foreground">Pin to the top of the supplies page</p>
              </div>
              <Switch checked={formData.featured} onCheckedChange={(v) => handleInputChange('featured', v)} aria-label="Featured" />
            </div>
          </div>
        )}
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
