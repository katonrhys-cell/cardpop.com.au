import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { compressImage } from '@/utils/compressImage.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, X, ImagePlus, Plus, Trash2, ExternalLink, RefreshCw } from 'lucide-react';
import useShopCategoryGroups from '@/hooks/useShopCategoryGroups.js';
import { normalizeSku, isValidSku, suggestSku, SKU_MAX_LENGTH } from '@/utils/shopSku.js';
import { grossMargin } from '@/src/utils/shopRrp.js';
import { variantStock } from '@/utils/shopVariants.js';
import { PREORDER_ETA_MAX_LENGTH } from '@/utils/shopStock.js';
import { escapeLike } from '@/src/utils/escapeLike.js';
import { normaliseSupplierUrl } from '@/utils/supplierUrl.js';
import apiServerClient from '@/lib/apiServerClient.js';

/**
 * Stock is decremented by the Stripe webhook while this form is open, so the
 * value loaded when it opened goes stale. Saving it back unchanged would
 * restore units that have since sold (→ oversell). Only write stock when the
 * admin actually edited the field: `original` is the string loaded into the
 * form (null/undefined for a new row, which always sends stock).
 */
export function stockEdited(current, original) {
  if (original == null) return true;
  const a = parseInt(current, 10);
  const b = parseInt(original, 10);
  if (Number.isNaN(a) && Number.isNaN(b)) return false;
  return a !== b;
}

// One-tap estimates for the pre-order field; any free text works too.
const PREORDER_ETA_PRESETS = ['Ships in 7–10 days', 'Ships in 1–2 weeks', 'Ships in 2–4 weeks', 'Ships in 4–6 weeks', 'Ships in 6–8 weeks'];

const COLOUR_CODES = { black: 'BLK', blue: 'BLU', clear: 'CLR', green: 'GRN', jade: 'JDE', navy: 'NAV', orange: 'ORA', pink: 'PNK', purple: 'PUR', red: 'RED', rose: 'ROS', turquoise: 'TQS', white: 'WHT', yellow: 'YEL', grey: 'GRY', gray: 'GRY', silver: 'SLV', gold: 'GLD' };
const suggestVariantSku = (productSku, colour) => {
  const base = normalizeSku(productSku);
  const c = String(colour || '').trim();
  if (!base || !c) return '';
  const code = COLOUR_CODES[c.toLowerCase()] || c.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  return `${base}-${code}`;
};
const newVariant = () => ({ _key: Math.random().toString(36).slice(2), id: null, sku: '', barcode: '', colour: '', colour_hex: '', stock_quantity: '0', _origStock: null, price_aud: '', status: 'active' });

const CUSTOM_CATEGORY = '__custom__';

const INITIAL_STATE = {
  title: '',
  sku: '',
  description: '',
  price_aud: '',
  retail_price_aud: '',
  // Wholesale cost lives in shop_product_costs (admin-only), not on the
  // product row — see the migration notes. Loaded/saved separately.
  wholesale_ex_gst_aud: '',
  wholesale_inc_gst_aud: '',
  // Where it's ordered from — also admin-only (shop_product_costs), and
  // watched weekly for price changes (docs/supplier-price-watch.md).
  supplier: '',
  supplier_url: '',
  stock_quantity: '1',
  // Colour family (one product per colour): siblings share family_sku.
  family_sku: '',
  colour: '',
  colour_hex: '',
  barcode: '',
  category: '',
  product_type: 'sealed',
  status: 'active',
  // Shown to buyers while status = preorder (required then).
  preorder_eta: '',
};

const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20MB

const ShopProductForm = ({ product = null, onSuccess, onCancel }) => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(INITIAL_STATE);
  // Each entry is either a File (new upload) or { isExisting: true, url } (kept).
  const [images, setImages] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  // When true, the category is a free-text value not in the shop category list
  // (e.g. legacy "Pokémon"/"NBA" products) — show the text input instead.
  const [useCustomCategory, setUseCustomCategory] = useState(false);
  // Colour variants (shop_product_variants). Each row is a sellable unit with
  // its own SKU, barcode and stock; the product's stock becomes their sum.
  const [variants, setVariants] = useState([]);
  const [removedVariantIds, setRemovedVariantIds] = useState([]);
  // Last supplier price check (read-only; written by the weekly watch).
  const [supplierWatch, setSupplierWatch] = useState(null);
  const [checkingSupplier, setCheckingSupplier] = useState(false);

  // "Check price now": the weekly supplier watch, on demand for this product.
  const checkSupplierPrice = async () => {
    if (!product?.id) return;
    setCheckingSupplier(true);
    try {
      const res = await apiServerClient.fetch(`/admin/shop-products/${product.id}/supplier-price-check`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Check failed (${res.status})`);
      setSupplierWatch((prev) => ({
        ...prev,
        supplier_price_status: body.status,
        supplier_price_error: body.error,
        supplier_price_checked_at: body.checkedAt,
        ...(body.price != null ? { supplier_price_aud: body.price, supplier_price_currency: body.currency } : {}),
        ...(body.status === 'changed' ? { supplier_price_changed_at: body.checkedAt } : {}),
      }));
      if (body.status === 'changed') toast.warning(`Supplier price changed: now $${body.price.toFixed(2)} (was $${body.previousPrice.toFixed(2)})`);
      else if (body.price != null) toast.success(`Supplier price: $${body.price.toFixed(2)}${body.currency && body.currency !== 'AUD' ? ` ${body.currency}` : ''}`);
      else toast.error(`Couldn't read the supplier's price: ${body.error}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCheckingSupplier(false);
    }
  };
  const fileInputRef = useRef(null);
  // Stock as loaded when the form opened — see stockEdited().
  const originalStockRef = useRef(null);
  // Built-in + admin-added categories (Admin → Products → Categories).
  const { groups: categoryGroups, categories: shopCategories } = useShopCategoryGroups();
  const knownCategoryNames = shopCategories.map((c) => c.name);

  useEffect(() => {
    if (product) {
      originalStockRef.current = product.stock_quantity != null ? String(product.stock_quantity) : '0';
      setFormData({
        title: product.title || '',
        sku: product.sku || '',
        description: product.description || '',
        price_aud: product.price_aud != null ? String(product.price_aud) : '',
        retail_price_aud: product.retail_price_aud != null ? String(product.retail_price_aud) : '',
        stock_quantity: product.stock_quantity != null ? String(product.stock_quantity) : '0',
        family_sku: product.family_sku || '',
        colour: product.colour || '',
        colour_hex: product.colour_hex || '',
        barcode: product.barcode || '',
        category: product.category || '',
        product_type: product.product_type || 'sealed',
        status: product.status || 'active',
        preorder_eta: product.preorder_eta || '',
      });
      const existing = Array.isArray(product.images) && product.images.length
        ? product.images
        : (product.image_url ? [product.image_url] : []);
      setImages(existing.map(url => ({ isExisting: true, url })));
      setPreviewUrls(existing);
      setUseCustomCategory(!!product.category && !knownCategoryNames.includes(product.category));
      supabase
        .from('shop_product_variants')
        .select('id, sku, barcode, colour, colour_hex, stock_quantity, price_aud, status, sort_order')
        .eq('product_id', product.id)
        .order('sort_order', { ascending: true })
        .then(({ data }) => {
          setVariants((data || []).map((v) => ({
            _key: v.id, id: v.id, sku: v.sku || '', barcode: v.barcode || '', colour: v.colour || '', colour_hex: v.colour_hex || '',
            stock_quantity: v.stock_quantity != null ? String(v.stock_quantity) : '0',
            _origStock: v.stock_quantity != null ? String(v.stock_quantity) : '0',
            price_aud: v.price_aud != null ? String(v.price_aud) : '', status: v.status || 'active',
          })));
          setRemovedVariantIds([]);
        });
      // Cost is admin-only and in its own table; fetch it for the edit form.
      supabase
        .from('shop_product_costs')
        .select('wholesale_ex_gst_aud, wholesale_inc_gst_aud, supplier, supplier_url, supplier_price_aud, supplier_price_currency, supplier_price_status, supplier_price_error, supplier_price_checked_at, supplier_price_changed_at')
        .eq('product_id', product.id)
        .maybeSingle()
        .then(({ data }) => {
          setSupplierWatch(data?.supplier_url ? data : null);
          if (!data) return;
          setFormData((prev) => ({
            ...prev,
            wholesale_ex_gst_aud: data.wholesale_ex_gst_aud != null ? String(data.wholesale_ex_gst_aud) : '',
            wholesale_inc_gst_aud: data.wholesale_inc_gst_aud != null ? String(data.wholesale_inc_gst_aud) : '',
            supplier: data.supplier || '',
            supplier_url: data.supplier_url || '',
          }));
        });
    } else {
      originalStockRef.current = null;
      setFormData(INITIAL_STATE);
      setSupplierWatch(null);
      setVariants([]);
      setRemovedVariantIds([]);
      setImages([]);
      setPreviewUrls([]);
      setUseCustomCategory(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);

  // Admin-added categories arrive after the first render — once they do, a
  // product already in one shows it in the picker rather than as free text.
  useEffect(() => {
    if (useCustomCategory && knownCategoryNames.includes(formData.category)) setUseCustomCategory(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopCategories]);

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
      const { error: upErr } = await supabase.storage.from('media').upload(path, compressed, { upsert: true, cacheControl: '31536000' });
      if (upErr) throw new Error(`Image upload failed: ${upErr.message}`);
      urls.push(supabase.storage.from('media').getPublicUrl(path).data.publicUrl);
    }
    return urls;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return toast.error('Product Name is required');
    // SKU: required, stored upper-cased. The DB also enforces uniqueness
    // (case-insensitive) and fills a CP-… default if a writer omits it, but
    // the form asks for one explicitly so every upload is deliberate.
    const sku = normalizeSku(formData.sku);
    if (!sku) return toast.error('A SKU is required — use Generate to derive one from the name');
    if (!isValidSku(sku)) {
      return toast.error(`SKU must be up to ${SKU_MAX_LENGTH} characters: letters, numbers, . _ / -`);
    }
    const price = Number(formData.price_aud);
    if (formData.price_aud === '' || Number.isNaN(price) || price < 0) {
      return toast.error('A valid price is required');
    }
    // RRP is optional; when given it must be a valid non-negative amount.
    const rrpRaw = String(formData.retail_price_aud ?? '').trim();
    const rrp = rrpRaw === '' ? null : Number(rrpRaw);
    if (rrp !== null && (Number.isNaN(rrp) || rrp < 0)) {
      return toast.error('RRP must be a valid amount, or left blank');
    }
    // Wholesale cost (optional). Either GST basis may be entered; the other
    // is derived at 10% GST when blank.
    const costRaw = (k) => String(formData[k] ?? '').trim();
    let costEx = costRaw('wholesale_ex_gst_aud') === '' ? null : Number(costRaw('wholesale_ex_gst_aud'));
    let costInc = costRaw('wholesale_inc_gst_aud') === '' ? null : Number(costRaw('wholesale_inc_gst_aud'));
    if ((costEx !== null && (Number.isNaN(costEx) || costEx < 0)) || (costInc !== null && (Number.isNaN(costInc) || costInc < 0))) {
      return toast.error('Wholesale cost must be a valid amount, or left blank');
    }
    // Supplier link (optional): stored in its canonical form, tracking stripped.
    const supplierUrlRaw = String(formData.supplier_url ?? '').trim();
    const supplierUrl = supplierUrlRaw ? normaliseSupplierUrl(supplierUrlRaw) : null;
    if (supplierUrlRaw && !supplierUrl) {
      return toast.error('Supplier link must be a full web address starting with https://');
    }
    const supplierName = String(formData.supplier ?? '').trim() || null;
    if (costEx === null && costInc !== null) costEx = Math.round((costInc / 1.1) * 100) / 100;
    if (costInc === null && costEx !== null) costInc = Math.round(costEx * 1.1 * 100) / 100;
    const stock = parseInt(formData.stock_quantity, 10);

    // A pre-order must say when it ships — that promise is the whole point
    // (the DB refuses a blank one too: shop_products_preorder_eta_required).
    const preorderEta = String(formData.preorder_eta ?? '').trim();
    if (formData.status === 'preorder' && !preorderEta) {
      return toast.error('Pre-orders need an estimated dispatch, e.g. "Ships in 4–6 weeks"');
    }
    if (preorderEta.length > PREORDER_ETA_MAX_LENGTH) {
      return toast.error(`Estimated dispatch must be ${PREORDER_ETA_MAX_LENGTH} characters or fewer`);
    }

    // Variants: every row needs a SKU; with more than one row each needs a
    // colour so shoppers can tell them apart. SKUs must be unique in the form.
    const cleanVariants = variants.map((v) => ({
      ...v,
      sku: normalizeSku(v.sku),
      barcode: String(v.barcode || '').replace(/\s/g, ''),
      colour: String(v.colour || '').trim(),
      colour_hex: String(v.colour_hex || '').trim(),
    }));
    for (const v of cleanVariants) {
      if (!v.sku) return toast.error(`Every colour variant needs a SKU (${v.colour || 'unnamed variant'})`);
      if (!isValidSku(v.sku)) return toast.error(`Variant SKU ${v.sku} is not valid`);
      if (cleanVariants.length > 1 && !v.colour) return toast.error(`Variant ${v.sku} needs a colour name`);
      if (v.price_aud !== '' && (Number.isNaN(Number(v.price_aud)) || Number(v.price_aud) < 0)) return toast.error(`Variant ${v.sku} has an invalid price`);
    }
    const variantSkus = cleanVariants.map((v) => v.sku);
    if (new Set(variantSkus).size !== variantSkus.length) return toast.error('Two colour variants share the same SKU');
    const variantBarcodes = cleanVariants.map((v) => v.barcode).filter(Boolean);
    if (new Set(variantBarcodes).size !== variantBarcodes.length) return toast.error('Two colour variants share the same barcode');

    setLoading(true);
    try {
      // Friendly pre-check so a duplicate SKU reads as a clear message rather
      // than a raw constraint error. The unique index is the real guard.
      let dupQuery = supabase.from('shop_products').select('id, title').ilike('sku', escapeLike(sku)).limit(1);
      if (product?.id) dupQuery = dupQuery.neq('id', product.id);
      const { data: dup } = await dupQuery;
      if (dup && dup.length) {
        toast.error(`SKU ${sku} is already used by "${dup[0].title}"`);
        setLoading(false);
        return;
      }

      const imageUrls = await uploadNewImages();

      const payload = {
        title: formData.title.trim(),
        sku,
        description: formData.description.trim() || null,
        price_aud: price,
        retail_price_aud: rrp,
        category: formData.category.trim() || null,
        product_type: formData.product_type || null,
        status: formData.status,
        image_url: imageUrls[0] || null,
        images: imageUrls,
      };
      // Colour-family fields. Sent once the columns exist (an edited row that
      // carries them) or when filled in, so saving never trips over a column
      // that a pending migration hasn't added yet.
      const familyFields = {
        family_sku: normalizeSku(formData.family_sku) || null,
        colour: formData.colour.trim() || null,
        colour_hex: /^#[0-9a-f]{6}$/i.test(formData.colour_hex.trim()) ? formData.colour_hex.trim() : null,
        barcode: formData.barcode.replace(/\s+/g, '') || null,
      };
      if ((product && 'family_sku' in product) || Object.values(familyFields).some((v) => v != null)) {
        Object.assign(payload, familyFields);
      }
      // Same guard for the pre-order estimate: only sent once the column
      // exists (an edited row carries it) or when one has been typed. Kept
      // when the product goes back to active, so flipping it again is quick.
      if ((product && 'preorder_eta' in product) || preorderEta) {
        payload.preorder_eta = preorderEta || null;
      }
      // Only (re)write stock when the admin changed it, or for a new product —
      // otherwise sales made while the form was open would be undone.
      if (!product || stockEdited(formData.stock_quantity, originalStockRef.current)) {
        payload.stock_quantity = Number.isNaN(stock) ? 0 : Math.max(0, stock);
      }

      let productId = product?.id ?? null;
      if (product) {
        const { error } = await supabase
          .from('shop_products')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', product.id);
        if (error) throw error;
        toast.success('Shop product updated.');
      } else {
        const { data: inserted, error } = await supabase
          .from('shop_products')
          .insert({ ...payload, created_by: currentUser?.id ?? null })
          .select('id')
          .single();
        if (error) throw error;
        productId = inserted?.id ?? null;
        toast.success('Product added to the shop.');
      }

      // Colour variants: upsert the rows in the form, delete the ones removed.
      // The parent's stock_quantity / has_variants are kept by a DB trigger.
      if (productId) {
        if (removedVariantIds.length) {
          const { error: delErr } = await supabase.from('shop_product_variants').delete().in('id', removedVariantIds);
          if (delErr) toast.error(`Product saved, but removing a variant failed: ${delErr.message}`);
        }
        if (cleanVariants.length) {
          const rows = cleanVariants.map((v, i) => ({
            ...(v.id ? { id: v.id } : {}),
            product_id: productId,
            sku: v.sku,
            barcode: v.barcode || null,
            colour: v.colour || null,
            colour_hex: v.colour_hex || null,
            // Existing variants keep their live stock unless edited here.
            ...(!v.id || stockEdited(v.stock_quantity, v._origStock)
              ? { stock_quantity: Math.max(0, parseInt(v.stock_quantity, 10) || 0) }
              : {}),
            price_aud: v.price_aud === '' ? null : Number(v.price_aud),
            status: v.status === 'archived' ? 'archived' : 'active',
            sort_order: i,
          }));
          // A bulk upsert sends the union of columns, so a row without
          // stock_quantity would be reset to the default. Upsert the two
          // shapes separately so untouched stock is never written.
          const withStock = rows.filter((r) => 'stock_quantity' in r);
          const withoutStock = rows.filter((r) => !('stock_quantity' in r));
          let varErr = null;
          for (const group of [withStock, withoutStock]) {
            if (!group.length || varErr) continue;
            const { error } = await supabase.from('shop_product_variants').upsert(group, { onConflict: 'id' });
            if (error) varErr = error;
          }
          if (varErr) {
            toast.error(varErr.code === '23505'
              ? 'Product saved, but a variant SKU or barcode is already used by another product'
              : `Product saved, but the colour variants were not: ${varErr.message}`);
          }
        }
      }

      // Cost row: upsert when a cost or supplier link was entered, remove when
      // all of them are cleared.
      if (productId) {
        if (costEx !== null || supplierUrl || supplierName) {
          const costRow = {
            product_id: productId,
            wholesale_ex_gst_aud: costEx,
            wholesale_inc_gst_aud: costInc,
            supplier: supplierName,
            supplier_url: supplierUrl,
            updated_at: new Date().toISOString(),
            updated_by: currentUser?.id ?? null,
          };
          // A new link starts a fresh price history: don't compare its first
          // reading against the old page's price.
          if (supplierUrl !== (supplierWatch?.supplier_url ?? null)) {
            Object.assign(costRow, {
              supplier_price_aud: null,
              supplier_price_currency: null,
              supplier_price_status: null,
              supplier_price_error: null,
              supplier_price_checked_at: null,
              supplier_price_changed_at: null,
            });
          }
          const { error: costErr } = await supabase
            .from('shop_product_costs')
            .upsert(costRow, { onConflict: 'product_id' });
          if (costErr) toast.error(`Product saved, but the wholesale cost / supplier link was not: ${costErr.message}`);
        } else if (product) {
          await supabase.from('shop_product_costs').delete().eq('product_id', productId);
        }
      }

      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Shop product save error:', error);
      if (error?.code === '23505' && /sku/i.test(error.message || '')) {
        toast.error(`SKU ${sku} is already in use`);
      } else {
        toast.error(error.message || 'Failed to save product.');
      }
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
            <Label htmlFor="shop-product-title">Product Name <span className="text-destructive">*</span></Label>
            <Input id="shop-product-title" required value={formData.title} onChange={(e) => handleInputChange('title', e.target.value)} className="bg-background" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="shop-product-sku">SKU <span className="text-destructive">*</span></Label>
            <div className="flex gap-2">
              <Input
                id="shop-product-sku"
                required
                maxLength={SKU_MAX_LENGTH}
                placeholder="e.g. ZB-09 or CP-ACRYLIC-STAND-5-PACK"
                value={formData.sku}
                onChange={(e) => handleInputChange('sku', e.target.value.toUpperCase())}
                className="bg-background font-mono uppercase"
                autoComplete="off"
                spellCheck={false}
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                disabled={!formData.title.trim()}
                onClick={() => handleInputChange('sku', suggestSku(formData.title))}
                title="Derive a CP-… SKU from the product name"
              >
                Generate
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use the manufacturer's SKU for wholesale stock; house products use <span className="font-mono">CP-…</span>. Must be unique.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="shop-product-price">Price ($AUD) <span className="text-destructive">*</span></Label>
              <Input id="shop-product-price" required type="number" step="0.01" min="0" value={formData.price_aud} onChange={(e) => handleInputChange('price_aud', e.target.value)} className="bg-background tabular-nums" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shop-product-stock">Stock Quantity</Label>
              {variants.length > 0 ? (
                <>
                  <Input id="shop-product-stock" type="number" value={variants.reduce((s, v) => s + variantStock(v), 0)} disabled className="bg-muted tabular-nums" />
                  <p className="text-[11px] text-muted-foreground">Sum of the colour variants below</p>
                </>
              ) : (
                <Input id="shop-product-stock" type="number" min="0" value={formData.stock_quantity} onChange={(e) => handleInputChange('stock_quantity', e.target.value)} className="bg-background tabular-nums" />
              )}
              {formData.status === 'preorder' && (
                <p className="text-[11px] text-muted-foreground">Pre-orders are unlimited and don&apos;t use stock. Set this to what you have on hand when it arrives and you switch to Active.</p>
              )}
            </div>
          </div>

          {/* Wholesale cost — admin-only (shop_product_costs). Enter either
              basis; the other is derived at 10% GST on save. */}
          <div className="space-y-2">
            <Label>Wholesale cost <span className="text-muted-foreground font-normal">(admin-only, optional)</span></Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Input
                  id="shop-product-cost-ex"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="ex GST"
                  aria-label="Wholesale cost ex GST"
                  value={formData.wholesale_ex_gst_aud}
                  onChange={(e) => handleInputChange('wholesale_ex_gst_aud', e.target.value)}
                  className="bg-background tabular-nums"
                />
                <p className="text-[11px] text-muted-foreground">ex GST</p>
              </div>
              <div className="space-y-1">
                <Input
                  id="shop-product-cost-inc"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="inc GST"
                  aria-label="Wholesale cost inc GST"
                  value={formData.wholesale_inc_gst_aud}
                  onChange={(e) => handleInputChange('wholesale_inc_gst_aud', e.target.value)}
                  className="bg-background tabular-nums"
                />
                <p className="text-[11px] text-muted-foreground">inc GST</p>
              </div>
            </div>
            {(() => {
              const ex = formData.wholesale_ex_gst_aud !== '' ? Number(formData.wholesale_ex_gst_aud)
                : formData.wholesale_inc_gst_aud !== '' ? Number(formData.wholesale_inc_gst_aud) / 1.1 : NaN;
              const m = grossMargin(formData.price_aud, ex);
              return m == null ? null : (
                <p className={`text-xs font-semibold ${m < 0 ? 'text-destructive' : m < 0.2 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  Gross margin at this price: {(m * 100).toFixed(0)}% (ex GST)
                </p>
              );
            })()}
          </div>

          {/* Supplier — admin-only (shop_product_costs). The link is checked
              weekly for price changes; admins get a bell notification when
              it moves (docs/supplier-price-watch.md). */}
          <div className="space-y-2">
            <Label htmlFor="shop-product-supplier-url">Supplier <span className="text-muted-foreground font-normal">(admin-only, optional)</span></Label>
            <Input
              id="shop-product-supplier"
              placeholder="Supplier name, e.g. Temu"
              aria-label="Supplier name"
              value={formData.supplier}
              onChange={(e) => handleInputChange('supplier', e.target.value)}
              className="bg-background"
            />
            <div className="flex gap-2">
              <Input
                id="shop-product-supplier-url"
                type="url"
                inputMode="url"
                placeholder="https://… link to where you order it"
                value={formData.supplier_url}
                onChange={(e) => handleInputChange('supplier_url', e.target.value)}
                className="bg-background"
              />
              {normaliseSupplierUrl(formData.supplier_url) && (
                <Button type="button" variant="outline" size="icon" asChild>
                  <a href={normaliseSupplierUrl(formData.supplier_url)} target="_blank" rel="noopener noreferrer" aria-label="Open supplier link">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
            {(() => {
              const saved = supplierWatch?.supplier_url;
              const unsaved = normaliseSupplierUrl(formData.supplier_url) !== (saved ?? null);
              if (!saved || unsaved) {
                return formData.supplier_url
                  ? <p className="text-[11px] text-muted-foreground">Save the product to start the weekly price check on this link.</p>
                  : <p className="text-[11px] text-muted-foreground">Add the page you order this from and its price is checked once a week.</p>;
              }
              const w = supplierWatch;
              const when = (iso) => (iso ? new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : null);
              const price = w.supplier_price_aud != null
                ? `$${Number(w.supplier_price_aud).toFixed(2)}${w.supplier_price_currency && w.supplier_price_currency !== 'AUD' ? ` ${w.supplier_price_currency}` : ''}`
                : null;
              const failing = w.supplier_price_status === 'unreadable' || w.supplier_price_status === 'error';
              return (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {!w.supplier_price_checked_at && <span className="text-muted-foreground">Not checked yet — the weekly check will pick it up.</span>}
                  {w.supplier_price_checked_at && price && (
                    <span className={w.supplier_price_status === 'changed' ? 'font-semibold text-amber-600' : 'text-muted-foreground'}>
                      Supplier price {price} · checked {when(w.supplier_price_checked_at)}
                      {w.supplier_price_changed_at ? ` · last changed ${when(w.supplier_price_changed_at)}` : ''}
                    </span>
                  )}
                  {w.supplier_price_checked_at && failing && (
                    <span className="text-destructive">Couldn&apos;t read the price on {when(w.supplier_price_checked_at)}: {w.supplier_price_error}</span>
                  )}
                  <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={checkSupplierPrice} disabled={checkingSupplier}>
                    {checkingSupplier ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                    Check price now
                  </Button>
                </div>
              );
            })()}
          </div>

          {/* RRP: the manufacturer's recommended retail price. Shown
              struck-through on the shop when it's above the selling price.
              "Use RRP as price" is the one-click "sell at RRP" path. */}
          <div className="space-y-2">
            <Label htmlFor="shop-product-rrp">RRP ($AUD) <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <div className="flex gap-2">
              <Input
                id="shop-product-rrp"
                type="number"
                step="0.01"
                min="0"
                placeholder="Recommended retail price"
                value={formData.retail_price_aud}
                onChange={(e) => handleInputChange('retail_price_aud', e.target.value)}
                className="bg-background tabular-nums"
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                disabled={String(formData.retail_price_aud ?? '').trim() === ''}
                onClick={() => handleInputChange('price_aud', String(formData.retail_price_aud).trim())}
              >
                Use RRP as price
              </Button>
            </div>
          </div>

          {/* Colour family: each colour is its own product (own price, stock,
              photos and grid card). Give siblings the same family SKU — the
              line SKU, e.g. ZB-04 — and product pages offer them as a colour
              picker that switches between them. */}
          <div className="space-y-3 pt-4 border-t border-border">
            <div>
              <Label>Colour family <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <p className="text-xs text-muted-foreground mt-1">
                For one product per colour. Products sharing a family SKU are linked on their product pages so shoppers can flick between colours.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="shop-product-family" className="text-xs">Family SKU</Label>
                <Input id="shop-product-family" placeholder="e.g. ZB-04" value={formData.family_sku}
                  onChange={(e) => handleInputChange('family_sku', e.target.value.toUpperCase())} className="bg-background font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="shop-product-colour" className="text-xs">Colour</Label>
                <div className="flex gap-2">
                  <Input id="shop-product-colour" placeholder="e.g. Pink" value={formData.colour}
                    onChange={(e) => handleInputChange('colour', e.target.value)} className="bg-background" />
                  <input type="color" aria-label="Swatch colour" value={/^#[0-9a-f]{6}$/i.test(formData.colour_hex) ? formData.colour_hex : '#cccccc'}
                    onChange={(e) => handleInputChange('colour_hex', e.target.value)}
                    className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-border bg-background p-1" />
                </div>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="shop-product-barcode" className="text-xs">Barcode (EAN)</Label>
                <Input id="shop-product-barcode" inputMode="numeric" placeholder="Printed on the packaging" value={formData.barcode}
                  onChange={(e) => handleInputChange('barcode', e.target.value)} className="bg-background font-mono" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={formData.description} onChange={(e) => handleInputChange('description', e.target.value)} className="bg-background min-h-[120px]" />
          </div>

          {/* Colour variants — each is a sellable unit with its own SKU,
              barcode and stock. Shoppers pick one on the product page. */}
          <div className="space-y-2 pt-4 border-t border-border">
            <div className="flex items-center justify-between gap-2">
              <Label>Colour variants <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setVariants((prev) => [...prev, newVariant()])}
              >
                <Plus className="w-4 h-4 mr-1" /> Add colour
              </Button>
            </div>
            {variants.length === 0 ? (
              <p className="text-xs text-muted-foreground">No variants — this product is sold as a single unit with the stock above. Add a colour to sell and track stock per colour (each colour gets its own SKU and barcode).</p>
            ) : (
              <div className="space-y-2">
                <div className="hidden md:grid grid-cols-[1.1fr_1.2fr_1.3fr_0.6fr_0.8fr_auto_auto] gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1">
                  <span>Colour</span><span>SKU</span><span>Barcode</span><span>Stock</span><span>Price</span><span>Active</span><span></span>
                </div>
                {variants.map((v, i) => (
                  <div key={v._key} className="grid grid-cols-2 md:grid-cols-[1.1fr_1.2fr_1.3fr_0.6fr_0.8fr_auto_auto] gap-2 items-center rounded-xl border border-border p-2 bg-background/50">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        aria-label={`Swatch for ${v.colour || 'variant'}`}
                        value={/^#[0-9a-f]{6}$/i.test(v.colour_hex) ? v.colour_hex : '#888888'}
                        onChange={(e) => setVariants((prev) => prev.map((x, j) => (j === i ? { ...x, colour_hex: e.target.value } : x)))}
                        className="h-8 w-8 rounded-md border border-border bg-transparent p-0 shrink-0"
                      />
                      <Input
                        aria-label="Variant colour"
                        placeholder="Colour"
                        value={v.colour}
                        onChange={(e) => setVariants((prev) => prev.map((x, j) => (j === i ? { ...x, colour: e.target.value, sku: x.sku || suggestVariantSku(formData.sku, e.target.value) } : x)))}
                        className="bg-background h-9"
                      />
                    </div>
                    <Input
                      aria-label="Variant SKU"
                      placeholder="SKU"
                      value={v.sku}
                      onChange={(e) => setVariants((prev) => prev.map((x, j) => (j === i ? { ...x, sku: e.target.value.toUpperCase() } : x)))}
                      className="bg-background h-9 font-mono text-xs uppercase"
                    />
                    <Input
                      aria-label="Variant barcode"
                      placeholder="Barcode (EAN)"
                      inputMode="numeric"
                      value={v.barcode}
                      onChange={(e) => setVariants((prev) => prev.map((x, j) => (j === i ? { ...x, barcode: e.target.value } : x)))}
                      className="bg-background h-9 font-mono text-xs"
                    />
                    <Input
                      aria-label="Variant stock"
                      type="number"
                      min="0"
                      value={v.stock_quantity}
                      onChange={(e) => setVariants((prev) => prev.map((x, j) => (j === i ? { ...x, stock_quantity: e.target.value } : x)))}
                      className="bg-background h-9 tabular-nums"
                    />
                    <Input
                      aria-label="Variant price override"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={formData.price_aud || 'Product price'}
                      value={v.price_aud}
                      onChange={(e) => setVariants((prev) => prev.map((x, j) => (j === i ? { ...x, price_aud: e.target.value } : x)))}
                      className="bg-background h-9 tabular-nums"
                    />
                    <label className="flex items-center gap-1.5 text-xs justify-self-center">
                      <input
                        type="checkbox"
                        aria-label="Variant active"
                        checked={v.status !== 'archived'}
                        onChange={(e) => setVariants((prev) => prev.map((x, j) => (j === i ? { ...x, status: e.target.checked ? 'active' : 'archived' } : x)))}
                      />
                      <span className="md:hidden">Active</span>
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${v.colour || 'variant'}`}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        if (v.id) setRemovedVariantIds((prev) => [...prev, v.id]);
                        setVariants((prev) => prev.filter((_, j) => j !== i));
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">Leave a variant&apos;s price blank to use the product price. Untick Active to hide a colour without deleting its history.</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={useCustomCategory ? CUSTOM_CATEGORY : (formData.category || '')}
              onValueChange={(v) => {
                if (v === CUSTOM_CATEGORY) {
                  setUseCustomCategory(true);
                  handleInputChange('category', '');
                } else {
                  setUseCustomCategory(false);
                  handleInputChange('category', v);
                }
              }}
            >
              <SelectTrigger className="bg-background font-medium h-11">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categoryGroups.map((group) => (
                  <SelectGroup key={group.slug}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.items.map((item) => (
                      <SelectItem key={item.slug} value={item.name}>{item.name}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
                <SelectSeparator />
                <SelectItem value={CUSTOM_CATEGORY}>Other / custom…</SelectItem>
              </SelectContent>
            </Select>
            {useCustomCategory && (
              <Input
                value={formData.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
                placeholder="e.g. Pokémon, NBA, Sealed Boxes"
                className="bg-background mt-2"
              />
            )}
            <p className="text-xs text-muted-foreground">
              Pick a shop category so the product appears on its dropdown page, or choose “Other / custom…” for a one-off category.
            </p>
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
                <SelectItem value="preorder">Pre-order (for sale now, ships later — shows your estimate)</SelectItem>
                <SelectItem value="coming_soon">Coming soon (visible, not for sale — enquiry button)</SelectItem>
                <SelectItem value="draft">Draft (hidden)</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.status === 'preorder' && (
            <div className="space-y-2">
              <Label htmlFor="shop-product-preorder-eta">Estimated dispatch *</Label>
              <Input
                id="shop-product-preorder-eta"
                value={formData.preorder_eta}
                maxLength={PREORDER_ETA_MAX_LENGTH}
                placeholder="e.g. Ships in 4–6 weeks, or Expected mid-November"
                onChange={(e) => handleInputChange('preorder_eta', e.target.value)}
                className="bg-background"
              />
              <div className="flex flex-wrap gap-1.5">
                {PREORDER_ETA_PRESETS.map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    size="sm"
                    variant={formData.preorder_eta === preset ? 'default' : 'outline'}
                    className="h-7 rounded-full text-xs"
                    onClick={() => handleInputChange('preorder_eta', preset)}
                  >
                    {preset}
                  </Button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Shown on the product, in the cart and at checkout, and saved on each order so the buyer
                keeps the estimate they bought with. Buyers pay in full now. Switch the status to Active
                when stock arrives.
              </p>
            </div>
          )}
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
