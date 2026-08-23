import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNowStrict } from 'date-fns';
import { supabase } from '@/lib/supabaseClient.js';
import { publicImageUrl } from '@/utils/imageUrl.js';

const MAX_EVENTS = 16;

const eventFromListing = (listing, kind) => {
  const raw = kind === 'sold' ? (listing.updated_at || listing.created_at) : listing.created_at;
  const at = raw ? new Date(raw) : null;
  return {
    key: `${kind}-${listing.id}`,
    kind, // 'listed' | 'sold'
    listingId: listing.id,
    name: listing.vault_item?.card_name || listing.title || 'A card',
    price: Number(listing.price_aud || 0),
    image: publicImageUrl(
      listing.vault_item?.card_image
        || listing.vault_item?.vault_images?.[0]?.storage_path
        || null,
    ),
    // A malformed timestamp must degrade to "no time label", never a crash.
    at: at && Number.isFinite(at.getTime()) ? at : null,
  };
};

// Live "just listed / just sold" strip. Seeds from the newest active and sold
// listings, then prepends events from the realtime channel the marketplace
// already streams on. Renders nothing until it has something to show, so it
// can sit on any page without reserving empty space — `framed` additionally
// wraps it in its own full-width bordered section (used on the homepage).
const LiveActivityTicker = ({ className = '', framed = false }) => {
  const [events, setEvents] = useState([]);
  const channelRef = useRef(null);

  // Everything below is best-effort: the strip is decoration, so a failed
  // query or an environment without realtime must degrade to "no ticker",
  // never break the page hosting it.
  useEffect(() => {
    let cancelled = false;

    const seed = async () => {
      try {
        const base = 'id, title, price_aud, status, created_at, updated_at, vault_item:vault_items!inner(card_name, card_image, vault_images(storage_path))';
        const [listed, sold] = await Promise.all([
          supabase.from('listings').select(base)
            .eq('status', 'active').order('created_at', { ascending: false }).limit(10),
          supabase.from('listings').select(base)
            .eq('status', 'sold').order('updated_at', { ascending: false }).limit(6),
        ]);
        if (cancelled) return;
        const merged = [
          ...(listed.data || []).map(l => eventFromListing(l, 'listed')),
          ...(sold.data || []).map(l => eventFromListing(l, 'sold')),
        ].sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0)).slice(0, MAX_EVENTS);
        setEvents(merged);
      } catch (err) {
        console.warn('[LiveActivityTicker] seed failed:', err?.message);
      }
    };
    seed();

    // The payload has no vault_item embed — fetch the card name for the one
    // row that changed rather than refetching the whole strip.
    const hydrate = async (row, kind) => {
      try {
        const { data } = await supabase
          .from('listings')
          .select('id, title, price_aud, status, created_at, updated_at, vault_item:vault_items!inner(card_name, card_image, vault_images(storage_path))')
          .eq('id', row.id)
          .maybeSingle();
        if (cancelled || !data) return;
        setEvents(prev => {
          const ev = eventFromListing(data, kind);
          if (prev.some(e => e.key === ev.key)) return prev;
          return [ev, ...prev].slice(0, MAX_EVENTS);
        });
      } catch (err) {
        console.warn('[LiveActivityTicker] hydrate failed:', err?.message);
      }
    };

    try {
      channelRef.current = supabase
        .channel('live-activity-ticker')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'listings' },
          payload => { if (payload.new?.status === 'active') hydrate(payload.new, 'listed'); })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'listings' },
          payload => {
            if (payload.new?.status === 'sold' && payload.old?.status !== 'sold') hydrate(payload.new, 'sold');
          })
        .subscribe();
    } catch (err) {
      console.warn('[LiveActivityTicker] realtime unavailable:', err?.message);
    }

    return () => {
      cancelled = true;
      try {
        if (channelRef.current) supabase.removeChannel(channelRef.current);
      } catch { /* channel already gone */ }
    };
  }, []);

  if (events.length === 0) return null;

  const body = (
    <div className={`overflow-hidden ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
        </span>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Live on CardPop</p>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
        {events.map(ev => (
          <Link
            key={ev.key}
            to={`/marketplace/${ev.listingId}`}
            className="shrink-0 flex items-center gap-2.5 bg-card border border-border rounded-xl pl-1.5 pr-3.5 py-1.5 hover:border-primary/40 transition-colors"
          >
            <div className="w-9 h-12 rounded-lg bg-muted/40 overflow-hidden flex items-center justify-center shrink-0">
              {ev.image
                ? <img src={ev.image} alt="" className="w-full h-full object-cover" loading="lazy" />
                : <span className="text-[10px] text-muted-foreground">🃏</span>}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${ev.kind === 'sold' ? 'text-emerald-600' : 'text-primary'}`}>
                  {ev.kind === 'sold' ? 'Sold' : 'Just listed'}
                </span>
                {ev.at && (
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNowStrict(ev.at, { addSuffix: true })}
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-foreground truncate max-w-[11rem]">{ev.name}</p>
              {ev.price > 0 && <p className="text-xs font-semibold text-muted-foreground tabular-nums">${ev.price.toFixed(2)}</p>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );

  if (!framed) return body;
  return (
    <section className="py-6 md:py-8 bg-background border-b border-border">
      <div className="max-w-[90rem] mx-auto px-5 sm:px-8 lg:px-12 xl:px-16">
        {body}
      </div>
    </section>
  );
};

export default LiveActivityTicker;
