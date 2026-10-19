import React, { useState, useEffect, useMemo } from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, Users, Info } from 'lucide-react';
import { COLLECTIONS_LIST, TCG_COLLECTIONS, SPORTS_COLLECTIONS } from '@/components/Header.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseClient.js';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getCollectionImage } from '@/data/collectionImages.js';
import { cardThumbUrl } from '@/utils/imageUrl.js';
import { LISTING_CARD_COLUMNS } from '@/lib/listingColumns.js';
import { LISTING_CARD_VAULT_EMBED_INNER } from '@/lib/listingCardColumns.js';
import { slugify } from '@/lib/slugify.js';
import SoldBadge from '@/components/SoldBadge.jsx';

// How many listings a visit loads. The page used to fetch EVERY listing on the
// site (two unbounded `select('*')` queries, no limit) and filter in the
// browser, so its cost grew with the marketplace; it now shows the newest
// PAGE_SIZE and offers "Show more".
const PAGE_SIZE = 60;
const SELECT = `${LISTING_CARD_COLUMNS}, ${LISTING_CARD_VAULT_EMBED_INNER}, seller:profiles!seller_id(id, display_name, username, name)`;

// Deterministic pseudo-random index derived from an id string, used to spread
// items across brand/series buckets. A single charCodeAt(N) is out of bounds
// (NaN) for any id shorter than N+1 characters (e.g. a single-digit numeric
// id) — summing all char codes is always defined for any non-empty string.
const idHash = (id) => {
  const str = String(id);
  let sum = 0;
  for (let i = 0; i < str.length; i++) sum += str.charCodeAt(i);
  return sum;
};

const TCG_BRANDS = ['PSA', 'BGS', 'Beckett', 'CGC', 'Raw'];
const SPORTS_BRANDS = ['Panini', 'Topps', 'Upper Deck', 'Bowman', 'Fleer'];
const TCG_SERIES = ['Base Set', 'Scarlet & Violet', 'Sword & Shield', 'Sun & Moon', 'Alpha', 'Beta'];
const SPORTS_SERIES = ['Prizm', 'Chrome', 'Select', 'Optic', 'National Treasures'];

// A marketplace listing row (with its card embedded) → the shape the grid
// renders. The card's own fields live on `vault_item`; the listing carries the
// price and status. Exported for tests.
export function listingToCollectionItem(row) {
  const card = row.vault_item || {};
  const name = card.card_name || 'Vault Card';
  const collectionType = card.collection || 'Sports';
  const isSportsItem = SPORTS_COLLECTIONS.includes(collectionType);
  const brand = isSportsItem
    ? (SPORTS_BRANDS.find(b => name.includes(b)) || SPORTS_BRANDS[idHash(row.id) % SPORTS_BRANDS.length])
    : (TCG_BRANDS.find(b => card.grading_company?.includes(b)) || TCG_BRANDS[idHash(row.id) % TCG_BRANDS.length]);
  const series = isSportsItem
    ? SPORTS_SERIES[idHash(row.id) % SPORTS_SERIES.length]
    : TCG_SERIES[idHash(row.id) % TCG_SERIES.length];
  const type = row.listing_type ?? 'fixed';
  const imgPath = card.card_image || card.vault_images?.[0]?.storage_path || null;
  return {
    id: row.id,
    _key: `listing_${row.id}`,
    name,
    collectionType,
    condition: card.condition,
    grade: card.grading_company || null,
    price: Number(row.price_aud) || 0,
    tradeValue: null,
    // ~300 px tile: the 480 px companion thumbnail, not the full upload.
    image: cardThumbUrl(imgPath),
    isSold: row.status === 'sold',
    ownerName: row.seller?.display_name || row.seller?.username || row.seller?.name || 'Collector',
    isForSale: type !== 'trade',
    isForTrade: type === 'trade' || row.accepts_trade === true,
    brand,
    series,
    link: `/marketplace/${row.id}/${slugify(name)}`,
  };
}

async function fetchListingPage(offset) {
  // Sold listings stay visible, pilled "Sold" — same rule as every other grid.
  const { data, error } = await supabase
    .from('listings')
    .select(SELECT)
    .in('status', ['active', 'sold'])
    .neq('listing_type', 'vault')
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);
  if (error) throw error;
  return (data || []).map(listingToCollectionItem);
}

const PublicCollectionsPage = () => {
  const [searchParams] = useSearchParams();
  const initialCollection = searchParams.get('collection') || 'All';
  
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [collectionFilter, setCollectionFilter] = useState(initialCollection);
  const [brandFilter, setBrandFilter] = useState('All');
  const [seriesFilter, setSeriesFilter] = useState('All');

  useEffect(() => {
    let cancelled = false;
    const fetchItems = async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await fetchListingPage(0);
        if (!cancelled) { setItems(rows); setHasMore(rows.length === PAGE_SIZE); }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load collections. Please check your connection and try again.');
          toast.error('Failed to load collections');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchItems();
    return () => { cancelled = true; };
  }, []);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const rows = await fetchListingPage(items.length);
      setItems(prev => {
        const seen = new Set(prev.map(i => i._key));
        return [...prev, ...rows.filter(r => !seen.has(r._key))];
      });
      setHasMore(rows.length === PAGE_SIZE);
    } catch {
      toast.error('Failed to load more cards');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleCollectionChange = (val) => {
    setCollectionFilter(val);
    setBrandFilter('All');
    setSeriesFilter('All');
  };

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return items.filter(item => {
      const matchesSearch = !q || item.name.toLowerCase().includes(q);
      const matchesCollection = collectionFilter === 'All' || item.collectionType === collectionFilter;
      const matchesBrand = brandFilter === 'All' || item.brand === brandFilter;
      const matchesSeries = seriesFilter === 'All' || item.series === seriesFilter;
      return matchesSearch && matchesCollection && matchesBrand && matchesSeries;
    });
  }, [items, searchTerm, collectionFilter, brandFilter, seriesFilter]);

  const isSportsFilter = SPORTS_COLLECTIONS.includes(collectionFilter);
  const isTcgFilter = TCG_COLLECTIONS.includes(collectionFilter);

  let availableBrands = [];
  let availableSeries = [];

  if (isSportsFilter) {
    availableBrands = SPORTS_BRANDS;
    availableSeries = SPORTS_SERIES;
  } else if (isTcgFilter) {
    availableBrands = TCG_BRANDS;
    availableSeries = TCG_SERIES;
  } else {
    availableBrands = [...new Set([...TCG_BRANDS, ...SPORTS_BRANDS, 'Official'])];
    availableSeries = [...new Set([...TCG_SERIES, ...SPORTS_SERIES, 'Retail'])];
  }

  return (
    <div className="flex flex-col bg-background font-sans">
      <SEOHead title="Collections & Marketplace | CardPop Australia" description="Browse public trading card collections and marketplace listings from Australian collectors." />
      
      <div className="bg-secondary py-12 relative overflow-hidden">
        <div className="container-default relative z-10 grid lg:grid-cols-2 gap-6 lg:gap-16 items-end">
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-white">Marketplace Collections</h1>
          <p className="text-secondary-foreground/80 text-lg lg:pb-1">
            Explore curated official store items alongside verified collector vault listings in our unified marketplace.
          </p>
        </div>
      </div>

      <div className="flex-1 container-default py-8 w-full flex flex-col md:flex-row gap-8">
        
        <aside className="w-full md:w-64 shrink-0 space-y-8">
          <div>
            <h3 className="font-bold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Search</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Card name..." 
                className="pl-9 bg-muted/50 text-foreground rounded-xl" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
              />
            </div>
          </div>
          
          <div>
            <h3 className="font-bold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Category</h3>
            <Select value={collectionFilter} onValueChange={handleCollectionChange}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Collections</SelectItem>
                {COLLECTIONS_LIST.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <h3 className="font-bold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Brand</h3>
            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Brands</SelectItem>
                {availableBrands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <h3 className="font-bold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Series</h3>
            <Select value={seriesFilter} onValueChange={setSeriesFilter}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Series</SelectItem>
                {availableSeries.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

        </aside>

        <section className="flex-1">
          <div className="flex justify-between items-center mb-6">
            <p className="text-muted-foreground font-medium bg-muted/50 px-3 py-1 rounded-full text-sm">
              {filteredItems.length} items found
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-xl border border-destructive/20 flex items-start gap-3">
              <Info className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-[400px] bg-muted animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-20 bg-muted/30 rounded-3xl border border-dashed border-border">
              <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-bold mb-2">No cards found</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Try adjusting your filters, selecting a different collection, or modifying your search term.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredItems.map(item => {
                const displayImage = item.image || getCollectionImage(item.collectionType, item.image);
                return (
                  <Link key={item._key} to={item.link} className="group">
                    <div className="bg-card border border-border shadow-sm hover:shadow-xl transition-all duration-300 rounded-2xl overflow-hidden h-full flex flex-col">
                      <div className="aspect-[3/4] overflow-hidden relative bg-muted p-4 flex items-center justify-center">
                        <img
                          src={displayImage}
                          alt={item.name}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105 drop-shadow-md"
                        />
                        <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
                          {item.isSold && <SoldBadge />}
                          <Badge className="bg-secondary text-secondary-foreground font-bold shadow-sm">
                            <Users className="w-3 h-3 mr-1.5" /> Vault Listing
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="p-5 flex-1 flex flex-col bg-card">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{item.collectionType}</p>
                          <p className="text-xs font-medium text-muted-foreground/80">{item.ownerName}</p>
                        </div>
                        <h3 className="font-bold text-lg leading-tight mb-2 line-clamp-2 group-hover:text-primary transition-colors">{item.name}</h3>
                        <p className="text-xs text-muted-foreground font-medium">{item.series} • {item.brand}</p>
                        
                        <div className="mt-auto pt-4 border-t border-border/50 flex flex-col gap-2">
                          {item.isForSale && item.price > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Price</span>
                              <span className={`font-bold text-lg tabular-nums ${item.isSold ? 'text-muted-foreground line-through' : ''}`}>${item.price.toFixed(2)}</span>
                            </div>
                          )}
                          {item.isForTrade && (
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Trade Value</span>
                              <span className="font-bold text-primary tabular-nums">${item.tradeValue || item.price}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {!loading && hasMore && (
            <div className="mt-8 flex justify-center">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore} className="rounded-xl font-bold">
                {loadingMore ? 'Loading…' : 'Show more cards'}
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default PublicCollectionsPage;