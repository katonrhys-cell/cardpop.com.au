import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, Upload, Image as ImageIcon, ChevronRight, Sparkles, Loader2 } from 'lucide-react';
import Header, { COLLECTIONS_LIST } from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import CardListingOptions from '@/components/CardListingOptions.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import pb from '@/lib/pocketbaseClient.js';
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
    collectionType: 'Pokemon',
    cardName: '',
    condition: 'Mint',
    estimatedValue: '',
    description: '',
    listingStatus: 'Not Listed',
    tradePrice: '',
    salePrice: ''
  });

  useEffect(() => {
    if (isEdit) {
      const fetchCard = async () => {
        try {
          const card = await pb.collection('cards').getOne(id, { $autoCancel: false });
          if (card.owner !== currentUser.id) {
            toast.error("Unauthorized");
            navigate('/vault');
            return;
          }
          
          setFormData({
            collectionType: card.collectionType || 'Pokemon',
            cardName: card.cardName || '',
            condition: card.condition || 'Mint',
            estimatedValue: card.estimatedValue || '',
            description: card.description || '',
            listingStatus: card.listingStatus || 'Not Listed',
            tradePrice: card.tradeValue || '',
            salePrice: card.salePrice || ''
          });

          if (card.cardImage) {
            setImagePreview(pb.files.getUrl(card, card.cardImage));
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
    setFormData(prev => ({
      ...prev,
      cardName: analysisResult.cardName || prev.cardName,
      collectionType: analysisResult.mappedType || prev.collectionType,
      condition: analysisResult.mappedCondition || prev.condition,
      estimatedValue: analysisResult.estimatedValue ? String(analysisResult.estimatedValue) : prev.estimatedValue,
      description: [
        analysisResult.details,
        analysisResult.rarity ? `Rarity: ${analysisResult.rarity}` : '',
        analysisResult.cardType ? `Type: ${analysisResult.cardType}` : '',
        analysisResult.gradeScore ? `Grade: ${analysisResult.gradeScore}` : '',
        analysisResult.gradeCondition ? `Grade Condition: ${analysisResult.gradeCondition}` : ''
      ].filter(Boolean).join('\n') || prev.description
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
    
    if (formData.listingStatus === 'For Trade') {
      if (!formData.tradePrice || parseFloat(formData.tradePrice) <= 0) {
        newErrors.tradePrice = "Trade value must be greater than 0";
      }
    }
    
    if (formData.listingStatus === 'For Sale') {
      if (!formData.salePrice || parseFloat(formData.salePrice) <= 0) {
        newErrors.salePrice = "Sale price must be greater than 0";
      }
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
      const data = new FormData();
      data.append('owner', currentUser.id);
      data.append('collectionType', formData.collectionType);
      data.append('cardName', formData.cardName);
      data.append('condition', formData.condition);
      data.append('estimatedValue', parseFloat(formData.estimatedValue) || 0);
      if (formData.description) data.append('description', formData.description);
      
      // Listing Options
      data.append('listingStatus', formData.listingStatus);
      
      if (formData.listingStatus === 'For Trade') {
        data.append('listedForTrade', true);
        data.append('tradeValue', parseFloat(formData.tradePrice));
        data.append('listedForSale', false);
        data.append('salePrice', 0);
      } else if (formData.listingStatus === 'For Sale') {
        data.append('listedForSale', true);
        data.append('salePrice', parseFloat(formData.salePrice));
        data.append('listedForTrade', false);
        data.append('tradeValue', 0);
      } else {
        data.append('listedForTrade', false);
        data.append('tradeValue', 0);
        data.append('listedForSale', false);
        data.append('salePrice', 0);
      }

      if (imageFile) {
        data.append('cardImage', imageFile);
      }

      if (isEdit) {
        await pb.collection('cards').update(id, data, { $autoCancel: false });
        toast.success('Card updated successfully!');
        navigate('/vault');
      } else {
        await pb.collection('cards').create(data, { $autoCancel: false });
        toast.success('Card added to your vault!', {
          action: {
            label: 'Add Another',
            onClick: () => {
              setFormData({ 
                ...formData, 
                cardName: '', 
                description: '', 
                estimatedValue: '',
                listingStatus: 'Not Listed',
                tradePrice: '',
                salePrice: ''
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

  if (loading) return <div className="min-h-screen pt-32 text-center font-bold flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading...</div>;

  return (
    <div className="min-h-screen flex flex-col bg-muted/30 font-sans">
      <Helmet><title>{isEdit ? 'Edit Card' : 'Add New Card'} | Card Pop</title></Helmet>
      <Header />
      
      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 w-full">
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

              <div className="premium-card p-6 bg-card">
                <h2 className="font-serif text-xl font-bold border-b border-border pb-3 mb-4">Listing Options</h2>
                <CardListingOptions 
                  listingStatus={formData.listingStatus}
                  onListingStatusChange={(val) => setFormData({...formData, listingStatus: val})}
                  tradePrice={formData.tradePrice}
                  onTradePriceChange={(val) => setFormData({...formData, tradePrice: val})}
                  salePrice={formData.salePrice}
                  onSalePriceChange={(val) => setFormData({...formData, salePrice: val})}
                  errors={errors}
                />
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
                    <Select value={formData.collectionType} onValueChange={v => setFormData({...formData, collectionType: v})}>
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
                      placeholder="e.g. Charizard Base Set" 
                      className={`h-12 bg-background text-foreground transition-all ${isAutoFilled ? 'border-primary/50 ring-1 ring-primary/20' : ''}`} 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="font-bold">Condition <span className="text-destructive">*</span></Label>
                    <Select value={formData.condition} onValueChange={v => setFormData({...formData, condition: v})}>
                      <SelectTrigger className={`h-12 bg-background text-foreground transition-all ${isAutoFilled ? 'border-primary/50 ring-1 ring-primary/20' : ''}`}>
                        <SelectValue />
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
                    <Label htmlFor="estimatedValue" className="font-bold">Estimated Value <span className="text-destructive">*</span></Label>
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
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="description" className="font-bold">Notes / Description</Label>
                    <Textarea 
                      id="description" 
                      value={formData.description} 
                      onChange={e => setFormData({...formData, description: e.target.value})} 
                      placeholder="Any specific details about the card's condition, history, or unique features..." 
                      rows={5} 
                      className={`resize-none bg-background text-foreground transition-all ${isAutoFilled ? 'border-primary/50 ring-1 ring-primary/20' : ''}`} 
                    />
                  </div>
                </div>
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
      </main>
      <Footer />
    </div>
  );
};

export default AddEditCardPage;