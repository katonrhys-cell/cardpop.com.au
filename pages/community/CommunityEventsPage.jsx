import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead.jsx';
import { CalendarDays, Search, MapPin, SlidersHorizontal, X } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SITE_URL, EVENT_TYPE_LABELS, buildEventListJsonLd } from '@/lib/eventSeo.js';

const AU_STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];
const EVENT_TYPES = Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => ({ value, label }));

const todayStr = new Date().toISOString().split('T')[0];
const nextYearStr = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

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

  const [searchTerm, setSearchTerm] = useState('');
  const [filterState, setFilterState] = useState('all');
  const [filterType, setFilterType] = useState(defaultType);
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(nextYearStr);

  // Reset filter when the route changes between type pages
  useEffect(() => {
    setFilterType(defaultType);
  }, [defaultType]);

  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const isMounted = useRef(true);

  const fetchEvents = async () => {
    if (!isMounted.current) return;
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('events_public')
        .select('*')
        .order('start_date', { ascending: true });
      if (fetchError) throw fetchError;
      if (isMounted.current) setEvents(data || []);
    } catch (err) {
      if (isMounted.current) setError('Failed to load events. Please try again.');
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    fetchEvents();
    return () => { isMounted.current = false; };
  }, []);

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

      const eventDate = e.start_date ? new Date(e.start_date) : null;
      const matchStart = !startDate || !eventDate || eventDate >= new Date(startDate);
      const matchEnd = !endDate || !eventDate || eventDate <= new Date(endDate + 'T23:59:59');

      return matchSearch && matchState && matchType && matchStart && matchEnd;
    });
  }, [events, searchTerm, filterState, filterType, startDate, endDate]);

  const groupedEvents = useMemo(() => {
    const groups = {};
    filteredEvents.forEach(event => {
      const key = event.start_date ? format(new Date(event.start_date), 'MMMM yyyy') : 'Date TBA';
      if (!groups[key]) groups[key] = [];
      groups[key].push(event);
    });
    return groups;
  }, [filteredEvents]);

  const hasActiveFilters = searchTerm || filterState !== 'all' || filterType !== defaultType ||
    startDate !== todayStr || endDate !== nextYearStr;

  const clearFilters = () => {
    setSearchTerm('');
    setFilterState('all');
    setFilterType(defaultType);
    setStartDate(todayStr);
    setEndDate(nextYearStr);
  };

  const dateInputClass = 'flex h-11 w-full min-w-0 appearance-none items-center rounded-xl border border-border bg-background px-3 text-left text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-date-and-time-value]:text-left';

  const structuredData = useMemo(() => {
    const upcoming = events
      .filter(e => e.start_date && new Date(e.start_date) >= new Date(todayStr))
      .slice(0, 25);
    if (upcoming.length === 0) return null;
    return buildEventListJsonLd(upcoming);
  }, [events]);

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

      <div className="flex-1 max-w-[100rem] mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-5">

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
          </div>
        </div>

        {/* Results count + clear */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing{' '}
            <span className="font-semibold text-foreground">{filteredEvents.length}</span>{' '}
            approved event{filteredEvents.length !== 1 ? 's' : ''}
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
            <h3 className="text-xl font-bold mb-2">No upcoming events found</h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              There are currently no approved events matching your selected criteria.
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
        <div className="max-w-[100rem] mx-auto px-4 sm:px-6 lg:px-8 py-14 grid gap-10 md:grid-cols-2">
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
              free and reach thousands of collectors. Sign in and submit your event
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
