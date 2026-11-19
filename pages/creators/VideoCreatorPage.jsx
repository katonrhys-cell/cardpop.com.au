import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarDays, ChevronRight, MapPin, PlayCircle } from 'lucide-react';
import { FacebookIcon, InstagramIcon, TikTokIcon, YouTubeIcon } from '@/components/SocialBrandIcons.jsx';
import SEOHead from '@/components/SEOHead.jsx';
import XIcon from '@/components/XIcon.jsx';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { publicImageUrl } from '@/utils/imageUrl.js';
import { creatorEventsCovered, creatorPageMeta } from '@/utils/videoCreators.js';
import { fetchCreatorBySlug, fetchCreatorVideos } from '@/lib/videoCreators.js';

// A saved video creator's page — /creators/<slug>: who they are, where to
// follow them, and every event video on CardPop that credits them, each
// linking to its watch page. The prerender serves the same page to crawlers
// (renderVideoCreator in api/prerender.js).

const ICONS = { instagram: InstagramIcon, youtube: YouTubeIcon, tiktok: TikTokIcon, facebook: FacebookIcon, x: XIcon };

const formatDate = (iso) => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
};

const VideoCreatorPage = () => {
  const { slug } = useParams();
  // undefined = loading, null = no such creator.
  const [creator, setCreator] = useState(undefined);
  const [videos, setVideos] = useState([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setCreator(undefined);
    setVideos([]);
    setFailed(false);
    (async () => {
      try {
        const row = await fetchCreatorBySlug(slug);
        if (cancelled) return;
        if (!row) { setCreator(null); return; }
        const list = await fetchCreatorVideos(row.id).catch(() => []);
        if (cancelled) return;
        setVideos(list);
        setCreator(row);
      } catch {
        if (!cancelled) { setCreator(null); setFailed(true); }
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  if (creator === undefined) {
    return (
      <div className="min-h-screen bg-background" aria-busy="true">
        <div className="container-default w-full max-w-5xl space-y-5 py-6 md:py-10">
          <Skeleton className="h-4 w-48" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-20 w-20 rounded-full" />
            <Skeleton className="h-8 w-56" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="aspect-video w-full rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (creator === null) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-24 text-center">
        <SEOHead title="Creator not found | CardPop" noindex />
        <h1 className="mb-3 text-2xl font-bold">{failed ? 'Could not load this page' : 'Creator not found'}</h1>
        <p className="mb-6 text-muted-foreground">
          {failed ? 'Please try again in a moment.' : 'This creator page doesn’t exist or has moved.'}
        </p>
        <Button asChild><Link to="/events">Browse events</Link></Button>
      </div>
    );
  }

  const meta = creatorPageMeta(creator, videos);
  const events = creatorEventsCovered(videos);
  const { name } = meta;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={meta.title}
        description={meta.description}
        canonicalUrl={meta.canonical}
        ogImage={creator.avatar_url || undefined}
        structuredData={meta.jsonLd}
        noindex={!meta.indexable}
      />

      <div className="container-default w-full max-w-5xl py-4 md:py-10">
        <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <Link to="/events" className="hover:text-primary">Events</Link>
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
          <span className="text-foreground">{name}</span>
        </nav>

        <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center">
          {creator.avatar_url ? (
            <img
              src={publicImageUrl(creator.avatar_url)}
              alt={`${name} profile picture`}
              width="88"
              height="88"
              className="h-[88px] w-[88px] shrink-0 rounded-full border border-border object-cover"
            />
          ) : (
            <span aria-hidden="true" className="flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-full bg-brand-red text-3xl font-bold text-white">
              {name.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Video creator</p>
            <h1 className="font-heading text-2xl font-bold text-foreground md:text-3xl">{name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {videos.length > 0
                ? `${videos.length} event video${videos.length === 1 ? '' : 's'} on CardPop${events.length ? ` from ${events.length} event${events.length === 1 ? '' : 's'}` : ''}.`
                : 'No event videos on CardPop yet.'}
            </p>
            {meta.links.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {meta.links.map(({ key, label, url, handle }) => {
                  const Icon = ICONS[key];
                  return (
                    <li key={key}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${name} on ${label}${handle ? ` (${handle})` : ''}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-brand-red hover:text-brand-red"
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="max-w-[12rem] truncate">{handle || label}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </header>

        <section aria-labelledby="creator-videos" className="mt-8">
          <h2 id="creator-videos" className="font-heading text-xl font-bold text-foreground">
            Event videos by {name}
          </h2>
          {videos.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Nothing here yet. <Link to="/events" className="underline underline-offset-2 hover:text-brand-red">Browse upcoming card shows</Link>.
            </p>
          ) : (
            <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((video) => (
                <li key={video.key} className="min-w-0">
                  <Link to={video.path} className="group block">
                    <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-muted">
                      <img
                        src={video.thumbnailUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                      <PlayCircle className="absolute inset-0 m-auto h-10 w-10 text-white drop-shadow" aria-hidden="true" />
                    </div>
                    <span className="mt-2 block text-sm font-semibold text-foreground group-hover:text-brand-red">
                      {video.title || `${video.parentName} video`}
                    </span>
                  </Link>
                  <Link to={video.parentPath} className="mt-0.5 block text-xs font-medium text-muted-foreground underline-offset-2 hover:text-brand-red hover:underline">
                    {video.parentName}
                  </Link>
                  {(video.date || video.where) && (
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {video.date && (
                        <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" aria-hidden="true" />{formatDate(video.date)}</span>
                      )}
                      {video.where && (
                        <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" aria-hidden="true" />{video.where}</span>
                      )}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {events.length > 1 && (
          <section aria-labelledby="creator-events" className="mt-10">
            <h2 id="creator-events" className="font-heading text-xl font-bold text-foreground">Events {name} has covered</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {events.map((ev) => (
                <li key={ev.parentPath}>
                  <Link to={ev.parentPath} className="inline-flex rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-brand-red hover:text-brand-red">
                    {ev.parentName}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
};

export default VideoCreatorPage;
