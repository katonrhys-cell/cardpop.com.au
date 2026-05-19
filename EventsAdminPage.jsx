
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Calendar, MapPin, ImageOff, Loader2, Wand2 } from 'lucide-react';
import { format } from 'date-fns';
import pb from '@/lib/pocketbaseClient.js';
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
    name: '',
    description: '',
    date: '',
    location: '',
    status: 'active',
  });
  const [imageFile, setImageFile] = useState(null);

  // Fetch events
  useEffect(() => {
    fetchEvents();

    pb.collection('events').subscribe('*', function (e) {
      if (e.action === 'create') {
        setEvents(prev => [e.record, ...prev].sort((a, b) => new Date(b.date) - new Date(a.date)));
      } else if (e.action === 'update') {
        setEvents(prev => prev.map(ev => ev.id === e.record.id ? e.record : ev).sort((a, b) => new Date(b.date) - new Date(a.date)));
      } else if (e.action === 'delete') {
        setEvents(prev => prev.filter(ev => ev.id !== e.record.id));
      }
    });

    return () => {
      pb.collection('events').unsubscribe('*');
    };
  }, []);

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const response = await pb.collection('events').getFullList({
        sort: '-date',
        $autoCancel: false,
      });
      setEvents(response);
    } catch (err) {
      console.error('Failed to fetch events:', err);
      toast.error('Failed to load events.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      date: '',
      location: '',
      status: 'active',
    });
    setImageFile(null);
    setEditingEventId(null);
    setIsScrapedData(false);
  };

  const handleOpenModal = (event = null, scrapedData = null) => {
    if (event) {
      setEditingEventId(event.id);
      setFormData({
        name: event.name,
        description: event.description || '',
        date: event.date ? event.date.split(' ')[0] : '', // Extract YYYY-MM-DD from PB date
        location: event.location,
        status: event.status,
      });
      setImageFile(null);
      setIsScrapedData(false);
    } else if (scrapedData) {
      setEditingEventId(null);
      setFormData({
        name: scrapedData.name || '',
        description: scrapedData.description || '',
        date: scrapedData.date ? scrapedData.date.split('T')[0] : '',
        location: scrapedData.location || '',
        status: 'active',
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
    setFormData(prev => ({ ...prev, status: checked ? 'active' : 'inactive' }));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setImageFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.date || !formData.location) {
      toast.error('Name, Date, and Location are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = new FormData();
      data.append('name', formData.name);
      data.append('description', formData.description);
      data.append('location', formData.location);
      data.append('status', formData.status);
      
      data.append('date', `${formData.date} 12:00:00.000Z`);

      if (imageFile) {
        data.append('image', imageFile);
      }

      if (editingEventId) {
        await pb.collection('events').update(editingEventId, data, { $autoCancel: false });
        toast.success('Event updated successfully.');
      } else {
        await pb.collection('events').create(data, { $autoCancel: false });
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
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      await pb.collection('events').update(event.id, { status: newStatus }, { $autoCancel: false });
      toast.success(`Event marked as ${newStatus}.`);
    } catch (err) {
      console.error('Failed to toggle status:', err);
      toast.error('Failed to update event status.');
    }
  };

  const handleDelete = async (event) => {
    if (window.confirm(`Are you sure you want to delete "${event.name}"? This action cannot be undone.`)) {
      try {
        await pb.collection('events').delete(event.id, { $autoCancel: false });
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
                            {event.image ? (
                              <img 
                                src={pb.files.getUrl(event, event.image)} 
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
                <Label htmlFor="name" className="font-bold">Event Name *</Label>
                <Input 
                  id="name" 
                  name="name" 
                  value={formData.name} 
                  onChange={handleInputChange} 
                  required 
                  className="bg-background text-foreground border-border rounded-xl h-11"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="date" className="font-bold">Date *</Label>
                  <Input 
                    id="date" 
                    name="date" 
                    type="date"
                    value={formData.date} 
                    onChange={handleInputChange} 
                    required
                    className="bg-background text-foreground border-border rounded-xl h-11"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="location" className="font-bold">Location *</Label>
                  <Input 
                    id="location" 
                    name="location" 
                    placeholder="e.g. Sydney Convention Centre"
                    value={formData.location} 
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
                  checked={formData.status === 'active'}
                  onCheckedChange={handleStatusToggle}
                />
                <Label htmlFor="status" className="font-bold cursor-pointer text-base">
                  {formData.status === 'active' ? 'Active (Visible to public)' : 'Inactive (Hidden)'}
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
