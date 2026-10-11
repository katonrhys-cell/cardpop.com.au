import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, MapPin, Ticket, Clock, Users, Sparkles, ArrowUpRight } from 'lucide-react';
import { CROWD_LEVEL_MAP, formatAud, formatHours, hasQuickFacts } from '@/utils/eventReview.js';
import { eventPath, formatEventLocation } from '@/lib/eventSeo.js';

const formatDay = (iso) => {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

const Fact = ({ icon: Icon, label, children }) => (
  <div className="flex items-start gap-3 min-w-0">
    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-red/10 text-brand-red">
      <Icon className="w-4 h-4" aria-hidden="true" />
    </span>
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground leading-snug break-words">{children}</p>
    </div>
  </div>
);

// "At a glance" panel: when we went, where, what it cost, how long we stayed,
// how busy it was and the headline pickup — with a link back to the event page.
const EventReviewQuickFacts = ({ review, event }) => {
  if (!review || (!hasQuickFacts(review) && !event)) return null;

  const attended = formatDay(review.attended_on) || (event?.start_date ? formatDay(event.start_date) : null);
  const location = event ? formatEventLocation(event) : null;
  const ticket = review.ticket_paid_aud != null ? formatAud(review.ticket_paid_aud) : null;
  const hours = formatHours(review.hours_spent);
  const crowd = CROWD_LEVEL_MAP[review.crowd_level];

  return (
    <aside aria-label="Event at a glance" className="rounded-2xl border border-border bg-muted/30 p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">At a glance</p>
        {event && (
          <Link
            to={eventPath(event)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-red hover:underline"
          >
            Event page <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {attended && <Fact icon={CalendarDays} label="Attended">{attended}</Fact>}
        {location && location !== 'Venue TBA' && <Fact icon={MapPin} label="Where">{location}</Fact>}
        {ticket && <Fact icon={Ticket} label="Entry paid">{ticket}</Fact>}
        {hours && <Fact icon={Clock} label="Time on the floor">{hours}</Fact>}
        {crowd && <Fact icon={Users} label="Crowd">{crowd.label} <span className="font-normal text-muted-foreground">· {crowd.desc}</span></Fact>}
        {review.headline_pickup && <Fact icon={Sparkles} label="Headline pickup">{review.headline_pickup}</Fact>}
      </div>
    </aside>
  );
};

export default EventReviewQuickFacts;
