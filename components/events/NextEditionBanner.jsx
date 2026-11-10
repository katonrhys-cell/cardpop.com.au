import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { eventPath, formatEventDate, toLocalDateStr } from '@/lib/eventSeo.js';
import { NEXT_EDITION_COLUMNS, NEXT_EDITION_SCAN_LIMIT, pickNextEdition } from '@/utils/eventNextEdition.js';
import { eventRegionByState, eventRegionPath } from '@/data/eventRegions.js';

// Shown at the top of a finished event's page: the next edition of the same
// show (utils/eventNextEdition.js), else the city's card-show page. Most
// visitors to a past event arrive from a search for the show's name — they
// want the next date, not last year's.
const NextEditionBanner = ({ event }) => {
  const [next, setNext] = useState(null);

  useEffect(() => {
    let alive = true;
    setNext(null);
    const today = toLocalDateStr(new Date());
    supabase
      .from('events_public')
      .select(NEXT_EDITION_COLUMNS)
      .eq('status', 'approved')
      .gte('start_date', today)
      .order('start_date', { ascending: true })
      .limit(NEXT_EDITION_SCAN_LIMIT)
      .then(({ data, error }) => {
        if (alive && !error) setNext(pickNextEdition(event, data || [], today));
      });
    return () => { alive = false; };
  }, [event]);

  const region = eventRegionByState(event?.state);
  if (!next && !region) return null;

  if (!next) {
    return (
      <div className="mb-8 rounded-2xl border border-border bg-card p-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">This event has finished.</span>{' '}
          See what&apos;s coming up near {region.city}.
        </p>
        <Link to={eventRegionPath(region)} className="text-sm font-semibold text-primary hover:underline inline-flex items-center gap-1">
          Card shows in {region.city} <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  const where = [next.venue_name, next.suburb, next.state].filter(Boolean).join(', ');
  return (
    <Link
      to={eventPath(next)}
      className="mb-8 group block rounded-2xl border-2 border-primary/30 bg-primary/5 p-5 hover:border-primary transition-colors"
      data-testid="next-edition"
    >
      <div className="flex items-start gap-4">
        <CalendarClock className="w-6 h-6 text-primary shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">This event has finished — next one is on</p>
          <p className="font-serif text-xl font-bold text-foreground mt-1">{next.title}</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {formatEventDate(next, true)}{where ? ` · ${where}` : ''}
          </p>
        </div>
        <ArrowRight className="w-5 h-5 text-primary shrink-0 self-center group-hover:translate-x-1 transition-transform" aria-hidden="true" />
      </div>
    </Link>
  );
};

export default NextEditionBanner;
