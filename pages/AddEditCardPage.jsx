import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Save, Upload, Image as ImageIcon, ChevronRight, Sparkles, Loader2,
  Lock, ShoppingCart, ArrowRightLeft, Layers, Award, Star,
} from 'lucide-react';
import { COLLECTIONS_LIST } from '@/components/Header.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { useCategories } from '@/hooks/useCategories.js';
import { COLLECTION_CONFIGS } from '@/data/collectionConfigs.js';
import { VARIANT_GROUPS } from '@/lib/cardVariants.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useCardOCR } from '@/hooks/useCardOCR.js';

// ─── Grading companies ────────────────────────────────────────────────────────
const GRADING_COMPANIES = [
  { value: 'raw',   label: 'Raw',   sub: 'Ungraded',      activeClass: 'border-slate-500 bg-slate-500/10 text-slate-700 dark:text-slate-300' },
  { value: 'psa',   label: 'PSA',   sub: 'PSA Grading',   activeClass: 'border-red-500 bg-red-500/10 text-red-700 dark:text-red-400' },
  { value: 'bgs',   label: 'BGS',   sub: 'Beckett',       activeClass: 'border-blue-600 bg-blue-600/10 text-blue-700 dark:text-blue-400' },
  { value: 'cgc',   label: 'CGC',   sub: 'CGC Cards',     activeClass: 'border-green-600 bg-green-600/10 text-green-700 dark:text-green-400' },
  { value: 'ace',   label: 'ACE',   sub: 'ACE Grading',   activeClass: 'border-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-400' },
  { value: 'sgc',   label: 'SGC',   sub: 'SGC',           activeClass: 'border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-400' },
  { value: 'other', label: 'Other', sub: 'Other service', activeClass: 'border-muted-foreground/50 bg-muted text-foreground' },
];

const COMMON_GRADES = ['10', '9.5', '9', '8.5', '8', '7', '6', '5'];

// ─── Listing visibility options ───────────────────────────────────────────────
const LISTING_OPTIONS = [
  { value: 'private',         label: 'Private',     description: 'Only visible to you', Icon: Lock,            activeClass: 'border-slate-500 bg-slate-500/10 text-slate-700 dark:text-slate-300', iconClass: 'text-slate-500' },
  { value: 'For Sale',        label: 'For Sale',    description: 'List with a price',   Icon: ShoppingCart,    activeClass: 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', iconClass: 'text-emerald-500' },
  { value: 'For Trade',       label: 'For Trade',   description: 'Open to trades',      Icon: ArrowRightLeft,  activeClass: 'border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-400', iconClass: 'text-violet-500' },
  { value: 'For Sale & Trade', label: 'Sale & Trade', description: 'Both options open', Icon: Layers,          activeClass: 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400', iconClass: 'text-amber-500' },
];

// ─── Section heading ──────────────────────────────────────────────────────────
const SectionCard = ({ title, children, className = '' }) => (
  <div className={`premium-card p-6 bg-card space-y-5 ${className}`}>
    <h2 className="font-serif text-xl font-bold border-b border-border pb-3">{title}</h2>
    {children}
  </div>
);

const AddEditCardPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { getCategories } = useCategories();

  const isEdit = !!id;
  const [loading, setLoading]       = useState(isEdit);
  const [saving, setSaving]         = useState(false);
  const [imageFile, setImageFile]   = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [errors, setErrors]         = useState({});
  const [isAutoFilled, setIsAutoFilled] = useState(false);
  const [categoryId, setCategoryId] = useState(null);

  const { scanCard, isScanning, scanResult, clearScan } = useCardOCR();

  const emptyForm = {
    // Card identity
    collection:     'Pokemon',
    cardName:       '',
    setName:        '',
    cardNumber:     '',
    year:           '',
    variant:        '',
    // Attributes
    isFoil:         false,
    isSealed:       false,
    // Grading
    gradingCompany: 'raw',
    grade:          '',
    certNumber:     '',
    // Condition & value
    condition:      'near_mint',
    estimatedValue: '',
    purchasePrice:  '',
    acquiredDate:   '',
    acquiredFrom:   '',
    notes:          '',
    // Listing
    tradeValue:     '',
    listingType:    'private',
  };

  const [formData, setFormData] = useState(emptyForm);

  const set = (key, val) => setFormData(f => ({ ...f, [key]: val }));

  // ─── Resolve category_id whenever collection changes ──────────────────────
  useEffect(() => {
    getCategories().then(cats => {
      const selected = formData.collection?.toLowerCase();
      // Try matching against COLLECTION_CONFIGS aliases first
      const configEntry = Object.values(COLLECTION_CONFIGS).find(cfg =>
        [cfg.name, ...(cfg.categoryAliases ?? [])].some(a => a.toLowerCase() === selected)
      );
      const aliases = configEntry
        ? [configEntry.name, ...(configEntry.categoryAliases ?? [])].map(a => a.toLowerCase())
        : [selected];
      const match = cats.find(c => aliases.includes(c.name.toLowerCase()));
      setCategoryId(match?.id ?? null);
    });
  }, [formData.collection, getCategories]);

  // ─── Load existing card when editing ─────────────────────────────────────
  useEffect(() => {
    if (!isEdit) return;
    const fetchCard = async () => {
      try {
        const { data: card, error: fetchError } = await supabase
          .from('vault_items')
          .select('*')
          .eq('id', id)
          .single();
        if (fetchError) throw fetchError;
        if (card.owner_id !== currentUser.id) {
          toast.error('Unauthorized');
          navigate('/vault');
          return;
        }
        setFormData({
          collection:     card.collection     || 'Pokemon',
          cardName:       card.card_name      || '',
          setName:        card.set_name       || '',
          cardNumber:     card.card_number    || '',
          year:           card.year           ? String(card.year) : '',
          variant:        card.variant        || '',
          isFoil:         card.is_foil        ?? false,
          isSealed:       card.is_sealed      ?? false,
          gradingCompany: card.grading_company || 'raw',
          grade:          card.grade          || '',
          certNumber:     card.cert_number    || '',
          condition:      card.condition      || 'near_mint',
          estimatedValue: card.estimated_value_aud ? String(card.estimated_value_aud) : '',
          purchasePrice:  card.purchase_price_aud ? String(card.purchase_price_aud) : '',
          acquiredDate:   card.acquired_date  || '',
          acquiredFrom:   card.acquired_from  || '',
          notes:          card.notes          || '',
          tradeValue:     card.trade_value_aud ? String(card.trade_value_aud) : '',
          listingType:    card.listing_type   || 'private',
        });
        if (card.card_image) {
          const imgUrl = card.card_image.startsWith('http')
            ? card.card_image
            : supabase.storage.from('vault-images').getPublicUrl(card.card_image).data.publicUrl;
          setImagePreview(imgUrl);
        }
      } catch {
        toast.error('Failed to load card');
        navigate('/vault');
      } finally {
        setLoading(false);
      }
    };
    fetchCard();
  }, [id, currentUser.id, navigate, isEdit]);

  // ─── Image handling ───────────────────────────────────────────────────────
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5242880) { toast.error('Image must be less than 5MB'); return; }
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  // ─── AI auto-fill ─────────────────────────────────────────────────────────
  const handleApplyAI = () => {
    if (!scanResult) return;
    const conditionMap = {
      'Mint': 'mint', 'Near Mint': 'near_mint', 'Excellent': 'excellent',
      'Good': 'good', 'Fair': 'light_played',
    };
    const gradingCompanyMap = { 'PSA': 'psa', 'BGS': 'bgs', 'CGC': 'cgc' };
    setFormData(prev => ({
      ...prev,
      cardName:       scanResult.name               || prev.cardName,
      collection:     scanResult.collectionType     || prev.collection,
      setName:        scanResult.cardSetName        || prev.setName,
      cardNumber:     scanResult.cardNumber         || prev.cardNumber,
      year:           scanResult.releaseYear        || prev.year,
      condition:      conditionMap[scanResult.condition] || prev.condition,
      grade:          scanResult.gradeScore         || prev.grade,
      gradingCompany: gradingCompanyMap[scanResult.gradingService] ?? prev.gradingCompany,
      certNumber:     scanResult.certificationNumber || prev.certNumber,
      notes: [
        scanResult.description,
        scanResult.rarity   ? `Rarity: ${scanResult.rarity}` : '',
        scanResult.cardType ? `Type: ${scanResult.cardType}` : '',
      ].filter(Boolean).join('\n') || prev.notes,
    }));
    toast.success('Fields auto-filled successfully. Please review and edit as needed.');
    setIsAutoFilled(true);
  };

  // ─── Validation ───────────────────────────────────────────────────────────
  const validateForm = () => {
    const newErrors = {};
    if (!formData.cardName?.trim()) newErrors.cardName = 'Card name is required';
    if (!formData.estimatedValue || parseFloat(formData.estimatedValue) < 0)
      newErrors.estimatedValue = 'Enter a valid estimated value';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isEdit && !imageFile) { toast.error('Card image is required'); return; }
    if (!validateForm()) { toast.error('Please fix the errors in the form'); return; }

    setSaving(true);
    try {
      let cardImagePath = null;
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const filePath = `${currentUser.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('vault-images')
          .upload(filePath, imageFile, { upsert: true });
        if (uploadError) throw uploadError;
        cardImagePath = filePath;
      }

      const isGraded  = formData.gradingCompany !== 'raw';
      const isPublic  = formData.listingType !== 'private';
      const tradeAud  = parseFloat(formData.tradeValue) || 0;

      const payload = {
        owner_id:            currentUser.id,
        category_id:         categoryId || null,
        collection:          formData.collection  || null,
        card_name:           formData.cardName.trim(),
        set_name:            formData.setName?.trim()     || null,
        card_number:         formData.cardNumber?.trim()  || null,
        year:                formData.year ? parseInt(formData.year, 10) : null,
        variant:             formData.variant             || null,
        is_foil:             formData.isFoil,
        is_sealed:           formData.isSealed,
        grading_company:     formData.gradingCompany,
        grade:               isGraded ? (formData.grade?.trim() || null) : null,
        cert_number:         isGraded ? (formData.certNumber?.trim() || null) : null,
        condition:           formData.condition,
        estimated_value_aud: parseFloat(formData.estimatedValue) || 0,
        purchase_price_aud:  parseFloat(formData.purchasePrice)  || null,
        acquired_date:       formData.acquiredDate || null,
        acquired_from:       formData.acquiredFrom?.trim() || null,
        notes:               formData.notes?.trim()       || null,
        trade_value_aud:     tradeAud,
        trade_value_locked:  tradeAud > 0,
        listing_type:        isPublic ? formData.listingType : null,
        is_public:           isPublic,
      };

      if (cardImagePath) payload.card_image = cardImagePath;

      if (isEdit) {
        const { error } = await supabase.from('vault_items').update(payload).eq('id', id);
        if (error) throw error;
        toast.success('Card updated successfully!');
        navigate('/vault');
      } else {
        const { error } = await supabase.from('vault_items').insert(payload);
        if (error) throw error;
        toast.success('Card added to your vault!', {
          action: {
            label: 'Add Another',
            onClick: () => {
              setFormData({ ...emptyForm, collection: formData.collection });
              setImageFile(null);
              setImagePreview(null);
              setErrors({});
              setIsAutoFilled(false);
              clearAnalysis();
              window.scrollTo(0, 0);
            },
          },
        });
        navigate('/vault');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to save card');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="pt-32 text-center flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading...
    </div>
  );

  const isGraded = formData.gradingCompany !== 'raw';

  return (
    <div className="bg-muted/30 font-sans">
      <Helmet><title>{isEdit ? 'Edit Card' : 'Add New Card'} | Card Pop</title></Helmet>

      <div className="max-w-5xl mx-auto px-4 py-8 w-full">
        <nav className="flex items-center text-sm text-muted-foreground mb-6 font-medium">
          <Link to="/vault" className="hover:text-primary transition-colors">Vault</Link>
          <ChevronRight className="w-4 h-4 mx-2 opacity-50" />
          <span className="text-foreground">{isEdit ? 'Edit Card' : 'Add New Card'}</span>
        </nav>

        <div className="flex items-center justify-between mb-8">
          <h1 className="font-serif text-4xl font-bold">{isEdit ? 'Edit Card Details' : 'Add New Card'}</h1>
          <Button variant="ghost" asChild className="text-muted-foreground">
            <Link to="/vault"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Link>
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">

            {/* ── Left: Image + AI ── */}
            <div className="lg:col-span-1 space-y-5">
              <div className="premium-card p-6 bg-card">
                <Label className="font-bold text-base mb-4 block">
                  Card Image <span className="text-destructive">*</span>
                </Label>
                <div className="aspect-[3/4] bg-muted/50 rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center relative overflow-hidden group transition-colors hover:border-primary/50 hover:bg-primary/5">
                  {imagePreview ? (
                    <>
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <p className="text-white font-medium flex items-center gap-2"><Upload className="w-4 h-4" /> Change Image</p>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-6">
                      <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50 group-hover:text-primary group-hover:opacity-100 transition-colors" />
                      <p className="text-sm font-medium text-foreground mb-1">Drag & drop or click</p>
                      <p className="text-xs text-muted-foreground">JPG, PNG, WebP up to 5MB</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>

                {/* AI Analysis */}
                <div className="mt-4">
                  {!scanResult && imageFile && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => scanCard(imageFile)}
                      disabled={isScanning}
                      className="w-full bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
                    >
                      {isScanning
                        ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Analyzing...</>
                        : <><Sparkles className="w-4 h-4 mr-2" /> Analyze with AI</>
                      }
                    </Button>
                  )}
                  {scanResult && (
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl animate-in fade-in slide-in-from-top-2">
                      <h4 className="font-bold text-sm text-primary mb-3 flex items-center gap-2">
                        <Sparkles className="w-4 h-4" /> AI Analysis Results
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-sm text-foreground/80 mb-4">
                        <div className="col-span-2"><strong className="text-foreground">Name:</strong> {scanResult.name || 'N/A'}</div>
                        <div><strong className="text-foreground">Category:</strong> {scanResult.collectionType || 'N/A'}</div>
                        <div><strong className="text-foreground">Condition:</strong> {scanResult.condition || 'N/A'}</div>
                        {scanResult.cardSetName && <div><strong className="text-foreground">Set:</strong> {scanResult.cardSetName}</div>}
                        {scanResult.gradeScore && <div><strong className="text-foreground">Grade:</strong> {scanResult.gradeScore}</div>}
                        {scanResult.rarity && <div className="col-span-2"><strong className="text-foreground">Rarity:</strong> {scanResult.rarity}</div>}
                      </div>
                      <div className="flex gap-2 pt-3 border-t border-primary/10">
                        <Button type="button" size="sm" onClick={handleApplyAI} className="flex-1 font-semibold">Auto-fill Fields</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => { clearScan(); setIsAutoFilled(false); }} className="flex-1">Clear</Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Right: All form sections ── */}
            <div className="lg:col-span-2 space-y-5">

              {/* ── 1. Card Identity ── */}
              <SectionCard title="Card Details">
                {isAutoFilled && (
                  <div className="flex items-center text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-md w-fit -mt-2">
                    <Sparkles className="w-3 h-3 mr-1" /> AI Auto-filled — review before saving
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Collection */}
                  <div className="space-y-2 md:col-span-2">
                    <Label className="font-bold">Collection / Game <span className="text-destructive">*</span></Label>
                    <Select value={formData.collection} onValueChange={v => set('collection', v)}>
                      <SelectTrigger className={`h-11 bg-background ${isAutoFilled ? 'border-primary/50 ring-1 ring-primary/20' : ''}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COLLECTIONS_LIST.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {categoryId && <p className="text-xs text-muted-foreground">✓ Matched to collection page</p>}
                  </div>

                  {/* Card Name */}
                  <div className="space-y-2">
                    <Label htmlFor="cardName" className="font-bold">Card Name <span className="text-destructive">*</span></Label>
                    <Input
                      id="cardName"
                      value={formData.cardName}
                      onChange={e => set('cardName', e.target.value)}
                      placeholder="e.g. Charizard"
                      className={`h-11 bg-background ${isAutoFilled ? 'border-primary/50 ring-1 ring-primary/20' : ''}`}
                    />
                    {errors.cardName && <p className="text-destructive text-xs">{errors.cardName}</p>}
                  </div>

                  {/* Set Name */}
                  <div className="space-y-2">
                    <Label htmlFor="setName" className="font-bold">Set Name</Label>
                    <Input
                      id="setName"
                      value={formData.setName}
                      onChange={e => set('setName', e.target.value)}
                      placeholder="e.g. Base Set"
                      className="h-11 bg-background"
                    />
                  </div>

                  {/* Card Number */}
                  <div className="space-y-2">
                    <Label htmlFor="cardNumber" className="font-bold">Card Number</Label>
                    <Input
                      id="cardNumber"
                      value={formData.cardNumber}
                      onChange={e => set('cardNumber', e.target.value)}
                      placeholder="e.g. 4/102 or 001/165"
                      className="h-11 bg-background"
                    />
                  </div>

                  {/* Year */}
                  <div className="space-y-2">
                    <Label htmlFor="year" className="font-bold">Year</Label>
                    <Input
                      id="year"
                      type="number"
                      min="1993"
                      max={new Date().getFullYear() + 1}
                      value={formData.year}
                      onChange={e => set('year', e.target.value)}
                      placeholder={String(new Date().getFullYear())}
                      className="h-11 bg-background"
                    />
                  </div>

                  {/* Variant */}
                  <div className="space-y-2">
                    <Label className="font-bold">Card Variant / Finish</Label>
                    <Select value={formData.variant} onValueChange={v => set('variant', v)}>
                      <SelectTrigger className="h-11 bg-background">
                        <SelectValue placeholder="Select variant…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No variant</SelectItem>
                        {VARIANT_GROUPS.map((group, gi) => (
                          <React.Fragment key={group.label}>
                            {gi > 0 && <SelectSeparator />}
                            <div className="px-2 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                              {group.label}
                            </div>
                            {group.variants.map(v => (
                              <SelectItem key={v} value={v}>{v}</SelectItem>
                            ))}
                          </React.Fragment>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Condition */}
                  <div className="space-y-2">
                    <Label className="font-bold">Condition <span className="text-destructive">*</span></Label>
                    <Select value={formData.condition} onValueChange={v => set('condition', v)}>
                      <SelectTrigger className={`h-11 bg-background ${isAutoFilled ? 'border-primary/50 ring-1 ring-primary/20' : ''}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mint">Mint</SelectItem>
                        <SelectItem value="near_mint">Near Mint</SelectItem>
                        <SelectItem value="excellent">Excellent</SelectItem>
                        <SelectItem value="good">Good</SelectItem>
                        <SelectItem value="light_played">Light Played</SelectItem>
                        <SelectItem value="played">Played</SelectItem>
                        <SelectItem value="poor">Poor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Foil + Sealed toggles */}
                  <div className="space-y-2 md:col-span-2">
                    <Label className="font-bold">Card Attributes</Label>
                    <div className="flex gap-3">
                      {[
                        { key: 'isFoil',   label: '✨ Foil',          desc: 'Holographic / foil finish' },
                        { key: 'isSealed', label: '📦 Sealed Product', desc: 'Booster, box, or sealed item' },
                      ].map(({ key, label, desc }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => set(key, !formData[key])}
                          className={`flex-1 flex flex-col items-start px-4 py-3 rounded-xl border-2 text-left transition-all ${
                            formData[key]
                              ? 'border-primary bg-primary/10 text-primary shadow-sm'
                              : 'border-border bg-background hover:border-muted-foreground/40 text-foreground'
                          }`}
                        >
                          <span className="font-bold text-sm">{label}</span>
                          <span className={`text-xs mt-0.5 ${formData[key] ? 'text-primary/70' : 'text-muted-foreground'}`}>{desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </SectionCard>

              {/* ── 2. Grading ── */}
              <SectionCard title="Grading">
                <div className="space-y-4">
                  <div>
                    <Label className="font-bold mb-3 block">Grading Service</Label>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                      {GRADING_COMPANIES.map(({ value, label, sub, activeClass }) => {
                        const isActive = formData.gradingCompany === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => set('gradingCompany', value)}
                            className={`flex flex-col items-center px-2 py-2.5 rounded-xl border-2 text-center transition-all duration-150 ${
                              isActive ? `${activeClass} shadow-sm` : 'border-border bg-background hover:border-muted-foreground/40 text-foreground'
                            }`}
                          >
                            <span className="font-extrabold text-sm leading-tight">{label}</span>
                            <span className={`text-[9px] mt-0.5 leading-tight ${isActive ? 'opacity-70' : 'text-muted-foreground'}`}>{sub}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {isGraded && (
                    <div className="grid md:grid-cols-2 gap-4 pt-2 border-t border-border animate-in fade-in slide-in-from-top-1">
                      {/* Grade */}
                      <div className="space-y-2">
                        <Label className="font-bold flex items-center gap-1.5">
                          <Award className="w-4 h-4 text-amber-500" /> Grade Score
                        </Label>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {COMMON_GRADES.map(g => (
                            <button
                              key={g}
                              type="button"
                              onClick={() => set('grade', g)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                                formData.grade === g
                                  ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                                  : 'border-border bg-background hover:border-amber-400 hover:text-amber-600'
                              }`}
                            >
                              {g}
                            </button>
                          ))}
                        </div>
                        <Input
                          value={formData.grade}
                          onChange={e => set('grade', e.target.value)}
                          placeholder="e.g. 9.5 or Authentic"
                          className={`h-11 bg-background ${isAutoFilled && formData.grade ? 'border-primary/50 ring-1 ring-primary/20' : ''}`}
                        />
                      </div>

                      {/* Cert Number */}
                      <div className="space-y-2">
                        <Label htmlFor="certNumber" className="font-bold flex items-center gap-1.5">
                          <Star className="w-4 h-4 text-amber-500" /> Cert / Population Number
                        </Label>
                        <Input
                          id="certNumber"
                          value={formData.certNumber}
                          onChange={e => set('certNumber', e.target.value)}
                          placeholder="e.g. 12345678"
                          className="h-11 bg-background"
                        />
                        <p className="text-xs text-muted-foreground">Verify at {formData.gradingCompany.toUpperCase()}'s website</p>
                      </div>
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* ── 3. Value & Acquisition ── */}
              <SectionCard title="Value & Acquisition">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="estimatedValue" className="font-bold">
                      Estimated Value (AUD) <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                      <Input
                        id="estimatedValue"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.estimatedValue}
                        onChange={e => set('estimatedValue', e.target.value)}
                        placeholder="0.00"
                        className={`h-11 pl-8 bg-background tabular-nums ${isAutoFilled ? 'border-primary/50 ring-1 ring-primary/20' : ''}`}
                      />
                    </div>
                    {errors.estimatedValue && <p className="text-destructive text-xs">{errors.estimatedValue}</p>}
                    <p className="text-xs text-muted-foreground">Your estimate of current market value</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="purchasePrice" className="font-bold">Purchase Price (AUD)</Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                      <Input
                        id="purchasePrice"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.purchasePrice}
                        onChange={e => set('purchasePrice', e.target.value)}
                        placeholder="0.00"
                        className="h-11 pl-8 bg-background tabular-nums"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">What you paid — for your own tracking</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="acquiredDate" className="font-bold">Date Acquired</Label>
                    <Input
                      id="acquiredDate"
                      type="date"
                      value={formData.acquiredDate}
                      onChange={e => set('acquiredDate', e.target.value)}
                      className="h-11 bg-background"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="acquiredFrom" className="font-bold">Acquired From</Label>
                    <Input
                      id="acquiredFrom"
                      value={formData.acquiredFrom}
                      onChange={e => set('acquiredFrom', e.target.value)}
                      placeholder="e.g. eBay, Local shop, Trade"
                      className="h-11 bg-background"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="notes" className="font-bold">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={e => set('notes', e.target.value)}
                      placeholder="Any specific details about this card's condition, history, or unique features…"
                      rows={3}
                      className={`resize-none bg-background ${isAutoFilled ? 'border-primary/50 ring-1 ring-primary/20' : ''}`}
                    />
                  </div>
                </div>
              </SectionCard>

              {/* ── 4. Listing Visibility ── */}
              <SectionCard title="Listing Visibility">
                <p className="text-sm text-muted-foreground -mt-2">Choose how this card appears to other collectors.</p>

                <div className="grid grid-cols-2 gap-3">
                  {LISTING_OPTIONS.map(({ value, label, description, Icon, activeClass, iconClass }) => {
                    const isActive = formData.listingType === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => set('listingType', value)}
                        className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                          isActive
                            ? `${activeClass} shadow-sm`
                            : 'border-border bg-background hover:border-muted-foreground/40 hover:bg-muted/30 text-foreground'
                        }`}
                      >
                        <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${isActive ? iconClass : 'text-muted-foreground'}`} />
                        <div>
                          <p className="font-bold text-sm leading-tight">{label}</p>
                          <p className={`text-xs mt-0.5 ${isActive ? 'opacity-80' : 'text-muted-foreground'}`}>{description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {(formData.listingType === 'For Sale' || formData.listingType === 'For Sale & Trade') && (
                  <div className="space-y-2 pt-3 border-t border-border">
                    <Label htmlFor="listingPrice" className="font-bold flex items-center gap-1.5">
                      <ShoppingCart className="w-4 h-4 text-emerald-500" /> Asking Price (AUD)
                    </Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                      <input
                        id="listingPrice"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.estimatedValue}
                        onChange={e => set('estimatedValue', e.target.value)}
                        placeholder="0.00"
                        className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm pl-8 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                  </div>
                )}

                {(formData.listingType === 'For Trade' || formData.listingType === 'For Sale & Trade') && (
                  <div className="space-y-2 pt-3 border-t border-border">
                    <Label htmlFor="tradeValueInput" className="font-bold flex items-center gap-1.5">
                      <ArrowRightLeft className="w-4 h-4 text-violet-500" /> Trade Value (AUD)
                    </Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                      <input
                        id="tradeValueInput"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.tradeValue}
                        onChange={e => set('tradeValue', e.target.value)}
                        placeholder="0.00"
                        className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm pl-8 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">The value in traded cards you'd accept</p>
                  </div>
                )}
              </SectionCard>

            </div>
          </div>

          <div className="flex justify-end gap-4 pt-6 border-t border-border">
            <Button type="button" variant="outline" className="h-14 px-8 text-lg" asChild>
              <Link to="/vault">Cancel</Link>
            </Button>
            <Button type="submit" disabled={saving} className="h-14 px-10 font-bold text-lg shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
              {saving
                ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Saving...</>
                : <><Save className="w-5 h-5 mr-2" /> {isEdit ? 'Update Card' : 'Save Card'}</>
              }
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddEditCardPage;
