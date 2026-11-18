import React, { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, PlayCircle } from 'lucide-react';
import SEOHead from '@/components/SEOHead.jsx';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toCdnUrl } from '@/utils/imageUrl.js';
import { buildWatchPage } from '@/utils/videoWatch.js';
import VideoCreatorCredit from '@/components/events/VideoCreatorCredit.jsx';
import { loadWatchSource, watchParentPath } from '@/lib/videoWatch.js';

// A video's own page — `<parent page>/videos/<key>` — where the video is the
// main content: the player first, at full width, then its title, what it is
// from and the other videos from the same page. This is the "watch page"
// Google needs before it will index a video; the event / organiser / article /
// card shop page the video also plays on is not one. It is the only page that
// carries the video's VideoObject markup (utils/videoWatch.js builds it; the
// prerender serves the same page to crawlers).
//
// `kind` picks the parent: 'event' | 'organiser' | 'article' | 'store'.

const Player = ({ video, name, poster }) => (
  <div className="aspect-video w-full overflow-hidden rounded-2xl border border-border bg-black shadow-md">
    {video.embedUrl ? (
      <iframe
        src={video.embedUrl}
        title={name}
        className="block h-full w-full"
        loading="eager"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    ) : (
      // An uploaded clip plays from its canonical storage URL (the CSP
      // media-src allows the Supabase host, not the image CDN).
      <video
        src={video.contentUrl}
        poster={poster ? toCdnUrl(poster) : undefined}
        controls
        playsInline
        preload="metadata"
        className="block h-full w-full object-contain"
        aria-label={name}
      />
    )}
  </div>
);

const VideoWatchPage = ({ kind }) => {
  const params = useParams();
  const { slug, city, videoKey } = params;
  // undefined = loading, null = the parent page isn't there.
  const [source, setSource] = useState(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSource(undefined);
    setFailed(false);
    loadWatchSource(kind, { slug, city })
      .then((found) => { if (!cancelled) setSource(found || null); })
      .catch(() => { if (!cancelled) { setSource(null); setFailed(true); } });
    return () => { cancelled = true; };
  }, [kind, slug, city]);

  if (source === undefined) {
    return (
      <div className="min-h-screen bg-background" aria-busy="true">
        <div className="container-default w-full max-w-5xl space-y-5 py-6 md:py-10">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="aspect-video w-full rounded-2xl" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
    );
  }

  if (source === null) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-24 text-center">
        <SEOHead title="Video not found | CardPop" noindex />
        <h1 className="mb-3 text-2xl font-bold">{failed ? 'Could not load this video' : 'Video not found'}</h1>
        <p className="mb-6 text-muted-foreground">
          {failed ? 'Please try again in a moment.' : 'The page this video belonged to doesn’t exist or has moved.'}
        </p>
        <Button asChild><Link to="/events">Browse events</Link></Button>
      </div>
    );
  }

  const page = buildWatchPage(source, videoKey);
  // The video was removed (or the link is mistyped): its page is the next best place.
  if (!page) return <Navigate to={source.parentPath || watchParentPath(kind, params)} replace />;

  const { video, name } = page;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={page.title}
        description={page.description}
        canonicalUrl={page.canonical}
        ogImage={page.thumbnailUrl || undefined}
        structuredData={page.jsonLd}
      />

      <div className="container-default w-full max-w-5xl py-4 md:py-10">
        <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <Link to={source.sectionPath} className="hover:text-primary">{source.sectionName}</Link>
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
          <Link to={source.parentPath} className="hover:text-primary">{source.parentName}</Link>
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
          <span className="text-foreground">{page.label}</span>
        </nav>

        <Player video={video} name={name} poster={page.thumbnailUrl} />

        <h1 className="mt-5 font-heading text-2xl font-bold text-foreground md:text-3xl">{name}</h1>
        {source.facts.length > 0 && (
          <p className="mt-2 text-sm text-muted-foreground">{source.facts.join(' · ')}</p>
        )}
        <VideoCreatorCredit creator={video.creator} />

        <section aria-labelledby="watch-about" className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h2 id="watch-about" className="font-heading text-lg font-bold text-foreground">
            From the {source.parentNoun}: {source.parentName}
          </h2>
          {source.summary && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{source.summary}</p>}
          <Button asChild variant="outline" className="mt-4 rounded-xl">
            <Link to={source.parentPath}>
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" /> View the {source.parentNoun} page
            </Link>
          </Button>
        </section>

        {page.others.length > 0 && (
          <section aria-labelledby="watch-more" className="mt-8">
            <h2 id="watch-more" className="font-heading text-lg font-bold text-foreground">
              More videos from {source.parentName}
            </h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {page.others.map((other) => (
                <li key={other.key}>
                  <Link to={other.path} className="group block">
                    <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-muted">
                      {other.thumbnailUrl && (
                        <img
                          src={toCdnUrl(other.thumbnailUrl)}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                      )}
                      <PlayCircle className="absolute inset-0 m-auto h-10 w-10 text-white drop-shadow" aria-hidden="true" />
                    </div>
                    <span className="mt-2 block text-sm font-semibold text-foreground group-hover:text-primary">{other.label}</span>
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

export default VideoWatchPage;
