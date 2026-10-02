import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, Store, User, Newspaper, CalendarDays, ShoppingBag, ArrowRight, ImageOff } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { PUBLIC_PROFILE_COLUMNS } from '@/lib/profileColumns.js';
import { LISTING_CARD_VAULT_EMBED_INNER } from '@/lib/listingCardColumns.js';
import { publicImageUrl } from '@/utils/imageUrl.js';
import { sanitizeSearch, tokenizeSearch, rankItems } from '@/utils/searchRanking.js';
import { shopProductPath } from '@/utils/shopProductUrl.js';
import SEOHead from '@/components/SEOHead.jsx';
import MarketplaceListingCard from '@/components/MarketplaceListingCard.jsx';
import SearchBar from '@/components/SearchBar.jsx';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { PUBLIC_SHOP_STATUSES } from '@/utils/shopStock.js';

// How many hits to show per content type. The page favours breadth ("did the
// site have anything?"), so a handful of the *best* matches per source beats a
// deep list — deep browsing happens on each section's own hub.
const PER_SOURCE = 8;
// Pull a wider net from the DB, then rank locally and keep the top PER_SOURCE.
// Ranking (searchRanking.js) is what makes results accurate; the DB filter only
// narrows.
const OVER_FETCH = 30;

// Apply an AND-of-tokens filter: each token must appear in at least one of the
// given fields — "(f1~tokA or f2~tokA) AND (f1~tokB or f2~tokB) …".
//   • Base table: chained .or() calls are ANDed together (standard supabase-js).
//   • Embedded resource (referencedTable, e.g. vault_items on a listings query):
//     chained embedded .or() filters aren't reliably ANDed, so the AND is
//     encoded as a single `and(or(...),or(...))` tree — `or(and(X,Y))` ≡ AND.
function applyTokens(query, tokens, fields, referencedTable) {
  const orGroup = (tok) => fields.map((f) => `${f}.ilike.%${tok}%`).join(',');
  if (referencedTable) {
    const value = tokens.length === 1
      ? orGroup(tokens[0])
      : `and(${tokens.map((tok) => `or(${orGroup(tok)})`).join(',')})`;
    return query.or(value, { referencedTable });
  }
  for (const tok of tokens) query = query.or(orGroup(tok));
  return query;
}

const fmtPrice = (v) => (v || v === 0 ? `$${Number(v).toLocaleString('en-AU')}` : null);
const fmtDate = (d) => {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return null; }
};

// ─── Per-source queries ───────────────────────────────────────────────────────
// Each is independent and fault-tolerant: a failing source resolves to [] via
// Promise.allSettled below, so one bad query never blanks the whole page. Each
// returns items carrying _title/_haystack so the caller can rank them.

async function searchListings(tokens) {
  const { data, error } = await applyTokens(
    supabase
      .from('listings')
      .select(`*, ${LISTING_CARD_VAULT_EMBED_INNER}, seller:profiles!seller_id(id, display_name, username, avatar_url, is_verified, seller_tier, rating, reviews_count)`)
      // Sold cards stay in the results, badged "Sold" by MarketplaceListingCard
      // — a card that sold is still the card someone searched for. Only
      // 'archived' is genuinely off the site.
      .in('status', ['active', 'sold'])
      .neq('listing_type', 'vault'),
    tokens, ['card_name', 'set_name'], 'vault_items',
  ).order('created_at', { ascending: false }).limit(OVER_FETCH);
  if (error) throw error;
  // Spread the listing so MarketplaceListingCard still receives a listing-shaped
  // object; the extra _title/_haystack props are harmless.
  return (data || []).map((l) => ({
    ...l,
    _title: l.vault_item?.card_name || l.title || '',
    _haystack: `${l.vault_item?.card_name || ''} ${l.vault_item?.set_name || ''}`,
  }));
}

async function searchShop(tokens) {
  const { data, error } = await applyTokens(
    supabase.from('shop_products').select('*').in('status', PUBLIC_SHOP_STATUSES),
    tokens, ['title'],
  ).limit(OVER_FETCH);
  if (error) throw error;
  return (data || []).map((p) => ({
    key: `shop-${p.id}`,
    url: shopProductPath(p),
    image: publicImageUrl(p.image_url || p.image),
    title: p.title || p.name || 'Product',
    subtitle: 'Official Store',
    meta: fmtPrice(p.price_aud),
    _title: p.title || p.name || '',
    _haystack: p.title || p.name || '',
  }));
}

async function searchSellers(tokens) {
  const { data, error } = await applyTokens(
    supabase.from('profiles').select(PUBLIC_PROFILE_COLUMNS),
    tokens, ['display_name', 'username', 'business_name'],
  ).limit(OVER_FETCH);
  if (error) throw error;
  return (data || [])
    .filter((p) => p.is_active !== false && p.is_public !== false && !p.is_deleted)
    .map((p) => ({
      key: `seller-${p.id}`,
      url: `/seller/${p.id}`,
      image: publicImageUrl(p.avatar_url),
      title: p.business_name || p.display_name || p.username || 'Collector',
      subtitle: p.username ? `@${p.username}` : 'Community member',
      meta: p.is_verified ? 'Verified' : null,
      _title: p.business_name || p.display_name || p.username || '',
      _haystack: `${p.display_name || ''} ${p.username || ''} ${p.business_name || ''}`,
    }));
}

async function searchBlog(tokens) {
  const { data, error } = await applyTokens(
    supabase.from('blog_articles')
      .select('id,slug,title,excerpt,featured_image_url,category,created_at')
      .eq('is_published', true),
    tokens, ['title', 'excerpt'],
  ).order('created_at', { ascending: false }).limit(OVER_FETCH);
  if (error) throw error;
  return (data || []).map((a) => ({
    key: `blog-${a.id}`,
    url: `/blog/${a.slug || a.id}`,
    image: publicImageUrl(a.featured_image_url || a.featured_image),
    title: a.title || 'Article',
    subtitle: a.excerpt || 'Read the article',
    meta: a.category || null,
    _title: a.title || '',
    _haystack: `${a.title || ''} ${a.excerpt || ''}`,
  }));
}

async function searchEvents(tokens) {
  // events_public is the curated, already-public view (approved events only).
  const { data, error } = await applyTokens(
    supabase.from('events_public').select('*'),
    tokens, ['title', 'suburb'],
  ).order('start_date', { ascending: true }).limit(OVER_FETCH);
  if (error) throw error;
  return (data || []).map((e) => ({
    key: `event-${e.id}`,
    url: `/events/${e.slug || e.id}`,
    image: publicImageUrl(e.image_url),
    title: e.title || 'Event',
    subtitle: [e.suburb, e.state].filter(Boolean).join(', ') || 'Australia',
    meta: fmtDate(e.start_date),
    _title: e.title || '',
    _haystack: `${e.title || ''} ${e.suburb || ''} ${e.state || ''}`,
  }));
}

// ─── Generic result card (shop / sellers / blog / events) ─────────────────────
const ResultCard = ({ item }) => {
  const [imgOk, setImgOk] = useState(Boolean(item.image));
  return (
    <Link
      to={item.url}
      className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
    >
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted flex items-center justify-center">
        {imgOk ? (
          <img
            src={item.image}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setImgOk(false)}
          />
        ) : (
          <ImageOff className="h-5 w-5 text-muted-foreground/50" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-foreground group-hover:text-primary transition-colors">{item.title}</p>
        <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
      </div>
      {item.meta && (
        <Badge variant="outline" className="shrink-0 font-semibold">{item.meta}</Badge>
      )}
    </Link>
  );
};

// ─── Section wrapper ──────────────────────────────────────────────────────────
const Section = ({ icon: Icon, label, count, viewAll, children }) => (
  <section className="mb-12">
    <div className="mb-4 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
        <Icon className="h-5 w-5 text-primary" />
        {label}
        <span className="text-sm font-medium text-muted-foreground">({count})</span>
      </h2>
      {viewAll && (
        <Link to={viewAll} className="flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors">
          Browse all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
    {children}
  </section>
);

const SearchResultsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';

  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState({ listings: [], shop: [], sellers: [], blog: [], events: [] });
  // Fuzzy fallback for zero-result queries ("Charzard" → "Charizard"),
  // served by the suggestions endpoint's did-you-mean matcher.
  const [didYouMean, setDidYouMean] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const safe = sanitizeSearch(query);
      const tokens = tokenizeSearch(query);
      if (safe.length < 2 || tokens.length === 0) {
        setGroups({ listings: [], shop: [], sellers: [], blog: [], events: [] });
        setDidYouMean(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      const qLower = safe.toLowerCase();
      const [listings, shop, sellers, blog, events] = await Promise.allSettled([
        searchListings(tokens),
        searchShop(tokens),
        searchSellers(tokens),
        searchBlog(tokens),
        searchEvents(tokens),
      ]);
      if (cancelled) return;
      // Rank each group by relevance and keep the best matches.
      const val = (r) => (r.status === 'fulfilled' ? rankItems(r.value, qLower, tokens, PER_SOURCE) : []);
      const ranked = {
        listings: val(listings),
        shop: val(shop),
        sellers: val(sellers),
        blog: val(blog),
        events: val(events),
      };
      setGroups(ranked);
      setLoading(false);

      // Nothing matched → ask the suggestions endpoint for a fuzzy correction
      setDidYouMean(null);
      if (Object.values(ranked).every((g) => g.length === 0)) {
        try {
          const res = await fetch(`/api/search-suggestions?q=${encodeURIComponent(safe)}&limit=1`);
          const data = await res.json();
          if (!cancelled && data?.didYouMean) setDidYouMean(data.didYouMean);
        } catch { /* fuzzy fallback is best-effort */ }
      }
    };
    run();
    return () => { cancelled = true; };
  }, [query]);

  const total =
    groups.listings.length + groups.shop.length + groups.sellers.length + groups.blog.length + groups.events.length;

  return (
    <div className="container-default section-padding">
      <SEOHead
        title={query ? `Search results for "${query}" | CardPop` : 'Search | CardPop'}
        description={`Search across the whole of CardPop — marketplace listings, shop supplies, sellers, guides and events${query ? ` for "${query}"` : ''}.`}
        noindex
      />

      <div className="max-w-2xl mx-auto text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-bold font-heading mb-6">Search CardPop</h1>
        {/* Keyed on the query so the box shows the current search after a header
            search, a "Did you mean" click or Clear Search (SearchBar only reads
            initialQuery on mount). */}
        <SearchBar key={query} initialQuery={query} className="mx-auto" placeholder="Search cards, supplies, sellers, guides, events..." />
      </div>

      <div className="mb-8 flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">
          {loading ? 'Searching…' : <>{total} result{total === 1 ? '' : 's'} {query && <span>for "{query}"</span>}</>}
        </h2>
        {query && (
          <button type="button" onClick={() => setSearchParams({})} className="rounded-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Badge variant="outline" className="cursor-pointer">
              Clear Search ✕
            </Badge>
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array(8).fill(0).map((_, i) => (
            <div key={i} className="flex flex-col space-y-4 bg-card border border-border rounded-2xl p-4">
              <Skeleton className="aspect-[4/5] w-full rounded-xl" />
              <Skeleton className="h-5 w-1/3 rounded-md" />
              <Skeleton className="h-6 w-3/4 rounded-md" />
            </div>
          ))}
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-card rounded-[2rem] border border-border shadow-sm text-center">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
            <Search className="w-10 h-10 text-muted-foreground opacity-50" />
          </div>
          <p className="text-foreground text-2xl font-bold mb-3 tracking-tight">No results found</p>
          <p className="text-muted-foreground max-w-sm">
            {query
              ? <>We couldn't find anything matching "{query}" across the marketplace, shop, sellers, guides or events. Try a different spelling or a broader term.</>
              : 'Enter a search above to look across the whole site.'}
          </p>
          {didYouMean && (
            <button
              type="button"
              onClick={() => setSearchParams({ q: didYouMean })}
              className="mt-4 text-primary font-bold hover:underline"
            >
              Did you mean “{didYouMean}”?
            </button>
          )}
        </div>
      ) : (
        <>
          {groups.listings.length > 0 && (
            <Section icon={ShoppingBag} label="Marketplace" count={groups.listings.length} viewAll={`/marketplace?q=${encodeURIComponent(query)}`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {groups.listings.map((listing, i) => (
                  <MarketplaceListingCard key={listing.id} listing={listing} priority={i < 2} />
                ))}
              </div>
            </Section>
          )}

          {groups.shop.length > 0 && (
            <Section icon={Store} label="Shop Supplies" count={groups.shop.length} viewAll={`/shop?q=${encodeURIComponent(query)}`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {groups.shop.map((item) => <ResultCard key={item.key} item={item} />)}
              </div>
            </Section>
          )}

          {groups.sellers.length > 0 && (
            <Section icon={User} label="Sellers" count={groups.sellers.length} viewAll="/community/profiles">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {groups.sellers.map((item) => <ResultCard key={item.key} item={item} />)}
              </div>
            </Section>
          )}

          {groups.blog.length > 0 && (
            <Section icon={Newspaper} label="Guides & Articles" count={groups.blog.length} viewAll="/blog">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {groups.blog.map((item) => <ResultCard key={item.key} item={item} />)}
              </div>
            </Section>
          )}

          {groups.events.length > 0 && (
            <Section icon={CalendarDays} label="Events" count={groups.events.length} viewAll="/events">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {groups.events.map((item) => <ResultCard key={item.key} item={item} />)}
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
};

export default SearchResultsPage;
