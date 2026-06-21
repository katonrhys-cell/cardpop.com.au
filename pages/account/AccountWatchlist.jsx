import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Heart, ExternalLink, RefreshCw, Clock, Tag, Trash2 } from 'lucide-react';
import Breadcrumb from '@/components/Breadcrumb.jsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useWatchlist } from '@/hooks/useWatchlist.js';
import { supabase } from '@/lib/supabaseClient.js';
import { slugify } from '@/lib/slugify.js';
import { toast } from 'sonner';

// ── Auction countdown ─────────────────────────────────────────────────────────
const useCountdown = (endAt) => {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    if (!endAt) return;
    const tick = () => {
      const diff = new Date(endAt) - Date.now();
      if (diff <= 0) { setTimeLeft('Ended'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (d > 0) setTimeLeft(`${d}d ${h}h ${m}m`);
      else if (h > 0) setTimeLeft(`${h}h ${m}m ${s}s`);
      else setTimeLeft(`${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endAt]);
  return timeLeft;
};

const GRADE_BADGE = {
  psa: 'bg-red-600 text-white', bgs: 'bg-blue-700 text-white',
  cgc: 'bg-green-600 text-white', ace: 'bg-orange-500 text-white',
  sgc: 'bg-purple-600 text-white', other: 'bg-slate-600 text-white',
};

const STATUS = {
  active:   { label: 'Active',   cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:text-emerald-400' },
  sold:     { label: 'Sold',     cls: 'bg-slate-500/10 text-slate-600 border-slate-300 dark:text-slate-400' },
  ended:    { label: 'Ended',    cls: 'bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-400' },
  inactive: { label: 'Unlisted', cls: 'bg-muted text-muted-foreground border-border' },
};

const getStatusCfg = (listing) => {
  if (!listing) return STATUS.ended;
  return STATUS[listing.status] ?? STATUS.inactive;
};

// ── Single row ────────────────────────────────────────────────────────────────
const WatchlistRow = ({ entry, onRemove }) => {
  const { listing } = entry;
  const countdown = useCountdown(listing?.listing_type === 'auction' && listing?.status === 'active' ? listing?.auction_end_at : null);

  if (!listing) {
    return (
      <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl border border-border">
        <div className="w-16 h-20 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <Tag className="w-5 h-5 text-muted-foreground opacity-30" />
        </div>
        <p className="flex-1 text-sm text-muted-foreground">Listing no longer available</p>
        <Button variant="ghost" size="sm" onClick={() => onRemove(entry.listing_id)}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  const vi = listing.vault_item;
  const imgPath = vi?.card_image
    || vi?.vault_images?.find(i => i.is_primary)?.storage_path
    || vi?.vault_images?.[0]?.storage_path
    || null;
  const imgSrc = imgPath
    ? (imgPath.startsWith('http') ? imgPath : supabase.storage.from('vault-images').getPublicUrl(imgPath).data.publicUrl)
    : null;
  const detailPath = `/marketplace/${listing.id}/${slugify(vi?.card_name || 'card')}`;
  const statusCfg = getStatusCfg(listing);
  const isAuction = listing.listing_type === 'auction';
  const auctionLive = isAuction && listing.status === 'active' && listing.auction_end_at && new Date(listing.auction_end_at) > Date.now();
  const hasGrade = vi?.grading_company && vi.grading_company !== 'raw' && vi?.grade;

  return (
    <div className="group flex gap-4 p-4 bg-card rounded-xl border border-border hover:border-primary/30 hover:shadow-sm transition-all duration-200">
      {/* Image */}
      <Link to={detailPath} className="shrink-0 w-16 h-20 rounded-lg overflow-hidden bg-muted/30 block">
        {imgSrc ? (
          <img src={imgSrc} alt={vi?.card_name || 'Card'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Tag className="w-5 h-5 text-muted-foreground opacity-30" />
          </div>
        )}
      </Link>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <Link to={detailPath}>
            <h3 className="font-bold text-sm leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2">
              {vi?.card_name || 'Untitled Listing'}
            </h3>
          </Link>
          <Badge variant="outline" className={`text-[10px] font-bold shrink-0 ${statusCfg.cls}`}>
            {statusCfg.label}
          </Badge>
        </div>

        {vi?.set_name && (
          <p className="text-xs text-muted-foreground mb-1.5 truncate">{vi.set_name}</p>
        )}

        {hasGrade && (
          <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-md mr-2 mb-1.5 ${GRADE_BADGE[vi.grading_company] || GRADE_BADGE.other}`}>
            {vi.grading_company.toUpperCase()} {vi.grade}
          </span>
        )}

        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          {isAuction ? (
            <div>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                {listing.bid_count > 0 ? 'Current Bid' : 'Starting Bid'}
              </p>
              <p className="font-extrabold text-base tabular-nums text-foreground">
                ${((listing.current_bid_aud ?? listing.starting_bid_aud) || 0).toFixed(2)}
              </p>
              {listing.bid_count > 0 && (
                <p className="text-[10px] text-muted-foreground">{listing.bid_count} bid{listing.bid_count !== 1 ? 's' : ''}</p>
              )}
            </div>
          ) : (
            <div>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Buy Now</p>
              <p className="font-extrabold text-base tabular-nums text-foreground">
                ${(listing.price_aud || 0).toFixed(2)}
              </p>
            </div>
          )}

          {auctionLive && countdown && (
            <div className="flex items-center gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-lg">
              <Clock className="w-3 h-3 shrink-0" />
              <span className="text-xs font-bold tabular-nums">{countdown}</span>
            </div>
          )}
          {isAuction && listing.status !== 'active' && (
            <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-lg">
              <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground font-medium">Auction ended</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col items-end justify-between gap-2 shrink-0">
        <Button variant="ghost" size="sm" onClick={() => onRemove(entry.listing_id)}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          aria-label="Remove from watchlist">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0 text-muted-foreground hover:text-primary">
          <Link to={detailPath} aria-label="View listing">
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────
const AccountWatchlist = () => {
  const { currentUser } = useAuth();
  const { toggle } = useWatchlist();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchRef = useRef(null);

  useEffect(() => {
    if (!currentUser?.id) { setLoading(false); return; }
    let cancelled = false;
    const uid = currentUser.id;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchErr } = await supabase
          .from('watchlist')
          .select(`
            id,
            listing_id,
            created_at,
            listing:listings(
              id,
              listing_type,
              status,
              price_aud,
              current_bid_aud,
              starting_bid_aud,
              bid_count,
              auction_end_at,
              accepts_offers,
              sold_at,
              vault_item:vault_items(
                id,
                card_name,
                set_name,
                grading_company,
                grade,
                cert_number,
                card_image,
                vault_images(storage_path, is_primary, sort_order)
              ),
              seller:profiles!seller_id(id, display_name, username, is_verified)
            )
          `)
          .eq('user_id', uid)
          .order('created_at', { ascending: false });

        if (fetchErr) throw fetchErr;
        if (!cancelled) setEntries(data ?? []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load watchlist.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRef.current = run;
    run();

    const channel = supabase
      .channel(`watchlist-page-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'watchlist', filter: `user_id=eq.${uid}` },
        () => fetchRef.current?.()
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'listings' },
        () => fetchRef.current?.()
      )
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [currentUser?.id]);

  const handleRemove = async (listingId) => {
    setEntries(prev => prev.filter(e => e.listing_id !== listingId));
    const success = await toggle(listingId);
    if (success) {
      toast.success('Removed from watchlist');
    } else {
      fetchRef.current?.();
      toast.error('Failed to remove from watchlist');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Helmet><title>Watchlist | CardPop</title></Helmet>

      <Breadcrumb items={[{ label: 'Account', path: '/account' }, { label: 'Watchlist' }]} />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold font-heading mb-1">Watchlist</h1>
          <p className="text-muted-foreground">
            {loading ? 'Loading…' : `${entries.length} saved listing${entries.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button variant="outline" onClick={() => fetchRef.current?.()} disabled={loading} className="rounded-xl h-10 px-4">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-4 p-4 rounded-xl border border-border">
              <Skeleton className="w-16 h-20 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-5 w-24 mt-3" />
              </div>
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-16 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto mb-5">
            <Heart className="w-8 h-8 text-rose-500 opacity-70" />
          </div>
          <h3 className="text-xl font-bold mb-2">Your watchlist is empty</h3>
          <p className="text-muted-foreground max-w-sm mx-auto mb-6">
            Tap the ♥ on any marketplace listing to save it here. You'll always see the latest price, bids, and auction status.
          </p>
          <Button asChild className="rounded-xl font-bold">
            <Link to="/marketplace">Browse Marketplace</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(entry => (
            <WatchlistRow key={entry.id} entry={entry} onRemove={handleRemove} />
          ))}
        </div>
      )}
    </div>
  );
};

export default AccountWatchlist;