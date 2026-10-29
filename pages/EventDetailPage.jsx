import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead.jsx';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import EventDetailCard from '@/components/EventDetailCard.jsx';
import EventInfoBoard from '@/components/events/EventInfoBoard.jsx';
import EventDiscussion from '@/components/events/EventDiscussion.jsx';
import RelatedEvents from '@/components/RelatedEvents.jsx';
import EventReviewTeaser from '@/components/reviews/EventReviewTeaser.jsx';
import EventAttendeeReviews from '@/components/events/EventAttendeeReviews.jsx';
import { supabase } from '@/lib/supabaseClient.js';
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
  buildVideoJsonLds,
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

  if (isLoading) {
    return (
      <div className="flex flex-col bg-background font-sans min-h-screen">
        <div className="flex-1 container-default py-12 w-full space-y-6">
          <Skeleton className="h-10 w-44 rounded-xl" />
          <Skeleton className="h-96 w-full rounded-3xl" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-6 w-1/2" />
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
        structuredData={[buildEventJsonLd(event), buildBreadcrumbJsonLd(event), ...buildVideoJsonLds(event)].filter(Boolean)}
      />

      <div className="flex-1 container-default py-12 w-full">
        <Button
          variant="ghost"
          asChild
          className="mb-8 -ml-4 text-muted-foreground hover:bg-card hover:text-primary transition-colors rounded-xl"
        >
          <Link to="/events">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Calendar
          </Link>
        </Button>

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
