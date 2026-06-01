import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead.jsx';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import EventDetailCard from '@/components/EventDetailCard.jsx';
import RelatedEvents from '@/components/RelatedEvents.jsx';
import { communityEvents } from '@/data/communityEvents.js';
import { Button } from '@/components/ui/button';

const EventDetailPage = () => {
  const { eventId } = useParams();

  const event = useMemo(() => {
    return communityEvents.find(e => e.id === eventId);
  }, [eventId]);

  if (!event) {
    return (
      <div className="flex flex-col bg-background font-sans min-h-screen">
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="bg-card border border-border p-12 rounded-3xl shadow-sm text-center">
            <CalendarDays className="w-16 h-16 text-muted-foreground opacity-50 mx-auto mb-4" />
            <h1 className="font-serif text-3xl font-bold mb-2 text-foreground">Event Not Found</h1>
            <p className="text-muted-foreground mb-6">The event you're looking for doesn't exist or has been removed.</p>
            <Button asChild className="rounded-xl">
              <Link to="/community/events">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Events
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-background font-sans min-h-screen">
      <SEOHead title="Event Details | CardPop" description="Find details about this trading card event in Australia — venue, dates, and how to register." />
      
      <div className="flex-1 max-w-6xl mx-auto px-4 py-12 w-full">
        <Button 
          variant="ghost" 
          asChild 
          className="mb-8 -ml-4 text-muted-foreground hover:bg-card hover:text-primary transition-colors rounded-xl"
        >
          <Link to="/community/events">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Calendar
          </Link>
        </Button>

        <EventDetailCard event={event} />
        
        <div className="mt-16">
          <RelatedEvents currentEventId={event.id} currentMonth={event.month} />
        </div>
      </div>
    </div>
  );
};

export default EventDetailPage;