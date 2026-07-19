import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Save, Upload, Trash2, Store, ExternalLink, Building2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { compressImage } from '@/utils/compressImage.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Breadcrumb from '@/components/Breadcrumb.jsx';
import { Link } from 'react-router-dom';

const CATEGORIES = [
  'Basketball Cards', 'Football Cards', 'Pokémon Cards', 'Graded Cards',
  'Rookie Cards', 'Autographs', 'Numbered Parallels', 'Case Hits',
  'Sealed Wax', 'Baseball Cards', 'Soccer Cards', 'Cricket Cards',
  'UFC Cards', 'Vintage Cards', 'Sports Memorabilia',
];

const TRUST_BADGES = [
  { key: 'authentic',         label: '100% Authentic',       desc: 'All cards verified before listing' },
  { key: 'safe_secure',       label: 'Safe & Secure',        desc: 'Cards packed with care and protection' },
  { key: 'worldwide_shipping',label: 'Worldwide Shipping',   desc: 'Fast & reliable shipping Australia & Worldwide' },
  { key: 'collector_first',   label: 'Collector First',      desc: "We're collectors too — you're in good hands" },
  { key: 'fast_dispatch',     label: 'Fast Dispatch',        desc: 'Ships within 1–2 business days' },
  { key: 'returns_accepted',  label: 'Returns Accepted',     desc: '7-day returns on eligible items' },
];

const slugify = (s) => String(s || '')
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 60)
  .replace(/-+$/g, '');

const AccountSoleTrader = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading]           = useState(false);
  const [pageLoading, setPageLoading]   = useState(true);

  const [isSoleTrader, setIsSoleTrader] = useState(false);
  const [formData, setFormData]         = useState({
    business_name: '',
    business_tagline: '',
    abn: '',
    dealer_shipping_policy: '',
  });
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedBadges, setSelectedBadges]         = useState([]);

  const [logoFile, setLogoFile]         = useState(null);
  const [logoPreview, setLogoPreview]   = useState(null);
  const [removeLogo, setRemoveLogo]     = useState(false);
  const [existingLogoUrl, setExistingLogoUrl] = useState(null);
  const [storeSlug, setStoreSlug]       = useState(null);

  useEffect(() => {
    if (!currentUser?.id) { setPageLoading(false); return; }
    let cancelled = false;
    supabase.from('profiles')
      .select('is_sole_trader, business_name, business_tagline, abn, business_logo_url, business_categories, dealer_trust_badges, dealer_shipping_policy, store_slug')
      .eq('id', currentUser.id)
      .single()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setIsSoleTrader(data.is_sole_trader ?? false);
        setFormData({
          business_name:          data.business_name          ?? '',
          business_tagline:       data.business_tagline       ?? '',
          abn:                    data.abn                    ?? '',
          dealer_shipping_policy: data.dealer_shipping_policy ?? '',
        });
        setSelectedCategories(data.business_categories ?? []);
        setSelectedBadges(data.dealer_trust_badges ?? []);
        setExistingLogoUrl(data.business_logo_url ?? null);
        setStoreSlug(data.store_slug ?? null);
      })
      .finally(() => { if (!cancelled) setPageLoading(false); });
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please upload a valid image file.'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Logo exceeds 10MB limit.'); return; }
    setLogoFile(file);
    setRemoveLogo(false);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const toggleCategory = (cat) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const toggleBadge = (key) => {
    setSelectedBadges(prev =>
      prev.includes(key) ? prev.filter(b => b !== key) : [...prev, key]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSoleTrader && !formData.business_name.trim()) {
      toast.error('Business name is required for sole trader accounts.');
      return;
    }
    setLoading(true);
    try {
      let business_logo_url = existingLogoUrl;

      if (logoFile) {
        const compressed = await compressImage(logoFile, { maxDimension: 512, quality: 0.85 });
        const ext  = compressed.name.split('.').pop();
        // Timestamped name (not a fixed per-user path) so the file is
        // immutable and can carry a long-lived cache header.
        const path = `business-logos/${currentUser.id}-${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, compressed, { upsert: true, cacheControl: '31536000' });
        if (uploadErr) throw uploadErr;
        business_logo_url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      } else if (removeLogo) {
        business_logo_url = null;
      }

      // Generate a stable, human-readable store slug for the dealer's store URL
      // (/dealer/<slug>) the first time they save a business name.
      let finalSlug = storeSlug;
      if (isSoleTrader && !finalSlug && formData.business_name.trim()) {
        const base = slugify(formData.business_name) || `store-${currentUser.id.slice(0, 8)}`;
        let candidate = base;
        for (let n = 2; n <= 20; n++) {
          const { data: clash } = await supabase
            .from('profiles').select('id')
            .eq('store_slug', candidate).neq('id', currentUser.id).maybeSingle();
          if (!clash) break;
          candidate = `${base}-${n}`;
        }
        finalSlug = candidate;
      }

      const { error } = await supabase.from('profiles').update({
        is_sole_trader:         isSoleTrader,
        business_name:          formData.business_name,
        business_tagline:       formData.business_tagline,
        abn:                    formData.abn,
        dealer_shipping_policy: formData.dealer_shipping_policy,
        business_categories:    selectedCategories,
        dealer_trust_badges:    selectedBadges,
        business_logo_url,
        ...(finalSlug ? { store_slug: finalSlug } : {}),
      }).eq('id', currentUser.id);

      if (error) throw error;

      setLogoFile(null);
      setRemoveLogo(false);
      setExistingLogoUrl(business_logo_url);
      setStoreSlug(finalSlug);
      toast.success('Business profile saved!');
    } catch (err) {
      toast.error(err.message || 'Failed to save business profile.');
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-muted rounded-xl" />
      <div className="h-64 bg-muted rounded-2xl" />
    </div>
  );

  const currentLogoUrl = logoPreview ?? (removeLogo ? null : existingLogoUrl);

  return (
    <div className="max-w-[100rem] mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 space-y-8 animate-in fade-in duration-300">
      <Helmet><title>Sole Trader Account | CardPop</title></Helmet>

      <Breadcrumb items={[{ label: 'Account', path: '/account' }, { label: 'Sole Trader' }]} />

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-serif mb-2 tracking-tight text-foreground">Sole Trader Account</h1>
          <p className="text-muted-foreground text-base font-medium">
            Register your business on CardPop and get a Verified Dealer profile with a dedicated store page.
          </p>
        </div>
        {isSoleTrader && currentUser?.id && (
          <Button asChild variant="outline" size="sm" className="rounded-xl font-bold self-start">
            <Link to={`/dealer/${storeSlug || currentUser.id}`} target="_blank">
              <ExternalLink className="w-4 h-4 mr-2" /> View My Store
            </Link>
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Enable toggle */}
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-foreground">Enable Sole Trader Mode</p>
                  <p className="text-sm text-muted-foreground">
                    Activates a public dealer store page and shows a Verified Dealer badge on your profile.
                  </p>
                </div>
              </div>
              <Switch
                checked={isSoleTrader}
                onCheckedChange={setIsSoleTrader}
                aria-label="Enable sole trader mode"
              />
            </div>
          </CardContent>
        </Card>

        {/* Business details */}
        <Card className={`shadow-sm transition-opacity ${isSoleTrader ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
          <CardContent className="p-6 sm:p-8 space-y-8">

            {/* Logo */}
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <div className="relative group shrink-0 flex flex-col items-center">
                <Avatar className="w-28 h-28 rounded-2xl border-2 border-border bg-muted text-foreground">
                  {currentLogoUrl ? (
                    <AvatarImage src={currentLogoUrl} className="object-cover" />
                  ) : null}
                  <AvatarFallback className="rounded-2xl text-3xl font-bold bg-muted/50">
                    <Store className="w-10 h-10 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-3 flex gap-2">
                  <Label htmlFor="logo-upload" className="bg-foreground text-background p-2 rounded-full shadow-md cursor-pointer hover:scale-105 transition-transform">
                    <Upload className="w-4 h-4" />
                    <Input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                  </Label>
                  {currentLogoUrl && (
                    <button type="button" onClick={() => { setLogoFile(null); setLogoPreview(null); setRemoveLogo(true); }}
                      className="bg-destructive text-destructive-foreground p-2 rounded-full shadow-md cursor-pointer hover:scale-105 transition-transform">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 space-y-1 mt-2">
                <Label className="font-bold text-foreground">Business Logo</Label>
                <p className="text-sm text-muted-foreground font-medium">Square image recommended. JPG, PNG or WEBP. Max 10MB.</p>
              </div>
            </div>

            {/* Core fields grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-border">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="business_name" className="font-bold text-foreground">
                    Business Name <span className="text-destructive">*</span>
                  </Label>
                  <Input id="business_name" name="business_name" value={formData.business_name}
                    onChange={handleChange} className="h-12 rounded-xl font-medium shadow-sm"
                    placeholder="e.g. Parallel House AU" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="abn" className="font-bold text-foreground">ABN</Label>
                  <Input id="abn" name="abn" value={formData.abn}
                    onChange={handleChange} className="h-12 rounded-xl font-medium shadow-sm"
                    placeholder="e.g. 12 345 678 901" maxLength={14} />
                  <p className="text-xs text-muted-foreground">Australian Business Number — displayed on your store page.</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="business_tagline" className="font-bold text-foreground">Tagline</Label>
                  <Input id="business_tagline" name="business_tagline" value={formData.business_tagline}
                    onChange={handleChange} className="h-12 rounded-xl font-medium shadow-sm"
                    placeholder="e.g. Premium Sports Cards & Collectibles" maxLength={80} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dealer_shipping_policy" className="font-bold text-foreground">Shipping Policy</Label>
                  <Textarea id="dealer_shipping_policy" name="dealer_shipping_policy"
                    value={formData.dealer_shipping_policy} onChange={handleChange}
                    className="min-h-[120px] resize-none rounded-xl font-medium shadow-sm"
                    placeholder="e.g. All orders dispatched within 1–2 business days. Express and registered post available..." />
                </div>
              </div>
            </div>

            {/* Categories */}
            <div className="pt-6 border-t border-border space-y-4">
              <div>
                <Label className="font-bold text-foreground block mb-1">Specialisation Categories</Label>
                <p className="text-sm text-muted-foreground">Select all categories your business specialises in.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                  <button key={cat} type="button" onClick={() => toggleCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all ${
                      selectedCategories.includes(cat)
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-muted/50 text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              {selectedCategories.length > 0 && (
                <p className="text-xs text-muted-foreground">{selectedCategories.length} categor{selectedCategories.length === 1 ? 'y' : 'ies'} selected</p>
              )}
            </div>

            {/* Trust badges */}
            <div className="pt-6 border-t border-border space-y-4">
              <div>
                <Label className="font-bold text-foreground block mb-1">Trust Badges</Label>
                <p className="text-sm text-muted-foreground">Select badges that apply to your business. These appear on your store page.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {TRUST_BADGES.map(badge => {
                  const active = selectedBadges.includes(badge.key);
                  return (
                    <button key={badge.key} type="button" onClick={() => toggleBadge(badge.key)}
                      className={`text-left p-4 rounded-xl border transition-all ${
                        active
                          ? 'bg-primary/5 border-primary/40 ring-2 ring-primary/20'
                          : 'bg-muted/30 border-border hover:border-primary/30'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <ShieldCheck className={`w-4 h-4 shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className={`text-sm font-bold ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{badge.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

          </CardContent>

          <div className="p-6 border-t border-border bg-muted/10 flex justify-end">
            <Button type="submit" disabled={loading || !isSoleTrader}
              className="rounded-xl h-12 px-8 font-bold shadow-md active:scale-95 transition-transform">
              {loading ? 'Saving…' : <><Save className="w-4 h-4 mr-2" /> Save Business Profile</>}
            </Button>
          </div>
        </Card>

        {/* Save button for the toggle-only case */}
        {!isSoleTrader && (
          <div className="flex justify-end">
            <Button type="submit" disabled={loading}
              className="rounded-xl h-12 px-8 font-bold shadow-md active:scale-95 transition-transform">
              {loading ? 'Saving…' : <><Save className="w-4 h-4 mr-2" /> Save</>}
            </Button>
          </div>
        )}

      </form>
    </div>
  );
};

export default AccountSoleTrader;
