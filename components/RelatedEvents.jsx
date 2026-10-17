import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import EventCard from '@/components/EventCard.jsx';
import { toLocalDateStr } from '@/lib/eventSeo.js';

const RelatedEvents = ({ currentEventId, currentState }) => {
  const [relatedEvents, setRelatedEvents] = useState([]);

  useEffect(() => {
    let isMounted = true;

    const fetchRelated = async () => {
      try {
        const todayStr = toLocalDateStr(new Date());
        let query = supabase
          .from('events_public')
          .select('*')
          .eq('status', 'approved')
          .neq('id', currentEventId)
          .gte('start_date', todayStr)
          .order('start_date', { ascending: true })
          .limit(3);
        if (currentState) query = query.eq('state', currentState);

        let { data, error } = await query;
        if (error) throw error;

        // Fall back to any upcoming events if none share the same state
        if (currentState && (!data || data.length === 0)) {
          ({ data, error } = await supabase
            .from('events_public')
            .select('*')
            .eq('status', 'approved')
            .neq('id', currentEventId)
            .gte('start_date', todayStr)
            .order('start_date', { ascending: true })
            .limit(3));
          if (error) throw error;
        }

        if (isMounted) setRelatedEvents(data || []);
      } catch (err) {
        console.error('Error fetching related events:', err);
      }
    };

    if (currentEventId) fetchRelated();
    return () => { isMounted = false; };
  }, [currentEventId, currentState]);

  if (relatedEvents.length === 0) return null;

  return (
    <div className="mt-16 pt-12 border-t border-border">
      <h2 className="font-serif text-2xl font-bold mb-6 text-foreground">
        More Upcoming Card Events{currentState ? ` in ${currentState}` : ''}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {relatedEvents.map(event => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
};

export default RelatedEvents;
