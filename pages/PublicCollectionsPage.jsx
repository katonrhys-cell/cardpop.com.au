import React, { useState, useEffect } from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, ShieldCheck, Users, Info } from 'lucide-react';
import { COLLECTIONS_LIST, TCG_COLLECTIONS, SPORTS_COLLECTIONS } from '@/components/Header.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseClient.js';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getCollectionImage } from '@/data/collectionImages.js';
import { publicImageUrl } from '@/utils/imageUrl.js';
import SoldBadge from '@/components/SoldBadge.jsx';

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

const PublicCollectionsPage = () => {
  const [searchParams] = useSearchParams();
  const initialCollection = searchParams.get('collection') || 'All';
  
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [collectionFilter, setCollectionFilter] = useState(initialCollection);
  const [brandFilter, setBrandFilter] = useState('All');
  const [seriesFilter, setSeriesFilter] = useState('All');
  const [listingTypeFilter, setListingTypeFilter] = useState('Both'); // Vault, Store, Both

  useEffect(() => {
    let cancelled = false;
    const fetchItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const [officialRes, vaultRes] = await Promise.allSettled([
        // Sold listings stay visible, pilled "Sold" — same rule as every other grid.
        supabase.from('listings').select('*').eq('source', 'official').in('status', ['active', 'sold']),
        supabase.from('listings').select('*, profiles:seller_id(name)').neq('source', 'official').in('status', ['active', 'sold'])
      ]);

      const getImageUrl = (item) => {
        const img = item.image || item.card_image;
        if (!img) return null;
        return publicImageUrl(img);
      };

      const processVaultItem = (item) => {
        const isSportsItem = SPORTS_COLLECTIONS.includes(item.collectionType);
        const brand = isSportsItem
          ? (SPORTS_BRANDS.find(b => item.card_name?.includes(b)) || SPORTS_BRANDS[idHash(item.id) % SPORTS_BRANDS.length])
          : (TCG_BRANDS.find(b => item.grading_company?.includes(b)) || TCG_BRANDS[idHash(item.id) % TCG_BRANDS.length]);

        const series = isSportsItem
          ? SPORTS_SERIES[idHash(item.id) % SPORTS_SERIES.length]
          : TCG_SERIES[idHash(item.id) % TCG_SERIES.length];

        return {
          id: item.id,
          _key: `vault_${item.id}`,
          name: item.card_name || 'Vault Card',
          collectionType: item.collectionType || 'Sports',
          condition: item.condition,
          grade: item.grading_company || null,
          price: item.price_aud || 0,
          tradeValue: null,
          image: getImageUrl(item),
          source: 'Vault',
          isSold: item.status === 'sold',
          ownerName: item.profiles?.name || 'Collector',
          isForSale: item.listingStatus === 'For Sale' || item.listingStatus === 'For Both',
          isForTrade: item.listingStatus === 'For Trade' || item.listingStatus === 'For Both',
          brand,
          series,
          link: `/marketplace/${item.id}`
        };
      };

      const processStoreItem = (item) => {
        const isSportsItem = SPORTS_COLLECTIONS.includes(item.collectionType);
        const brand = isSportsItem
          ? (SPORTS_BRANDS.find(b => item.name?.includes(b)) || 'Official')
          : (TCG_BRANDS.find(b => item.name?.includes(b) || item.grading_company?.includes(b)) || 'Official');

        const series = isSportsItem
          ? SPORTS_SERIES[idHash(item.id) % SPORTS_SERIES.length]
          : TCG_SERIES[idHash(item.id) % TCG_SERIES.length];

        return {
          id: item.id,
          _key: `store_${item.id}`,
          name: item.name || item.card_name,
          collectionType: item.collectionType,
          condition: item.condition,
          grade: item.grading_company || null,
          price: item.price_aud || 0,
          tradeValue: null,
          image: getImageUrl(item),
          source: 'Store',
          isSold: item.status === 'sold',
          ownerName: 'Official Store',
          isForSale: true,
          isForTrade: false,
          brand,
          series,
          link: `/marketplace/${item.id}`
        };
      };

      let combined = [];
      if (officialRes.status === 'fulfilled' && officialRes.value?.data) {
        combined = combined.concat(officialRes.value.data.map(processStoreItem));
      }
      if (vaultRes.status === 'fulfilled' && vaultRes.value?.data) {
        combined = combined.concat(vaultRes.value.data.map(processVaultItem));
      }
      
      if (!cancelled) setItems(combined.sort((a, b) => b.price - a.price));
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

  const handleCollectionChange = (val) => {
    setCollectionFilter(val);
    setBrandFilter('All');
    setSeriesFilter('All');
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCollection = collectionFilter === 'All' || item.collectionType === collectionFilter;
    const matchesSource = listingTypeFilter === 'Both' || item.source === listingTypeFilter;
    const matchesBrand = brandFilter === 'All' || item.brand === brandFilter;
    const matchesSeries = seriesFilter === 'All' || item.series === seriesFilter;
    
    return matchesSearch && matchesCollection && matchesSource && matchesBrand && matchesSeries;
  });

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
        <div className="max-w-[90rem] mx-auto px-4 relative z-10 grid lg:grid-cols-2 gap-6 lg:gap-16 items-end">
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-white">Marketplace Collections</h1>
          <p className="text-secondary-foreground/80 text-lg lg:pb-1">
            Explore curated official store items alongside verified collector vault listings in our unified marketplace.
          </p>
        </div>
      </div>

      <div className="flex-1 max-w-[90rem] mx-auto px-4 py-8 w-full flex flex-col md:flex-row gap-8">
        
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

          <div>
            <h3 className="font-bold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Listing Type</h3>
            <div className="space-y-3 bg-muted/30 p-4 rounded-xl border border-border/50">
              {['Both', 'Store', 'Vault'].map(type => (
                <label key={type} className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="radio" 
                    name="listingType" 
                    value={type} 
                    checked={listingTypeFilter === type} 
                    onChange={e => setListingTypeFilter(e.target.value)} 
                    className="accent-primary w-4 h-4" 
                  />
                  <span className="text-sm font-medium">{type === 'Both' ? 'All Listings' : `${type} Only`}</span>
                </label>
              ))}
            </div>
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
                          className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105 drop-shadow-md" 
                        />
                        <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
                          {item.isSold && <SoldBadge />}
                          {item.source === 'Store' ? (
                            <Badge className="bg-primary text-primary-foreground font-bold shadow-sm">
                              <ShieldCheck className="w-3 h-3 mr-1.5" /> Store Listing
                            </Badge>
                          ) : (
                            <Badge className="bg-secondary text-secondary-foreground font-bold shadow-sm">
                              <Users className="w-3 h-3 mr-1.5" /> Vault Listing
                            </Badge>
                          )}
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
        </section>
      </div>
    </div>
  );
};

export default PublicCollectionsPage;