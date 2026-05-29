import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Calendar, MapPin, ImageOff, Wand2 } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabaseClient.js';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import EventScraperPanel from '@/components/EventScraperPanel.jsx';
import EventFormModal from '@/components/EventFormModal.jsx';

const EventsManagementPage = () => {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScraperOpen, setIsScraperOpen] = useState(false);
  
  // Data state passed to modal
  const [editingEvent, setEditingEvent] = useState(null);
  const [scrapedData, setScrapedData] = useState(null);

  useEffect(() => {
    fetchEvents();

    const channel = supabase.channel('events-management')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setEvents(prev => [payload.new, ...prev].sort((a, b) => new Date(b.event_date) - new Date(a.event_date)));
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
      const { data, error } = await supabase.from('events').select('*').order('event_date', { ascending: false });
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

  const handleQuickToggleStatus = async (event, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      const { error } = await supabase.from('events').update({ status: newStatus }).eq('id', event.id);
      if (error) throw error;
      toast.success(`Event marked as ${newStatus}.`);
    } catch (err) {
      console.error('Failed to toggle status:', err);
      toast.error('Failed to update event status.');
    }
  };

  const handleDelete = async (event) => {
    if (window.confirm(`Are you sure you want to delete "${event.name}"? This action cannot be undone.`)) {
      try {
        const { error } = await supabase.from('events').delete().eq('id', event.id);
        if (error) throw error;
        toast.success('Event deleted successfully.');
      } catch (err) {
        console.error('Failed to delete event:', err);
        toast.error('Failed to delete event.');
      }
    }
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300 py-6 px-4 sm:px-6 md:px-8">
      <Helmet>
        <title>Manage Events | Admin Portal</title>
      </Helmet>
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Event Management</h1>
          <p className="text-muted-foreground mt-1">Create, update, and manage community events.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto shrink-0">
          <Button onClick={() => setIsScraperOpen(true)} variant="outline" className="font-bold rounded-xl h-11 px-4 shadow-sm flex-1 md:flex-auto">
            <Wand2 className="w-4 h-4 mr-2" />
            AI Event Scraper
          </Button>
          <Button onClick={() => handleOpenModal()} className="font-bold rounded-xl h-11 px-6 shadow-sm flex-1 md:flex-auto">
            <Plus className="w-5 h-5 mr-2" />
            Create Event
          </Button>
        </div>
      </div>

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
                          {event.image ? (
                            <img 
                              src={event.image_url || event.image} 
                              alt={event.name} 
                              className="w-full h-full object-cover" 
                            />
                          ) : (
                            <ImageOff className="w-4 h-4 text-muted-foreground/50" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-foreground text-base leading-tight">
                            {event.name}
                          </p>
                          <p className="text-muted-foreground text-xs mt-1 font-medium md:hidden">
                            {event.date ? format(new Date(event.date), 'MMM d, yyyy') : 'TBA'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <div className="flex flex-col gap-1.5">
                        <span className="flex items-center text-foreground font-medium">
                          <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                          {event.date ? format(new Date(event.date), 'MMMM do, yyyy') : 'TBA'}
                        </span>
                        <span className="flex items-center text-muted-foreground text-xs font-medium">
                          <MapPin className="w-4 h-4 mr-2" />
                          {event.location}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={event.status === 'active'}
                          onCheckedChange={() => handleQuickToggleStatus(event, event.status)}
                        />
                        <Badge variant={event.status === 'active' ? 'default' : 'secondary'} className="capitalize font-bold shadow-sm">
                          {event.status}
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
        onClose={() => {
          setIsModalOpen(false);
          setEditingEvent(null);
          setScrapedData(null);
        }}
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