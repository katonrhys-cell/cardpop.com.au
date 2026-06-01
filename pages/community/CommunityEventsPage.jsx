import React, { useState, useEffect, useMemo, useRef } from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { CalendarDays, Search, MapPin, SlidersHorizontal, X } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabaseClient.js';
import EventCard from '@/components/EventCard.jsx';
import EventDetailModal from '@/components/EventDetailModal.jsx';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const AU_STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];
const EVENT_TYPES = ['Tournament', 'Card Fair', 'Trade Show', 'Meetup', 'Convention', 'Expo', 'Other'];

const todayStr = new Date().toISOString().split('T')[0];
const nextYearStr = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

const CommunityEventsPage = () => {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterState, setFilterState] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(nextYearStr);

  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const isMounted = useRef(true);

  const fetchEvents = async () => {
    if (!isMounted.current) return;
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'approved')
        .order('start_date', { ascending: true });
      if (fetchError) throw fetchError;
      if (isMounted.current) setEvents(data || []);
    } catch (err) {
      console.error('Error fetching events:', err);
      if (isMounted.current) setError('Failed to load events. Please try again.');
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    fetchEvents();

    const channel = supabase.channel('community-events-full')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, payload => {
        if (!isMounted.current) return;
        const record = payload.new;
        if (payload.eventType === 'INSERT' && record.status === 'approved') {
          setEvents(prev => [...prev, record].sort((a, b) => new Date(a.start_date) - new Date(b.start_date)));
        } else if (payload.eventType === 'UPDATE') {
          setEvents(prev => {
            const rest = prev.filter(ev => ev.id !== record.id);
            if (record.status === 'approved') rest.push(record);
            return rest.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
          });
        } else if (payload.eventType === 'DELETE') {
          setEvents(prev => prev.filter(ev => ev.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      isMounted.current = false;
      supabase.removeChannel(channel);
    };
  }, []);

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

  const hasActiveFilters = searchTerm || filterState !== 'all' || filterType !== 'all' ||
    startDate !== todayStr || endDate !== nextYearStr;

  const clearFilters = () => {
    setSearchTerm('');
    setFilterState('all');
    setFilterType('all');
    setStartDate(todayStr);
    setEndDate(nextYearStr);
  };

  const dateInputClass = 'flex h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

  return (
    <div className="flex flex-col bg-background font-sans min-h-screen">
      <SEOHead title="Community Events | CardPop" description="Find TCG tournaments, card fairs, and collector shows happening across Australia." />

      {/* Hero — matches all other main section pages */}
      <section className="bg-card border-b border-border py-20 text-center">
        <div className="container-default">
          <CalendarDays className="w-12 h-12 text-primary mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Trading Card Events<br className="hidden sm:block" /> Across Australia
          </h1>
          <Badge variant="outline" className="mb-4 text-xs font-semibold tracking-widest uppercase border-primary/40 text-primary px-3 py-1">
            Event Calendar
          </Badge>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Your go-to directory for TCG tournaments, card fairs, and collector shows happening nationwide. Find events near you — from major expos to local meetups.
          </p>
        </div>
      </section>

      <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-5">

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
                  {EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
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
                      onView={ev => { setSelectedEvent(ev); setIsDetailOpen(true); }}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <EventDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        event={selectedEvent}
      />
    </div>
  );
};

export default CommunityEventsPage;
