
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/lib/supabaseClient.js';
import { compressImage } from '@/utils/compressImage.js';
import {
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  CalendarDays,
  Image as ImageIcon,
  MapPin,
  Clock,
  AlertCircle
} from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from 'sonner';

const EventsAdminPage = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    date: '',
    location: '',
    status: 'active'
  });
  const [imageFile, setImageFile] = useState(null);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.from('events').select('*').order('event_date', { ascending: false });
      if (error) throw error;
      setEvents(data ?? []);
    } catch (err) {
      setError("Failed to load events. Please try again.");
      toast.error("Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      date: '',
      location: '',
      status: 'active'
    });
    setImageFile(null);
    setSelectedEvent(null);
  };

  const handleCreate = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleEdit = (event) => {
    setSelectedEvent(event);
    setFormData({
      name: event.name || '',
      description: event.description || '',
      date: event.date ? event.date.split('T')[0] : '',
      location: event.location || '',
      status: event.status || 'active'
    });
    setImageFile(null);
    setIsFormOpen(true);
  };

  const handleDeleteConfirm = (event) => {
    setSelectedEvent(event);
    setIsDeleteDialogOpen(true);
  };

  const executeDelete = async () => {
    if (!selectedEvent) return;
    
    try {
      const { error } = await supabase.from('events').delete().eq('id', selectedEvent.id);
      if (error) throw error;
      toast.success("Event deleted successfully");
      setIsDeleteDialogOpen(false);
      fetchEvents();
    } catch (err) {
      toast.error(err.message || "Failed to delete event");
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.date || !formData.location) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      let image_url = selectedEvent?.image_url ?? null;
      if (imageFile) {
        const compressed = await compressImage(imageFile);
        const path = `events/${Date.now()}-${compressed.name}`;
        const { error: upErr } = await supabase.storage.from('events').upload(path, compressed, { upsert: true });
        if (!upErr) image_url = supabase.storage.from('events').getPublicUrl(path).data.publicUrl;
      }

      const payload = {
        title: formData.name,
        description: formData.description,
        event_date: formData.date ? new Date(formData.date).toISOString() : null,
        location: formData.location,
        status: formData.status,
        image_url,
      };

      if (selectedEvent) {
        const { error } = await supabase.from('events').update(payload).eq('id', selectedEvent.id);
        if (error) throw error;
        toast.success("Event updated successfully");
      } else {
        const { error } = await supabase.from('events').insert(payload);
        if (error) throw error;
        toast.success("Event created successfully");
      }
      
      setIsFormOpen(false);
      fetchEvents();
    } catch (err) {
      toast.error(err.message || "Failed to save event");
    } finally {
      setIsSubmitting(false);
    }
  };

  const EventRowSkeleton = () => (
    <TableRow>
      <TableCell><Skeleton className="h-10 w-16 rounded" /></TableCell>
      <TableCell><Skeleton className="h-5 w-48 mb-1" /><Skeleton className="h-4 w-32" /></TableCell>
      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
      <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
      <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto rounded-md" /></TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 animate-in fade-in duration-300">
      <Helmet>
        <title>Manage Events | Admin Portal</title>
      </Helmet>

      <AdminPageHeader
        icon={CalendarDays}
        title="Events Management"
        subtitle="Create and manage platform community events."
      >
        <Button onClick={handleCreate} variant="outline" className="font-semibold gap-2 rounded-xl h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
          <Plus className="w-4 h-4" /> Create Event
        </Button>
      </AdminPageHeader>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto w-full">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-[80px]">Image</TableHead>
                <TableHead>Event Details</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array(5).fill(0).map((_, i) => <EventRowSkeleton key={i} />)
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <AlertCircle className="w-10 h-10 text-destructive mb-3 opacity-80" />
                      <p className="font-medium text-foreground">{error}</p>
                      <Button variant="outline" onClick={fetchEvents} className="mt-4 rounded-xl">Retry</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <CalendarDays className="w-10 h-10 mb-3 opacity-20" />
                      <p className="font-medium text-foreground">No events found</p>
                      <p className="text-sm">Get started by creating a new event.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                events.map((event) => {
                  const eventDate = new Date(event.date);
                  const isPast = eventDate < new Date();
                  
                  return (
                    <TableRow key={event.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell>
                        {event.image ? (
                          <div className="w-16 h-10 rounded overflow-hidden border border-border bg-muted shrink-0 shadow-sm">
                            <img 
                              src={event.image_url || event.image} 
                              alt={event.name} 
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-16 h-10 rounded border border-border border-dashed bg-muted/50 flex items-center justify-center text-muted-foreground shrink-0">
                            <ImageIcon className="w-4 h-4 opacity-50" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-foreground line-clamp-1">{event.name}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {event.description || "No description"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium whitespace-nowrap">
                            {eventDate.toLocaleDateString()}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-start gap-1.5 max-w-[200px]">
                          <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                          <span className="text-sm truncate">{event.location}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="secondary"
                          className={event.status === 'active' ? (isPast ? 'bg-primary/10 text-primary border-primary/20' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20') : 'bg-muted text-muted-foreground'}
                        >
                          {event.status === 'active' ? (isPast ? 'Completed' : 'Active') : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted rounded-lg">
                              <MoreHorizontal className="w-4 h-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40 rounded-xl">
                            <DropdownMenuItem onClick={() => handleEdit(event)} className="cursor-pointer gap-2">
                              <Edit className="w-4 h-4" /> Edit Event
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeleteConfirm(event)} 
                              className="cursor-pointer gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                            >
                              <Trash2 className="w-4 h-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl bg-background border-border">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">{selectedEvent ? 'Edit Event' : 'Create New Event'}</DialogTitle>
            <DialogDescription>
              {selectedEvent ? 'Update the details for this event.' : 'Fill in the details to create a new event.'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleFormSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="name">Event Name <span className="text-destructive">*</span></Label>
              <Input 
                id="name" 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="e.g., Summer Trade Night"
                required
                className="bg-background rounded-xl h-11"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date <span className="text-destructive">*</span></Label>
                <Input 
                  id="date" 
                  type="date"
                  value={formData.date} 
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  required
                  className="bg-background rounded-xl h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(val) => setFormData({...formData, status: val})}>
                  <SelectTrigger className="bg-background rounded-xl h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location <span className="text-destructive">*</span></Label>
              <Input 
                id="location" 
                value={formData.location} 
                onChange={(e) => setFormData({...formData, location: e.target.value})}
                placeholder="e.g., Convention Center, NY"
                required
                className="bg-background rounded-xl h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea 
                id="description" 
                value={formData.description} 
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Details about the event..."
                className="bg-background rounded-xl min-h-[100px] resize-y"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="image">Event Image</Label>
              <Input 
                id="image" 
                type="file" 
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files[0])}
                className="bg-background rounded-xl file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer h-auto py-2"
              />
              {selectedEvent?.image && !imageFile && (
                <p className="text-xs text-muted-foreground mt-1">Current image will be kept if no new file is selected.</p>
              )}
            </div>

            <DialogFooter className="pt-4 border-t border-border mt-6">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} disabled={isSubmitting} className="rounded-xl h-11 px-6">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="rounded-xl h-11 px-6 font-bold">
                {isSubmitting ? 'Saving...' : (selectedEvent ? 'Save Changes' : 'Create Event')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl border-border bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{selectedEvent?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl h-10">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={executeDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl h-10 font-bold"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EventsAdminPage;
