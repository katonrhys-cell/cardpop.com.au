import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, TrendingUp } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import SEOHead from '@/components/SEOHead.jsx';
import apiServerClient from '@/lib/apiServerClient.js';
import {
  PRICE_CATEGORIES,
  fetchCardWithHistory,
  fetchRelatedCards,
  formatAud,
} from '@/lib/cardPrices.js';

const SITE_ORIGIN = 'https://cardpop.com.au';

const todayUtc = () => new Date().toISOString().slice(0, 10);

const formatDate = (isoDate) =>
  new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });

const StatBox = ({ label, value, sub }) => (
  <div className="bg-card border border-border rounded-2xl p-5">
    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</div>
    <div className="text-2xl font-bold">{value}</div>
    {sub && <div className="text-sm text-muted-foreground mt-1">{sub}</div>}
  </div>
);

const CardPriceDetailPage = () => {
  const { category, slug } = useParams();
  const [card, setCard] = useState(undefined); // undefined = loading, null = not found
  const [related, setRelated] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        let data = await fetchCardWithHistory(slug);
        if (!data) { if (!cancelled) setCard(null); return; }

        // On-demand fallback: if the daily cron hasn't reached this card yet,
        // ask the backend to snapshot it now, then re-read the history.
        const latest = data.history[data.history.length - 1];
        if (!latest || latest.snapshot_date !== todayUtc()) {
          try {
            const res = await apiServerClient.fetch('/prices/refresh-card', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ slug }),
            });
            if (res.ok) {
              const { refreshed } = await res.json();
              if (refreshed) data = (await fetchCardWithHistory(slug)) || data;
            }
          } catch {
            // Stale data is still worth showing; the page notes its date.
          }
        }

        if (cancelled) return;
        setCard(data);
        fetchRelatedCards(data.category, slug)
          .then((r) => { if (!cancelled) setRelated(r); })
          .catch(() => {});
      } catch {
        if (!cancelled) setCard(null);
      }
    };

    setCard(undefined);
    load();
    return () => { cancelled = true; };
  }, [slug]);

  const latest = card?.history?.length ? card.history[card.history.length - 1] : null;

  const chartData = useMemo(() =>
    (card?.history || [])
      .filter((s) => s.raw_avg !== null || s.graded_avg !== null)
      .map((s) => ({
        date: new Date(`${s.snapshot_date}T00:00:00Z`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
        Raw: s.raw_avg,
        Graded: s.graded_avg,
      })),
  [card]);

  if (card === null) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 py-24">
        <h1 className="text-2xl font-bold">Card not found</h1>
        <Link to="/prices" className="text-primary hover:underline">Browse all card prices</Link>
      </div>
    );
  }

  if (card === undefined) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-16 space-y-6">
          <div className="h-10 w-2/3 bg-card border border-border rounded-xl animate-pulse" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 bg-card border border-border rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const categoryInfo = PRICE_CATEGORIES[card.category] || { label: card.category };
  const fullName = card.set_name ? `${card.name} — ${card.set_name}` : card.name;
  const pageUrl = `/prices/${card.category}/${card.slug}`;
  const updatedOn = latest ? formatDate(latest.snapshot_date) : null;

  const title = `${card.name} Price (AUD) — ${card.set_name || categoryInfo.label} | CardPop`;
  const description = latest?.raw_avg
    ? `${fullName} is listing for around ${formatAud(latest.raw_avg)} raw and ${formatAud(latest.graded_avg)} graded in Australia (updated ${updatedOn}). Live AUD prices, history and where to buy.`
    : `Live Australian-dollar market price for ${fullName}: raw and graded averages, price history, and where to buy and sell in Australia.`;

  const faqs = [
    {
      q: `How much is ${card.name} (${card.set_name || categoryInfo.label}) worth in Australia?`,
      a: latest?.raw_avg
        ? `As at ${updatedOn}, ungraded copies list for around ${formatAud(latest.raw_avg)} (range ${formatAud(latest.raw_min)}–${formatAud(latest.raw_max)}), while graded copies average about ${formatAud(latest.graded_avg)}. Prices are in Australian dollars and refresh daily.`
        : 'A current AUD price is being calculated from live listings — check back shortly for the latest figure.',
    },
    {
      q: 'Why do these prices differ from US price guides?',
      a: 'US guides quote USD and reflect American supply and demand. CardPop aggregates live listings available to Australian buyers — local listings in AUD plus international listings converted at the current exchange rate — so the figure is what you would actually pay or receive here.',
    },
    {
      q: `Where can I buy or sell ${card.name} in Australia?`,
      a: 'You can buy and sell directly on the CardPop marketplace, with verified Australian sellers and buyer protection. Use the listing links on this page to see live stock, or create a free account to list your own copy.',
    },
  ];

  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Card Prices', item: `${SITE_ORIGIN}/prices` },
        { '@type': 'ListItem', position: 2, name: categoryInfo.label, item: `${SITE_ORIGIN}/prices/${card.category}` },
        { '@type': 'ListItem', position: 3, name: card.name, item: `${SITE_ORIGIN}${pageUrl}` },
      ],
    },
    latest && (latest.raw_avg || latest.graded_avg) ? {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: fullName,
      description: card.blurb || description,
      category: `${categoryInfo.label} Trading Cards`,
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'AUD',
        lowPrice: latest.raw_min ?? latest.graded_min,
        highPrice: latest.graded_max ?? latest.raw_max,
        offerCount: (latest.raw_count || 0) + (latest.graded_count || 0),
      },
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
        canonicalUrl={pageUrl}
        structuredData={structuredData}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <Link to="/prices" className="hover:text-foreground">Card Prices</Link>
          {' / '}
          <Link to={`/prices/${card.category}`} className="hover:text-foreground">{categoryInfo.label}</Link>
          {' / '}
          <span className="text-foreground">{card.name}</span>
        </nav>

        <header>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            {card.name} <span className="text-primary">Price (AUD)</span>
          </h1>
          <p className="text-muted-foreground">
            {card.set_name}
            {card.card_number ? ` · ${card.card_number}` : ''}
            {updatedOn ? ` · Updated ${updatedOn}` : ''}
          </p>
        </header>

        {latest ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatBox label="Raw average" value={formatAud(latest.raw_avg)} sub={latest.raw_count ? `${latest.raw_count} listings` : null} />
            <StatBox label="Raw range" value={latest.raw_avg !== null ? `${formatAud(latest.raw_min)} – ${formatAud(latest.raw_max)}` : '—'} />
            <StatBox label="Graded average" value={formatAud(latest.graded_avg)} sub={latest.graded_count ? `${latest.graded_count} listings` : null} />
            <StatBox label="Graded range" value={latest.graded_avg !== null ? `${formatAud(latest.graded_min)} – ${formatAud(latest.graded_max)}` : '—'} />
          </div>
        ) : (
          <p className="text-muted-foreground">
            The first price snapshot for this card is being collected — check back shortly.
          </p>
        )}

        {card.blurb && <p className="text-lg leading-relaxed">{card.blurb}</p>}

        <section className="bg-card border border-border rounded-3xl p-6 text-center">
          <h2 className="text-xl font-bold mb-2">Buy or sell this card on CardPop</h2>
          <p className="text-muted-foreground mb-4">
            See live listings from verified Australian sellers, or list your own copy in minutes.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              to={`/marketplace?q=${encodeURIComponent(card.name)}`}
              className="px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
            >
              See CardPop listings
            </Link>
            <Link
              to="/signup"
              className="px-6 py-3 rounded-full border border-border bg-background font-semibold hover:border-primary/50 transition-colors"
            >
              Sell yours
            </Link>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" /> Price history
          </h2>
          {chartData.length >= 2 ? (
            <div className="bg-card border border-border rounded-3xl p-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} tickFormatter={(v) => `$${v}`} width={70} />
                  <Tooltip formatter={(value) => formatAud(value)} />
                  <Line type="monotone" dataKey="Raw" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} connectNulls />
                  <Line type="monotone" dataKey="Graded" stroke="#8884d8" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-muted-foreground">
              Price history builds daily — the chart appears once this card has a few days of data.
            </p>
          )}
        </section>

        {latest?.sample_listings?.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold mb-4">Live listings sampled today</h2>
            <ul className="space-y-3">
              {latest.sample_listings.map((listing, i) => (
                <li key={i} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
                  {listing.thumbnailUrl && (
                    <img
                      src={listing.thumbnailUrl}
                      alt={listing.title}
                      loading="lazy"
                      className="w-14 h-14 object-cover rounded-lg flex-shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{listing.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {listing.graded ? 'Graded' : 'Raw'} · eBay {listing.marketplace}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold">{formatAud(listing.priceAud)}</div>
                    {listing.listingUrl && (
                      <a
                        href={listing.listingUrl}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
                      >
                        View <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

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

        {related.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold mb-4">More {categoryInfo.label} prices</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  to={`/prices/${r.category}/${r.slug}`}
                  className="bg-card border border-border rounded-2xl p-4 hover:border-primary/50 transition-colors"
                >
                  <div className="font-medium">{r.name}</div>
                  <div className="text-sm text-muted-foreground">{r.set_name}</div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div>
          <Link to={`/prices/${card.category}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> All {categoryInfo.label} prices
          </Link>
        </div>

        <p className="text-xs text-muted-foreground">
          Methodology: this price is aggregated daily from live eBay Australia and international
          listings (converted to AUD at the current rate
          {latest?.exchange_rate ? `, USD→AUD ${latest.exchange_rate}` : ''}), with outliers
          trimmed. It reflects current asking prices, not completed sales, and is a guide only —
          not financial advice.
        </p>
      </div>
    </div>
  );
};

export default CardPriceDetailPage;
