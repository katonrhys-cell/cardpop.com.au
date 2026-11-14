import React, { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Camera, Clock, ExternalLink, Instagram, MapPin, Pencil, Phone, Video } from 'lucide-react';
import SEOHead from '@/components/SEOHead.jsx';
import BackButton from '@/components/BackButton.jsx';
import { EventPhotoGrid } from '@/components/reviews/EventReviewGallery.jsx';
import { ReviewVideoPlayer } from '@/components/reviews/EventReviewVideo.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { DIRECTORY_CITIES, STORE_CATEGORY_LABELS, fetchStore } from '@/lib/storeDirectory.js';
import {
  cleanStorePhotos,
  cleanStoreVideos,
  storeCoverPhoto,
  storeExternalLink,
  storeHoursLines,
  storeIsIndexable,
  storeJsonLd,
  storeLocationLine,
  storePageDescription,
  storePageTitle,
  storePath,
} from '@/utils/storePage.js';

const SITE_ORIGIN = 'https://cardpop.com.au';

// One card shop's own page: /card-shops/<city>/<slug>. Everything on it comes
// from the store's `local_game_stores` row, edited in Admin → Store Directory.
// See docs/store-pages.md.
const StorePage = () => {
  const { city, slug } = useParams();
  const { isAdmin } = useAuth();
  const cityInfo = DIRECTORY_CITIES[city];
  // undefined = loading, null = not found
  const [store, setStore] = useState(undefined);

  useEffect(() => {
    let cancelled = false;
    setStore(undefined);
    fetchStore(slug)
      .then((data) => { if (!cancelled) setStore(data); })
      .catch(() => { if (!cancelled) setStore(null); });
    return () => { cancelled = true; };
  }, [slug]);

  if (!cityInfo) return <Navigate to="/card-shops" replace />;
  if (store === null) return <Navigate to={`/card-shops/${city}`} replace />;
  // A store reached under the wrong city goes to its real URL.
  if (store && store.city !== city) return <Navigate to={storePath(store)} replace />;

  if (store === undefined) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container-default py-10 space-y-6">
          <div className="h-10 w-2/3 rounded-xl bg-muted animate-pulse" />
          <div className="h-64 rounded-3xl bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  const photos = cleanStorePhotos(store.photos).map((p, i, all) => ({
    ...p,
    alt: p.caption ? `${store.name} — ${p.caption}` : `Inside ${store.name} (${i + 1} of ${all.length})`,
  }));
  const videos = cleanStoreVideos(store.videos);
  const hours = storeHoursLines(store.opening_hours);
  const website = storeExternalLink(store.website);
  const instagram = storeExternalLink(store.instagram_url);
  const location = storeLocationLine(store);
  const path = storePath(store);
  const cover = storeCoverPhoto(store);
  const mapsUrl = store.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${store.name}, ${store.address}`)}`
    : null;

  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Card Shops', item: `${SITE_ORIGIN}/card-shops` },
        { '@type': 'ListItem', position: 2, name: cityInfo.label, item: `${SITE_ORIGIN}/card-shops/${city}` },
        { '@type': 'ListItem', position: 3, name: store.name, item: `${SITE_ORIGIN}${path}` },
      ],
    },
    storeJsonLd(store),
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={storePageTitle(store, cityInfo.label)}
        description={storePageDescription(store, cityInfo.label)}
        canonicalUrl={path}
        ogImage={cover || undefined}
        noindex={!storeIsIndexable(store)}
        structuredData={structuredData}
      />

      <div className="container-default py-10 space-y-10">
        <BackButton fallback={`/card-shops/${city}`} />

        <header className="space-y-3">
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <Link to="/card-shops" className="hover:text-foreground">Card Shops</Link>
            <span className="mx-1.5">/</span>
            <Link to={`/card-shops/${city}`} className="hover:text-foreground">{cityInfo.label}</Link>
          </nav>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-3xl md:text-4xl font-bold">{store.name}</h1>
            {isAdmin && (
              <Link
                to={`/admin/store-directory?edit=${encodeURIComponent(store.slug)}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-primary/60"
              >
                <Pencil className="w-4 h-4" /> Edit this page
              </Link>
            )}
          </div>
          {store.status !== 'approved' && (
            <p className="inline-block rounded-full bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              {store.status} — only admins can see this page
            </p>
          )}
          {location && (
            <p className="text-muted-foreground flex items-center gap-1.5">
              <MapPin className="w-4 h-4 shrink-0" /> {location}
            </p>
          )}
          {store.categories?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {store.categories.map((cat) => (
                <span key={cat} className="text-xs px-2.5 py-1 rounded-full bg-card border border-border">
                  {STORE_CATEGORY_LABELS[cat] || cat}
                </span>
              ))}
            </div>
          )}
        </header>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-10">
            {store.description && (
              <section aria-labelledby="store-about" className="space-y-3">
                <h2 id="store-about" className="font-heading text-xl font-bold">About {store.name}</h2>
                <p className="text-muted-foreground whitespace-pre-line leading-relaxed">{store.description}</p>
              </section>
            )}

            {photos.length > 0 && (
              <section aria-labelledby="store-photos" className="space-y-4">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-brand-red" aria-hidden="true" />
                  <h2 id="store-photos" className="font-heading text-xl font-bold">Photos</h2>
                  <span className="text-xs text-muted-foreground">({photos.length})</span>
                </div>
                <EventPhotoGrid photos={photos} lightboxTitle={store.name} />
              </section>
            )}

            {videos.length > 0 && (
              <section aria-labelledby="store-videos" className="space-y-4">
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-brand-red" aria-hidden="true" />
                  <h2 id="store-videos" className="font-heading text-xl font-bold">{videos.length > 1 ? 'Videos' : 'Video'}</h2>
                </div>
                <div className="grid gap-6 sm:grid-cols-2">
                  {videos.map((v) => <ReviewVideoPlayer key={v.url} video={v} title={`${store.name} video`} />)}
                </div>
              </section>
            )}

            {!store.description && photos.length === 0 && videos.length === 0 && (
              <p className="text-muted-foreground">
                We don&apos;t have photos or a write-up for {store.name} yet.
              </p>
            )}
          </div>

          <aside className="space-y-4">
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <h2 className="font-heading text-lg font-bold">Visit</h2>
              {location && (
                <div className="flex items-start gap-2.5 text-sm">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-brand-red" aria-hidden="true" />
                  <div>
                    <div>{location}</div>
                    {mapsUrl && (
                      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        Open in Google Maps
                      </a>
                    )}
                  </div>
                </div>
              )}
              {store.phone && (
                <div className="flex items-center gap-2.5 text-sm">
                  <Phone className="w-4 h-4 shrink-0 text-brand-red" aria-hidden="true" />
                  <a href={`tel:${store.phone.replace(/[^\d+]/g, '')}`} className="hover:underline">{store.phone}</a>
                </div>
              )}
              {website && (
                <div className="flex items-center gap-2.5 text-sm">
                  <ExternalLink className="w-4 h-4 shrink-0 text-brand-red" aria-hidden="true" />
                  <a href={website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                    {website.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '')}
                  </a>
                </div>
              )}
              {instagram && (
                <div className="flex items-center gap-2.5 text-sm">
                  <Instagram className="w-4 h-4 shrink-0 text-brand-red" aria-hidden="true" />
                  <a href={instagram} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Instagram</a>
                </div>
              )}
            </div>

            {hours.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                <h2 className="font-heading text-lg font-bold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-brand-red" aria-hidden="true" /> Opening hours
                </h2>
                <ul className="space-y-1.5 text-sm">
                  {hours.map((line) => {
                    const [day, ...rest] = line.split(':');
                    return rest.length ? (
                      <li key={line} className="flex justify-between gap-4">
                        <span className="text-muted-foreground">{day.trim()}</span>
                        <span className="text-right">{rest.join(':').trim()}</span>
                      </li>
                    ) : <li key={line}>{line}</li>;
                  })}
                </ul>
                <p className="text-xs text-muted-foreground">Hours can change — check with the store before a long trip.</p>
              </div>
            )}
          </aside>
        </div>

        <Link to={`/card-shops/${city}`} className="inline-block text-sm text-primary hover:underline">
          ← More card shops in {cityInfo.label}
        </Link>
      </div>
    </div>
  );
};

export default StorePage;
