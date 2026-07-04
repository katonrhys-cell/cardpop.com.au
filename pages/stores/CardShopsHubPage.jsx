import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Store, PlusCircle } from 'lucide-react';
import SEOHead from '@/components/SEOHead.jsx';
import { DIRECTORY_CITIES, fetchStores } from '@/lib/storeDirectory.js';

const STATE_ORDER = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
const STATE_LABELS = {
  NSW: 'New South Wales', VIC: 'Victoria', QLD: 'Queensland', WA: 'Western Australia',
  SA: 'South Australia', TAS: 'Tasmania', ACT: 'Australian Capital Territory', NT: 'Northern Territory',
};

const CardShopsHubPage = () => {
  const [stores, setStores] = useState(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchStores()
      .then((data) => { if (!cancelled) setStores(data); })
      .catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, []);

  const countsByCity = useMemo(() => {
    const counts = {};
    for (const store of stores || []) counts[store.city] = (counts[store.city] || 0) + 1;
    return counts;
  }, [stores]);

  const citiesByState = useMemo(() => {
    const grouped = {};
    for (const [slug, info] of Object.entries(DIRECTORY_CITIES)) {
      (grouped[info.state] ||= []).push({ slug, ...info, count: countsByCity[slug] || 0 });
    }
    for (const list of Object.values(grouped)) list.sort((a, b) => b.count - a.count);
    return grouped;
  }, [countsByCity]);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Card Shops & Card Shows in Australia — Store Directory | CardPop"
        description="Find trading card shops near you: Pokémon, sports cards, One Piece and TCG stores across Sydney, Melbourne, Brisbane, Perth, Adelaide and more — plus upcoming card shows."
        canonicalUrl="/card-shops"
      />

      <section className="bg-card border-b border-border py-16 text-center">
        <div className="container mx-auto px-4">
          <Store className="w-12 h-12 text-primary mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Australian Card Shops <span className="text-primary">& Shows</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            The directory of local game stores and card shows across Australia — Pokémon, sports
            cards, One Piece, Magic and more, city by city.
          </p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        {loadError && (
          <p className="text-center text-muted-foreground">
            The directory is temporarily unavailable. Please try again shortly.
          </p>
        )}

        {STATE_ORDER.map((state) => {
          const cities = (citiesByState[state] || []).filter((c) => c.count > 0 || stores === null);
          if (cities.length === 0) return null;
          return (
            <section key={state}>
              <h2 className="text-2xl font-bold mb-4">{STATE_LABELS[state]}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cities.map((cityInfo) => (
                  <Link
                    key={cityInfo.slug}
                    to={`/card-shops/${cityInfo.slug}`}
                    className="group bg-card border border-border rounded-2xl p-5 flex items-center gap-3 hover:border-primary/50 hover:shadow-md transition-all"
                  >
                    <MapPin className="w-5 h-5 text-primary flex-shrink-0" />
                    <div>
                      <div className="font-semibold group-hover:text-primary transition-colors">
                        {cityInfo.label}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {stores === null ? '…' : `${cityInfo.count} store${cityInfo.count === 1 ? '' : 's'} listed`}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}

        <section className="bg-card border border-border rounded-3xl p-8 text-center">
          <PlusCircle className="w-8 h-8 text-primary mx-auto mb-3" />
          <h2 className="text-2xl font-bold mb-3">Run a card store?</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
            Get your store in front of collectors searching for shops in your city — listing is
            free. Submissions are reviewed before they go live.
          </p>
          <Link
            to="/card-shops/add"
            className="inline-block px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
          >
            Add your store
          </Link>
        </section>
      </div>
    </div>
  );
};

export default CardShopsHubPage;
