import React, { useState, useEffect, useCallback, useRef } from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { CalendarDays, ExternalLink, Plus, Tv2, Trash2, Clock, X, Star, ImageIcon } from 'lucide-react';

const WhatnotIcon = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
    <rect width="32" height="32" rx="8" fill="#00C854" />
    <path
      d="M5 9l4.5 14 4-9.5 2.5 5.5 2.5-5.5 4 9.5L27 9"
      stroke="white"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const StarRating = ({ rating, count }) => {
  if (!rating && !count) return null;
  return (
    <span className="flex items-center gap-1 text-xs text-amber-500 font-bold">
      <Star className="w-3 h-3 fill-amber-500" />
      {rating ? Number(rating).toFixed(1) : '—'}
      {count > 0 && <span className="text-muted-foreground font-normal">({count})</span>}
    </span>
  );
};

const EMPTY_FORM = {
  seller_name: '',
  show_title: '',
  description: '',
  show_date: '',
  show_time: '',
  whatnot_url: '',
  whatnot_channel_url: '',
};

const WhatnotShowsPage = () => {
  const { currentUser, isAuthenticated } = useAuth();

  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deletingId, setDeletingId] = useState(null);

  const [userProfile, setUserProfile] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  // Fetch current user's profile to auto-populate seller info
  useEffect(() => {
    if (!currentUser?.id) return;
    supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url, profile_photo_or_character, rating, reviews_count')
      .eq('id', currentUser.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setUserProfile(data);
          setForm(f => ({ ...f, seller_name: data.display_name || data.username || '' }));
        }
      });
  }, [currentUser?.id]);

  const fetchShows = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('whatnot_shows')
        .select('*, profiles:user_id(id, display_name, avatar_url, profile_photo_or_character, username, rating, reviews_count)')
        .eq('is_active', true)
        .gte('show_date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('show_date', { ascending: true });
      if (error) throw error;
      setShows(data || []);
    } catch (err) {
      console.error('Failed to fetch Whatnot shows:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchShows(); }, [fetchShows]);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('Image must be under 10 MB.'); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.show_title.trim() || !form.show_date || !form.show_time) {
      toast.error('Please fill in the title, date and time.');
      return;
    }
    if (!form.seller_name.trim()) {
      toast.error('Please enter a business or seller name.');
      return;
    }

    setSubmitting(true);
    try {
      let preview_image_url = null;

      if (imageFile) {
        const ext = imageFile.name.split('.').pop();
        const path = `whatnot-shows/${currentUser.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('vault-images')
          .upload(path, imageFile, { upsert: true });
        if (uploadErr) throw uploadErr;
        preview_image_url = supabase.storage.from('vault-images').getPublicUrl(path).data.publicUrl;
      }

      const showDatetime = new Date(`${form.show_date}T${form.show_time}`).toISOString();
      const { error } = await supabase.from('whatnot_shows').insert({
        user_id:             currentUser.id,
        seller_name:         form.seller_name.trim(),
        show_title:          form.show_title.trim(),
        description:         form.description.trim() || null,
        show_date:           showDatetime,
        whatnot_url:         form.whatnot_url.trim() || null,
        whatnot_channel_url: form.whatnot_channel_url.trim() || null,
        preview_image_url,
      });
      if (error) throw error;

      toast.success('Your show has been listed!');
      setForm(f => ({ ...EMPTY_FORM, seller_name: f.seller_name }));
      clearImage();
      setShowForm(false);
      fetchShows();
    } catch (err) {
      toast.error(err.message || 'Failed to submit show. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this show listing?')) return;
    setDeletingId(id);
    try {
      const { error } = await supabase.from('whatnot_shows').delete().eq('id', id).eq('user_id', currentUser.id);
      if (error) throw error;
      toast.success('Show removed.');
      setShows(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      toast.error(err.message || 'Failed to remove show.');
    } finally {
      setDeletingId(null);
    }
  };

  const formatShowDate = (iso) => {
    const d = new Date(iso);
    return {
      date: d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
      time: d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true }),
    };
  };

  const isUpcoming = (iso) => new Date(iso) > new Date();

  const resolveAvatarUrl = (profile) => {
    const raw = profile?.avatar_url || profile?.profile_photo_or_character;
    if (!raw) return null;
    if (raw.startsWith('http')) return raw;
    return supabase.storage.from('vault-images').getPublicUrl(raw).data.publicUrl;
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Whatnot Shows | CardPop Community" description="Find live trading card breaks and auctions from Australian sellers on Whatnot. Watch, bid and win." />

      {/* ── Hero ── */}
      <section className="bg-card border-b border-border py-16 text-center">
        <div className="container-default">
          <div className="flex items-center justify-center gap-3 mb-5">
            <WhatnotIcon className="w-12 h-12" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold font-serif mb-4">Whatnot Shows</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Advertise your upcoming Whatnot live shows to the CardPop community.
            Let collectors know when you're going live.
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* ── Auth banner ── */}
        {isAuthenticated ? (
          <div className="bg-[#00C854]/10 border border-[#00C854]/30 rounded-2xl p-5 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="font-bold text-foreground text-base mb-0.5">Got a show coming up?</p>
              <p className="text-sm text-muted-foreground">List it here so your followers know when to tune in.</p>
            </div>
            <Button
              onClick={() => setShowForm(v => !v)}
              className="shrink-0 bg-[#00C854] hover:bg-[#00C854]/90 text-white font-bold rounded-xl gap-2"
            >
              {showForm ? <><X className="w-4 h-4" /> Cancel</> : <><Plus className="w-4 h-4" /> List My Show</>}
            </Button>
          </div>
        ) : (
          <div className="bg-muted/40 border border-border rounded-2xl p-5 mb-8 text-center">
            <p className="text-muted-foreground text-sm font-medium">
              <a href="/login" className="text-primary font-bold hover:underline">Sign in</a> to advertise your upcoming Whatnot shows.
            </p>
          </div>
        )}

        {/* ── Submit form ── */}
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 mb-8 space-y-5 shadow-sm">
            <h2 className="text-xl font-bold font-serif">List Your Show</h2>

            {/* Listing-as profile card */}
            {userProfile && (
              <div className="bg-muted/40 border border-border rounded-xl p-4 flex items-center gap-3">
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarImage src={resolveAvatarUrl(userProfile)} />
                  <AvatarFallback className="text-sm font-bold">
                    {(userProfile.display_name || userProfile.username || 'S').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Listing as</p>
                  <p className="font-bold text-sm leading-tight">{userProfile.display_name || userProfile.username}</p>
                  <StarRating rating={userProfile.rating} count={userProfile.reviews_count} />
                </div>
              </div>
            )}

            {/* Business / Seller Name */}
            <div className="space-y-2">
              <Label htmlFor="seller_name">Business / Seller Name <span className="text-destructive">*</span></Label>
              <Input
                id="seller_name"
                placeholder="Your business name, sole trader name, or handle"
                value={form.seller_name}
                onChange={e => setForm(f => ({ ...f, seller_name: e.target.value }))}
                maxLength={120}
              />
              <p className="text-xs text-muted-foreground">This is the name buyers will see on your listing.</p>
            </div>

            {/* Show Title */}
            <div className="space-y-2">
              <Label htmlFor="show_title">Show Title <span className="text-destructive">*</span></Label>
              <Input
                id="show_title"
                placeholder="e.g. Sunday Night Pokémon Break"
                value={form.show_title}
                onChange={e => setForm(f => ({ ...f, show_title: e.target.value }))}
                maxLength={120}
              />
            </div>

            {/* Date + Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="show_date">Date <span className="text-destructive">*</span></Label>
                <Input
                  id="show_date"
                  type="date"
                  value={form.show_date}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setForm(f => ({ ...f, show_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="show_time">Time (your local time) <span className="text-destructive">*</span></Label>
                <Input
                  id="show_time"
                  type="time"
                  value={form.show_time}
                  onChange={e => setForm(f => ({ ...f, show_time: e.target.value }))}
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Show Description</Label>
              <Textarea
                id="description"
                placeholder="What cards or sets will you be breaking? Any special deals or giveaways?"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                maxLength={500}
              />
            </div>

            {/* Preview Image */}
            <div className="space-y-2">
              <Label>Show Preview Image</Label>
              {imagePreview ? (
                <div className="relative rounded-xl overflow-hidden border border-border">
                  <img src={imagePreview} alt="Preview" className="w-full max-h-52 object-cover" />
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute top-2 right-2 bg-background/90 hover:bg-background rounded-lg p-1.5 transition-colors shadow"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center gap-2 text-muted-foreground hover:border-[#00C854]/50 hover:text-[#00C854] transition-colors cursor-pointer"
                >
                  <ImageIcon className="w-8 h-8 opacity-50" />
                  <span className="text-sm font-medium">Upload a show preview or promotional image</span>
                  <span className="text-xs opacity-70">PNG, JPG — up to 10 MB</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
            </div>

            {/* Whatnot URLs */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="whatnot_url">Show / Event Link</Label>
                <Input
                  id="whatnot_url"
                  type="url"
                  placeholder="https://whatnot.com/live/..."
                  value={form.whatnot_url}
                  onChange={e => setForm(f => ({ ...f, whatnot_url: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Direct link to this specific show or auction event.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatnot_channel_url">Your Whatnot Channel / Profile</Label>
                <Input
                  id="whatnot_channel_url"
                  type="url"
                  placeholder="https://whatnot.com/user/yourname"
                  value={form.whatnot_channel_url}
                  onChange={e => setForm(f => ({ ...f, whatnot_channel_url: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Your Whatnot profile so buyers can follow you.</p>
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl font-bold h-11 bg-[#00C854] hover:bg-[#00C854]/90 text-white"
            >
              {submitting ? 'Publishing…' : 'Publish Show'}
            </Button>
          </form>
        )}

        {/* ── Shows list ── */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold font-serif">Upcoming Shows</h2>
          <Badge variant="secondary" className="text-sm font-bold">
            <Tv2 className="w-3.5 h-3.5 mr-1.5" />
            {loading ? '—' : shows.length} listed
          </Badge>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-2xl" />)}
          </div>
        ) : shows.length > 0 ? (
          <div className="space-y-4">
            {shows.map(show => {
              const { date, time } = formatShowDate(show.show_date);
              const upcoming = isUpcoming(show.show_date);
              const isOwner = currentUser?.id === show.user_id;
              const profile = show.profiles;
              const avatarUrl = resolveAvatarUrl(profile);
              const sellerName = show.seller_name || profile?.display_name || profile?.username || 'Seller';
              const profileLink = profile?.id ? `/seller/${profile.id}` : null;

              return (
                <div
                  key={show.id}
                  className="bg-card border border-border rounded-2xl overflow-hidden hover:border-[#00C854]/40 hover:shadow-md transition-all"
                >
                  {/* Preview image */}
                  {show.preview_image_url && (
                    <div className="relative">
                      <img
                        src={show.preview_image_url}
                        alt={show.show_title}
                        className="w-full h-48 object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
                      <div className="absolute top-3 left-3">
                        {upcoming ? (
                          <Badge className="bg-[#00C854] text-white border-0 font-bold text-xs shadow-md">Upcoming</Badge>
                        ) : (
                          <Badge className="bg-black/60 text-white border-0 text-xs backdrop-blur-sm">Live / Recent</Badge>
                        )}
                      </div>
                      {isOwner && (
                        <button
                          onClick={() => handleDelete(show.id)}
                          disabled={deletingId === show.id}
                          className="absolute top-3 right-3 bg-background/80 hover:bg-background text-muted-foreground hover:text-destructive rounded-lg p-1.5 transition-colors shadow"
                          title="Remove show"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}

                  <div className="p-5 flex flex-col sm:flex-row gap-4">
                    {/* Date pill */}
                    <div className="flex-shrink-0 flex flex-col items-center justify-center bg-[#00C854]/10 border border-[#00C854]/20 rounded-xl px-4 py-3 min-w-[90px] text-center self-start">
                      <CalendarDays className="w-5 h-5 text-[#00C854] mb-1" />
                      <span className="text-xs font-bold text-[#00C854] leading-tight">{date.split(',')[0]}</span>
                      <span className="text-base font-extrabold text-foreground leading-tight">{date.split(',')[1]?.trim()}</span>
                      <span className="text-xs text-muted-foreground mt-0.5 flex items-center gap-0.5">
                        <Clock className="w-3 h-3" />{time}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Title row */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-base leading-tight">{show.show_title}</h3>
                          {!show.preview_image_url && (
                            upcoming ? (
                              <Badge className="bg-[#00C854]/15 text-[#00C854] border-[#00C854]/30 font-bold text-[10px]">Upcoming</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px]">Live / Recent</Badge>
                            )
                          )}
                        </div>
                        {isOwner && !show.preview_image_url && (
                          <button
                            onClick={() => handleDelete(show.id)}
                            disabled={deletingId === show.id}
                            className="text-muted-foreground hover:text-destructive transition-colors shrink-0 p-1 rounded-lg hover:bg-destructive/10"
                            title="Remove show"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Description */}
                      {show.description && (
                        <p className="text-sm text-muted-foreground leading-relaxed mb-3">{show.description}</p>
                      )}

                      {/* Seller bar */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border mt-auto">
                        {/* Seller identity */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar className="h-9 w-9 flex-shrink-0 ring-2 ring-border">
                            <AvatarImage src={avatarUrl} />
                            <AvatarFallback className="text-xs font-bold">
                              {sellerName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            {profileLink ? (
                              <Link
                                to={profileLink}
                                className="font-bold text-sm hover:text-primary transition-colors truncate block leading-tight"
                              >
                                {sellerName}
                              </Link>
                            ) : (
                              <span className="font-bold text-sm truncate block leading-tight">{sellerName}</span>
                            )}
                            <StarRating rating={profile?.rating} count={profile?.reviews_count} />
                          </div>
                        </div>

                        {/* Action links */}
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {show.whatnot_channel_url && (
                            <a
                              href={show.whatnot_channel_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
                            >
                              <WhatnotIcon className="w-3.5 h-3.5" />
                              Channel
                            </a>
                          )}
                          {show.whatnot_url && (
                            <a
                              href={show.whatnot_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#00C854] hover:underline"
                            >
                              Watch Show
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 bg-muted/30 rounded-3xl border border-border border-dashed">
            <WhatnotIcon className="w-14 h-14 mb-4 opacity-60" />
            <p className="text-foreground text-xl font-bold mb-2">No shows listed yet</p>
            <p className="text-sm text-muted-foreground mb-6">Be the first to advertise your upcoming Whatnot show.</p>
            {isAuthenticated && (
              <Button
                onClick={() => setShowForm(true)}
                className="rounded-xl font-bold bg-[#00C854] hover:bg-[#00C854]/90 text-white gap-2"
              >
                <Plus className="w-4 h-4" /> List My Show
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatnotShowsPage;
