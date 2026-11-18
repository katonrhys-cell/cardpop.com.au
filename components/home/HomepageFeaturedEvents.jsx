import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Clock, MapPin, Star, Ticket, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PagedCarousel from '@/components/PagedCarousel.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { getHomepageEvents } from '@/lib/homepageData.js';
import { HOMEPAGE_EVENTS_LIMIT } from '@/lib/homepageQueries.js';
import { eventPath, eventTypeLabel, formatEntryFee, formatEventDate, formatEventLocation, formatEventTime, toLocalDateStr } from '@/lib/eventSeo.js';
import { cardThumbUrl, publicImageUrl } from '@/utils/imageUrl.js';
import { FEATURED_CARD_CLASS, FEATURED_PILL_CLASS, isFeaturedEvent } from '@/utils/eventFeatured.js';

// "List event": straight to the submit form when signed in; otherwise sign up
// first, and the confirmation link brings them back to it (SignupPage carries
// ?next= through, validated by lib/safeInternalPath.js).
export const LIST_EVENT_SIGNED_IN = '/account/events?new=1';
export const LIST_EVENT_SIGNED_OUT = `/signup?next=${encodeURIComponent(LIST_EVENT_SIGNED_IN)}`;
// My Events opens the feature picker (event → package → Stripe) for
// `?feature=1`; a signed-out visitor goes via /login and back.
export const FEATURE_EVENT_PATH = '/account/events?feature=1';

/**
 * Homepage "Featured events": the tier above the calendar's featured strip —
 * events whose organiser bought the Full Feature package (or an admin
 * placed), events.homepage_featured. Same gold as the calendar's featured
 * cards. Shown in the same swipe / arrow carousel as Trusted Australian Sellers
 * (components/PagedCarousel.jsx): one card is one card wide, never the full
 * page, and any number of events can be paged through. The section is always on the page once the read settles: with no
 * event to show it invites organisers to take the spot, and the "List event"
 * button lives under it either way.
 */
export const homepageEventsToShow = (rows, today) =>
  (Array.isArray(rows) ? rows : [])
    .filter((ev) => ev?.homepage_featured && isFeaturedEvent({ ...ev, is_featured: true }, today))
    .slice(0, HOMEPAGE_EVENTS_LIMIT);

// The poster is shown whole (contain) over a blurred copy of itself, in a
// 16:9 frame: a flyer's text and dates are the point of it, so it is never
// cropped, and every card's frame is the same size whatever shape was
// uploaded. Loads the 480 px thumb and falls back to the full poster when the
// thumb is missing, then to the placeholder.
const EventPoster = ({ imageUrl }) => {
  const full = publicImageUrl(imageUrl || null);
  const [src, setSrc] = useState(() => cardThumbUrl(imageUrl || null));
  if (!src) {
    return (
      <div className="flex h-full items-center justify-center">
        <CalendarDays className="w-10 h-10 text-muted-foreground/40" aria-hidden="true" />
      </div>
    );
  }
  return (
    <>
      <img src={src} alt="" aria-hidden="true" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl opacity-70" />
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-contain"
        onError={() => setSrc(src !== full ? full : null)}
      />
    </>
  );
};

const HomepageFeaturedEvents = () => {
  // null until the read settles, so the empty state never flashes first.
  const [events, setEvents] = useState(null);
  // `|| {}`: also rendered outside AuthProvider (tests, prerender shells).
  const { isAuthenticated } = useAuth() || {};

  useEffect(() => {
    let alive = true;
    getHomepageEvents()
      .then((res) => { if (alive) setEvents(homepageEventsToShow(res?.data, toLocalDateStr(new Date()))); })
      .catch(() => { if (alive) setEvents([]); });
    return () => { alive = false; };
  }, []);

  if (!events) return null;

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

          {events.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-amber-400/70 bg-card px-5 py-8 text-center" data-testid="home-featured-events-empty">
              <p className="font-bold text-foreground">No featured events right now</p>
              <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
                This spot on the CardPop home page is open. Feature your card show or trade night and it appears here, in front of every visitor.
              </p>
            </div>
          ) : (
            <PagedCarousel
              items={events}
              getKey={(ev) => ev.id}
              animate={false}
              trackTestId="home-featured-events-track"
              trackLabel="Featured events"
              prevLabel="Previous events"
              nextLabel="Next events"
              renderItem={(ev) => {
                const type = eventTypeLabel(ev);
                const hasTime = Boolean(ev.start_time);
                const hasFee = ev.is_free || Number(ev.entry_fee_aud) > 0;
                return (
                  <Link
                    to={eventPath(ev)}
                    className={`group flex h-full flex-col overflow-hidden rounded-2xl bg-card transition-transform duration-200 hover:-translate-y-1 ${FEATURED_CARD_CLASS}`}
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-muted">
                      <EventPoster imageUrl={ev.image_url} />
                      <span className={`absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold shadow-sm ${FEATURED_PILL_CLASS}`}>
                        <Star className="w-3 h-3 fill-current" aria-hidden="true" /> Featured
                      </span>
                      {type && (
                        <span className="absolute top-3 right-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-semibold text-foreground shadow-sm">{type}</span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-4">
                      <h3 className="font-bold text-lg leading-snug text-foreground group-hover:text-primary">{ev.title}</h3>
                      {ev.short_description && (
                        <p className="line-clamp-2 text-sm text-muted-foreground">{ev.short_description}</p>
                      )}
                      <p className="flex items-center gap-1.5 text-sm text-foreground">
                        <CalendarDays className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden="true" /> {formatEventDate(ev)}
                      </p>
                      {hasTime && (
                        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4 shrink-0" aria-hidden="true" /> {formatEventTime(ev)}
                        </p>
                      )}
                      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" /> <span className="truncate">{formatEventLocation(ev)}</span>
                      </p>
                      {hasFee && (
                        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Ticket className="w-4 h-4 shrink-0" aria-hidden="true" /> {formatEntryFee(ev)}
                        </p>
                      )}
                      {ev.organizer_name && (
                        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <User className="w-4 h-4 shrink-0" aria-hidden="true" /> <span className="truncate">{ev.organizer_name}</span>
                        </p>
                      )}
                      <span className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-bold text-primary">
                        View event <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      </span>
                    </div>
                  </Link>
                );
              }}
            />
          )}

          <div className="mt-6 flex flex-col items-center gap-3 border-t border-amber-400/40 pt-5 sm:flex-row sm:justify-between">
            <p className="text-center text-sm text-muted-foreground sm:text-left">
              Running a card show or trade night? Listing it on CardPop is free.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild size="sm" className="rounded-full font-bold">
                <Link to={isAuthenticated ? LIST_EVENT_SIGNED_IN : LIST_EVENT_SIGNED_OUT}>List event <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="rounded-full font-bold">
                <Link to="/list-your-event#featured-packages">Feature it here</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HomepageFeaturedEvents;
