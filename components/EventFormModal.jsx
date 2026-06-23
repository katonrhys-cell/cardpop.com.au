import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, UploadCloud, X, Wand2, Trash2, Plus, Tag } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { compressImage } from '@/utils/compressImage.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { slugify } from '@/lib/slugify.js';
import { toast } from 'sonner';

const AUS_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];

const EVENT_TYPES = [
  { value: 'card_show',        label: 'Card Show' },
  { value: 'trade_event',      label: 'Trade Event' },
  { value: 'community_event',  label: 'Community Event' },
  { value: 'lgs_event',        label: 'LGS (Local Game Store) Event' },
];

const STATUS_OPTIONS = [
  { value: 'approved',       label: 'Approved (Live)' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'cancelled',      label: 'Cancelled' },
  { value: 'completed',      label: 'Completed' },
  { value: 'rejected',       label: 'Rejected' },
];

const CARD_GAMES = [
  'Pokémon', 'Magic: The Gathering', 'Yu-Gi-Oh!',
  'One Piece', 'Flesh and Blood', 'Lorcana',
  'Dragon Ball Super', 'Star Wars: Unlimited', 'MetaZoo',
];

const INITIAL_STATE = {
  title: '',
  short_description: '',
  description: '',
  event_type: 'community_event',
  status: 'approved',
  featured_card_games: [],
  is_featured: false,
  // Venue
  venue_name: '',
  address: '',
  suburb: '',
  state: '',
  postcode: '',
  // Dates & Times
  start_date: '',
  end_date: '',
  start_time: '',
  end_time: '',
  // Organiser & Tickets
  organizer_name: '',
  organizer_email: '',
  organizer_phone: '',
  website_url: '',
  ticket_url: '',
  instagram_url: '',
  facebook_url: '',
  entry_fee_aud: '',
  is_free: true,
  capacity: '',
  registration_required: false,
  // SEO
  seo_title: '',
  seo_description: '',
  seo_keywords: [],
  tags: [],
  source_url: '',
};

// Simple tag input — press Enter or comma to add
const TagInput = ({ value = [], onChange, placeholder }) => {
  const [inputVal, setInputVal] = useState('');
  const handleKey = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && inputVal.trim()) {
      e.preventDefault();
      const tag = inputVal.trim().replace(/,$/, '');
      if (tag && !value.includes(tag)) onChange([...value, tag]);
      setInputVal('');
    }
  };
  const remove = (tag) => onChange(value.filter(t => t !== tag));
  return (
    <div className="flex flex-wrap gap-1.5 min-h-11 p-2 border border-input rounded-xl bg-background focus-within:ring-1 focus-within:ring-ring">
      {value.map(tag => (
        <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
          {tag}
          <button type="button" onClick={() => remove(tag)} className="hover:text-destructive"><X className="w-3 h-3" /></button>
        </span>
      ))}
      <input
        className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        placeholder={value.length ? '' : placeholder}
        value={inputVal}
        onChange={e => setInputVal(e.target.value)}
        onKeyDown={handleKey}
      />
    </div>
  );
};

const CharCount = ({ value = '', max, warn = 0.85 }) => {
  const len = value.length;
  const overWarn = len > max * warn;
  const overMax = len > max;
  return (
    <span className={`text-xs tabular-nums ${overMax ? 'text-destructive font-semibold' : overWarn ? 'text-amber-500' : 'text-muted-foreground'}`}>
      {len}/{max}
    </span>
  );
};

// mode="admin" exposes status/featured/SEO controls; mode="user" locks
// submissions to pending_review so they go through the admin approval queue.
const EventFormModal = ({ isOpen, onClose, event, scrapedData, onSaved, mode = 'admin' }) => {
  const { currentUser } = useAuth();
  const isUserMode = mode === 'user';
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [formData, setFormData] = useState(INITIAL_STATE);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    if (scrapedData) {
      setFormData({
        ...INITIAL_STATE,
        title:               scrapedData.title || scrapedData.name || '',
        short_description:   scrapedData.short_description || '',
        description:         scrapedData.description || '',
        event_type:          scrapedData.event_type || 'community_event',
        status:              'approved',
        featured_card_games: scrapedData.featured_card_games || [],
        is_featured:         false,
        venue_name:          scrapedData.venue_name || scrapedData.location || '',
        address:             scrapedData.address || '',
        suburb:              scrapedData.suburb || '',
        state:               scrapedData.state || '',
        postcode:            scrapedData.postcode || '',
        start_date:          scrapedData.start_date || scrapedData.date || '',
        end_date:            scrapedData.end_date || '',
        start_time:          scrapedData.start_time || scrapedData.time || '',
        end_time:            scrapedData.end_time || '',
        organizer_name:      scrapedData.organizer_name || scrapedData.organizer || '',
        organizer_email:     scrapedData.organizer_email || scrapedData.contact?.email || '',
        organizer_phone:     scrapedData.organizer_phone || scrapedData.contact?.phone || '',
        website_url:         scrapedData.website_url || scrapedData.contact?.website || '',
        ticket_url:          scrapedData.ticket_url || scrapedData.registrationLink || '',
        instagram_url:       scrapedData.instagram_url || '',
        facebook_url:        scrapedData.facebook_url || '',
        entry_fee_aud:       scrapedData.entry_fee_aud != null ? String(scrapedData.entry_fee_aud) : scrapedData.price != null ? String(scrapedData.price) : '',
        is_free:             scrapedData.is_free ?? (!scrapedData.entry_fee_aud && !scrapedData.price),
        capacity:            scrapedData.capacity != null ? String(scrapedData.capacity) : '',
        registration_required: scrapedData.registration_required || false,
        seo_title:           scrapedData.seo_title || '',
        seo_description:     scrapedData.seo_description || '',
        seo_keywords:        scrapedData.seo_keywords || [],
        tags:                scrapedData.tags || [],
        source_url:          scrapedData.source_url || '',
      });

      if (scrapedData.image_url || scrapedData.imageUrl) {
        const imgUrl = scrapedData.image_url || scrapedData.imageUrl;
        fetch(imgUrl).then(r => r.ok ? r.blob() : null).then(blob => {
          if (!blob) return;
          const ext = blob.type.split('/')[1] || 'jpg';
          const file = new File([blob], `scraped-event.${ext}`, { type: blob.type });
          setImageFile(file);
          setImagePreview(URL.createObjectURL(file));
        }).catch(() => {});
      }
      setActiveTab('details');

    } else if (event?.id) {
      setFormData({
        ...INITIAL_STATE,
        title:               event.title || '',
        short_description:   event.short_description || '',
        description:         event.description || '',
        event_type:          event.event_type || 'community_event',
        status:              event.status || 'approved',
        featured_card_games: event.featured_card_games || [],
        is_featured:         event.is_featured || false,
        venue_name:          event.venue_name || '',
        address:             event.address || '',
        suburb:              event.suburb || '',
        state:               event.state || '',
        postcode:            event.postcode || '',
        start_date:          event.start_date || '',
        end_date:            event.end_date || '',
        start_time:          event.start_time || '',
        end_time:            event.end_time || '',
        organizer_name:      event.organizer_name || '',
        organizer_email:     event.organizer_email || '',
        organizer_phone:     event.organizer_phone || '',
        website_url:         event.website_url || '',
        ticket_url:          event.ticket_url || '',
        instagram_url:       event.instagram_url || '',
        facebook_url:        event.facebook_url || '',
        entry_fee_aud:       event.entry_fee_aud != null ? String(event.entry_fee_aud) : '',
        is_free:             event.is_free ?? true,
        capacity:            event.capacity != null ? String(event.capacity) : '',
        registration_required: event.registration_required || false,
        seo_title:           event.seo_title || '',
        seo_description:     event.seo_description || '',
        seo_keywords:        event.seo_keywords || [],
        tags:                event.tags || [],
        source_url:          event.source_url || '',
      });
      setImagePreview(event.image_url || null);
      setActiveTab('details');

    } else {
      setFormData(INITIAL_STATE);
      setImagePreview(null);
      setActiveTab('details');
    }

    setImageFile(null);
    setRemoveExistingImage(false);
  }, [isOpen, event, scrapedData]);

  const set = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleChange = (e) => set(e.target.name, e.target.value);

  const toggleCardGame = (game) => {
    set('featured_card_games', formData.featured_card_games.includes(game)
      ? formData.featured_card_games.filter(g => g !== game)
      : [...formData.featured_card_games, game]);
  };

  const processFile = (file) => {
    if (!file) return;
    if (file.size > 20971520) { toast.error('Image exceeds 20MB.'); return; }
    if (!file.type.startsWith('image/')) { toast.error('Only images allowed.'); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setRemoveExistingImage(false);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setRemoveExistingImage(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error('Event title is required.');
      setActiveTab('details');
      return;
    }

    if (!formData.start_date) {
      toast.error('Start date is required.');
      setActiveTab('venue');
      return;
    }

    setLoading(true);
    try {
      let image_url = event?.image_url ?? null;

      if (imageFile) {
        const compressed = await compressImage(imageFile);
        const ext = compressed.name.split('.').pop() || 'jpg';
        const path = `events/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('events').upload(path, compressed, { upsert: true });
        if (!upErr) {
          image_url = supabase.storage.from('events').getPublicUrl(path).data.publicUrl;
        }
      } else if (removeExistingImage) {
        image_url = null;
      }

      const payload = {
        title:               formData.title.trim(),
        short_description:   formData.short_description.trim() || null,
        description:         formData.description.trim() || null,
        event_type:          formData.event_type,
        // User submissions always enter the review queue — RLS enforces this too
        status:              isUserMode ? 'pending_review' : formData.status,
        featured_card_games: formData.featured_card_games.length ? formData.featured_card_games : null,
        is_featured:         isUserMode ? false : formData.is_featured,
        image_url,
        // Venue
        venue_name:          formData.venue_name.trim() || null,
        address:             formData.address.trim() || null,
        suburb:              formData.suburb.trim() || null,
        state:               formData.state || null,
        postcode:            formData.postcode.trim() || null,
        // Dates
        start_date:          formData.start_date || null,
        end_date:            formData.end_date || null,
        start_time:          formData.start_time || null,
        end_time:            formData.end_time || null,
        // Organiser
        organizer_name:      formData.organizer_name.trim() || null,
        organizer_email:     formData.organizer_email.trim() || null,
        organizer_phone:     formData.organizer_phone.trim() || null,
        website_url:         formData.website_url.trim() || null,
        ticket_url:          formData.ticket_url.trim() || null,
        instagram_url:       formData.instagram_url.trim() || null,
        facebook_url:        formData.facebook_url.trim() || null,
        entry_fee_aud:       formData.is_free ? 0 : (parseFloat(formData.entry_fee_aud) || 0),
        is_free:             formData.is_free,
        capacity:            formData.capacity ? parseInt(formData.capacity, 10) : null,
        registration_required: formData.registration_required,
        // SEO
        seo_title:           formData.seo_title.trim() || null,
        seo_description:     formData.seo_description.trim() || null,
        seo_keywords:        formData.seo_keywords.length ? formData.seo_keywords : null,
        tags:                formData.tags.length ? formData.tags : null,
        source_url:          formData.source_url.trim() || null,
        // Organiser FK
        ...(currentUser?.id && { organiser_id: currentUser.id }),
      };

      if (event?.id) {
        const { error } = await supabase.from('events').update(payload).eq('id', event.id);
        if (error) throw error;
        toast.success(isUserMode ? 'Event updated — it will be reviewed before publishing.' : 'Event updated successfully');
      } else {
        // SEO-friendly slug for the event detail URL; suffix on collision
        payload.slug = `${slugify(formData.title)}-${formData.start_date}`;
        let { error } = await supabase.from('events').insert(payload);
        if (error?.code === '23505') {
          payload.slug = `${payload.slug}-${Math.random().toString(36).slice(2, 6)}`;
          ({ error } = await supabase.from('events').insert(payload));
        }
        if (error) throw error;
        toast.success(isUserMode
          ? 'Event submitted! Our team will review it before it appears on the calendar.'
          : 'Event created successfully');
      }

      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error('Event save error:', err);
      toast.error(err.message || 'Failed to save event');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'bg-background rounded-xl h-11';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !loading && !open && onClose()}>
      <DialogContent className="sm:max-w-[860px] w-[95vw] h-[92vh] sm:h-auto max-h-[92vh] flex flex-col p-0 overflow-hidden bg-card border-border shadow-xl">
        <DialogHeader className="px-6 py-5 border-b border-border bg-muted/20 shrink-0">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-2xl font-bold font-heading text-foreground">
              {event?.id ? 'Edit Event' : 'Create New Event'}
            </DialogTitle>
            {scrapedData && (
              <Badge variant="secondary" className="bg-primary/10 text-primary border-none shadow-sm h-6 font-semibold px-3">
                <Wand2 className="w-3.5 h-3.5 mr-1.5" /> AI Auto-populated
              </Badge>
            )}
          </div>
          <DialogDescription className="text-muted-foreground mt-1">
            {isUserMode
              ? 'Submit your card event to the CardPop calendar. Our team reviews every submission before it goes live.'
              : event?.id ? 'Update event details, SEO, and visibility.' : 'Add a comprehensive event listing with full SEO setup.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="px-6 border-b border-border sticky top-0 bg-card z-10 pt-2">
              <TabsList className="w-full justify-start h-12 bg-transparent p-0 gap-0">
                {[
                  { id: 'details',   label: 'Details' },
                  { id: 'venue',     label: 'Venue & Dates' },
                  { id: 'organiser', label: 'Organiser' },
                  ...(isUserMode ? [] : [{ id: 'seo', label: 'SEO' }]),
                ].map(tab => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 font-bold text-sm h-full"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <div className="p-6 space-y-0">

              {/* ── TAB 1: DETAILS ── */}
              <TabsContent value="details" className="mt-0 space-y-5 animate-in fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="sm:col-span-2 space-y-2">
                    <Label htmlFor="title" className="font-bold">Event Title <span className="text-destructive">*</span></Label>
                    <Input id="title" name="title" value={formData.title} onChange={handleChange} className={inputCls} disabled={loading} required />
                  </div>

                  <div className="sm:col-span-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="short_description" className="font-bold">Short Description <span className="text-muted-foreground font-normal text-xs">(listing card teaser)</span></Label>
                      <CharCount value={formData.short_description} max={200} />
                    </div>
                    <Input id="short_description" name="short_description" value={formData.short_description} onChange={handleChange} className={inputCls} placeholder="1-2 sentence hook shown on event cards and social previews" disabled={loading} />
                  </div>

                  <div className="sm:col-span-2 space-y-2">
                    <Label htmlFor="description" className="font-bold">Full Description</Label>
                    <Textarea id="description" name="description" value={formData.description} onChange={handleChange} className="bg-background min-h-[140px] rounded-xl resize-y" disabled={loading} />
                  </div>

                  <div className="space-y-2">
                    <Label className="font-bold">Event Type</Label>
                    <Select value={formData.event_type} onValueChange={v => set('event_type', v)} disabled={loading}>
                      <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {!isUserMode && (
                    <div className="space-y-2">
                      <Label className="font-bold">Status</Label>
                      <Select value={formData.status} onValueChange={v => set('status', v)} disabled={loading}>
                        <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Featured Card Games */}
                <div className="space-y-2">
                  <Label className="font-bold">Featured Card Games</Label>
                  <div className="flex flex-wrap gap-2">
                    {CARD_GAMES.map(game => (
                      <button
                        key={game} type="button"
                        onClick={() => toggleCardGame(game)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                          formData.featured_card_games.includes(game)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-muted/40 text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                        }`}
                      >
                        {game}
                      </button>
                    ))}
                  </div>
                </div>

                {!isUserMode && (
                  <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-xl border border-border">
                    <Switch checked={formData.is_featured} onCheckedChange={v => set('is_featured', v)} disabled={loading} />
                    <div>
                      <p className="text-sm font-semibold">Feature on Homepage</p>
                      <p className="text-xs text-muted-foreground">Appears in the featured events section</p>
                    </div>
                  </div>
                )}

                {/* Image upload */}
                <div className="space-y-2">
                  <Label className="font-bold">Cover Image</Label>
                  <div
                    className={`border-2 border-dashed rounded-2xl transition-all ${isDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/20 hover:bg-muted/40'}`}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}
                    onDrop={e => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]); }}
                  >
                    {imagePreview ? (
                      <div className="relative p-2">
                        <div className="relative aspect-[21/9] rounded-xl overflow-hidden bg-black/5">
                          <img src={imagePreview} alt="Preview" className="w-full h-full object-contain" />
                          <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8 rounded-full shadow" onClick={clearImage}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <UploadCloud className="w-8 h-8 text-muted-foreground mb-2" />
                        <p className="text-sm font-semibold text-foreground">Click or drag to upload</p>
                        <p className="text-xs text-muted-foreground">Max 20MB — JPG, PNG, WEBP</p>
                      </div>
                    )}
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => e.target.files[0] && processFile(e.target.files[0])} disabled={loading} />
                  </div>
                </div>
              </TabsContent>

              {/* ── TAB 2: VENUE & DATES ── */}
              <TabsContent value="venue" className="mt-0 space-y-5 animate-in fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="sm:col-span-2 space-y-2">
                    <Label htmlFor="venue_name" className="font-bold">Venue Name</Label>
                    <Input id="venue_name" name="venue_name" value={formData.venue_name} onChange={handleChange} className={inputCls} placeholder="e.g. Melbourne Convention Centre" disabled={loading} />
                  </div>
                  <div className="sm:col-span-2 space-y-2">
                    <Label htmlFor="address" className="font-bold">Street Address</Label>
                    <Input id="address" name="address" value={formData.address} onChange={handleChange} className={inputCls} disabled={loading} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="suburb" className="font-bold">Suburb</Label>
                    <Input id="suburb" name="suburb" value={formData.suburb} onChange={handleChange} className={inputCls} disabled={loading} />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold">State</Label>
                    <Select value={formData.state} onValueChange={v => set('state', v)} disabled={loading}>
                      <SelectTrigger className={inputCls}><SelectValue placeholder="Select state" /></SelectTrigger>
                      <SelectContent>
                        {AUS_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postcode" className="font-bold">Postcode</Label>
                    <Input id="postcode" name="postcode" value={formData.postcode} onChange={handleChange} className={inputCls} maxLength={4} disabled={loading} />
                  </div>
                </div>

                <div className="pt-2 border-t border-border">
                  <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">Dates & Times</p>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="start_date" className="font-bold">Start Date</Label>
                      <Input id="start_date" name="start_date" type="date" value={formData.start_date} onChange={handleChange} className={inputCls} disabled={loading} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end_date" className="font-bold">End Date</Label>
                      <Input id="end_date" name="end_date" type="date" value={formData.end_date} onChange={handleChange} className={inputCls} disabled={loading} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="start_time" className="font-bold">Start Time</Label>
                      <Input id="start_time" name="start_time" type="time" value={formData.start_time} onChange={handleChange} className={inputCls} disabled={loading} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end_time" className="font-bold">End Time</Label>
                      <Input id="end_time" name="end_time" type="time" value={formData.end_time} onChange={handleChange} className={inputCls} disabled={loading} />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ── TAB 3: ORGANISER ── */}
              <TabsContent value="organiser" className="mt-0 space-y-5 animate-in fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="sm:col-span-2 space-y-2">
                    <Label htmlFor="organizer_name" className="font-bold">Organizer Name</Label>
                    <Input id="organizer_name" name="organizer_name" value={formData.organizer_name} onChange={handleChange} className={inputCls} disabled={loading} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="organizer_email" className="font-bold">Contact Email</Label>
                    <Input id="organizer_email" name="organizer_email" type="email" value={formData.organizer_email} onChange={handleChange} className={inputCls} disabled={loading} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="organizer_phone" className="font-bold">Contact Phone</Label>
                    <Input id="organizer_phone" name="organizer_phone" value={formData.organizer_phone} onChange={handleChange} className={inputCls} disabled={loading} />
                  </div>
                  <div className="sm:col-span-2 space-y-2">
                    <Label htmlFor="website_url" className="font-bold">Event Website</Label>
                    <Input id="website_url" name="website_url" type="url" value={formData.website_url} onChange={handleChange} className={inputCls} placeholder="https://" disabled={loading} />
                  </div>
                  <div className="sm:col-span-2 space-y-2">
                    <Label htmlFor="ticket_url" className="font-bold">Tickets / Registration URL</Label>
                    <Input id="ticket_url" name="ticket_url" type="url" value={formData.ticket_url} onChange={handleChange} className={inputCls} placeholder="https://" disabled={loading} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="instagram_url" className="font-bold">Instagram URL</Label>
                    <Input id="instagram_url" name="instagram_url" type="url" value={formData.instagram_url} onChange={handleChange} className={inputCls} placeholder="https://instagram.com/..." disabled={loading} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="facebook_url" className="font-bold">Facebook URL</Label>
                    <Input id="facebook_url" name="facebook_url" type="url" value={formData.facebook_url} onChange={handleChange} className={inputCls} placeholder="https://facebook.com/..." disabled={loading} />
                  </div>
                </div>

                <div className="pt-2 border-t border-border space-y-5">
                  <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Entry & Capacity</p>
                  <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-xl border border-border">
                    <Switch checked={formData.is_free} onCheckedChange={v => { set('is_free', v); if (v) set('entry_fee_aud', ''); }} disabled={loading} />
                    <div>
                      <p className="text-sm font-semibold">Free Entry</p>
                      <p className="text-xs text-muted-foreground">Toggle off to set an entry fee</p>
                    </div>
                  </div>
                  {!formData.is_free && (
                    <div className="space-y-2">
                      <Label htmlFor="entry_fee_aud" className="font-bold">Entry Fee (AUD)</Label>
                      <Input id="entry_fee_aud" name="entry_fee_aud" type="number" min="0" step="0.01" value={formData.entry_fee_aud} onChange={handleChange} className={inputCls} placeholder="0.00" disabled={loading} />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="capacity" className="font-bold">Max Capacity</Label>
                      <Input id="capacity" name="capacity" type="number" min="1" value={formData.capacity} onChange={handleChange} className={inputCls} placeholder="e.g. 500" disabled={loading} />
                    </div>
                    <div className="flex items-center gap-3 pt-8">
                      <Switch checked={formData.registration_required} onCheckedChange={v => set('registration_required', v)} disabled={loading} />
                      <Label className="font-semibold text-sm cursor-pointer">Registration Required</Label>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ── TAB 4: SEO (admin only) ── */}
              {!isUserMode && (
              <TabsContent value="seo" className="mt-0 space-y-5 animate-in fade-in">
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm text-muted-foreground">
                  Complete SEO fields are auto-generated by the AI scraper. Review and refine them here for best search performance.
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="seo_title" className="font-bold">SEO Title <span className="text-muted-foreground font-normal text-xs">(page &lt;title&gt; tag)</span></Label>
                    <CharCount value={formData.seo_title} max={60} />
                  </div>
                  <Input id="seo_title" name="seo_title" value={formData.seo_title} onChange={handleChange} className={inputCls} placeholder="Leave blank to use event title — target 50-60 chars" disabled={loading} />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="seo_description" className="font-bold">Meta Description</Label>
                    <CharCount value={formData.seo_description} max={160} />
                  </div>
                  <Textarea id="seo_description" name="seo_description" value={formData.seo_description} onChange={handleChange} className="bg-background rounded-xl resize-none min-h-[80px]" placeholder="Keyword-rich description shown in Google results — target 140-160 chars" disabled={loading} />
                </div>

                <div className="space-y-2">
                  <Label className="font-bold">SEO Keywords <span className="text-muted-foreground font-normal text-xs">(press Enter to add)</span></Label>
                  <TagInput value={formData.seo_keywords} onChange={v => set('seo_keywords', v)} placeholder="Add keywords and press Enter..." />
                </div>

                <div className="space-y-2">
                  <Label className="font-bold">Event Tags <span className="text-muted-foreground font-normal text-xs">(for search & filtering)</span></Label>
                  <TagInput value={formData.tags} onChange={v => set('tags', v)} placeholder="Add tags and press Enter..." />
                </div>

                {formData.source_url && (
                  <div className="space-y-2">
                    <Label htmlFor="source_url" className="font-bold text-muted-foreground">Scraped From</Label>
                    <Input id="source_url" name="source_url" value={formData.source_url} onChange={handleChange} className={`${inputCls} text-muted-foreground`} disabled={loading} />
                  </div>
                )}
              </TabsContent>
              )}

            </div>
          </Tabs>

          <DialogFooter className="px-6 py-4 border-t border-border bg-muted/20 flex flex-col sm:flex-row gap-3 sm:justify-between shrink-0">
            <Button
              type="button" variant="outline"
              onClick={() => { setFormData(INITIAL_STATE); setImagePreview(null); setImageFile(null); setRemoveExistingImage(true); }}
              disabled={loading}
              className="rounded-xl font-bold text-muted-foreground hover:text-destructive hover:bg-destructive/10 border-transparent hover:border-destructive/20"
            >
              <Trash2 className="w-4 h-4 mr-2" /> Clear Form
            </Button>
            <div className="flex gap-3 sm:justify-end">
              <Button type="button" variant="ghost" onClick={onClose} disabled={loading} className="rounded-xl font-bold">Cancel</Button>
              <Button type="submit" disabled={loading} className="rounded-xl font-bold px-8 shadow-md">
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {event?.id ? 'Save Changes' : isUserMode ? 'Submit for Review' : 'Create Event'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EventFormModal;
