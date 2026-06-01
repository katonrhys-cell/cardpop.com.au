import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, Upload, Image as ImageIcon, ChevronRight, Sparkles, Loader2, Lock, ShoppingCart, ArrowRightLeft, Layers } from 'lucide-react';
import { COLLECTIONS_LIST } from '@/components/Header.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useCardAnalysis } from '@/hooks/useCardAnalysis.js';

const AddEditCardPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const isEdit = !!id;
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [isAutoFilled, setIsAutoFilled] = useState(false);

  const { analyzeCardImage, isAnalyzing, analysisResult, clearAnalysis } = useCardAnalysis();

  const [formData, setFormData] = useState({
    collection: 'Pokemon',
    cardName: '',
    setName: '',
    condition: 'near_mint',
    estimatedValue: '',
    notes: '',
    tradeValue: '',
    listingType: 'private',
  });

  const LISTING_OPTIONS = [
    {
      value: 'private',
      label: 'Private',
      description: 'Only visible to you',
      Icon: Lock,
      activeClass: 'border-slate-500 bg-slate-500/10 text-slate-700 dark:text-slate-300',
      iconClass: 'text-slate-500',
    },
    {
      value: 'For Sale',
      label: 'For Sale',
      description: 'List with a price',
      Icon: ShoppingCart,
      activeClass: 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
      iconClass: 'text-emerald-500',
    },
    {
      value: 'For Trade',
      label: 'For Trade',
      description: 'Open to trades',
      Icon: ArrowRightLeft,
      activeClass: 'border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-400',
      iconClass: 'text-violet-500',
    },
    {
      value: 'For Sale & Trade',
      label: 'Sale & Trade',
      description: 'Both options open',
      Icon: Layers,
      activeClass: 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400',
      iconClass: 'text-amber-500',
    },
  ];

  useEffect(() => {
    if (isEdit) {
      const fetchCard = async () => {
        try {
          const { data: card, error: fetchError } = await supabase
            .from('vault_items')
            .select('*')
            .eq('id', id)
            .single();

          if (fetchError) throw fetchError;

          if (card.owner_id !== currentUser.id) {
            toast.error("Unauthorized");
            navigate('/vault');
            return;
          }

          setFormData({
            collection: card.collection || 'Pokemon',
            cardName: card.card_name || '',
            setName: card.set_name || '',
            condition: card.condition || 'near_mint',
            estimatedValue: card.estimated_value_aud || '',
            notes: card.notes || '',
            tradeValue: card.trade_value_aud || '',
            listingType: card.listing_type || 'private',
          });

          if (card.card_image) {
            const imgUrl = card.card_image.startsWith('http')
              ? card.card_image
              : supabase.storage.from('vault-images').getPublicUrl(card.card_image).data.publicUrl;
            setImagePreview(imgUrl);
          }
        } catch (error) {
          toast.error("Failed to load card");
          navigate('/vault');
        } finally {
          setLoading(false);
        }
      };
      fetchCard();
    }
  }, [id, currentUser.id, navigate, isEdit]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5242880) {
        toast.error("Image must be less than 5MB");
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleApplyAI = () => {
    if (!analysisResult) return;
    const conditionMap = { 'Mint': 'mint', 'Near Mint': 'near_mint', 'Excellent': 'excellent', 'Good': 'good', 'Fair': 'light_played', 'Played': 'played', 'Poor': 'poor' };
    setFormData(prev => ({
      ...prev,
      cardName: analysisResult.cardName || prev.cardName,
      collection: analysisResult.mappedType || prev.collection,
      condition: conditionMap[analysisResult.mappedCondition] || prev.condition,
      estimatedValue: analysisResult.estimatedValue ? String(analysisResult.estimatedValue) : prev.estimatedValue,
      notes: [
        analysisResult.details,
        analysisResult.rarity ? `Rarity: ${analysisResult.rarity}` : '',
        analysisResult.cardType ? `Type: ${analysisResult.cardType}` : '',
        analysisResult.gradeScore ? `Grade: ${analysisResult.gradeScore}` : '',
        analysisResult.gradeCondition ? `Grade Condition: ${analysisResult.gradeCondition}` : ''
      ].filter(Boolean).join('\n') || prev.notes
    }));
    toast.success("Fields auto-filled successfully. Please review and edit as needed.");
    setIsAutoFilled(true);
  };

  const handleClearAnalysis = () => {
    clearAnalysis();
    setIsAutoFilled(false);
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.cardName?.trim()) newErrors.cardName = "Card name is required";
    if (!formData.estimatedValue || parseFloat(formData.estimatedValue) < 0) {
      newErrors.estimatedValue = "Enter a valid estimated value";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isEdit && !imageFile) {
      toast.error("Card image is required");
      return;
    }

    if (!validateForm()) {
      toast.error("Please fix the errors in the form");
      return;
    }

    setSaving(true);
    try {
      let cardImagePath = null;

      // Upload image to Supabase Storage if provided
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const filePath = `${currentUser.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('vault-images')
          .upload(filePath, imageFile, { upsert: true });
        if (uploadError) throw uploadError;
        cardImagePath = filePath;
      }

      const tradeAud = parseFloat(formData.tradeValue) || 0;
      const isPublic = formData.listingType !== 'private';
      const payload = {
        owner_id:            currentUser.id,
        collection:          formData.collection || null,
        card_name:           formData.cardName.trim(),
        set_name:            formData.setName?.trim() || null,
        condition:           formData.condition,
        estimated_value_aud: parseFloat(formData.estimatedValue) || 0,
        notes:               formData.notes?.trim() || null,
        trade_value_aud:     tradeAud,
        trade_value_locked:  tradeAud > 0,
        listing_type:        isPublic ? formData.listingType : null,
        is_public:           isPublic,
      };

      if (cardImagePath) {
        payload.card_image = cardImagePath;
      }

      if (isEdit) {
        const { error: updateError } = await supabase
          .from('vault_items')
          .update(payload)
          .eq('id', id);
        if (updateError) throw updateError;
        toast.success('Card updated successfully!');
        navigate('/vault');
      } else {
        const { error: insertError } = await supabase
          .from('vault_items')
          .insert(payload);
        if (insertError) throw insertError;
        toast.success('Card added to your vault!', {
          action: {
            label: 'Add Another',
            onClick: () => {
              setFormData({
                ...formData,
                cardName: '',
                setName: '',
                notes: '',
                estimatedValue: '',
                tradeValue: '',
                listingType: 'private',
              });
              setImageFile(null);
              setImagePreview(null);
              setErrors({});
              setIsAutoFilled(false);
              clearAnalysis();
              window.scrollTo(0, 0);
            }
          }
        });
        navigate('/vault');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to save card');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="pt-32 text-center font-bold flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading...</div>;

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
        
        <form onSubmit={handleSubmit} className="space-y-8">
          
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Column: Image Upload & Listing Options */}
            <div className="lg:col-span-1 space-y-6">
              <div className="premium-card p-6 bg-card">
                <Label className="font-bold text-base mb-4 block">Card Image <span className="text-destructive">*</span></Label>
                <div className="aspect-[3/4] bg-muted/50 rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center relative overflow-hidden group transition-colors hover:border-primary/50 hover:bg-primary/5">
                  {imagePreview ? (
                    <>
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <p className="text-white font-medium flex items-center"><Upload className="w-4 h-4 mr-2" /> Change Image</p>
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

                {/* AI Analysis Section */}
                <div className="mt-4">
                  {!analysisResult && imageFile && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => analyzeCardImage(imageFile)}
                      disabled={isAnalyzing}
                      className="w-full bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-all"
                    >
                      {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                      {isAnalyzing ? 'Analyzing Image...' : 'Analyze with AI'}
                    </Button>
                  )}
                  {analysisResult && (
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl animate-in fade-in slide-in-from-top-2">
                      <h4 className="font-bold text-sm text-primary mb-3 flex items-center">
                        <Sparkles className="w-4 h-4 mr-2"/> AI Analysis Results
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-sm text-foreground/80 mb-4">
                        <div className="col-span-2"><strong className="text-foreground">Name:</strong> {analysisResult.cardName || 'N/A'}</div>
                        <div><strong className="text-foreground">Category:</strong> {analysisResult.mappedType || 'N/A'}</div>
                        <div><strong className="text-foreground">Condition:</strong> {analysisResult.mappedCondition || 'N/A'}</div>
                        {analysisResult.estimatedValue && <div><strong className="text-foreground">Est. Value:</strong> ${analysisResult.estimatedValue}</div>}
                        {analysisResult.gradeScore && <div><strong className="text-foreground">Grade:</strong> {analysisResult.gradeScore}</div>}
                        {analysisResult.rarity && <div className="col-span-2"><strong className="text-foreground">Rarity:</strong> {analysisResult.rarity}</div>}
                      </div>
                      <div className="flex gap-2 pt-3 border-t border-primary/10">
                        <Button type="button" size="sm" onClick={handleApplyAI} className="flex-1 font-semibold">
                          Auto-fill Fields
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={handleClearAnalysis} className="flex-1">
                          Clear
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Right Column: Form Fields */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Section 1: Collection & Card Details */}
              <div className="premium-card p-6 bg-card space-y-6 relative">
                {isAutoFilled && (
                  <div className="absolute top-6 right-6 flex items-center text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-md">
                    <Sparkles className="w-3 h-3 mr-1" />
                    AI Auto-filled (Edit as needed)
                  </div>
                )}
                <h2 className="font-serif text-2xl font-bold border-b border-border pb-4 pr-32">Card Details</h2>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="font-bold">Collection Type <span className="text-destructive">*</span></Label>
                    <Select value={formData.collection} onValueChange={v => setFormData({...formData, collection: v})}>
                      <SelectTrigger className={`h-12 bg-background text-foreground transition-all ${isAutoFilled ? 'border-primary/50 ring-1 ring-primary/20' : ''}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COLLECTIONS_LIST.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="cardName" className="font-bold">Card Name <span className="text-destructive">*</span></Label>
                    <Input
                      id="cardName"
                      required
                      value={formData.cardName}
                      onChange={e => setFormData({...formData, cardName: e.target.value})}
                      placeholder="e.g. Charizard"
                      className={`h-12 bg-background text-foreground transition-all ${isAutoFilled ? 'border-primary/50 ring-1 ring-primary/20' : ''}`}
                    />
                    {errors.cardName && <p className="text-destructive text-xs">{errors.cardName}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="setName" className="font-bold">Set Name</Label>
                    <Input
                      id="setName"
                      value={formData.setName}
                      onChange={e => setFormData({...formData, setName: e.target.value})}
                      placeholder="e.g. Base Set"
                      className="h-12 bg-background text-foreground"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="font-bold">Condition <span className="text-destructive">*</span></Label>
                    <Select value={formData.condition} onValueChange={v => setFormData({...formData, condition: v})}>
                      <SelectTrigger className={`h-12 bg-background text-foreground transition-all ${isAutoFilled ? 'border-primary/50 ring-1 ring-primary/20' : ''}`}>
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

                  <div className="space-y-2">
                    <Label htmlFor="estimatedValue" className="font-bold">Estimated Value (AUD) <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                      <Input
                        id="estimatedValue"
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={formData.estimatedValue}
                        onChange={e => setFormData({...formData, estimatedValue: e.target.value})}
                        placeholder="0.00"
                        className={`h-12 pl-8 bg-background text-foreground tabular-nums transition-all ${isAutoFilled ? 'border-primary/50 ring-1 ring-primary/20' : ''}`}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Market value for your own tracking</p>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="notes" className="font-bold">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={e => setFormData({...formData, notes: e.target.value})}
                      placeholder="Any specific details about the card's condition, history, or unique features..."
                      rows={4}
                      className={`resize-none bg-background text-foreground transition-all ${isAutoFilled ? 'border-primary/50 ring-1 ring-primary/20' : ''}`}
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Listing Visibility */}
              <div className="premium-card p-6 bg-card space-y-5">
                <div>
                  <h2 className="font-serif text-2xl font-bold border-b border-border pb-4">Listing Visibility</h2>
                  <p className="text-sm text-muted-foreground mt-3">Choose how this card appears to other collectors.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {LISTING_OPTIONS.map(({ value, label, description, Icon, activeClass, iconClass }) => {
                    const isActive = formData.listingType === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFormData(f => ({ ...f, listingType: value }))}
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

                {/* Conditional price fields */}
                {(formData.listingType === 'For Sale' || formData.listingType === 'For Sale & Trade') && (
                  <div className="space-y-2 pt-2 border-t border-border">
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
                        onChange={e => setFormData(f => ({ ...f, estimatedValue: e.target.value }))}
                        placeholder="0.00"
                        className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background pl-8 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                  </div>
                )}

                {(formData.listingType === 'For Trade' || formData.listingType === 'For Sale & Trade') && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <Label htmlFor="tradeValueListing" className="font-bold flex items-center gap-1.5">
                      <ArrowRightLeft className="w-4 h-4 text-violet-500" /> Trade Value (AUD)
                    </Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                      <input
                        id="tradeValueListing"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.tradeValue}
                        onChange={e => setFormData(f => ({ ...f, tradeValue: e.target.value }))}
                        placeholder="0.00"
                        className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background pl-8 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">The value you'd accept in traded cards</p>
                  </div>
                )}
              </div>

            </div>
          </div>

          <div className="flex justify-end gap-4 pt-6 border-t border-border">
            <Button type="button" variant="outline" className="h-14 px-8 text-lg" asChild>
              <Link to="/vault">Cancel</Link>
            </Button>
            <Button type="submit" disabled={saving} className="h-14 px-10 font-bold text-lg shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
              {saving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
              {saving ? 'Saving...' : isEdit ? 'Update Card' : 'Save Card'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddEditCardPage;