import React, { useEffect, useState, useCallback } from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { BadgeCheck, Search, MapPin, Star, Package, ArrowRight, ShieldCheck, Store, Sparkles } from 'lucide-react';

const AU_STATES = [
  { code: 'NSW', label: 'New South Wales' },
  { code: 'VIC', label: 'Victoria' },
  { code: 'QLD', label: 'Queensland' },
  { code: 'WA',  label: 'Western Australia' },
  { code: 'SA',  label: 'South Australia' },
  { code: 'TAS', label: 'Tasmania' },
  { code: 'ACT', label: 'ACT' },
  { code: 'NT',  label: 'Northern Territory' },
];

const LocalTradersPage = () => {
  const { isAuthenticated, currentUser } = useAuth();
  const [traders, setTraders] = useState([]);
  const [stores, setStores] = useState([]);
  // undefined = still resolving user location; null = resolved, no state / show all
  const [selectedState, setSelectedState] = useState(undefined);
  const [search, setSearch] = useState('');
  const [userState, setUserState] = useState(null);

  // Load the logged-in user's state so we can default to it.
  // Sets selectedState exactly once after the profile fetch resolves.
  useEffect(() => {
    if (!currentUser?.id) {
      setSelectedState(null);
      return;
    }
    supabase
      .from('profiles')
      .select('location_state')
      .eq('id', currentUser.id)
      .single()
      .then(({ data }) => {
        const state = data?.location_state?.toUpperCase().trim() || null;
        setUserState(state);
        setSelectedState(state);
      })
      .catch(() => { setSelectedState(null); });
  }, [currentUser?.id]);

  // loading = true until selectedState is resolved (not undefined)
  const loading = selectedState === undefined;

  const fetchTraders = useCallback(async () => {
    if (selectedState === undefined) return;
    try {
      let query = supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url, profile_photo_or_character, bio, location_state, location_suburb, rating, reviews_count, is_verified, listings_count, collection_count')
        .eq('is_verified', true)
        .not('location_state', 'is', null)
        .order('rating', { ascending: false })
        .limit(80);

      if (selectedState) {
        query = query.ilike('location_state', selectedState);
      }

      const { data } = await query;
      setTraders(data || []);
    } catch (err) {
      console.error(err);
    }
  }, [selectedState]);

  useEffect(() => { fetchTraders(); }, [fetchTraders]);

  // Featured sole-trader stores (dealers). Shown regardless of state filter so
  // their business acts as a promotional thumbnail across the whole directory.
  useEffect(() => {
    let cancelled = false;
    supabase
      .from('profiles')
      .select('id, business_name, business_tagline, business_logo_url, avatar_url, business_categories, location_state, location_suburb, rating, reviews_count, total_sales, seller_tier, display_name, username, is_verified, is_featured_seller')
      .eq('is_sole_trader', true)
      .eq('is_public', true)
      // Promoted stores pinned to the top, then by rating. All sole traders
      // are shown — promotion/verification will become subscription perks.
      .order('is_featured_seller', { ascending: false })
      .order('rating', { ascending: false, nullsFirst: false })
      .limit(24)
      .then(({ data }) => { if (!cancelled) setStores(data || []); });
    return () => { cancelled = true; };
  }, []);

  const filtered = search.trim()
    ? traders.filter(t =>
        (t.display_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (t.location_suburb || '').toLowerCase().includes(search.toLowerCase())
      )
    : traders;

  const resolveAvatar = (t) => {
    const raw = t.avatar_url || t.profile_photo_or_character;
    if (!raw) return null;
    if (raw.startsWith('http')) return raw;
    return supabase.storage.from('vault-images').getPublicUrl(raw).data.publicUrl;
  };

  const stateLabel = selectedState
    ? (AU_STATES.find(s => s.code === selectedState)?.label ?? selectedState)
    : 'Australia';

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={`Local Traders${selectedState ? ` — ${stateLabel}` : ''} | CardPop`}
        description={`Browse CardPop-endorsed trading card sellers in ${stateLabel}. Verified, trusted collectors you can buy and trade with confidence.`}
      />

      {/* Hero */}
      <section className="bg-card border-b border-border py-20 text-center">
        <div className="container-default">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 mb-6 shadow-lg">
            <BadgeCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold font-serif mb-4">Local Traders</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            CardPop-endorsed sellers you can trust. Verified collectors from your area ready to
            buy, sell and trade.
          </p>

          {/* Location hint for logged-in users */}
          {isAuthenticated && userState && (
            <div className="mt-5 inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2 text-sm text-emerald-700 dark:text-emerald-400 font-medium">
              <MapPin className="w-4 h-4" />
              Showing traders near you in {AU_STATES.find(s => s.code === userState)?.label ?? userState}
            </div>
          )}
          {isAuthenticated && !userState && (
            <div className="mt-5 inline-flex items-center gap-2 bg-muted border border-border rounded-xl px-4 py-2 text-sm text-muted-foreground font-medium">
              <MapPin className="w-4 h-4" />
              <span>Add your location in{' '}
                <Link to="/account/profile" className="text-primary font-bold hover:underline">
                  Account Settings
                </Link>{' '}
                to see traders near you
              </span>
            </div>
          )}
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Featured Stores (sole-trader dealers) */}
        {stores.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center gap-2 mb-1">
              <Store className="w-4 h-4 text-brand-red" />
              <p className="text-xs font-extrabold uppercase tracking-widest text-brand-red">
                Trader Stores
              </p>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Sole-trader businesses with their own CardPop store. Tap a store to browse everything
              they have listed on the marketplace.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {stores.map(store => {
                const storeName = store.business_name || store.display_name || store.username || 'Store';
                const logo = store.business_logo_url || resolveAvatar(store);
                const storeLocation = [store.location_suburb, store.location_state].filter(Boolean).join(', ');
                const cats = (store.business_categories || []).slice(0, 3);
                return (
                  <Link
                    key={store.id}
                    to={`/dealer/${store.id}`}
                    className="group relative overflow-hidden bg-card border border-border rounded-2xl p-5 flex gap-4 items-center hover:shadow-lg hover:-translate-y-0.5 hover:border-brand-red/40 transition-all"
                  >
                    {/* Logo / thumbnail */}
                    <div className="relative shrink-0">
                      <div className="w-20 h-20 rounded-2xl bg-muted border border-border overflow-hidden flex items-center justify-center">
                        {logo ? (
                          <img src={logo} alt={storeName} className="w-full h-full object-cover" />
                        ) : (
                          <Store className="w-8 h-8 text-muted-foreground" />
                        )}
                      </div>
                      {store.is_verified && (
                        <div className="absolute -bottom-1.5 -right-1.5 bg-[#1d9bf0] text-white p-1 rounded-lg shadow-md border-2 border-card" title="Verified Dealer">
                          <BadgeCheck className="w-4 h-4" />
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-bold text-base truncate">{storeName}</span>
                        {store.is_featured_seller && (
                          <Badge className="bg-brand-red text-white rounded-md text-[10px] font-bold px-1.5 py-0 gap-0.5 shrink-0 hover:bg-brand-red">
                            <Sparkles className="w-2.5 h-2.5" /> Promoted
                          </Badge>
                        )}
                        {store.is_verified && (
                          <BadgeCheck className="w-4 h-4 text-[#1d9bf0] shrink-0" title="Verified business" />
                        )}
                      </div>
                      {store.business_tagline && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mb-1.5">{store.business_tagline}</p>
                      )}
                      <div className="flex items-center gap-3 flex-wrap">
                        {store.rating > 0 && (
                          <span className="flex items-center gap-0.5 text-xs text-amber-500 font-bold">
                            <Star className="w-3 h-3 fill-amber-500" />
                            {Number(store.rating).toFixed(1)}
                          </span>
                        )}
                        {store.total_sales > 0 && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Package className="w-3 h-3" />
                            {store.total_sales} sales
                          </span>
                        )}
                        {storeLocation && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="w-3 h-3" />
                            {storeLocation}
                          </span>
                        )}
                      </div>
                      {cats.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {cats.map(cat => (
                            <Badge key={cat} variant="secondary" className="rounded-md text-[10px] font-semibold px-1.5 py-0">
                              {cat}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Visit arrow */}
                    <div className="self-center text-muted-foreground group-hover:text-brand-red transition-colors">
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* State selector */}
        <div className="mb-6">
          <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground mb-3">
            Filter by State
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedState(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                !selectedState
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              All States
            </button>
            {AU_STATES.map(s => (
              <button
                key={s.code}
                onClick={() => setSelectedState(s.code)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedState === s.code
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : s.code === userState
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {s.code}
                {s.code === userState && ' ★'}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name or suburb…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>

        {/* Count + heading */}
        {!loading && (
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-muted-foreground font-medium">
              <span className="font-bold text-foreground">{filtered.length}</span> endorsed trader{filtered.length !== 1 ? 's' : ''}{' '}
              {selectedState ? `in ${stateLabel}` : 'across Australia'}
            </p>
            <Badge variant="secondary" className="gap-1.5 font-bold">
              <BadgeCheck className="w-3.5 h-3.5 text-emerald-500" />
              CardPop Verified
            </Badge>
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-52 rounded-2xl" />)}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(trader => {
              const name = trader.display_name || trader.username || 'Collector';
              const location = [trader.location_suburb, trader.location_state].filter(Boolean).join(', ');

              return (
                <div
                  key={trader.id}
                  className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3 hover:shadow-md hover:-translate-y-0.5 hover:border-emerald-500/30 transition-all group"
                >
                  {/* Avatar + identity */}
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 flex-shrink-0 ring-2 ring-border group-hover:ring-emerald-500/30 transition-all">
                      <AvatarImage src={resolveAvatar(trader)} className="object-cover" />
                      <AvatarFallback className="font-bold text-base">
                        {name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <span className="font-bold text-sm truncate">{name}</span>
                        <BadgeCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {location && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="w-3 h-3" />
                            {location}
                          </span>
                        )}
                        {trader.rating > 0 && (
                          <span className="flex items-center gap-0.5 text-xs text-amber-500 font-bold">
                            <Star className="w-3 h-3 fill-amber-500" />
                            {Number(trader.rating).toFixed(1)}
                            {trader.reviews_count > 0 && (
                              <span className="text-muted-foreground font-normal ml-0.5">
                                ({trader.reviews_count})
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bio */}
                  {trader.bio && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {trader.bio}
                    </p>
                  )}

                  {/* Stats */}
                  {(trader.listings_count > 0 || trader.collection_count > 0) && (
                    <div className="flex items-center gap-3 pt-2 border-t border-border">
                      {trader.listings_count > 0 && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Package className="w-3.5 h-3.5" />
                          {trader.listings_count} listing{trader.listings_count !== 1 ? 's' : ''}
                        </span>
                      )}
                      {trader.collection_count > 0 && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          {trader.collection_count} in vault
                        </span>
                      )}
                    </div>
                  )}

                  {/* CTA */}
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="mt-auto rounded-xl font-bold text-xs group-hover:border-emerald-500/40 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors gap-1.5"
                  >
                    <Link to={`/community/user/${trader.id}`}>
                      View Profile <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 bg-muted/30 rounded-3xl border border-border border-dashed">
            <BadgeCheck className="w-14 h-14 text-muted-foreground mb-4 opacity-40" />
            <p className="text-foreground text-xl font-bold mb-2">
              {search
                ? 'No matching traders'
                : selectedState
                  ? `No endorsed traders in ${stateLabel} yet`
                  : 'No endorsed traders yet'}
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              {search
                ? 'Try a different name or suburb.'
                : 'Check back soon as more verified sellers join the community.'}
            </p>
            {selectedState && (
              <Button
                variant="outline"
                className="rounded-xl font-bold text-sm"
                onClick={() => setSelectedState(null)}
              >
                View all states
              </Button>
            )}
          </div>
        )}

        {/* Endorsement info panel */}
        <div className="mt-12 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 rounded-2xl p-8">
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm shrink-0">
              <BadgeCheck className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold mb-2">What is a CardPop Endorsed Trader?</h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                Endorsed traders are verified CardPop members with a strong reputation for honest
                dealing, accurate listings and positive community feedback. Verification is reviewed
                by the CardPop team — we only endorse sellers we'd buy from ourselves.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { icon: BadgeCheck, label: 'Identity verified', desc: 'Real name confirmed by CardPop' },
                  { icon: Star,       label: 'Strong ratings',    desc: 'Consistently positive feedback' },
                  { icon: ShieldCheck,label: 'Safe to trade',     desc: 'Trusted by the community' },
                ].map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="bg-background/60 border border-border rounded-xl p-3">
                    <Icon className="w-4 h-4 text-emerald-500 mb-2" />
                    <p className="text-xs font-bold text-foreground">{label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Button asChild variant="outline" size="sm" className="rounded-xl font-bold gap-1.5">
                  <Link to="/verify-account">
                    Apply for Verification <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SEO footer */}
      <section className="border-t border-border bg-muted/30 py-14 mt-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold mb-3">Trade with Confidence, Trade Local</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm leading-relaxed">
            CardPop's Local Traders directory connects you with personally endorsed sellers in your
            state. Every trader listed here has been verified by the CardPop team — so you can buy,
            sell and trade knowing you're dealing with the real deal.
          </p>
        </div>
      </section>
    </div>
  );
};

export default LocalTradersPage;
