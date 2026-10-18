import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Calendar, MapPin, ImageOff, Wand2, Star, Radar, Users, ClipboardPen, Search, X, ArrowUp, ArrowDown, ArrowUpDown, ChevronRight } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabaseClient.js';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EventScraperPanel from '@/components/EventScraperPanel.jsx';
import EventScanPanel from '@/components/EventScanPanel.jsx';
import EventFormModal from '@/components/EventFormModal.jsx';
import EventRsvpListDialog from '@/components/admin/EventRsvpListDialog.jsx';
import { toCdnUrl } from '@/utils/imageUrl.js';
import { toLocalDateStr } from '@/lib/eventSeo.js';
import {
  filterEvents, groupEventsByTiming, defaultSortDir,
  EVENT_STATUS_OPTIONS, EVENT_TYPE_OPTIONS, EVENT_STATE_OPTIONS, EVENT_SOURCE_OPTIONS, EVENT_SORT_OPTIONS,
} from '@/utils/adminEventList.js';

const STATUS_STYLES = {
  pending_review: 'bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-400',
  cancelled:      'bg-muted text-muted-foreground border-border',
  completed:      'bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-400',
  rejected:       'bg-destructive/10 text-destructive border-destructive/20',
};

const STATUS_LABELS = {
  pending_review: 'Pending',
  cancelled:      'Cancelled',
  completed:      'Completed',
  rejected:       'Rejected',
};

const fmtLocation = (ev) =>
  [ev.venue_name, ev.suburb, ev.state].filter(Boolean).join(', ') || 'Location TBA';

// Two views over the same list: everything, or just what the nightly scan found
// and hasn't been reviewed yet — which is the queue an admin actually works.
const FILTERS = {
  all: () => true,
  discovered: (ev) => ev.auto_discovered && ev.status === 'pending_review',
};

// Search / filter / sort state lives in the URL so a refresh, the back button
// or a shared link lands on the same view. A param at its default is dropped.
const PARAM_DEFAULTS = { q: '', status: 'all', type: 'all', state: 'all', source: 'all', sort: 'date', dir: 'desc' };
const FILTER_PARAMS = ['status', 'type', 'state', 'source'];

// Which of the Current & upcoming / Past sections the admin has collapsed. A
// per-browser convenience, so it lives in localStorage (which can throw or
// be empty in private windows — fall back to both open).
const COLLAPSED_STORAGE_KEY = 'cardpop.admin.events.collapsed';
const loadCollapsed = () => {
  try {
    const raw = window.localStorage.getItem(COLLAPSED_STORAGE_KEY);
    const keys = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(keys) ? keys : []);
  } catch {
    return new Set();
  }
};
const saveCollapsed = (set) => {
  try {
    window.localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify([...set]));
  } catch { /* storage unavailable — collapse state just won't persist */ }
};

// Sortable table columns. `key` is a sortEvents() key.
const COLUMNS = [
  { key: 'title', label: 'Event' },
  { key: 'date', label: 'Date & Location', className: 'hidden md:table-cell' },
  { key: 'status', label: 'Status' },
];

// How long a row the admin has just published stays in the "Found by scan"
// list before it leaves. Without this the row vanishes on the same render
// that flips its toggle, so the next event slides up under the cursor with
// its own grey toggle and Pending badge, and it looks as if nothing happened.
export const PUBLISHED_ROW_LINGER_MS = 1200;

const EventsManagementPage = () => {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScraperOpen, setIsScraperOpen] = useState(false);
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [editingEvent, setEditingEvent] = useState(null);
  const [scrapedData, setScrapedData] = useState(null);
  const [rsvpEvent, setRsvpEvent] = useState(null);
  // Ids of rows published from the "Found by scan" view that are still shown
  // there (toggle on, fading) until their linger timer removes them.
  const [lingeringIds, setLingeringIds] = useState(() => new Set());
  const lingerTimers = useRef(new Map());
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const toggleCollapsed = (key) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    saveCollapsed(next);
    return next;
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const param = (k) => searchParams.get(k) || PARAM_DEFAULTS[k];
  const setParams = (updates) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(updates)) {
        if (v === undefined || v === null || v === PARAM_DEFAULTS[k]) next.delete(k);
        else next.set(k, v);
      }
      return next;
    }, { replace: true });
  };
  const searchTerm = param('q');
  const listFilters = { search: searchTerm, status: param('status'), type: param('type'), state: param('state'), source: param('source') };
  const sortKey = param('sort');
  const sortDir = param('dir');
  const activeFilterCount = FILTER_PARAMS.filter((k) => listFilters[k] !== 'all').length + (searchTerm ? 1 : 0);
  const clearFilters = () => setParams({ q: null, status: null, type: null, state: null, source: null });
  const toggleSort = (key) => {
    if (sortKey === key) setParams({ dir: sortDir === 'asc' ? 'desc' : 'asc' });
    else setParams({ sort: key, dir: defaultSortDir(key) });
  };

  useEffect(() => {
    const timers = lingerTimers.current;
    return () => { timers.forEach(clearTimeout); timers.clear(); };
  }, []);

  useEffect(() => {
    fetchEvents();

    const channel = supabase.channel(`events-management-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setEvents(prev => [payload.new, ...prev].sort((a, b) => new Date(b.start_date) - new Date(a.start_date)));
        } else if (payload.eventType === 'UPDATE') {
          setEvents(prev => prev.map(ev => ev.id === payload.new.id ? payload.new : ev));
        } else if (payload.eventType === 'DELETE') {
          setEvents(prev => prev.filter(ev => ev.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('events').select('*').order('start_date', { ascending: false });
      if (error) throw error;
      setEvents(data ?? []);
    } catch (err) {
      toast.error('Failed to load events.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (event = null) => {
    setEditingEvent(event);
    setScrapedData(null);
    setIsModalOpen(true);
  };

  const handleScraperSuccess = (extractedData) => {
    setIsScraperOpen(false);
    setEditingEvent(null);
    setScrapedData(extractedData);
    setIsModalOpen(true);
  };

  const lingerRow = useCallback((id) => {
    setLingeringIds(prev => new Set(prev).add(id));
    clearTimeout(lingerTimers.current.get(id));
    lingerTimers.current.set(id, setTimeout(() => {
      lingerTimers.current.delete(id);
      setLingeringIds(prev => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, PUBLISHED_ROW_LINGER_MS));
  }, []);

  const handleQuickTogglePublished = async (event) => {
    const newStatus = event.status === 'approved' ? 'cancelled' : 'approved';
    try {
      const { data, error } = await supabase
        .from('events')
        .update({ status: newStatus })
        .eq('id', event.id)
        .select('id');
      if (error) throw error;
      // RLS answers a forbidden update with zero rows and no error — don't
      // claim success (or hide the row) when nothing actually changed.
      if (!data || data.length === 0) throw new Error('No rows updated');
      // Optimistically update locally so the row reflects the change even if the
      // realtime subscription isn't delivering events. Idempotent with the
      // realtime UPDATE handler (both key by id).
      setEvents(prev => prev.map(ev => ev.id === event.id ? { ...ev, status: newStatus } : ev));
      // In the scan queue the row would otherwise leave on this same render:
      // keep it for a beat so the admin sees the toggle go green first.
      if (filter === 'discovered' && newStatus === 'approved') lingerRow(event.id);
      toast.success(`Event ${newStatus === 'approved' ? 'published' : 'unpublished'}.`);
    } catch (err) {
      toast.error('Failed to update event status.');
    }
  };

  const handleDelete = async (event) => {
    if (window.confirm(`Are you sure you want to delete "${event.title}"? This cannot be undone.`)) {
      try {
        const { error } = await supabase.from('events').delete().eq('id', event.id);
        if (error) throw error;
        // Optimistically remove locally in case realtime isn't delivering events.
        // Idempotent with the realtime DELETE handler (both filter by id).
        setEvents(prev => prev.filter(ev => ev.id !== event.id));
        toast.success('Event deleted.');
      } catch (err) {
        toast.error('Failed to delete event.');
      }
    }
  };

  const discoveredCount = events.filter(FILTERS.discovered).length;
  const queueEvents = events.filter(
    filter === 'discovered'
      ? (ev) => FILTERS.discovered(ev) || lingeringIds.has(ev.id)
      : FILTERS[filter]
  );
  // Search, dropdown filters and sort apply on top of the queue view, and the
  // result is split into Current & upcoming / Past. `today` is the admin's
  // local date so the split matches the public calendar.
  const sections = useMemo(
    () => {
      const today = toLocalDateStr(new Date());
      return groupEventsByTiming(filterEvents(queueEvents, listFilters, { today }), sortKey, sortDir, { today });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- listFilters/sortKey/sortDir all derive from searchParams
    [events, filter, lingeringIds, searchParams],
  );
  const visibleCount = sections.reduce((n, s) => n + s.events.length, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Helmet><title>Manage Events | Admin Portal</title></Helmet>

      <AdminPageHeader
        icon={Calendar}
        title="Event Management"
        subtitle="Create, update, and manage community events."
      >
        <Button onClick={() => setIsScanOpen(true)} variant="outline" className="font-bold rounded-xl h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
          <Radar className="w-4 h-4 mr-2" /> Automated Scan
          {discoveredCount > 0 && (
            <span className="ml-2 rounded-full bg-brand-red px-1.5 text-xs font-bold leading-5">{discoveredCount}</span>
          )}
        </Button>
        <Button onClick={() => setIsScraperOpen(true)} variant="outline" className="font-bold rounded-xl h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
          <Wand2 className="w-4 h-4 mr-2" /> AI Event Scraper
        </Button>
        <Button onClick={() => handleOpenModal()} variant="outline" className="font-bold rounded-xl h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
          <Plus className="w-5 h-5 mr-2" /> Create Event
        </Button>
      </AdminPageHeader>

      {discoveredCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
            className="rounded-lg font-bold"
          >
            All events ({events.length})
          </Button>
          <Button
            variant={filter === 'discovered' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('discovered')}
            className="rounded-lg font-bold"
          >
            <Radar className="w-3.5 h-3.5 mr-1.5" /> Found by scan ({discoveredCount})
          </Button>
        </div>
      )}

      <div className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/20 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="search"
              name="admin-event-search"
              aria-label="Search events"
              placeholder="Search by title, venue, suburb, organiser or tag..."
              className="pl-9 h-10 rounded-xl bg-background border-border text-foreground"
              value={searchTerm}
              onChange={(e) => setParams({ q: e.target.value })}
            />
          </div>
          <FilterSelect label="Status" value={listFilters.status} onChange={(v) => setParams({ status: v })} options={EVENT_STATUS_OPTIONS} allLabel="All statuses" />
          <FilterSelect label="State" value={listFilters.state} onChange={(v) => setParams({ state: v })} options={EVENT_STATE_OPTIONS} allLabel="All states" width="w-[130px]" />
          <FilterSelect label="Type" value={listFilters.type} onChange={(v) => setParams({ type: v })} options={EVENT_TYPE_OPTIONS} allLabel="All types" />
          <FilterSelect label="Source" value={listFilters.source} onChange={(v) => setParams({ source: v })} options={EVENT_SOURCE_OPTIONS} allLabel="Any source" />
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" className="gap-1 h-10 rounded-xl text-muted-foreground" onClick={clearFilters}>
              <X className="w-4 h-4" /> Clear ({activeFilterCount})
            </Button>
          )}
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
              {visibleCount} of {queueEvents.length}
            </span>
            <Select value={sortKey} onValueChange={(v) => setParams({ sort: v, dir: defaultSortDir(v) })}>
              <SelectTrigger aria-label="Sort events by" className="h-10 w-[150px] rounded-xl bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {EVENT_SORT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-10 w-10 rounded-xl p-0"
              onClick={() => setParams({ dir: sortDir === 'asc' ? 'desc' : 'asc' })}
              aria-label={sortDir === 'asc' ? 'Sorted ascending — switch to descending' : 'Sorted descending — switch to ascending'}
              title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortDir === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl bg-background" />)}
            </div>
          ) : visibleCount === 0 ? (
            <div className="text-center py-20 px-4">
              <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-bold mb-2 text-foreground">
                {activeFilterCount > 0 ? 'No events match' : 'No events found'}
              </h3>
              <p className="text-muted-foreground mb-6">
                {activeFilterCount > 0
                  ? 'Nothing matches your search and filters.'
                  : filter === 'discovered'
                    ? 'The scan has nothing waiting for review.'
                    : "You haven't created any events yet."}
              </p>
              {activeFilterCount > 0 ? (
                <Button onClick={clearFilters} variant="outline" className="rounded-xl font-bold">
                  <X className="w-4 h-4 mr-2" /> Clear filters
                </Button>
              ) : (
                <div className="flex justify-center gap-3">
                  <Button onClick={() => setIsScraperOpen(true)} variant="outline" className="rounded-xl font-bold">
                    <Wand2 className="w-4 h-4 mr-2" /> Scrape from URL
                  </Button>
                  <Button onClick={() => handleOpenModal()} className="rounded-xl font-bold">
                    Create your first event
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/20 border-b border-border">
                <tr>
                  {COLUMNS.map((col) => {
                    const active = sortKey === col.key;
                    const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
                    return (
                      <th
                        key={col.key}
                        className={`px-6 py-4 font-bold whitespace-nowrap ${col.className || ''}`}
                        aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      >
                        <button type="button" onClick={() => toggleSort(col.key)} className="inline-flex items-center gap-1 uppercase hover:text-primary">
                          {col.label}
                          <Icon className={`w-3.5 h-3.5 ${active ? 'text-primary' : 'text-muted-foreground/60'}`} />
                        </button>
                      </th>
                    );
                  })}
                  <th className="px-6 py-4 font-bold whitespace-nowrap text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sections.map(({ key, label, events: rows }) => {
                  const open = !collapsed.has(key);
                  return (
                  <React.Fragment key={key}>
                  <tr className="bg-muted/60 hover:bg-muted/80" data-section={key}>
                    <td colSpan={4} className="p-0">
                      <button
                        type="button"
                        onClick={() => toggleCollapsed(key)}
                        aria-expanded={open}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-foreground"
                      >
                        <ChevronRight aria-hidden="true" className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
                        {label} <span className="font-semibold text-muted-foreground normal-case tracking-normal">· {rows.length}</span>
                      </button>
                    </td>
                  </tr>
                  {open && rows.map((event) => (
                  <tr
                    key={event.id}
                    data-lingering={lingeringIds.has(event.id) ? 'true' : undefined}
                    className={`hover:bg-muted/30 transition-opacity duration-700 ${lingeringIds.has(event.id) ? 'opacity-40' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-12 bg-background rounded-lg flex items-center justify-center shrink-0 overflow-hidden border border-border shadow-sm">
                          {event.image_url ? (
                            <img src={toCdnUrl(event.image_url)} alt={event.title} className="w-full h-full object-cover" />
                          ) : (
                            <ImageOff className="w-4 h-4 text-muted-foreground/50" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-foreground text-base leading-tight truncate">{event.title}</p>
                            {event.is_featured && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                            {event.auto_discovered && (
                              <Radar
                                className="w-3.5 h-3.5 text-muted-foreground shrink-0"
                                aria-label="Found by the automated scan"
                              />
                            )}
                          </div>
                          {event.short_description && (
                            <p className="text-muted-foreground text-xs mt-0.5 line-clamp-1">{event.short_description}</p>
                          )}
                          <p className="text-muted-foreground text-xs mt-1 font-medium md:hidden">
                            {event.start_date ? format(new Date(event.start_date), 'MMM d, yyyy') : 'TBA'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <div className="flex flex-col gap-1.5">
                        <span className="flex items-center text-foreground font-medium text-sm whitespace-nowrap">
                          <Calendar className="w-3.5 h-3.5 mr-1.5 text-muted-foreground shrink-0" />
                          {event.start_date ? format(new Date(event.start_date), 'MMMM d, yyyy') : 'TBA'}
                          {event.end_date && event.end_date !== event.start_date && (
                            <span className="text-muted-foreground ml-1">— {format(new Date(event.end_date), 'MMM d')}</span>
                          )}
                        </span>
                        <span className="flex items-center text-muted-foreground text-xs font-medium">
                          <MapPin className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                          <span className="truncate max-w-[180px]">{fmtLocation(event)}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={event.status === 'approved'}
                          onCheckedChange={() => handleQuickTogglePublished(event)}
                          disabled={event.status === 'completed' || event.status === 'rejected'}
                        />
                        {event.status !== 'approved' && (
                          <Badge
                            variant="outline"
                            className={`text-xs font-bold whitespace-nowrap ${STATUS_STYLES[event.status] || STATUS_STYLES.cancelled}`}
                          >
                            {STATUS_LABELS[event.status] || event.status}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRsvpEvent(event)}
                          className="rounded-lg shadow-sm"
                          title="Attendees & vendors"
                          aria-label={`Attendees and vendors for ${event.title}`}
                        >
                          <Users className="w-4 h-4" />
                        </Button>
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="rounded-lg shadow-sm"
                          title="Write a review of this event"
                        >
                          <Link to={`/admin/event-reviews/new?eventId=${event.id}`} aria-label={`Write a review of ${event.title}`}>
                            <ClipboardPen className="w-4 h-4" />
                          </Link>
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleOpenModal(event)} className="rounded-lg shadow-sm">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(event)} className="rounded-lg shadow-sm">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  ))}
                  </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>

      <EventFormModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingEvent(null); setScrapedData(null); }}
        event={editingEvent}
        scrapedData={scrapedData}
        onSaved={fetchEvents}
      />

      <EventScraperPanel
        isOpen={isScraperOpen}
        onClose={() => setIsScraperOpen(false)}
        onSaved={handleScraperSuccess}
      />

      <EventRsvpListDialog event={rsvpEvent} onClose={() => setRsvpEvent(null)} />

      <EventScanPanel
        isOpen={isScanOpen}
        onClose={() => setIsScanOpen(false)}
        onScanFinished={fetchEvents}
      />
    </div>
  );
};

const FilterSelect = ({ label, value, onChange, options, allLabel, width = 'w-[160px]' }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger aria-label={`Filter by ${label.toLowerCase()}`} className={`h-10 ${width} rounded-xl bg-background ${value !== 'all' ? 'border-primary text-foreground' : ''}`}>
      <SelectValue placeholder={allLabel} />
    </SelectTrigger>
    <SelectContent className="rounded-xl">
      <SelectItem value="all">{allLabel}</SelectItem>
      {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
    </SelectContent>
  </Select>
);

export default EventsManagementPage;
