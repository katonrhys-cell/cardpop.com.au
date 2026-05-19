import React from 'react';
import { communityEvents } from '@/data/communityEvents.js';
import EventCard from '@/components/EventCard.jsx';

const RelatedEvents = ({ currentEventId, currentMonth }) => {
  const relatedEvents = communityEvents
    .filter(event => event.month === currentMonth && event.id !== currentEventId)
    .slice(0, 3);

  if (relatedEvents.length === 0) return null;

  return (
    <div className="mt-16 pt-12 border-t border-border">
      <h3 className="font-serif text-2xl font-bold mb-6 text-foreground">
        More Events in {currentMonth}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {relatedEvents.map(event => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
};

export default RelatedEvents;