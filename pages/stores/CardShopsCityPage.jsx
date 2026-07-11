import React, { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, ExternalLink, MapPin, PlusCircle } from 'lucide-react';
import SEOHead from '@/components/SEOHead.jsx';
import BackButton from '@/components/BackButton.jsx';
import {
  DIRECTORY_CITIES,
  STORE_CATEGORY_LABELS,
  fetchStores,
  fetchUpcomingEventsByState,
} from '@/lib/storeDirectory.js';

const SITE_ORIGIN = 'https://cardpop.com.au';

const formatEventDate = (isoDate) =>
  new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });

const CardShopsCityPage = () => {
  const { city } = useParams();
  const cityInfo = DIRECTORY_CITIES[city];

  const [stores, setStores] = useState(null);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!cityInfo) return;
    let cancelled = false;
    fetchStores(city)
      .then((data) => { if (!cancelled) setStores(data); })
      .catch(() => { if (!cancelled) setStores([]); });
    fetchUpcomingEventsByState(cityInfo.state)
      .then((data) => { if (!cancelled) setEvents(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [city, cityInfo]);

  if (!cityInfo) return <Navigate to="/card-shops" replace />;

  const title = `Card Shops in ${cityInfo.label} — Pokémon, TCG & Sports Card Stores | CardPop`;
  const description = `Find trading card shops in ${cityInfo.label}, ${cityInfo.state}: local stores for Pokémon, sports cards, One Piece and other TCGs, plus upcoming card shows near ${cityInfo.label}.`;

  const faqs = [
    {
      q: `Where can I buy Pokémon or sports cards in ${cityInfo.label}?`,
      a: `The stores listed above stock trading cards in and around ${cityInfo.label}. Many also run trade nights and tournaments — check their websites for hours and stock. You can also buy from verified Australian sellers online via the CardPop marketplace.`,
    },
    {
      q: `Are there card shows near ${cityInfo.label}?`,
      a: `Upcoming card shows and collector events for ${cityInfo.state} are listed on this page as they're announced, with full details on the CardPop events calendar.`,
    },
    {
      q: 'How do I get a store added to this page?',
      a: 'Store owners (or regulars!) can submit a store for free using the "Add your store" form. Submissions are reviewed before going live to keep the directory accurate.',
    },
  ];

  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Card Shops', item: `${SITE_ORIGIN}/card-shops` },
        { '@type': 'ListItem', position: 2, name: cityInfo.label, item: `${SITE_ORIGIN}/card-shops/${city}` },
      ],
    },
    stores?.length ? {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `Card shops in ${cityInfo.label}`,
      numberOfItems: stores.length,
      itemListElement: stores.map((store, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'LocalBusiness',
          name: store.name,
          ...(store.website ? { url: store.website } : {}),
          address: {
            '@type': 'PostalAddress',
            ...(store.suburb ? { addressLocality: store.suburb } : {}),
            addressRegion: store.state,
            addressCountry: 'AU',
          },
        },
      })),
    } : null,
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    },
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={title}
        description={description}
        canonicalUrl={`/card-shops/${city}`}
        structuredData={structuredData}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        <BackButton fallback="/card-shops" />

        <header>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            Card Shops in <span className="text-primary">{cityInfo.label}</span>
          </h1>
          <p className="text-muted-foreground">
            Local stores for Pokémon, sports cards, One Piece and other TCGs in{' '}
            {cityInfo.label}, {cityInfo.state} — plus upcoming card shows nearby.
          </p>
        </header>

        <section>
          {stores === null && (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl h-24 animate-pulse" />
              ))}
            </div>
          )}

          {stores !== null && stores.length === 0 && (
            <div className="bg-card border border-border rounded-3xl p-8 text-center">
              <p className="text-muted-foreground mb-4">
                No stores listed in {cityInfo.label} yet — know one? Help fellow collectors find it.
              </p>
              <Link to="/card-shops/add" className="text-primary font-semibold hover:underline">
                Add a store →
              </Link>
            </div>
          )}

          {stores !== null && stores.length > 0 && (
            <ul className="space-y-3">
              {stores.map((store) => (
                <li key={store.slug} className="bg-card border border-border rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold">{store.name}</h2>
                      <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3.5 h-3.5" />
                        {[store.suburb, store.state].filter(Boolean).join(', ')}
                      </div>
                      {store.description && (
                        <p className="text-sm text-muted-foreground mt-2">{store.description}</p>
                      )}
                      {store.categories?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {store.categories.map((cat) => (
                            <span key={cat} className="text-xs px-2.5 py-1 rounded-full bg-background border border-border">
                              {STORE_CATEGORY_LABELS[cat] || cat}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {store.website && (
                      <a
                        href={store.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        Website <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {events.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-primary" /> Upcoming card events in {cityInfo.state}
            </h2>
            <ul className="space-y-3">
              {events.map((event) => (
                <li key={event.id}>
                  <Link
                    to={`/events/${event.slug || event.id}`}
                    className="block bg-card border border-border rounded-2xl p-4 hover:border-primary/50 transition-colors"
                  >
                    <div className="font-medium">{event.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatEventDate(event.start_date)}
                      {event.venue_name ? ` · ${event.venue_name}` : ''}
                      {event.suburb ? ` · ${event.suburb}` : ''}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <Link to="/events" className="inline-block mt-3 text-sm text-primary hover:underline">
              All card events →
            </Link>
          </section>
        )}

        <section className="bg-card border border-border rounded-3xl p-6 text-center">
          <PlusCircle className="w-7 h-7 text-primary mx-auto mb-2" />
          <h2 className="text-xl font-bold mb-2">Missing a store?</h2>
          <p className="text-muted-foreground mb-4">
            Listing is free and takes a minute — submissions are reviewed before they go live.
          </p>
          <Link
            to="/card-shops/add"
            className="inline-block px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
          >
            Add your store
          </Link>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">Frequently asked questions</h2>
          <div className="space-y-4">
            {faqs.map(({ q, a }) => (
              <div key={q} className="bg-card border border-border rounded-2xl p-5">
                <h3 className="font-semibold mb-2">{q}</h3>
                <p className="text-muted-foreground">{a}</p>
              </div>
            ))}
          </div>
        </section>

        <Link to="/card-shops" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> All cities
        </Link>
      </div>
    </div>
  );
};

export default CardShopsCityPage;
