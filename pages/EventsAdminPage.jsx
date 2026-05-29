
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Calendar, MapPin, ImageOff, Loader2, Wand2 } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabaseClient.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import EventScraperPanel from '@/components/EventScraperPanel.jsx';

const EventsAdminPage = () => {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScraperOpen, setIsScraperOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);
  const [isScrapedData, setIsScrapedData] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_date: '',
    venue_name: '',
    status: 'pending_review',
  });
  const [imageFile, setImageFile] = useState(null);

  // Fetch events
  useEffect(() => {
    fetchEvents();

    const channel = supabase.channel('events-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, payload => {
        const record = payload.new;
        if (payload.eventType === 'INSERT') {
          setEvents(prev => [record, ...prev].sort((a, b) => new Date(b.start_date) - new Date(a.start_date)));
        } else if (payload.eventType === 'UPDATE') {
          setEvents(prev => prev.map(ev => ev.id === record.id ? record : ev).sort((a, b) => new Date(b.start_date) - new Date(a.start_date)));
        } else if (payload.eventType === 'DELETE') {
          setEvents(prev => prev.filter(ev => ev.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('events')
        .select('*')
        .order('start_date', { ascending: false });
      if (fetchError) throw fetchError;
      setEvents(data || []);
    } catch (err) {
      console.error('Failed to fetch events:', err);
      toast.error('Failed to load events.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      start_date: '',
      venue_name: '',
      status: 'pending_review',
    });
    setImageFile(null);
    setEditingEventId(null);
    setIsScrapedData(false);
  };

  const handleOpenModal = (event = null, scrapedData = null) => {
    if (event) {
      setEditingEventId(event.id);
      setFormData({
        title: event.title,
        description: event.description || '',
        start_date: event.start_date ? event.start_date.split('T')[0] : '',
        venue_name: event.venue_name,
        status: event.status,
      });
      setImageFile(null);
      setIsScrapedData(false);
    } else if (scrapedData) {
      setEditingEventId(null);
      setFormData({
        title: scrapedData.name || scrapedData.title || '',
        description: scrapedData.description || '',
        start_date: scrapedData.date ? scrapedData.date.split('T')[0] : '',
        venue_name: scrapedData.location || scrapedData.venue_name || '',
        status: 'pending_review',
      });
      setImageFile(null);
      setIsScrapedData(true);
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleStatusToggle = (checked) => {
    setFormData(prev => ({ ...prev, status: checked ? 'approved' : 'pending_review' }));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setImageFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.start_date || !formData.venue_name) {
      toast.error('Name, Date, and Location are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        venue_name: formData.venue_name,
        status: formData.status,
        start_date: formData.start_date,
      };

      if (editingEventId) {
        const { error: updateError } = await supabase.from('events').update(payload).eq('id', editingEventId);
        if (updateError) throw updateError;
        toast.success('Event updated successfully.');
      } else {
        const { error: insertError } = await supabase.from('events').insert(payload);
        if (insertError) throw insertError;
        toast.success('Event created successfully.');
      }
      handleCloseModal();
    } catch (err) {
      console.error('Error saving event:', err);
      toast.error('Failed to save event. Check console for details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickToggleStatus = async (event, currentStatus) => {
    const newStatus = currentStatus === 'approved' ? 'pending_review' : 'approved';
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
    if (window.confirm(`Are you sure you want to delete "${event.title}"? This action cannot be undone.`)) {
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
    <div className="min-h-screen bg-background text-foreground py-12">
      <Helmet>
        <title>Admin - Manage Events | CardPop</title>
      </Helmet>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Event Management</h1>
            <p className="text-muted-foreground">Create, update, and manage community events and trade shows.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button onClick={() => setIsScraperOpen(true)} variant="outline" className="font-bold rounded-xl h-11 px-4 shadow-sm">
              <Wand2 className="w-4 h-4 mr-2" />
              Scrape Event
            </Button>
            <Button onClick={() => handleOpenModal()} className="font-bold rounded-xl h-11 px-6 shadow-sm">
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
                <thead className="text-xs text-muted-foreground uppercase bg-background border-b border-border">
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
                            {event.image_url ? (
                              <img
                                src={event.image_url}
                                alt={event.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <ImageOff className="w-4 h-4 text-muted-foreground/50" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-foreground text-base leading-tight">
                              {event.title}
                            </p>
                            <p className="text-muted-foreground text-xs mt-1 font-medium md:hidden">
                              {event.start_date ? format(new Date(event.start_date), 'MMM d, yyyy') : 'TBA'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <div className="flex flex-col gap-1.5">
                          <span className="flex items-center text-foreground font-medium">
                            <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                            {event.start_date ? format(new Date(event.start_date), 'MMMM do, yyyy') : 'TBA'}
                          </span>
                          <span className="flex items-center text-muted-foreground text-xs font-medium">
                            <MapPin className="w-4 h-4 mr-2" />
                            {event.venue_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={event.status === 'approved'}
                            onCheckedChange={() => handleQuickToggleStatus(event, event.status)}
                          />
                          <Badge variant={event.status === 'approved' ? 'default' : 'secondary'} className="capitalize font-bold shadow-sm">
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
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px] bg-card border-border rounded-3xl p-8">
          <form onSubmit={handleSubmit}>
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-serif font-bold text-foreground flex items-center gap-3">
                {editingEventId ? 'Edit Event' : 'Create New Event'}
                {isScrapedData && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-xs font-sans">
                    <Wand2 className="w-3 h-3 mr-1" /> Pre-filled from scraped data
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="text-base text-muted-foreground font-medium">
                Fill in the details below to {editingEventId ? 'update the' : 'create a new'} community event.
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-6 py-2 mb-8">
              <div className="grid gap-2">
                <Label htmlFor="title" className="font-bold">Event Name *</Label>
                <Input
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  className="bg-background text-foreground border-border rounded-xl h-11"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="start_date" className="font-bold">Date *</Label>
                  <Input
                    id="start_date"
                    name="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={handleInputChange}
                    required
                    className="bg-background text-foreground border-border rounded-xl h-11"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="venue_name" className="font-bold">Location *</Label>
                  <Input
                    id="venue_name"
                    name="venue_name"
                    placeholder="e.g. Sydney Convention Centre"
                    value={formData.venue_name}
                    onChange={handleInputChange}
                    required
                    className="bg-background text-foreground border-border rounded-xl h-11"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description" className="font-bold">Description</Label>
                <Textarea 
                  id="description" 
                  name="description" 
                  rows={4}
                  value={formData.description} 
                  onChange={handleInputChange}
                  className="bg-background text-foreground border-border rounded-xl resize-none"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="image" className="font-bold">Cover Image (Optional)</Label>
                <Input 
                  id="image" 
                  name="image" 
                  type="file" 
                  accept="image/*"
                  onChange={handleFileChange}
                  className="bg-background text-foreground cursor-pointer border-border rounded-xl file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                />
                <p className="text-xs text-muted-foreground font-medium">Max size: 20MB. Formats: JPG, PNG, WEBP.</p>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-border mt-2">
                <Switch
                  id="status"
                  checked={formData.status === 'approved'}
                  onCheckedChange={handleStatusToggle}
                />
                <Label htmlFor="status" className="font-bold cursor-pointer text-base">
                  {formData.status === 'approved' ? 'Approved (Visible to public)' : 'Pending Review (Hidden)'}
                </Label>
              </div>
            </div>

            <DialogFooter className="gap-3 sm:gap-0">
              <Button type="button" variant="ghost" onClick={handleCloseModal} disabled={isSubmitting} className="rounded-xl font-bold text-muted-foreground hover:text-foreground">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="rounded-xl font-bold shadow-md">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Event'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <EventScraperPanel
        isOpen={isScraperOpen}
        onClose={() => setIsScraperOpen(false)}
        onSaved={(data) => handleOpenModal(null, data)}
      />
    </div>
  );
};

export default EventsAdminPage;
