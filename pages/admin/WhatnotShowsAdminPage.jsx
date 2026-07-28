import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Eye, EyeOff, ExternalLink, Pencil, Plus, Search, Star, Trash2, Tv2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import WhatnotShowFormModal from '@/components/WhatnotShowFormModal.jsx';
import WhatnotIcon from '@/components/WhatnotIcon.jsx';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toCdnUrl } from '@/utils/imageUrl.js';

const FILTERS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'live',     label: 'On directory' },
  { value: 'hidden',   label: 'Hidden by admin' },
  { value: 'unlisted', label: 'Unlisted by owner' },
  { value: 'past',     label: 'Past' },
  { value: 'all',      label: 'All shows' },
];

const formatShowDate = (iso) => new Date(iso).toLocaleString('en-AU', {
  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: true,
});

const WhatnotShowsAdminPage = () => {
  const [shows, setShows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [filter, setFilter] = useState('upcoming');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShow, setEditingShow] = useState(null);

  const fetchShows = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      // Admins can read every row (RLS), so this is the full moderation queue.
      const { data, error } = await supabase
        .from('whatnot_shows')
        .select('*, profiles:user_id(id, display_name, username, avatar_url)')
        .order('show_date', { ascending: false });
      if (error) throw error;
      setShows(data || []);
    } catch (err) {
      console.error('Failed to load Whatnot shows:', err);
      setLoadError(err.message || 'Unable to load shows right now.');
      setShows([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchShows(); }, [fetchShows]);

  const visibleShows = useMemo(() => {
    const now = new Date();
    const q = query.trim().toLowerCase();
    return shows.filter((show) => {
      const upcoming = new Date(show.show_date) > now;
      const onDirectory = show.is_active && !show.admin_hidden;

      const matchesFilter =
        filter === 'all' ? true :
        filter === 'upcoming' ? upcoming :
        filter === 'live' ? onDirectory && upcoming :
        filter === 'hidden' ? show.admin_hidden :
        filter === 'unlisted' ? !show.is_active :
        /* past */ !upcoming;
      if (!matchesFilter) return false;

      if (!q) return true;
      return [show.show_title, show.seller_name, show.profiles?.display_name, show.profiles?.username]
        .filter(Boolean)
        .some(field => field.toLowerCase().includes(q));
    });
  }, [shows, filter, query]);

  const stats = useMemo(() => {
    const now = new Date();
    return {
      total:    shows.length,
      live:     shows.filter(s => s.is_active && !s.admin_hidden && new Date(s.show_date) > now).length,
      hidden:   shows.filter(s => s.admin_hidden).length,
      featured: shows.filter(s => s.is_featured).length,
    };
  }, [shows]);

  const patchShow = async (show, patch, successMessage) => {
    setBusyId(show.id);
    try {
      const { error } = await supabase.from('whatnot_shows').update(patch).eq('id', show.id);
      if (error) throw error;
      setShows(prev => prev.map(s => (s.id === show.id ? { ...s, ...patch } : s)));
      toast.success(successMessage);
    } catch (err) {
      toast.error(err.message || 'Failed to update show.');
    } finally {
      setBusyId(null);
    }
  };

  const toggleHidden = (show) => patchShow(
    show,
    { admin_hidden: !show.admin_hidden },
    show.admin_hidden ? 'Show restored to the directory.' : 'Show hidden from the directory.',
  );

  const toggleFeatured = (show) => patchShow(
    show,
    { is_featured: !show.is_featured },
    show.is_featured ? 'Show unpinned.' : 'Show pinned to the top of the directory.',
  );

  const handleDelete = async (show) => {
    if (!window.confirm(`Permanently delete “${show.show_title}”? The seller can't recover it.`)) return;
    setBusyId(show.id);
    try {
      const { error } = await supabase.from('whatnot_shows').delete().eq('id', show.id);
      if (error) throw error;
      setShows(prev => prev.filter(s => s.id !== show.id));
      toast.success('Show deleted.');
    } catch (err) {
      toast.error(err.message || 'Failed to delete show.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-3">
            <WhatnotIcon className="w-8 h-8" /> Whatnot Shows
          </h1>
          <p className="text-muted-foreground mt-1">
            Every member show published to the{' '}
            <Link to="/community/whatnot" className="text-primary font-semibold hover:underline">public Whatnot directory</Link>.
            Listings go live instantly — hide one here to take it down.
          </p>
        </div>
        <Button
          onClick={() => { setEditingShow(null); setIsModalOpen(true); }}
          className="font-bold rounded-xl h-11 px-6 shrink-0 bg-[#FFDF00] hover:bg-[#FFDF00]/90 text-black"
        >
          <Plus className="w-5 h-5 mr-2" /> Add Show
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total shows',    value: stats.total,    icon: Tv2 },
          { label: 'Live upcoming',  value: stats.live,     icon: Eye },
          { label: 'Hidden',         value: stats.hidden,   icon: EyeOff },
          { label: 'Featured',       value: stats.featured, icon: Star },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium mb-1">
              <Icon className="w-4 h-4" /> {label}
            </div>
            <p className="text-3xl font-bold text-foreground">{isLoading ? '—' : value}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by show title or seller…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-full sm:w-56 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FILTERS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
        </div>
      ) : loadError ? (
        <div className="text-center py-16 bg-card rounded-3xl border border-dashed border-destructive/30">
          <h2 className="text-xl font-bold mb-2">Couldn’t load shows</h2>
          <p className="text-muted-foreground mb-6">{loadError}</p>
          <Button onClick={fetchShows} variant="outline" className="rounded-xl font-bold">Try again</Button>
        </div>
      ) : visibleShows.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-3xl border border-dashed border-border">
          <WhatnotIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <h2 className="text-xl font-bold mb-2">No shows match this view</h2>
          <p className="text-muted-foreground">Try a different filter or clear the search.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleShows.map((show) => {
            const owner = show.profiles;
            const upcoming = new Date(show.show_date) > new Date();
            return (
              <div key={show.id} className="bg-card border border-border rounded-2xl p-5 flex flex-col lg:flex-row gap-4">
                {show.preview_image_url ? (
                  <img
                    src={toCdnUrl(show.preview_image_url)}
                    alt=""
                    className="w-full lg:w-32 h-32 lg:h-24 object-cover rounded-xl border border-border shrink-0"
                  />
                ) : (
                  <div className="w-full lg:w-32 h-32 lg:h-24 rounded-xl border border-border bg-muted/40 flex items-center justify-center shrink-0">
                    <WhatnotIcon className="w-7 h-7 opacity-50" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-bold text-lg truncate">{show.show_title}</h3>
                    {show.admin_hidden && <Badge variant="destructive">Hidden</Badge>}
                    {!show.is_active && <Badge variant="secondary">Unlisted by owner</Badge>}
                    {show.is_featured && (
                      <Badge className="bg-[#FFDF00] text-black border-0 gap-1">
                        <Star className="w-3 h-3 fill-black" /> Featured
                      </Badge>
                    )}
                    {!upcoming && <Badge variant="outline">Past</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{formatShowDate(show.show_date)}</p>
                  <p className="text-sm mt-1">
                    <span className="font-semibold text-foreground">{show.seller_name}</span>
                    {owner && (
                      <>
                        {' — '}
                        <Link to={`/admin/users/${owner.id}`} className="text-primary hover:underline">
                          {owner.display_name || owner.username || 'member'}
                        </Link>
                      </>
                    )}
                  </p>
                  {show.description && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{show.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-sm">
                    {show.whatnot_url && (
                      <a href={show.whatnot_url} target="_blank" rel="noopener noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">
                        Show link <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    {show.whatnot_channel_url && (
                      <a href={show.whatnot_channel_url} target="_blank" rel="noopener noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">
                        Channel <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 shrink-0 lg:flex-col lg:w-40">
                  <Button
                    variant={show.admin_hidden ? 'default' : 'outline'}
                    size="sm"
                    className="rounded-xl gap-1.5 lg:w-full"
                    disabled={busyId === show.id}
                    onClick={() => toggleHidden(show)}
                  >
                    {show.admin_hidden
                      ? <><Eye className="w-3.5 h-3.5" /> Restore</>
                      : <><EyeOff className="w-3.5 h-3.5" /> Hide</>}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl gap-1.5 lg:w-full"
                    disabled={busyId === show.id}
                    onClick={() => toggleFeatured(show)}
                  >
                    <Star className={`w-3.5 h-3.5 ${show.is_featured ? 'fill-current' : ''}`} />
                    {show.is_featured ? 'Unfeature' : 'Feature'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl gap-1.5 lg:w-full"
                    onClick={() => { setEditingShow(show); setIsModalOpen(true); }}
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl gap-1.5 lg:w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                    disabled={busyId === show.id}
                    onClick={() => handleDelete(show)}
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
        onSaved={fetchShows}
      />
    </div>
  );
};

export default WhatnotShowsAdminPage;
