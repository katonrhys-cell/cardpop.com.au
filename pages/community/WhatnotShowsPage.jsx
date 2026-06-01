import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
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
import { CalendarDays, ExternalLink, Plus, Tv2, Trash2, Clock, X } from 'lucide-react';

// ── Whatnot brand SVG icon ──────────────────────────────────────────────────
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

const EMPTY_FORM = {
  show_title: '',
  description: '',
  show_date: '',
  show_time: '',
  whatnot_url: '',
};

const WhatnotShowsPage = () => {
  const { currentUser, isAuthenticated } = useAuth();

  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deletingId, setDeletingId] = useState(null);

  const fetchShows = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('whatnot_shows')
        .select('*, profiles:user_id(display_name, avatar_url, username)')
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.show_title.trim() || !form.show_date || !form.show_time) {
      toast.error('Please fill in the title, date and time.');
      return;
    }

    setSubmitting(true);
    try {
      const showDatetime = new Date(`${form.show_date}T${form.show_time}`).toISOString();
      const { error } = await supabase.from('whatnot_shows').insert({
        user_id:     currentUser.id,
        seller_name: currentUser.display_name || currentUser.username || currentUser.email,
        show_title:  form.show_title.trim(),
        description: form.description.trim() || null,
        show_date:   showDatetime,
        whatnot_url: form.whatnot_url.trim() || null,
      });
      if (error) throw error;
      toast.success('Your show has been listed!');
      setForm(EMPTY_FORM);
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
      const { error } = await supabase.from('whatnot_shows').delete().eq('id', id);
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

  return (
    <div className="min-h-screen bg-background">
      <Helmet><title>Whatnot Shows | CardPop Community</title></Helmet>

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

        {/* ── Submit banner ── */}
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

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="What cards or sets will you be breaking? Any special deals?"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                maxLength={500}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatnot_url">Your Whatnot Channel / Show Link</Label>
              <Input
                id="whatnot_url"
                type="url"
                placeholder="https://whatnot.com/user/yourname"
                value={form.whatnot_url}
                onChange={e => setForm(f => ({ ...f, whatnot_url: e.target.value }))}
              />
            </div>

            <Button type="submit" disabled={submitting} className="w-full rounded-xl font-bold h-11 bg-[#00C854] hover:bg-[#00C854]/90 text-white">
              {submitting ? 'Submitting…' : 'Publish Show'}
            </Button>
          </form>
        )}

        {/* ── Shows grid ── */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold font-serif">Upcoming Shows</h2>
          <Badge variant="secondary" className="text-sm font-bold">
            <Tv2 className="w-3.5 h-3.5 mr-1.5" />
            {loading ? '—' : shows.length} listed
          </Badge>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-36 w-full rounded-2xl" />)}
          </div>
        ) : shows.length > 0 ? (
          <div className="space-y-4">
            {shows.map(show => {
              const { date, time } = formatShowDate(show.show_date);
              const upcoming = isUpcoming(show.show_date);
              const isOwner = currentUser?.id === show.user_id;
              const profile = show.profiles;

              return (
                <div
                  key={show.id}
                  className="bg-card border border-border rounded-2xl p-5 flex flex-col sm:flex-row gap-4 hover:border-[#00C854]/40 hover:shadow-md transition-all"
                >
                  {/* Left: date pill */}
                  <div className="flex-shrink-0 flex flex-col items-center justify-center bg-[#00C854]/10 border border-[#00C854]/20 rounded-xl px-4 py-3 min-w-[90px] text-center">
                    <CalendarDays className="w-5 h-5 text-[#00C854] mb-1" />
                    <span className="text-xs font-bold text-[#00C854] leading-tight">{date.split(',')[0]}</span>
                    <span className="text-base font-extrabold text-foreground leading-tight">{date.split(',')[1]?.trim()}</span>
                    <span className="text-xs text-muted-foreground mt-0.5 flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />{time}
                    </span>
                  </div>

                  {/* Right: content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-bold text-base leading-tight">{show.show_title}</h3>
                          {upcoming ? (
                            <Badge className="bg-[#00C854]/15 text-[#00C854] border-[#00C854]/30 font-bold text-[10px]">Upcoming</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">Live Now / Recently</Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Avatar className="h-5 w-5 flex-shrink-0">
                            <AvatarImage src={profile?.avatar_url} />
                            <AvatarFallback className="text-[10px]">{(profile?.display_name || show.seller_name || 'S').charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{profile?.display_name || show.seller_name}</span>
                        </div>
                      </div>

                      {isOwner && (
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

                    {show.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1 mb-3">{show.description}</p>
                    )}

                    {show.whatnot_url && (
                      <a
                        href={show.whatnot_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-bold text-[#00C854] hover:underline"
                      >
                        <WhatnotIcon className="w-4 h-4" />
                        Watch on Whatnot
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
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
              <Button onClick={() => setShowForm(true)} className="rounded-xl font-bold bg-[#00C854] hover:bg-[#00C854]/90 text-white gap-2">
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
