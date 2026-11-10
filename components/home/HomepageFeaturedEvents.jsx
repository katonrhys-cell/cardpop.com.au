import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, MapPin, Star } from 'lucide-react';
import { getHomepageEvents } from '@/lib/homepageData.js';
import { HOMEPAGE_EVENTS_LIMIT } from '@/lib/homepageQueries.js';
import { eventPath, formatEventDate, formatEventLocation, toLocalDateStr } from '@/lib/eventSeo.js';
import { cardThumbUrl } from '@/utils/imageUrl.js';
import { FEATURED_CARD_CLASS, FEATURED_PILL_CLASS, isFeaturedEvent } from '@/utils/eventFeatured.js';

/**
 * Homepage "Featured events": events whose organiser bought the Full Feature
 * package (or an admin placed), events.homepage_featured. Same gold as the
 * calendar's featured cards. Renders nothing until there is at least one
 * upcoming event to show.
 */
export const homepageEventsToShow = (rows, today) =>
  (Array.isArray(rows) ? rows : [])
    .filter((ev) => ev?.homepage_featured && isFeaturedEvent({ ...ev, is_featured: true }, today))
    .slice(0, HOMEPAGE_EVENTS_LIMIT);

const HomepageFeaturedEvents = () => {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    let alive = true;
    getHomepageEvents()
      .then((res) => { if (alive) setEvents(homepageEventsToShow(res?.data, toLocalDateStr(new Date()))); })
      .catch(() => { /* section stays hidden */ });
    return () => { alive = false; };
  }, []);

  if (!events.length) return null;

  return (
    <section aria-labelledby="home-featured-events-heading" className="cv-auto py-10 md:py-16 bg-background">
      <div className="max-w-[90rem] mx-auto px-5 sm:px-8 lg:px-12 xl:px-16">
        <div className="rounded-3xl border border-amber-400/60 bg-amber-50/60 dark:bg-amber-400/5 p-5 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
            <div>
              <h2 id="home-featured-events-heading" className="flex items-center gap-2 text-2xl md:text-3xl font-bold font-serif">
                <Star className="w-6 h-6 text-amber-500 fill-current" aria-hidden="true" /> Featured events
              </h2>
              <p className="text-muted-foreground text-sm mt-1">Card shows and trade nights coming up around Australia.</p>
            </div>
            <Link to="/events" className="inline-flex items-center gap-1 text-sm font-bold text-foreground hover:underline">
              All events <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>

          <div className={`grid gap-4 sm:gap-6 ${events.length > 1 ? 'sm:grid-cols-2' : ''} ${events.length > 2 ? 'lg:grid-cols-3' : ''}`}>
            {events.map((ev) => {
              const img = cardThumbUrl(ev.image_url || null);
              return (
                <Link
                  key={ev.id}
                  to={eventPath(ev)}
                  className={`group flex flex-col overflow-hidden rounded-2xl bg-card transition-transform duration-200 hover:-translate-y-1 ${FEATURED_CARD_CLASS}`}
                >
                  <div className="relative h-40 w-full overflow-hidden bg-muted">
                    {img ? (
                      <img src={img} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <CalendarDays className="w-10 h-10 text-muted-foreground/40" aria-hidden="true" />
                      </div>
                    )}
                    <span className={`absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold shadow-sm ${FEATURED_PILL_CLASS}`}>
                      <Star className="w-3 h-3 fill-current" aria-hidden="true" /> Featured
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <h3 className="font-bold text-lg leading-snug text-foreground group-hover:text-primary">{ev.title}</h3>
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <CalendarDays className="w-4 h-4 shrink-0" aria-hidden="true" /> {formatEventDate(ev)}
                    </p>
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" /> <span className="truncate">{formatEventLocation(ev)}</span>
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            Running a show?{' '}
            <Link to="/list-your-event#featured-packages" className="font-semibold text-foreground hover:underline">Feature it here</Link>
          </p>
        </div>
      </div>
    </section>
  );
};

export default HomepageFeaturedEvents;
