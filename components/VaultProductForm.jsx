
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2, X, ImagePlus } from 'lucide-react';
import { useCardOCR } from '@/hooks/useCardOCR.js';
import { useEbayPriceLookup } from '@/hooks/useEbayPriceLookup.js';
import CardScanPanel from '@/components/CardScanPanel.jsx';
import { COLLECTIONS_LIST } from '@/components/Header.jsx';
import { VARIANT_GROUPS } from '@/lib/cardVariants.js';

const INITIAL_STATE = {
  name: '',
  description: '',
  price: '',
  collectionType: '',
  categoryId: '',
  subcategoryId: '',
  brandId: '',
  seriesId: '',
  condition: 'Mint',
  grade: '',
  gradeScore: '',
  stockQuantity: '1',
  cardNumber: '',
  cardSetName: '',
  releaseYear: '',
  gradingService: 'None',
  certificationNumber: '',
  rarity: 'Common',
  cardType: '',
  cardVariants: [],
  listing_type: 'Private',
  is_public: false,
};

const VaultProductForm = ({ card = null, onSuccess, onCancel }) => {
  const { currentUser } = useAuth();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(INITIAL_STATE);
  const { scanCard, isScanning, scanResult, clearScan } = useCardOCR();
  const { lookupPrice, isLookingUp, priceData, clearPrice } = useEbayPriceLookup();

  useEffect(() => {
    if (scanResult) lookupPrice(scanResult);
  }, [scanResult, lookupPrice]);
  
  // Independent Classification Toggles
  const [enableCat, setEnableCat] = useState(false);
  const [enableSub, setEnableSub] = useState(false);
  const [enableBrand, setEnableBrand] = useState(false);
  const [enableSeries, setEnableSeries] = useState(false);

  // Hierarchy Data States (All fetched independently)
  const [allCategories, setAllCategories] = useState([]);
  const [allSubcategories, setAllSubcategories] = useState([]);
  const [allBrands, setAllBrands] = useState([]);
  const [allSeries, setAllSeries] = useState([]);
  const [fetchingHierarchy, setFetchingHierarchy] = useState(false);

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [imagesToDelete, setImagesToDelete] = useState([]);
  const fileInputRef = useRef(null);

  // Initial Load & Populate
  useEffect(() => {
    const initData = async () => {
      setFetchingHierarchy(true);
      try {
        const { data: cats } = await supabase.from('categories').select('*').is('parent_id', null).order('name');
        const { data: subs } = await supabase.from('categories').select('*').not('parent_id', 'is', null).order('name');
        // brands and series have no Supabase equivalent — use empty arrays
        console.warn('[VaultProductForm] brands/series collections have no Supabase equivalent');
        const brnds = [];
        const srs = [];
        setAllCategories(cats || []);
        setAllSubcategories(subs || []);
        setAllBrands(brnds);
        setAllSeries(srs);

        if (card) {
          setFormData({
            name: card.name || '',
            description: card.description || '',
            price: card.price !== null && card.price !== undefined ? String(card.price) : '',
            collectionType: card.collectionType || '',
            categoryId: card.categoryId || '',
            subcategoryId: card.subcategoryId || '',
            brandId: card.brandId || '',
            seriesId: card.seriesId || '',
            condition: card.condition || 'Mint',
            grade: card.grade || '',
            gradeScore: card.gradeScore !== null && card.gradeScore !== undefined ? String(card.gradeScore) : '',
            stockQuantity: card.stockQuantity !== null && card.stockQuantity !== undefined ? String(card.stockQuantity) : '1',
            cardNumber: card.cardNumber || '',
            cardSetName: card.cardSetName || '',
            releaseYear: card.releaseYear !== null && card.releaseYear !== undefined ? String(card.releaseYear) : '',
            gradingService: card.gradingService || 'None',
            certificationNumber: card.certificationNumber || '',
            rarity: card.rarity || 'Common',
            cardType: card.cardType || '',
            cardVariants: Array.isArray(card.cardVariants) ? card.cardVariants : [],
            listing_type: card.listing_type || 'Private',
            is_public: card.is_public || false,
          });

          setEnableCat(!!card.categoryId);
          setEnableSub(!!card.subcategoryId);
          setEnableBrand(!!card.brandId);
          setEnableSeries(!!card.seriesId);
          
          if (card.images && card.images.length > 0) {
            const urls = card.images.map(img => (typeof img === 'string' && img.startsWith('http') ? img : img));
            setPreviewUrls(urls);
            setSelectedFiles(card.images.map(img => ({ isExisting: true, filename: img })));
          }
        } else {
          setFormData(INITIAL_STATE);
          setEnableCat(false);
          setEnableSub(false);
          setEnableBrand(false);
          setEnableSeries(false);
          setSelectedFiles([]);
          setPreviewUrls([]);
          setImagesToDelete([]);
        }
      } catch (err) {
        console.error("Failed to load hierarchy data", err);
      } finally {
        setFetchingHierarchy(false);
      }
    };
    initData();
  }, [card]);

  // Auto-sync is_public based on listing_type
  useEffect(() => {
    const shouldBePublic = formData.listing_type !== 'Private';
    if (formData.is_public !== shouldBePublic) {
      setFormData(prev => ({ ...prev, is_public: shouldBePublic }));
    }
  }, [formData.listing_type]);

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

    if (!validFiles.length) return;

    const isFirstImage = selectedFiles.length === 0 && previewUrls.length === 0;
    setSelectedFiles(prev => [...prev, ...validFiles]);
    setPreviewUrls(prev => [...prev, ...newPreviewUrls]);
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (isFirstImage) {
      scanCard(validFiles[0]);
    }
  };

  const handleApplyScan = () => {
    if (!scanResult) return;
    setFormData(prev => ({
      ...prev,
      ...(scanResult.name && { name: scanResult.name }),
      ...(scanResult.description && { description: scanResult.description }),
      ...(scanResult.collectionType && { collectionType: scanResult.collectionType }),
      ...(scanResult.cardSetName && { cardSetName: scanResult.cardSetName }),
      ...(scanResult.cardNumber && { cardNumber: scanResult.cardNumber }),
      ...(scanResult.releaseYear && { releaseYear: scanResult.releaseYear }),
      ...(scanResult.condition && { condition: scanResult.condition }),
      ...(scanResult.gradingService && { gradingService: scanResult.gradingService }),
      ...(scanResult.gradeScore && { gradeScore: scanResult.gradeScore }),
      ...(scanResult.certificationNumber && { certificationNumber: scanResult.certificationNumber }),
      ...(scanResult.rarity && { rarity: scanResult.rarity }),
      ...(scanResult.cardType && { cardType: scanResult.cardType }),
    }));
    clearScan();
    clearPrice();
    toast.success('Fields updated from scan. Review and adjust as needed.');
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
    
    if (!formData.name.trim()) return toast.error('Card Name is required');
    if (!formData.price || !Number.isInteger(Number(formData.price)) || Number(formData.price) < 0) return toast.error('Price must be a whole number (e.g. 5 not 5.99)');
    if (!formData.listing_type) return toast.error('Listing Type is required');
    
    const expectedPublic = formData.listing_type !== 'Private';
    if (formData.is_public !== expectedPublic) {
      formData.is_public = expectedPublic;
    }

    setLoading(true);
    try {
      const submitData = new FormData();
      
      if (!card) submitData.append('user_id', currentUser.id);

      // Append basic fields
      Object.entries(formData).forEach(([key, value]) => {
        if (!['categoryId', 'subcategoryId', 'brandId', 'seriesId'].includes(key)) {
          if (key === 'cardVariants') {
            // Multi-select: append each value separately (or empty string to clear)
            if (Array.isArray(value) && value.length > 0) {
              value.forEach(v => submitData.append(key, v));
            } else {
              submitData.append(key, '');
            }
          } else if (value !== '' && value !== null) {
            if (['price', 'gradeScore', 'stockQuantity', 'releaseYear'].includes(key)) {
              submitData.append(key, Number(value));
            } else if (key === 'is_public') {
              submitData.append(key, value === true || value === 'true');
            } else {
              submitData.append(key, value);
            }
          }
        }
      });

      // Append independent classifications and their names
      if (enableCat && formData.categoryId) {
        submitData.append('categoryId', formData.categoryId);
        submitData.append('category', allCategories.find(c => c.id === formData.categoryId)?.name || '');
      } else {
        submitData.append('categoryId', '');
        submitData.append('category', '');
      }

      if (enableSub && formData.subcategoryId) {
        submitData.append('subcategoryId', formData.subcategoryId);
        submitData.append('subcategory', allSubcategories.find(c => c.id === formData.subcategoryId)?.name || '');
      } else {
        submitData.append('subcategoryId', '');
        submitData.append('subcategory', '');
      }

      if (enableBrand && formData.brandId) {
        submitData.append('brandId', formData.brandId);
        submitData.append('brand', allBrands.find(c => c.id === formData.brandId)?.name || '');
      } else {
        submitData.append('brandId', '');
        submitData.append('brand', '');
      }

      if (enableSeries && formData.seriesId) {
        submitData.append('seriesId', formData.seriesId);
        submitData.append('series', allSeries.find(c => c.id === formData.seriesId)?.name || '');
      } else {
        submitData.append('seriesId', '');
        submitData.append('series', '');
      }

      selectedFiles.forEach((file) => {
        if (!file.isExisting) submitData.append('images', file);
      });

      if (card && imagesToDelete.length > 0) {
        const remainingImages = selectedFiles
          .filter(f => f.isExisting && !imagesToDelete.includes(f.filename))
          .map(f => f.filename);
        submitData.append('images', JSON.stringify(remainingImages));
      }

      // Convert FormData to plain object for Supabase
      const dataObj = {};
      submitData.forEach((value, key) => { dataObj[key] = value; });

      if (card) {
        const { error } = await supabase.from('vault_items').update(dataObj).eq('id', card.id).eq('owner_id', currentUser.id);
        if (error) throw error;
        toast.success('Vault item updated successfully!');
      } else {
        const { error } = await supabase.from('vault_items').insert(dataObj);
        if (error) throw error;
        toast.success('Card added to your vault!');
      }
      
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Submission Error:", error);
      toast.error(error.message || 'Failed to save card.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 bg-card text-card-foreground">
      <div className="space-y-4 bg-muted/30 p-6 rounded-2xl border border-border">
        <Label className="text-base font-bold text-foreground">Card Images</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {previewUrls.map((url, index) => (
            <div key={index} className="relative aspect-[3/4] rounded-xl overflow-hidden border border-border bg-background shadow-sm group">
              <img src={url} alt={`Preview ${index}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="absolute top-2 right-2 bg-black/60 hover:bg-destructive text-white p-1.5 rounded-lg transition-colors backdrop-blur-sm opacity-0 group-hover:opacity-100"
              >
                <X size={16} />
              </button>
            </div>
          ))}

          {previewUrls.length < 10 && (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="aspect-[3/4] border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/50 transition-all rounded-xl flex flex-col items-center justify-center cursor-pointer bg-background text-muted-foreground"
            >
              <ImagePlus className="w-8 h-8 mb-2 opacity-50" />
              <p className="font-bold text-xs text-foreground">Add Image</p>
            </div>
          )}
        </div>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" multiple className="hidden" />
      </div>

      <CardScanPanel
        isScanning={isScanning}
        scanResult={scanResult}
        onApply={handleApplyScan}
        onDismiss={() => { clearScan(); clearPrice(); }}
        isLookingUp={isLookingUp}
        priceData={priceData}
        onApplyPrice={(price) => {
          const rounded = Math.round(price);
          handleInputChange('price', String(rounded));
          toast.success(`Price set to $${rounded} AUD from eBay estimate.`);
        }}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-5">
          <div className="border-b border-border pb-3">
            <h3 className="font-bold text-lg text-foreground">Independent Classification</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Select any combination of classifications. None are required.
            </p>
          </div>
          
          <div className="space-y-4">
            <div className="flex flex-col gap-2 p-3 border border-border rounded-xl bg-muted/10">
              <div className="flex items-center justify-between">
                <Label className="font-semibold cursor-pointer" onClick={() => setEnableCat(!enableCat)}>Include Category</Label>
                <Switch checked={enableCat} onCheckedChange={setEnableCat} />
              </div>
              {enableCat && (
                <Select value={formData.categoryId} onValueChange={(v) => handleInputChange('categoryId', v)} disabled={fetchingHierarchy}>
                  <SelectTrigger className="bg-background mt-2"><SelectValue placeholder="Select Category" /></SelectTrigger>
                  <SelectContent>
                    {allCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex flex-col gap-2 p-3 border border-border rounded-xl bg-muted/10">
              <div className="flex items-center justify-between">
                <Label className="font-semibold cursor-pointer" onClick={() => setEnableSub(!enableSub)}>Include Subcategory</Label>
                <Switch checked={enableSub} onCheckedChange={setEnableSub} />
              </div>
              {enableSub && (
                <Select value={formData.subcategoryId} onValueChange={(v) => handleInputChange('subcategoryId', v)} disabled={fetchingHierarchy}>
                  <SelectTrigger className="bg-background mt-2"><SelectValue placeholder="Select Subcategory" /></SelectTrigger>
                  <SelectContent>
                    {allSubcategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex flex-col gap-2 p-3 border border-border rounded-xl bg-muted/10">
              <div className="flex items-center justify-between">
                <Label className="font-semibold cursor-pointer" onClick={() => setEnableBrand(!enableBrand)}>Include Brand</Label>
                <Switch checked={enableBrand} onCheckedChange={setEnableBrand} />
              </div>
              {enableBrand && (
                <Select value={formData.brandId} onValueChange={(v) => handleInputChange('brandId', v)} disabled={fetchingHierarchy}>
                  <SelectTrigger className="bg-background mt-2"><SelectValue placeholder="Select Brand" /></SelectTrigger>
                  <SelectContent>
                    {allBrands.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex flex-col gap-2 p-3 border border-border rounded-xl bg-muted/10">
              <div className="flex items-center justify-between">
                <Label className="font-semibold cursor-pointer" onClick={() => setEnableSeries(!enableSeries)}>Include Series</Label>
                <Switch checked={enableSeries} onCheckedChange={setEnableSeries} />
              </div>
              {enableSeries && (
                <Select value={formData.seriesId} onValueChange={(v) => handleInputChange('seriesId', v)} disabled={fetchingHierarchy}>
                  <SelectTrigger className="bg-background mt-2"><SelectValue placeholder="Select Series" /></SelectTrigger>
                  <SelectContent>
                    {allSeries.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="border-b border-border pb-3 mt-6">
            <h3 className="font-bold text-lg text-foreground">Basic Info</h3>
            <p className="text-sm text-muted-foreground mt-1">Required details to identify and value your card.</p>
          </div>
          
          <div className="space-y-2">
            <Label>Card Name <span className="text-destructive">*</span></Label>
            <Input required value={formData.name} onChange={(e) => handleInputChange('name', e.target.value)} placeholder="e.g. Charizard Holographic" className="bg-background" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Estimated Value / Price <span className="text-destructive">*</span></Label>
              <Input required type="number" step="1" min="0" value={formData.price} onChange={(e) => handleInputChange('price', e.target.value)} placeholder="0" className="bg-background tabular-nums" />
            </div>
            <div className="space-y-2">
              <Label>Stock Quantity</Label>
              <Input type="number" value={formData.stockQuantity} onChange={(e) => handleInputChange('stockQuantity', e.target.value)} className="bg-background tabular-nums" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={formData.description} onChange={(e) => handleInputChange('description', e.target.value)} className="bg-background min-h-[100px]" placeholder="Condition notes, details..." />
          </div>
        </div>

        <div className="space-y-5">
          <div className="border-b border-border pb-3">
            <h3 className="font-bold text-lg text-foreground">Details & Grading</h3>
            <p className="text-sm text-muted-foreground mt-1">Optional specifications for advanced collectors.</p>
          </div>

          <div className="space-y-2">
            <Label>Collection Type</Label>
            <Select value={formData.collectionType} onValueChange={(v) => handleInputChange('collectionType', v)}>
              <SelectTrigger className="bg-background"><SelectValue placeholder="Select collection..." /></SelectTrigger>
              <SelectContent>
                {COLLECTIONS_LIST.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Condition</Label>
              <Select value={formData.condition} onValueChange={(v) => handleInputChange('condition', v)}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="Select Condition" /></SelectTrigger>
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
              <Label>Grading Service</Label>
              <Select value={formData.gradingService} onValueChange={(v) => handleInputChange('gradingService', v)}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="Select Service" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="None">None (Raw)</SelectItem>
                  <SelectItem value="PSA">PSA</SelectItem>
                  <SelectItem value="BGS">BGS</SelectItem>
                  <SelectItem value="CGC">CGC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Grade Score</Label>
              <Input type="number" step="0.5" max="10" value={formData.gradeScore} onChange={(e) => handleInputChange('gradeScore', e.target.value)} placeholder="e.g. 9.5" className="bg-background tabular-nums" disabled={formData.gradingService === 'None'} />
            </div>
            <div className="space-y-2">
              <Label>Cert Number</Label>
              <Input value={formData.certificationNumber} onChange={(e) => handleInputChange('certificationNumber', e.target.value)} placeholder="e.g. 12345678" className="bg-background" disabled={formData.gradingService === 'None'} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Release Year</Label>
              <Input type="number" value={formData.releaseYear} onChange={(e) => handleInputChange('releaseYear', e.target.value)} placeholder="YYYY" className="bg-background tabular-nums" />
            </div>
            <div className="space-y-2">
              <Label>Card Number</Label>
              <Input value={formData.cardNumber} onChange={(e) => handleInputChange('cardNumber', e.target.value)} placeholder="e.g. 4/102" className="bg-background" />
            </div>
          </div>

          {/* Card Variants */}
          <div className="space-y-4 pt-4 border-t border-border mt-6">
            <div>
              <h3 className="font-bold text-lg text-foreground">Card Variants / Attributes</h3>
              <p className="text-sm text-muted-foreground mt-1">Select all that apply — e.g. Rookie Card, Refractor, Holo.</p>
            </div>
            {VARIANT_GROUPS.map(group => (
              <div key={group.label}>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{group.label}</p>
                <div className="flex flex-wrap gap-2">
                  {group.variants.map(variant => {
                    const active = formData.cardVariants.includes(variant);
                    return (
                      <button
                        key={variant}
                        type="button"
                        onClick={() => {
                          const next = active
                            ? formData.cardVariants.filter(v => v !== variant)
                            : [...formData.cardVariants, variant];
                          handleInputChange('cardVariants', next);
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                          active
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                        }`}
                      >
                        {variant}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {formData.cardVariants.length > 0 && (
              <button
                type="button"
                onClick={() => handleInputChange('cardVariants', [])}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                Clear selection
              </button>
            )}
          </div>

          <div className="space-y-5 pt-4 border-t border-border mt-6">
            <h3 className="font-bold text-lg text-foreground">Listing Settings <span className="text-destructive">*</span></h3>
            <div className="space-y-2">
              <Select value={formData.listing_type} onValueChange={(v) => handleInputChange('listing_type', v)} required>
                <SelectTrigger className="bg-background font-medium h-12"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Private">Private (Vault Only)</SelectItem>
                  <SelectItem value="For Sale">For Sale (Marketplace)</SelectItem>
                  <SelectItem value="For Trade">For Trade</SelectItem>
                  <SelectItem value="For Sale & Trade">Both Sale & Trade</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Private items are only visible to you. Marketplace items can be purchased or traded publicly.
                <br />
                <span className="font-medium text-foreground">
                  Status: {formData.is_public ? 'Publicly Visible' : 'Private (Hidden)'}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-6 border-t border-border">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel} disabled={loading} className="rounded-xl">Cancel</Button>}
        <Button type="submit" disabled={loading} className="font-bold rounded-xl active:scale-[0.98]">
          {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          {card ? 'Save Changes' : 'Add to Vault'}
        </Button>
      </div>
    </form>
  );
};

export default VaultProductForm;
