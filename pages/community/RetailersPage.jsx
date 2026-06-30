import React, { useEffect, useState, useCallback } from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Store, Search, ExternalLink, MapPin, Globe, ShieldCheck, Mail } from 'lucide-react';

const RetailersPage = () => {
  const [retailers, setRetailers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [categories, setCategories] = useState(['All']);

  const fetchRetailers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('is_active', true)
        .order('brand_name', { ascending: true });

      const list = data || [];
      setRetailers(list);

      const cats = ['All', ...new Set(list.map(r => r.category).filter(Boolean))].sort((a, b) =>
        a === 'All' ? -1 : b === 'All' ? 1 : a.localeCompare(b)
      );
      setCategories(cats);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRetailers(); }, [fetchRetailers]);

  const filtered = retailers.filter(r => {
    const matchesSearch = !search.trim() ||
      (r.brand_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.description || '').toLowerCase().includes(search.toLowerCase());
    const matchesCat = activeCategory === 'All' || r.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Retailers & Suppliers | CardPop Community"
        description="Find authorized trading card retailers and suppliers trusted by the CardPop community across Australia."
      />

      {/* Hero */}
      <section className="bg-card border-b border-border py-20 text-center">
        <div className="container-default">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 mb-6 shadow-lg">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold font-serif mb-4">Retailers &amp; Suppliers</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Discover authorized retailers and suppliers trusted by the CardPop community. From local hobby
            stores to national distributors — find your next card source here.
          </p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Search + category filters */}
        <div className="flex flex-col gap-4 mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search retailers by name or description…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>
          {categories.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeCategory === cat
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Count */}
        {!loading && (
          <p className="text-sm text-muted-foreground mb-6 font-medium">
            {filtered.length} retailer{filtered.length !== 1 ? 's' : ''} listed
          </p>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-52 rounded-2xl" />)}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(retailer => (
              <div
                key={retailer.id}
                className="bg-card border border-border p-5 rounded-2xl flex flex-col gap-3 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30 transition-all group"
              >
                {/* Logo + name */}
                <div className="flex items-center gap-3">
                  {retailer.logo_url ? (
                    <img
                      src={retailer.logo_url}
                      alt={retailer.brand_name}
                      className="h-12 w-12 rounded-xl object-cover border border-border flex-shrink-0"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-border flex items-center justify-center flex-shrink-0">
                      <Store className="w-5 h-5 text-amber-600" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      <p className="font-bold truncate text-sm">{retailer.brand_name}</p>
                      {retailer.is_verified && (
                        <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0" />
                      )}
                    </div>
                    {retailer.category && (
                      <Badge variant="outline" className="text-[10px] font-semibold mt-0.5">
                        {retailer.category}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed flex-1">
                  {retailer.description || 'Authorized CardPop partner.'}
                </p>

                {/* Meta */}
                <div className="flex flex-col gap-1.5">
                  {retailer.location && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      {retailer.location}
                    </span>
                  )}
                  {retailer.website && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Globe className="w-3.5 h-3.5 shrink-0" />
                      <a
                        href={retailer.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary transition-colors truncate"
                      >
                        {retailer.website.replace(/^https?:\/\//, '')}
                      </a>
                    </span>
                  )}
                </div>

                {/* CTA */}
                {retailer.affiliate_link && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-auto gap-1.5 rounded-xl font-bold text-xs"
                    onClick={() => window.open(retailer.affiliate_link, '_blank')}
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Visit Store
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 bg-muted/30 rounded-3xl border border-border border-dashed">
            <Store className="w-14 h-14 text-muted-foreground mb-4 opacity-40" />
            <p className="text-foreground text-xl font-bold mb-2">
              {search || activeCategory !== 'All' ? 'No matching retailers' : 'No retailers listed yet'}
            </p>
            <p className="text-sm text-muted-foreground">
              {search || activeCategory !== 'All'
                ? 'Try adjusting your search or filter.'
                : 'Authorized retailers and suppliers will appear here once added.'}
            </p>
          </div>
        )}

        {/* Get listed CTA */}
        <div className="mt-12 bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 rounded-2xl p-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 mb-4 shadow-sm">
            <Store className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-bold mb-2">Are you a retailer or supplier?</h2>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto mb-5 leading-relaxed">
            Get your business in front of thousands of Australian trading card collectors.
            CardPop partners with verified retailers to build trust in the hobby.
          </p>
          <Button asChild className="rounded-xl font-bold gap-2 shadow-sm">
            <a href="mailto:hello@cardpop.com.au">
              <Mail className="w-4 h-4" /> Get Listed
            </a>
          </Button>
        </div>
      </div>

      {/* SEO footer */}
      <section className="border-t border-border bg-muted/30 py-14 mt-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold mb-3">Trusted Australian Card Stores</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm leading-relaxed">
            CardPop works with authorized retailers and wholesalers across Australia to give collectors
            access to reliable sources for sealed product, singles, and grading supplies.
          </p>
        </div>
      </section>
    </div>
  );
};

export default RetailersPage;
