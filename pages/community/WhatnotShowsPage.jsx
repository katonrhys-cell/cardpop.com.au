import React, { useState, useEffect, useCallback } from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import Breadcrumb from '@/components/Breadcrumb.jsx';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { CalendarDays, ExternalLink, Plus, Tv2, Trash2, Pencil, Clock, Star, ListChecks } from 'lucide-react';
import { publicImageUrl, toCdnUrl } from '@/utils/imageUrl.js';
import WhatnotShowFormModal from '@/components/WhatnotShowFormModal.jsx';

import WhatnotIcon from '@/components/WhatnotIcon.jsx';

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

const WhatnotShowsPage = () => {
  const { currentUser, isAuthenticated } = useAuth();

  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showsError, setShowsError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShow, setEditingShow] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const fetchShows = useCallback(async () => {
    setLoading(true);
    setShowsError(null);
    try {
      // Admin-hidden rows are filtered out by RLS for everyone but their owner
      // and admins, so the explicit filter here keeps those two audiences from
      // seeing a taken-down show sitting in the public directory.
      const { data, error } = await supabase
        .from('whatnot_shows')
        .select('*, profiles:user_id(id, display_name, avatar_url, profile_photo_or_character, username, rating, reviews_count)')
        .eq('is_active', true)
        .eq('admin_hidden', false)
        .gte('show_date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('is_featured', { ascending: false })
        .order('show_date', { ascending: true });
      if (error) throw error;
      setShows(data || []);
    } catch (err) {
      console.error('Failed to load Whatnot shows:', err);
      setShowsError('Unable to load shows right now. Please try again shortly.');
      setShows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchShows(); }, [fetchShows]);

  const openCreate = () => { setEditingShow(null); setIsModalOpen(true); };
  const openEdit = (show) => { setEditingShow(show); setIsModalOpen(true); };

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
    return publicImageUrl(raw);
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Whatnot Shows | CardPop Community" description="Find live trading card breaks and auctions from Australian sellers on Whatnot. Watch, bid and win." />

      <div className="container-default pt-6">
        <Breadcrumb items={[{ label: 'Home', path: '/' }, { label: 'Community', path: '/community' }, { label: 'Whatnot' }]} />
      </div>

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

      <div className="container-default py-10">

        {/* ── Auth banner ── */}
        {isAuthenticated ? (
          <div className="bg-[#FFDF00]/10 border border-[#FFDF00]/40 rounded-2xl p-5 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="font-bold text-foreground text-base mb-0.5">Got a show coming up?</p>
              <p className="text-sm text-muted-foreground">
                List it here so your followers know when to tune in — it goes live straight away.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button variant="outline" className="rounded-xl font-bold gap-2" asChild>
                <Link to="/account/shows"><ListChecks className="w-4 h-4" /> My Shows</Link>
              </Button>
              <Button
                onClick={openCreate}
                className="bg-[#FFDF00] hover:bg-[#FFDF00]/90 text-black font-bold rounded-xl gap-2"
              >
                <Plus className="w-4 h-4" /> List My Show
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-muted/40 border border-border rounded-2xl p-5 mb-8 text-center">
            <p className="text-muted-foreground text-sm font-medium">
              <Link to="/login" className="text-primary font-bold hover:underline">Sign in</Link> to advertise your upcoming Whatnot shows.
            </p>
          </div>
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
        ) : showsError ? (
          <div className="flex flex-col items-center justify-center py-16 bg-muted/30 rounded-3xl border border-destructive/20 border-dashed">
            <Tv2 className="w-12 h-12 text-destructive mb-4 opacity-40" />
            <p className="text-foreground text-xl font-bold mb-2">Couldn't load shows</p>
            <p className="text-sm text-muted-foreground mb-6">{showsError}</p>
            <Button onClick={fetchShows} variant="outline" className="rounded-xl font-bold">
              Try again
            </Button>
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
                  className={`bg-card border rounded-2xl overflow-hidden hover:border-[#FFDF00]/50 hover:shadow-md transition-all ${
                    show.is_featured ? 'border-[#FFDF00] shadow-sm' : 'border-border'
                  }`}
                >
                  {/* Preview image */}
                  {show.preview_image_url && (
                    <div className="relative">
                      <img
                        src={toCdnUrl(show.preview_image_url)}
                        alt={show.show_title}
                        className="w-full h-48 object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
                      <div className="absolute top-3 left-3 flex gap-2">
                        {show.is_featured && (
                          <Badge className="bg-black/70 text-[#FFDF00] border-0 font-bold text-xs backdrop-blur-sm gap-1">
                            <Star className="w-3 h-3 fill-[#FFDF00]" /> Featured
                          </Badge>
                        )}
                        {upcoming ? (
                          <Badge className="bg-[#FFDF00] text-black border-0 font-bold text-xs shadow-md">Upcoming</Badge>
                        ) : (
                          <Badge className="bg-black/60 text-white border-0 text-xs backdrop-blur-sm">Live / Recent</Badge>
                        )}
                      </div>
                      {isOwner && (
                        <div className="absolute top-3 right-3 flex gap-1.5">
                          <button
                            onClick={() => openEdit(show)}
                            className="bg-background/80 hover:bg-background text-muted-foreground hover:text-foreground rounded-lg p-1.5 transition-colors shadow"
                            title="Edit show"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(show.id)}
                            disabled={deletingId === show.id}
                            className="bg-background/80 hover:bg-background text-muted-foreground hover:text-destructive rounded-lg p-1.5 transition-colors shadow"
                            title="Remove show"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="p-5 flex flex-col sm:flex-row gap-4">
                    {/* Date pill */}
                    <div className="flex-shrink-0 flex flex-col items-center justify-center bg-[#FFDF00]/10 border border-[#FFDF00]/30 rounded-xl px-4 py-3 min-w-[90px] text-center self-start">
                      <CalendarDays className="w-5 h-5 text-yellow-600 dark:text-[#FFDF00] mb-1" />
                      <span className="text-xs font-bold text-yellow-600 dark:text-[#FFDF00] leading-tight">{date.split(',')[0]}</span>
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
                            <>
                              {show.is_featured && (
                                <Badge className="bg-[#FFDF00] text-black border-0 font-bold text-[10px] gap-1">
                                  <Star className="w-2.5 h-2.5 fill-black" /> Featured
                                </Badge>
                              )}
                              {upcoming ? (
                                <Badge className="bg-[#FFDF00]/15 text-yellow-700 dark:text-[#FFDF00] border-[#FFDF00]/40 font-bold text-[10px]">Upcoming</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px]">Live / Recent</Badge>
                              )}
                            </>
                          )}
                        </div>
                        {isOwner && !show.preview_image_url && (
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => openEdit(show)}
                              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted"
                              title="Edit show"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(show.id)}
                              disabled={deletingId === show.id}
                              className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded-lg hover:bg-destructive/10"
                              title="Remove show"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
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
                              className="inline-flex items-center gap-1.5 text-sm font-bold text-yellow-600 dark:text-[#FFDF00] hover:underline"
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
                onClick={openCreate}
                className="rounded-xl font-bold bg-[#FFDF00] hover:bg-[#FFDF00]/90 text-black gap-2"
              >
                <Plus className="w-4 h-4" /> List My Show
              </Button>
            )}
          </div>
        )}
      </div>

      <WhatnotShowFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        show={editingShow}
        onSaved={fetchShows}
      />
    </div>
  );
};

export default WhatnotShowsPage;
