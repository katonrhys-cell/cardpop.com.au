import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNowStrict } from 'date-fns';
import { supabase } from '@/lib/supabaseClient.js';
import { getCardImage } from '@/utils/imageUrl.js';
import { useRefreshOnReturn } from '@/hooks/useRefreshOnReturn.js';
import SoldBadge from '@/components/SoldBadge.jsx';

const MAX_EVENTS = 16;

// The strip shows each card at 80×112 px (160×224 on a 2× display), so serve
// the pre-generated 480 px grid thumbnail wherever one exists (uploads since
// THUMBNAILS_SINCE) instead of the full 1600 px upload — up to 16 of these
// load on the homepage, and the full images were the bulk of PageSpeed's
// "Improve image delivery".
export const tickerImageUrl = (vaultItem) => {
  const raw = vaultItem?.card_image || vaultItem?.vault_images?.[0]?.storage_path || null;
  const art = getCardImage(raw);
  return art.thumbSrc || art.src || null;
};

const eventFromListing = (listing, kind) => {
  const raw = kind === 'sold' ? (listing.updated_at || listing.created_at) : listing.created_at;
  const at = raw ? new Date(raw) : null;
  return {
    key: `${kind}-${listing.id}`,
    kind, // 'listed' | 'sold'
    listingId: listing.id,
    name: listing.vault_item?.card_name || 'A card',
    price: Number(listing.price_aud || 0),
    image: tickerImageUrl(listing.vault_item),
    // A malformed timestamp must degrade to "no time label", never a crash.
    at: at && Number.isFinite(at.getTime()) ? at : null,
  };
};

const TICKER_SELECT = 'id, price_aud, status, created_at, updated_at, vault_item:vault_items!inner(card_name, card_image, vault_images(storage_path))';

/** The newest active and sold listings, merged newest-first. Exported for tests. */
export async function loadTickerEvents(client = supabase) {
  const [listed, sold] = await Promise.all([
    client.from('listings').select(TICKER_SELECT)
      .eq('status', 'active').order('created_at', { ascending: false }).limit(10),
    client.from('listings').select(TICKER_SELECT)
      .eq('status', 'sold').order('updated_at', { ascending: false }).limit(6),
  ]);
  return [
    ...(listed.data || []).map(l => eventFromListing(l, 'listed')),
    ...(sold.data || []).map(l => eventFromListing(l, 'sold')),
  ].sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0)).slice(0, MAX_EVENTS);
}

// "Just listed / just sold" strip. Seeds from the newest active and sold
// listings and re-seeds when the visitor comes back to the tab. Renders
// nothing until it has something to show, so it can sit on any page without
// reserving empty space — `framed` additionally wraps it in its own
// full-width bordered section (used on the homepage).
//
// It deliberately holds NO realtime channel. It used to subscribe every
// visitor of the homepage and marketplace — signed in or not — to every
// `listings` INSERT and UPDATE on the site. Supabase polls the WAL for as long
// as any client is subscribed, so the strip alone kept that poller running
// whenever anyone had the homepage open; it was the single largest consumer of
// database time on the project, for a decoration. A visitor looking at the
// strip sees what was live when the page loaded; one who tabbed away gets a
// fresh strip on return (useRefreshOnReturn).
const LiveActivityTicker = ({ className = '', framed = false }) => {
  const [events, setEvents] = useState([]);

  // Everything below is best-effort: the strip is decoration, so a failed
  // query must degrade to "no ticker", never break the page hosting it.
  useEffect(() => {
    let cancelled = false;
    loadTickerEvents()
      .then(merged => { if (!cancelled) setEvents(merged); })
      .catch(err => console.warn('[LiveActivityTicker] seed failed:', err?.message));
    return () => { cancelled = true; };
  }, []);

  useRefreshOnReturn(() => {
    loadTickerEvents()
      .then(setEvents)
      .catch(err => console.warn('[LiveActivityTicker] refresh failed:', err?.message));
  });

  if (events.length === 0) return null;

  const body = (
    <div className={`overflow-hidden ${className}`}>
      <div className="flex items-center gap-2 mb-2 pl-2 py-1">
        <span className="relative flex h-2.5 w-2.5">
          <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
        </span>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Live on CardPop</p>
      </div>
      <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
        {events.map(ev => (
          <Link
            key={ev.key}
            to={`/marketplace/${ev.listingId}`}
            className="group shrink-0 flex items-center gap-3 sm:gap-4 bg-card border border-border rounded-2xl p-2 pr-5 hover:border-primary/40 hover:bg-primary/[0.03] transition-colors"
          >
            {/* The card itself is the point of the strip, so give it a real
                thumbnail — 80×112 px (5:7, a card's own aspect ratio) on
                tablet and up, 64×90 on phones — rather than a 36 px glyph. */}
            <div className="w-16 h-[5.625rem] sm:w-20 sm:h-28 rounded-xl bg-muted/40 overflow-hidden flex items-center justify-center shrink-0">
              {ev.image
                ? <img src={ev.image} alt="" width="80" height="112" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                : <span className="text-2xl text-muted-foreground">🃏</span>}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                {ev.kind === 'sold' ? (
                  <SoldBadge size="sm" />
                ) : (
                  <span className="text-[11px] font-bold uppercase tracking-wider text-primary">Just listed</span>
                )}
                {ev.at && (
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNowStrict(ev.at, { addSuffix: true })}
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-foreground truncate max-w-[12rem] sm:max-w-[15rem] group-hover:text-primary transition-colors">{ev.name}</p>
              {ev.price > 0 && <p className="text-sm font-semibold text-muted-foreground tabular-nums mt-0.5">${ev.price.toFixed(2)}</p>}
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
