import React from 'react';
import { CalendarDays, Clock, DollarSign, ExternalLink, Users } from 'lucide-react';
import {
  groupSideEventsByDay,
  formatSideEventDay,
  formatSideEventTime,
  formatSideEventFee,
} from '@/utils/eventSideEvents.js';

// The event page's schedule of side events (events.side_events, normalised by
// cleanSideEvents): grouped under a heading per day, in time order, each with
// its time, entry fee, player cap, details and optional registration link.
// Renders nothing without a side event.
const EventSideEvents = ({ sideEvents = [], isPast = false, headingId = 'event-side-events' }) => {
  if (sideEvents.length === 0) return null;
  const groups = groupSideEventsByDay(sideEvents);

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div className="flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-brand-red" aria-hidden="true" />
        <h2 id={headingId} className="font-heading text-xl font-bold text-foreground">Side Events &amp; Schedule</h2>
        <span className="text-xs text-muted-foreground">({sideEvents.length})</span>
      </div>

      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group.date || 'undated'} className="space-y-2">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {formatSideEventDay(group.date) || 'Day to be confirmed'}
            </h3>
            <ul className="space-y-2 list-none p-0 m-0">
              {group.events.map((e, i) => {
                const time = formatSideEventTime(e);
                const fee = formatSideEventFee(e);
                return (
                  <li key={`${e.title}-${i}`} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                      <h4 className="font-heading text-base font-bold text-foreground">{e.title}</h4>
                      {e.url && !isPast && (
                        <a
                          href={e.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="inline-flex items-center gap-1 text-sm font-semibold text-brand-red hover:underline"
                        >
                          Register <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                        </a>
                      )}
                    </div>
                    {(time || fee || e.player_cap) && (
                      <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        {time && <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" aria-hidden="true" />{time}</span>}
                        {fee && <span className="inline-flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" aria-hidden="true" />{fee === 'Free' ? 'Free entry' : `${fee} entry`}</span>}
                        {e.player_cap && <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" aria-hidden="true" />{e.player_cap} player cap</span>}
                      </p>
                    )}
                    {e.description && <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{e.description}</p>}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
};

export default EventSideEvents;
