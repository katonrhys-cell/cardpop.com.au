
import React, { useState, useRef, useEffect } from 'react';
import pb from '@/lib/pocketbaseClient.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, X, ImagePlus } from 'lucide-react';

const INITIAL_STATE = {
  name: '',
  description: '',
  price: '',
  category: '',
  subcategory: '',
  condition: 'Mint',
  grade: '',
  stockQuantity: '1',
  visibility: 'public',
  status: 'active',
};

const ShopProductForm = ({ product = null, onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(INITIAL_STATE);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [imagesToDelete, setImagesToDelete] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        description: product.description || '',
        price: product.price ? String(product.price) : '',
        category: product.category || '',
        subcategory: product.subcategory || '',
        condition: product.condition || 'Mint',
        grade: product.grade || '',
        stockQuantity: product.stockQuantity !== null ? String(product.stockQuantity) : '1',
        visibility: product.visibility || 'public',
        status: product.status || 'active',
      });
      
      if (product.images && product.images.length > 0) {
        const urls = product.images.map(img => pb.files.getUrl(product, img));
        setPreviewUrls(urls);
        setSelectedFiles(product.images.map(img => ({ isExisting: true, filename: img })));
      }
    } else {
      setFormData(INITIAL_STATE);
      setSelectedFiles([]);
      setPreviewUrls([]);
      setImagesToDelete([]);
    }
  }, [product]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const validFiles = [];
    const newPreviewUrls = [];

    for (const file of files) {
      if (file.size > 20971520) {
        toast.error(`Image ${file.name} exceeds the 20MB limit.`);
        continue;
      }
      validFiles.push(file);
      newPreviewUrls.push(URL.createObjectURL(file));
    }

    setSelectedFiles(prev => [...prev, ...validFiles]);
    setPreviewUrls(prev => [...prev, ...newPreviewUrls]);
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index) => {
    const fileToRemove = selectedFiles[index];
    if (fileToRemove?.isExisting) {
      setImagesToDelete(prev => [...prev, fileToRemove.filename]);
    }
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return toast.error('Product Name is required');
    if (!formData.price || isNaN(formData.price)) return toast.error('A valid Price is required');
    
    setLoading(true);
    try {
      const submitData = new FormData();

      Object.entries(formData).forEach(([key, value]) => {
        if (value !== '' && value !== null) {
          if (['price', 'stockQuantity'].includes(key)) {
            submitData.append(key, Number(value));
          } else {
            submitData.append(key, value);
          }
        }
      });

      selectedFiles.forEach((file) => {
        if (!file.isExisting) submitData.append('images', file);
      });

      if (product && imagesToDelete.length > 0) {
        const remainingImages = selectedFiles
          .filter(f => f.isExisting && !imagesToDelete.includes(f.filename))
          .map(f => f.filename);
        submitData.append('images', JSON.stringify(remainingImages));
      }

      if (product) {
        await pb.collection('shop_products').update(product.id, submitData, { $autoCancel: false });
        toast.success('Shop product updated successfully!');
      } else {
        await pb.collection('shop_products').create(submitData, { $autoCancel: false });
        toast.success('Product added to shop!');
      }
      
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Submission Error:", error);
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
                onClick={() => removeFile(index)}
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
            <Input required value={formData.name} onChange={(e) => handleInputChange('name', e.target.value)} className="bg-background" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Price ($) <span className="text-destructive">*</span></Label>
              <Input required type="number" step="0.01" value={formData.price} onChange={(e) => handleInputChange('price', e.target.value)} className="bg-background tabular-nums" />
            </div>
            <div className="space-y-2">
              <Label>Stock Quantity</Label>
              <Input type="number" value={formData.stockQuantity} onChange={(e) => handleInputChange('stockQuantity', e.target.value)} className="bg-background tabular-nums" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Input value={formData.category} onChange={(e) => handleInputChange('category', e.target.value)} className="bg-background" />
            </div>
            <div className="space-y-2">
              <Label>Subcategory</Label>
              <Input value={formData.subcategory} onChange={(e) => handleInputChange('subcategory', e.target.value)} className="bg-background" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={formData.description} onChange={(e) => handleInputChange('description', e.target.value)} className="bg-background min-h-[120px]" />
          </div>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Condition</Label>
              <Select value={formData.condition} onValueChange={(v) => handleInputChange('condition', v)}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
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
              <Label>Grade (Optional)</Label>
              <Input value={formData.grade} onChange={(e) => handleInputChange('grade', e.target.value)} placeholder="e.g. PSA 10" className="bg-background" />
            </div>
          </div>

          <div className="space-y-5 pt-4 border-t border-border">
            <h3 className="font-bold text-lg">Visibility & Status</h3>
            
            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select value={formData.visibility} onValueChange={(v) => handleInputChange('visibility', v)}>
                <SelectTrigger className="bg-background font-medium h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Shop + Marketplace (Public)</SelectItem>
                  <SelectItem value="private">Shop Only (Private)</SelectItem>
                  <SelectItem value="marketplace-only">Marketplace Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => handleInputChange('status', v)}>
                <SelectTrigger className="bg-background font-medium h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                  <SelectItem value="sold">Sold Out</SelectItem>
                  <SelectItem value="delisted">Delisted</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
