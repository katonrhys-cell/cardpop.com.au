import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import SEOHead from '@/components/SEOHead.jsx';
import { CalendarDays, Search, MapPin, SlidersHorizontal, X, History } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { fetchRsvpCounts, fetchMyRsvps, emptyCounts } from '@/lib/eventRsvp.js';
import EventCard from '@/components/EventCard.jsx';
import EventDetailModal from '@/components/EventDetailModal.jsx';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { fetchReviewStatsMap } from '@/lib/eventAttendeeReviews.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SITE_URL, EVENT_TYPE_LABELS, buildEventListJsonLd, parseDate, toLocalDateStr } from '@/lib/eventSeo.js';

const AU_STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];
const EVENT_TYPES = Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => ({ value, label }));

const DAY_MS = 24 * 60 * 60 * 1000;
const todayStr = toLocalDateStr(new Date());
const nextYearStr = toLocalDateStr(new Date(Date.now() + 365 * DAY_MS));
// The "Past events" window: yesterday back two years. Older shows are still
// reachable by moving the start date.
const yesterdayStr = toLocalDateStr(new Date(Date.now() - DAY_MS));
const twoYearsAgoStr = toLocalDateStr(new Date(Date.now() - 2 * 365 * DAY_MS));

// Everything the card, the detail modal and the JSON-LD read from an event —
// the public view minus its SEO-only columns.
export const EVENT_CARD_COLUMNS = [
  'id', 'slug', 'event_type', 'status', 'title', 'description', 'short_description', 'image_url',
  'venue_name', 'address', 'suburb', 'state', 'postcode',
  'start_date', 'end_date', 'start_time', 'end_time',
  'entry_fee_aud', 'presale_fee_aud', 'ticket_prices', 'is_free', 'website_url', 'ticket_url',
  'is_cardpop_verified', 'is_featured', 'registration_required', 'capacity',
  'tags', 'featured_card_games', 'organizer_name',
  'instagram_url', 'facebook_url', 'youtube_url', 'facebook_video_url',
  'accessibility_info', 'age_restrictions', 'created_at', 'updated_at',
].join(',');

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_EVENTS = 500;

/**
 * Build the public-events query for a date window. Only events inside the
 * window (plus undated ones, which the page groups under "Date TBA") are
 * fetched: the page used to pull every public event ever — most of them past —
 * and filter in the browser, and the filter defaults to "today → next year"
 * anyway. Dates are validated before they reach the filter string.
 *
 * `past: true` is the "Past events" toggle: finished events inside the window
 * (newest first, no undated ones) plus anything an admin has marked
 * `completed` — their archive — whatever its date. The upcoming view is
 * `approved` only, so an archived event never sits in the calendar. `today`
 * caps the past window when the end date is blank.
 */
export function buildEventsQuery(client, { startDate, endDate, past = false, today } = {}) {
  let q = client.from('events_public').select(EVENT_CARD_COLUMNS);
  const start = ISO_DATE_RE.test(startDate || '') ? startDate : null;
  let end = ISO_DATE_RE.test(endDate || '') ? endDate : null;
  if (past) {
    if (!end && ISO_DATE_RE.test(today || '')) end = today;
    const window = start && end ? `and(start_date.gte.${start},start_date.lte.${end})`
      : start ? `start_date.gte.${start}`
        : end ? `start_date.lte.${end}` : null;
    q = window ? q.or(`status.eq.completed,${window}`) : q.not('start_date', 'is', null);
    return q.order('start_date', { ascending: false }).limit(MAX_EVENTS);
  }
  q = q.eq('status', 'approved');
  if (start && end) q = q.or(`start_date.is.null,and(start_date.gte.${start},start_date.lte.${end})`);
  else if (start) q = q.or(`start_date.is.null,start_date.gte.${start}`);
  else if (end) q = q.or(`start_date.is.null,start_date.lte.${end}`);
  return q.order('start_date', { ascending: true }).limit(MAX_EVENTS);
}

const TYPE_SEO = {
  card_show: {
    path: '/events/card-shows',
    title: 'Card Shows in Australia 2026 | CardPop',
    description: 'Find trading card shows and expos across Australia — Pokemon, Magic, sports cards and more. Dates, venues and tickets for card fairs in Sydney, Melbourne, Brisbane and beyond.',
    heading: 'Card Shows Across Australia',
    subheading: 'Trading card fairs, expos and collector shows happening nationwide.',
  },
  trade_event: {
    path: '/events/trade-events',
    title: 'Trading Card Swap Meets & Trade Events Australia 2026 | CardPop',
    description: 'Discover trading card swap meets and trade nights across Australia. Find dates, venues and details for collector trading events in every state.',
    heading: 'Trade Events Across Australia',
    subheading: 'Swap meets, trading nights and collector exchanges nationwide.',
  },
  community_event: {
    path: '/events/community-events',
    title: 'Trading Card Community Events Australia 2026 | CardPop',
    description: 'Join trading card community meetups and collector gatherings across Australia. Find local TCG community events, casual play nights and collector meets near you.',
    heading: 'Community Events Across Australia',
    subheading: 'Collector meetups, casual play nights and community gatherings.',
  },
  lgs_event: {
    path: '/events/store-events',
    title: 'Local Game Store Events & TCG Tournaments Australia 2026 | CardPop',
    description: 'Find local game store tournaments and TCG events across Australia. Pokemon, Magic: The Gathering, Yu-Gi-Oh, One Piece and more — find a store event near you.',
    heading: 'Store Events Across Australia',
    subheading: 'Local game store tournaments and in-store TCG events.',
  },
};

const ALL_SEO = {
  path: '/events',
  title: 'Trading Card Shows & TCG Events in Australia 2026 | CardPop',
  description: "Australia's trading card event calendar — card shows, TCG expos, fairs and collector meets in Sydney, Melbourne, Brisbane, Adelaide and Perth. Dates, venues and tickets.",
  heading: 'Trading Card Events Across Australia',
  subheading: 'Your go-to directory for TCG tournaments, card fairs, and collector shows happening nationwide. Find events near you — from major expos to local meetups.',
};

const CommunityEventsPage = ({ defaultType = 'all' }) => {
  const { currentUser, isAuthenticated } = useAuth();
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // RSVP counts + the current user's roles, batch-loaded for the whole list in a
  // single request each. Without this each <EventRsvp> fetches its own event on
  // mount — an N+1 across the grid (Sentry REACT-FRONT-END-C).
  const [rsvpCounts, setRsvpCounts] = useState({});
  const [myRsvps, setMyRsvps] = useState({});

  // "Past events" lives in the URL (?past=1) so a look back is linkable and
  // survives the back button. Off = the calendar: today → next year.
  const [searchParams, setSearchParams] = useSearchParams();
  const showPast = searchParams.get('past') === '1';
  const defaultStart = showPast ? twoYearsAgoStr : todayStr;
  const defaultEnd = showPast ? yesterdayStr : nextYearStr;

  const [searchTerm, setSearchTerm] = useState('');
  const [filterState, setFilterState] = useState('all');
  const [filterType, setFilterType] = useState(defaultType);
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  // Star summaries for the past grid ({ [eventId]: { review_count, average_rating } }).
  const [reviewStats, setReviewStats] = useState({});

  const setShowPast = (on) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (on) next.set('past', '1'); else next.delete('past');
      return next;
    }, { replace: true });
  };

  // Flipping the toggle (or arriving via the URL) resets the window to that
  // mode's defaults; a hand-picked range in one mode makes no sense in the other.
  useEffect(() => {
    setStartDate(showPast ? twoYearsAgoStr : todayStr);
    setEndDate(showPast ? yesterdayStr : nextYearStr);
  }, [showPast]);

  // Reset filter when the route changes between type pages
  useEffect(() => {
    setFilterType(defaultType);
  }, [defaultType]);

  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const isMounted = useRef(true);
  const fetchRef = useRef(null);

  // Fetch the events for the selected date window (see buildEventsQuery).
  // Re-runs when the window changes, debounced so typing a date doesn't fire
  // a query per keystroke.
  useEffect(() => {
    isMounted.current = true;
    let cancelled = false;
    const run = async () => {
      if (!isMounted.current) return;
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await buildEventsQuery(supabase, { startDate, endDate, past: showPast, today: todayStr });
        if (fetchError) throw fetchError;
        if (!cancelled && isMounted.current) setEvents(data || []);
      } catch (err) {
        if (!cancelled && isMounted.current) setError('Failed to load events. Please try again.');
      } finally {
        if (!cancelled && isMounted.current) setIsLoading(false);
      }
    };
    fetchRef.current = run;
    const timer = setTimeout(run, fetchRef.current && events.length ? 300 : 0);
    return () => { cancelled = true; clearTimeout(timer); isMounted.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- events.length only picks the debounce
  }, [startDate, endDate, showPast]);
  const fetchEvents = () => fetchRef.current?.();

  // Past grid only: one request for every card's star summary.
  useEffect(() => {
    if (!showPast) { setReviewStats({}); return undefined; }
    const ids = events.map(e => e.id).filter(Boolean);
    if (ids.length === 0) { setReviewStats({}); return undefined; }
    let cancelled = false;
    fetchReviewStatsMap(ids)
      .then((map) => { if (!cancelled) setReviewStats(map); })
      .catch(() => { if (!cancelled) setReviewStats({}); });
    return () => { cancelled = true; };
  }, [events, showPast]);

  // Batch-load RSVP data for every loaded event at once. Re-runs when the signed-in
  // user resolves so their own RSVP roles fill in. Each helper issues a single
  // `.in(event_id, [...])` request, replacing the per-card N+1.
  useEffect(() => {
    const ids = events.map(e => e.id).filter(Boolean);
    if (ids.length === 0) { setRsvpCounts({}); setMyRsvps({}); return undefined; }
    let cancelled = false;
    (async () => {
      const [countsMap, mineMap] = await Promise.all([
        fetchRsvpCounts(ids).catch(() => ({})),
        isAuthenticated && currentUser?.id
          ? fetchMyRsvps(currentUser.id, ids).catch(() => ({}))
          : Promise.resolve({}),
      ]);
      if (!cancelled) { setRsvpCounts(countsMap); setMyRsvps(mineMap); }
    })();
    return () => { cancelled = true; };
  }, [events, isAuthenticated, currentUser?.id]);

  // Stable per-event { counts, myRole } objects so a card's <EventRsvp> only
  // re-syncs when its data actually changes (not on search/filter re-renders).
  const rsvpDataById = useMemo(() => {
    const map = {};
    for (const e of events) {
      map[e.id] = { counts: rsvpCounts[e.id] || emptyCounts(), myRole: myRsvps[e.id] ?? null };
    }
    return map;
  }, [events, rsvpCounts, myRsvps]);

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      const term = searchTerm.toLowerCase();
      const matchSearch = !searchTerm ||
        e.title?.toLowerCase().includes(term) ||
        e.venue_name?.toLowerCase().includes(term) ||
        e.suburb?.toLowerCase().includes(term) ||
        e.description?.toLowerCase().includes(term);

      const matchState = filterState === 'all' || e.state === filterState;
      const matchType = filterType === 'all' || e.event_type === filterType;

      const eventDate = e.start_date ? parseDate(e.start_date) : null;
      const matchStart = !startDate || !eventDate || eventDate >= parseDate(startDate);
      const matchEnd = !endDate || !eventDate || eventDate <= new Date(endDate + 'T23:59:59');
      // An archived (completed) event belongs in the past view whatever its date.
      const matchDate = (showPast && e.status === 'completed') || (matchStart && matchEnd);

      return matchSearch && matchState && matchType && matchDate;
    });
  }, [events, searchTerm, filterState, filterType, startDate, endDate, showPast]);

  const groupedEvents = useMemo(() => {
    const groups = {};
    filteredEvents.forEach(event => {
      const parsed = event.start_date ? parseDate(event.start_date) : null;
      const key = parsed ? format(parsed, 'MMMM yyyy') : 'Date TBA';
      if (!groups[key]) groups[key] = [];
      groups[key].push(event);
    });
    return groups;
  }, [filteredEvents]);

  const hasActiveFilters = searchTerm || filterState !== 'all' || filterType !== defaultType ||
    startDate !== defaultStart || endDate !== defaultEnd;

  const clearFilters = () => {
    setSearchTerm('');
    setFilterState('all');
    setFilterType(defaultType);
    setStartDate(defaultStart);
    setEndDate(defaultEnd);
  };

  const dateInputClass = 'flex h-11 w-full min-w-0 appearance-none items-center rounded-xl border border-border bg-background px-3 text-left text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-date-and-time-value]:text-left';

  const structuredData = useMemo(() => {
    if (showPast) return null;
    const upcoming = events
      .filter(e => e.start_date && new Date(e.start_date) >= new Date(todayStr))
      .slice(0, 25);
    if (upcoming.length === 0) return null;
    return buildEventListJsonLd(upcoming);
  }, [events, showPast]);

  const seo = TYPE_SEO[defaultType] || ALL_SEO;

  return (
    <div className="flex flex-col bg-background font-sans min-h-screen">
      <SEOHead
        title={seo.title}
        description={seo.description}
        canonicalUrl={`${SITE_URL}${seo.path}`}
        structuredData={structuredData}
      />

      {/* Hero */}
      <section className="bg-card border-b border-border py-20 text-center">
        <div className="container-default">
          <CalendarDays className="w-12 h-12 text-primary mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{seo.heading}</h1>
          <Badge variant="outline" className="mb-4 text-xs font-semibold tracking-widest uppercase border-primary/40 text-primary px-3 py-1">
            Event Calendar
          </Badge>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{seo.subheading}</p>
        </div>
      </section>

      <div className="flex-1 max-w-[90rem] mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 py-10 w-full space-y-5">

        {/* Filter Bar */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <div className="flex flex-col lg:flex-row gap-3">

            {/* Search */}
            <div className="flex-1 min-w-0">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1.5">
                <Search className="w-3.5 h-3.5" /> Search Events
              </label>
              <Input
                placeholder="Search by event name, location, or keywords..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="h-11 bg-background border-border rounded-xl"
              />
            </div>

            {/* State */}
            <div className="w-full lg:w-40">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1.5">
                <MapPin className="w-3.5 h-3.5" /> State
              </label>
              <Select value={filterState} onValueChange={setFilterState}>
                <SelectTrigger className="h-11 bg-background border-border rounded-xl">
                  <SelectValue placeholder="All States" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  {AU_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Event Type */}
            <div className="w-full lg:w-44">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5" /> Event Type
              </label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-11 bg-background border-border rounded-xl">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div className="w-full lg:w-40">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1.5">
                <CalendarDays className="w-3.5 h-3.5" /> Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className={dateInputClass}
              />
            </div>

            {/* End Date */}
            <div className="w-full lg:w-40">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1.5">
                <CalendarDays className="w-3.5 h-3.5" /> End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className={dateInputClass}
              />
            </div>

            {/* Past events toggle */}
            <div className="w-full lg:w-36 shrink-0">
              <label htmlFor="show-past-events" className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1.5">
                <History className="w-3.5 h-3.5" /> Past Events
              </label>
              <div className="flex h-11 items-center gap-2.5 rounded-xl border border-border bg-background px-3">
                <Switch id="show-past-events" checked={showPast} onCheckedChange={setShowPast} aria-label="Show past events" />
                <span className="text-sm font-medium">{showPast ? 'Showing' : 'Hidden'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Results count + clear */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing{' '}
            <span className="font-semibold text-foreground">{filteredEvents.length}</span>{' '}
            {showPast ? 'past' : 'upcoming'} event{filteredEvents.length !== 1 ? 's' : ''}
            {showPast && (
              <span className="hidden sm:inline"> — been to one? Open it to read and leave reviews.</span>
            )}
          </p>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" /> Clear filters
            </Button>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="flex flex-col gap-4 bg-card p-4 rounded-2xl border border-border shadow-sm">
                <Skeleton className="aspect-video w-full rounded-xl" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-24 bg-card rounded-3xl border border-dashed border-border">
            <CalendarDays className="w-12 h-12 text-destructive mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-bold mb-2">Connection Issue</h3>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button onClick={fetchEvents} variant="outline">Retry</Button>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-24 bg-card rounded-3xl border border-dashed border-border">
            <CalendarDays className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
            <h3 className="text-xl font-bold mb-2">No {showPast ? 'past' : 'upcoming'} events found</h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              {showPast
                ? 'No finished events match your selected criteria. Try widening the dates.'
                : 'There are currently no approved events matching your selected criteria.'}
            </p>
            <Button onClick={clearFilters}>Clear All Filters</Button>
          </div>
        ) : (
          <div className="space-y-14">
            {Object.entries(groupedEvents).map(([monthYear, monthEvents]) => (
              <section key={monthYear}>
                <div className="flex items-center gap-4 mb-6">
                  <h2 className="text-2xl font-bold whitespace-nowrap">{monthYear}</h2>
                  <div className="flex-1 h-px bg-border" />
                  <Badge variant="secondary">{monthEvents.length}</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {monthEvents.map(event => (
                    <EventCard
                      key={event.id}
                      event={event}
                      isAdmin={false}
                      rsvpData={rsvpDataById[event.id]}
                      reviewStats={reviewStats[event.id]}
                      onView={ev => { setSelectedEvent(ev); setIsDetailOpen(true); }}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* SEO content */}
      <section className="border-t border-border bg-card">
        <div className="max-w-[90rem] mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 py-14 grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold mb-4">Find a Card Show Near You</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              CardPop tracks trading card shows, TCG expos and collector fairs across every Australian
              state — from major events like TCXPO at Oran Park and the Oz National Trading Card Show
              at Marvel Stadium, to local fairs in Sydney, Melbourne, Brisbane, Adelaide and Perth.
              Whether you collect Pokémon, Magic: The Gathering, One Piece, Yu-Gi-Oh! or sports cards
              (NBA, NRL, AFL, soccer and more), use the filters above to find an event near you.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Event details can change — always confirm dates, times and ticket prices with the
              organiser before travelling.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-4">Running a Card Event?</h2>
            <p className="text-muted-foreground leading-relaxed">
              Organising a card show, tournament or trade night in Australia? List it on CardPop for
              free and reach collectors across Australia. Sign in and submit your event
              from <Link to="/account/events" className="text-primary font-semibold hover:underline">My Events</Link> in
              your account — every submission is reviewed before it appears on the calendar. Between
              shows, explore the <Link to="/marketplace" className="text-primary font-semibold hover:underline">CardPop marketplace</Link> to
              buy and sell.
            </p>
          </div>
        </div>
      </section>

      <EventDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        event={selectedEvent}
      />
    </div>
  );
};

export default CommunityEventsPage;
