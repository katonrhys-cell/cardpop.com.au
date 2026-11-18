import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead.jsx';
import { ArrowLeft, CalendarDays, ChevronRight } from 'lucide-react';
import EventDetailCard from '@/components/EventDetailCard.jsx';
import EventInfoBoard from '@/components/events/EventInfoBoard.jsx';
import EventDiscussion from '@/components/events/EventDiscussion.jsx';
import RelatedEvents from '@/components/RelatedEvents.jsx';
import NextEditionBanner from '@/components/events/NextEditionBanner.jsx';
import EventReviewTeaser from '@/components/reviews/EventReviewTeaser.jsx';
import EventAttendeeReviews from '@/components/events/EventAttendeeReviews.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { useRecordEventView } from '@/hooks/useRecordEventView.js';
import { useAdminEditTarget } from '@/lib/adminEditTarget.js';
import { adminEventPath } from '@/utils/adminEditLinks.js';
import { isPastEvent } from '@/utils/eventPast.js';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  SITE_URL,
  eventTypeLabel,
  formatEventDate,
  formatEventTime,
  formatEventLocation,
  buildEventJsonLd,
  buildBreadcrumbJsonLd,
  toLocalDateStr,
} from '@/lib/eventSeo.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1540317580384-e5d43616b9aa?q=80&w=1600&auto=format&fit=crop';

const EventDetailPage = () => {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchEvent = async () => {
      setIsLoading(true);
      try {
        const column = UUID_PATTERN.test(eventId) ? 'id' : 'slug';
        // events_public exposes approved and completed (past) events with public-safe columns
        const { data, error } = await supabase
          .from('events_public')
          .select('*')
          .eq(column, eventId)
          .maybeSingle();
        if (error) throw error;
        if (isMounted) setEvent(data);
      } catch (err) {
        if (isMounted) setEvent(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchEvent();
    return () => { isMounted = false; };
  }, [eventId]);

  // A view of a public event (events_public only returns public ones).
  useRecordEventView(event?.id, Boolean(event));
  // Admins get an "Edit in admin" shortcut straight to this event's form.
  useAdminEditTarget('Edit event', adminEventPath(event?.id));

  if (isLoading) {
    return (
      // The same frame the loaded page has — the real Back link and the start
      // of the breadcrumb, then the card with its poster area and title block
      // at their real sizes — so only the poster and text fill in. It used to
      // be four loose bars at different paddings, and the whole page
      // rearranged when the event arrived.
      <div className="flex flex-col bg-background font-sans min-h-screen" aria-busy="true">
        <div className="flex-1 container-default py-4 md:py-12 w-full">
          <Button
            variant="ghost"
            asChild
            className="mb-1 md:mb-8 -ml-4 text-muted-foreground hover:bg-card hover:text-primary transition-colors rounded-xl"
          >
            <Link to="/events">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Calendar
            </Link>
          </Button>
          <div className="w-full">
            <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-3 md:mb-6 font-medium">
              <Link to="/" className="hover:text-primary transition-colors">Home</Link>
              <ChevronRight className="w-4 h-4" />
              <Link to="/events" className="hover:text-primary transition-colors">Events</Link>
              <ChevronRight className="w-4 h-4" />
              <Skeleton className="h-4 w-48" />
            </nav>
            <div className="bg-card rounded-3xl overflow-hidden border border-border shadow-lg" aria-hidden="true">
              <div className="w-full h-64 md:h-96 lg:h-[450px] bg-muted animate-pulse" />
              <div className="px-5 pt-5 pb-8 md:px-10 md:pt-8 md:pb-10">
                <Skeleton className="h-8 w-32 rounded-full" />
                <Skeleton className="h-8 md:h-12 lg:h-[60px] w-3/4 mt-4" />
                <div className="mt-8 space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-11/12" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex flex-col bg-background font-sans min-h-screen">
        <SEOHead title="Event Not Found | CardPop" description="This trading card event doesn't exist or has been removed. Browse upcoming card shows and TCG events across Australia on CardPop." />
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="bg-card border border-border p-12 rounded-3xl shadow-sm text-center">
            <CalendarDays className="w-16 h-16 text-muted-foreground opacity-50 mx-auto mb-4" />
            <h1 className="font-serif text-3xl font-bold mb-2 text-foreground">Event Not Found</h1>
            <p className="text-muted-foreground mb-6">The event you're looking for doesn't exist or has been removed.</p>
            <Button asChild className="rounded-xl">
              <Link to="/events">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Events
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const locationText = formatEventLocation(event);
  // Finished (by date, or archived as `completed` by an admin): no RSVP or
  // tickets, and the attendee reviews section opens.
  const isPast = isPastEvent(event, toLocalDateStr(new Date()));
  const seoTitle = event.seo_title
    ? `${event.seo_title} | CardPop`
    : `${event.title} – ${formatEventDate(event)} | ${locationText} | CardPop`;
  const seoDescription = event.seo_description || event.short_description ||
    `${event.title} on ${formatEventDate(event, true)} at ${locationText}. Find dates, venue, times and ticket info for this Australian trading card event on CardPop.`;

  // EventDetailCard renders both legacy static events and Supabase records,
  // so map the DB row onto the display shape it expects.
  const displayEvent = {
    ...event,
    name: event.title,
    type: eventTypeLabel(event),
    image: event.image_url || FALLBACK_IMAGE,
    date: formatEventDate(event, true),
    time: formatEventTime(event),
    location: [event.venue_name, event.address, event.suburb, event.state, event.postcode].filter(Boolean).join(', '),
    ticketLink: event.ticket_url || event.website_url,
  };

  return (
    <div className="flex flex-col bg-background font-sans min-h-screen">
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        canonicalUrl={`${SITE_URL}/events/${event.slug || event.id}`}
        ogImage={event.image_url || undefined}
        // No VideoObject here: an event page is not a watch page. Each video's
        // markup lives on its own page (/events/<slug>/videos/<id>).
        structuredData={[buildEventJsonLd(event), buildBreadcrumbJsonLd(event)].filter(Boolean)}
      />

      <div className="flex-1 container-default py-4 md:py-12 w-full">
        <Button
          variant="ghost"
          asChild
          className="mb-1 md:mb-8 -ml-4 text-muted-foreground hover:bg-card hover:text-primary transition-colors rounded-xl"
        >
          <Link to="/events">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Calendar
          </Link>
        </Button>

        {/* A finished event hands its search traffic to the next edition */}
        {isPast && <NextEditionBanner event={event} />}

        <EventDetailCard event={displayEvent} isPast={isPast} />

        {/* "CardPop was there" — shown only once an admin has published a review of this event */}
        <EventReviewTeaser eventId={event.id} />

        {/* Collector reviews — only once the event has finished */}
        {isPast && <EventAttendeeReviews event={event} />}

        <EventInfoBoard event={event} />

        <EventDiscussion event={event} />

        <RelatedEvents currentEventId={event.id} currentState={event.state} />
      </div>
    </div>
  );
};

export default EventDetailPage;
