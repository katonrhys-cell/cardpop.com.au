import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Calendar, MapPin, ImageOff, Wand2, Star } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabaseClient.js';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import EventScraperPanel from '@/components/EventScraperPanel.jsx';
import EventFormModal from '@/components/EventFormModal.jsx';

const STATUS_STYLES = {
  approved:       'bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-400',
  pending_review: 'bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-400',
  cancelled:      'bg-muted text-muted-foreground border-border',
  completed:      'bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-400',
  rejected:       'bg-destructive/10 text-destructive border-destructive/20',
};

const STATUS_LABELS = {
  approved:       'Live',
  pending_review: 'Pending',
  cancelled:      'Cancelled',
  completed:      'Completed',
  rejected:       'Rejected',
};

const fmtLocation = (ev) =>
  [ev.venue_name, ev.suburb, ev.state].filter(Boolean).join(', ') || 'Location TBA';

const EventsManagementPage = () => {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScraperOpen, setIsScraperOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [scrapedData, setScrapedData] = useState(null);

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
      console.error('Failed to fetch events:', err);
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

  const handleQuickTogglePublished = async (event) => {
    const newStatus = event.status === 'approved' ? 'cancelled' : 'approved';
    try {
      const { error } = await supabase.from('events').update({ status: newStatus }).eq('id', event.id);
      if (error) throw error;
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
        toast.success('Event deleted.');
      } catch (err) {
        toast.error('Failed to delete event.');
      }
    }
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300 py-6 px-4 sm:px-6 md:px-8">
      <Helmet><title>Manage Events | Admin Portal</title></Helmet>

      <AdminPageHeader
        icon={Calendar}
        title="Event Management"
        subtitle="Create, update, and manage community events."
      >
        <Button onClick={() => setIsScraperOpen(true)} variant="outline" className="font-bold rounded-xl h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
          <Wand2 className="w-4 h-4 mr-2" /> AI Event Scraper
        </Button>
        <Button onClick={() => handleOpenModal()} variant="outline" className="font-bold rounded-xl h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
          <Plus className="w-5 h-5 mr-2" /> Create Event
        </Button>
      </AdminPageHeader>

      <div className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl bg-background" />)}
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-20 px-4">
              <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-bold mb-2 text-foreground">No events found</h3>
              <p className="text-muted-foreground mb-6">You haven't created any events yet.</p>
              <div className="flex justify-center gap-3">
                <Button onClick={() => setIsScraperOpen(true)} variant="outline" className="rounded-xl font-bold">
                  <Wand2 className="w-4 h-4 mr-2" /> Scrape from URL
                </Button>
                <Button onClick={() => handleOpenModal()} className="rounded-xl font-bold">
                  Create your first event
                </Button>
              </div>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/20 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-bold">Event</th>
                  <th className="px-6 py-4 font-bold hidden md:table-cell">Date & Location</th>
                  <th className="px-6 py-4 font-bold hidden sm:table-cell">Type</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                  <th className="px-6 py-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-12 bg-background rounded-lg flex items-center justify-center shrink-0 overflow-hidden border border-border shadow-sm">
                          {event.image_url ? (
                            <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
                          ) : (
                            <ImageOff className="w-4 h-4 text-muted-foreground/50" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-foreground text-base leading-tight truncate">{event.title}</p>
                            {event.is_featured && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}
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
                        <span className="flex items-center text-foreground font-medium text-sm">
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
                    <td className="px-6 py-4 hidden sm:table-cell">
                      <Badge variant="outline" className="capitalize text-xs font-medium">
                        {event.event_type?.replace(/_/g, ' ') || '—'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={event.status === 'approved'}
                          onCheckedChange={() => handleQuickTogglePublished(event)}
                          disabled={event.status === 'completed' || event.status === 'rejected'}
                        />
                        <Badge
                          variant="outline"
                          className={`text-xs font-bold ${STATUS_STYLES[event.status] || STATUS_STYLES.cancelled}`}
                        >
                          {STATUS_LABELS[event.status] || event.status}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
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
              </tbody>
            </table>
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
    </div>
  );
};

export default EventsManagementPage;
