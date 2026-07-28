import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, ExternalLink, Info, Clock, CalendarDays, EyeOff } from 'lucide-react';
import Breadcrumb from '@/components/Breadcrumb.jsx';
import WhatnotShowFormModal from '@/components/WhatnotShowFormModal.jsx';
import WhatnotIcon from '@/components/WhatnotIcon.jsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { toCdnUrl } from '@/utils/imageUrl.js';
import { toast } from 'sonner';

const formatShowDate = (iso) => {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true }),
  };
};

// A show's badge reflects what a visitor to the directory would actually see.
const statusBadge = (show) => {
  if (show.admin_hidden) {
    return { label: 'Hidden by CardPop', cls: 'bg-destructive/10 text-destructive border-destructive/30' };
  }
  if (!show.is_active) {
    return { label: 'Not listed', cls: 'bg-muted text-muted-foreground border-border' };
  }
  if (new Date(show.show_date) <= new Date()) {
    return { label: 'Past', cls: 'bg-slate-500/10 text-slate-600 border-slate-300 dark:text-slate-400' };
  }
  return { label: 'Live on directory', cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:text-emerald-400' };
};

const AccountShows = () => {
  const { currentUser } = useAuth();
  const [shows, setShows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShow, setEditingShow] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const fetchMyShows = useCallback(async () => {
    if (!currentUser?.id) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('whatnot_shows')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('show_date', { ascending: false });
      if (error) throw error;
      setShows(data || []);
    } catch (err) {
      console.error('Failed to load your shows:', err);
      setLoadError('We couldn’t load your shows right now. Please try again shortly.');
      setShows([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => { fetchMyShows(); }, [fetchMyShows]);

  const upcomingCount = useMemo(
    () => shows.filter(s => s.is_active && !s.admin_hidden && new Date(s.show_date) > new Date()).length,
    [shows],
  );

  const openCreate = () => { setEditingShow(null); setIsModalOpen(true); };
  const openEdit = (show) => { setEditingShow(show); setIsModalOpen(true); };

  const handleDelete = async (show) => {
    if (!window.confirm(`Delete “${show.show_title}”? This can’t be undone.`)) return;
    setDeletingId(show.id);
    try {
      const { error } = await supabase.from('whatnot_shows').delete().eq('id', show.id);
      if (error) throw error;
      setShows(prev => prev.filter(s => s.id !== show.id));
      toast.success('Show deleted.');
    } catch (err) {
      toast.error(err.message || 'Failed to delete show.');
    } finally {
      setDeletingId(null);
    }
  };

  const toggleListed = async (show) => {
    const next = !show.is_active;
    try {
      const { error } = await supabase
        .from('whatnot_shows')
        .update({ is_active: next })
        .eq('id', show.id);
      if (error) throw error;
      setShows(prev => prev.map(s => (s.id === show.id ? { ...s, is_active: next } : s)));
      toast.success(next ? 'Show is back on the directory.' : 'Show removed from the directory.');
    } catch (err) {
      toast.error(err.message || 'Failed to update show.');
    }
  };

  return (
    <div className="max-w-[90rem] mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 py-8 w-full space-y-6">
      <Helmet><title>My Shows | CardPop</title></Helmet>
      <Breadcrumb items={[{ label: 'Account', path: '/account' }, { label: 'My Shows' }]} />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">My Shows</h1>
          <p className="text-muted-foreground mt-1">
            List your Whatnot live shows and manage where they appear.
          </p>
        </div>
        <Button onClick={openCreate} className="font-bold rounded-xl h-11 px-6 shadow-sm shrink-0 bg-[#FFDF00] hover:bg-[#FFDF00]/90 text-black">
          <Plus className="w-5 h-5 mr-2" /> List a Show
        </Button>
      </div>

      <div className="flex items-start gap-3 p-4 bg-[#FFDF00]/10 border border-[#FFDF00]/40 rounded-2xl text-sm text-muted-foreground">
        <Info className="w-5 h-5 text-yellow-600 dark:text-[#FFDF00] shrink-0 mt-0.5" />
        <p>
          Every show you list appears automatically on the{' '}
          <Link to="/community/whatnot" className="text-primary font-semibold hover:underline">Whatnot directory</Link>
          {' '}— no review needed. {upcomingCount > 0 && (
            <>You currently have <span className="font-semibold text-foreground">{upcomingCount}</span> upcoming {upcomingCount === 1 ? 'show' : 'shows'} live. </>
          )}
          Toggle a show off any time to hide it without deleting it.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
        </div>
      ) : loadError ? (
        <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-destructive/30">
          <WhatnotIcon className="w-14 h-14 mx-auto mb-4 opacity-40" />
          <h2 className="text-xl font-bold mb-2">Couldn’t load your shows</h2>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">{loadError}</p>
          <Button onClick={fetchMyShows} variant="outline" className="rounded-xl font-bold">Try again</Button>
        </div>
      ) : shows.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-border">
          <WhatnotIcon className="w-14 h-14 mx-auto mb-4 opacity-60" />
          <h2 className="text-xl font-bold mb-2">No shows yet</h2>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            Going live on Whatnot? List your show so collectors across Australia know when to tune in.
          </p>
          <Button onClick={openCreate} className="rounded-xl font-bold bg-[#FFDF00] hover:bg-[#FFDF00]/90 text-black">
            <Plus className="w-4 h-4 mr-2" /> List Your First Show
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {shows.map(show => {
            const { date, time } = formatShowDate(show.show_date);
            const badge = statusBadge(show);
            return (
              <div key={show.id} className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4">
                {show.preview_image_url ? (
                  <img
                    src={toCdnUrl(show.preview_image_url)}
                    alt=""
                    className="w-full sm:w-28 h-28 sm:h-20 object-cover rounded-xl border border-border shrink-0"
                  />
                ) : (
                  <div className="w-full sm:w-28 h-28 sm:h-20 rounded-xl border border-border bg-muted/40 flex items-center justify-center shrink-0">
                    <WhatnotIcon className="w-7 h-7 opacity-50" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-1.5">
                    <h3 className="text-lg font-bold text-foreground truncate">{show.show_title}</h3>
                    <Badge variant="outline" className={`font-semibold ${badge.cls}`}>{badge.label}</Badge>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5"><CalendarDays className="w-4 h-4" /> {date}</span>
                    <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {time}</span>
                  </div>
                  {show.admin_hidden && (
                    <p className="mt-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
                      A CardPop admin has hidden this show from the directory. Contact support if you think this is a mistake.
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 shrink-0">
                  {show.whatnot_url && (
                    <Button variant="ghost" size="sm" className="rounded-xl gap-1.5" asChild>
                      <a href={show.whatnot_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3.5 h-3.5" /> Show link
                      </a>
                    </Button>
                  )}
                  {!show.admin_hidden && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl gap-1.5"
                      onClick={() => toggleListed(show)}
                    >
                      <EyeOff className="w-3.5 h-3.5" /> {show.is_active ? 'Unlist' : 'Relist'}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => openEdit(show)}>
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(show)}
                    disabled={deletingId === show.id}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <WhatnotShowFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        show={editingShow}
        onSaved={fetchMyShows}
      />
    </div>
  );
};

export default AccountShows;
