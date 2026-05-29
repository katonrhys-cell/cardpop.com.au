import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, UploadCloud, X, Wand2, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { toast } from 'sonner';

const INITIAL_FORM_STATE = {
  name: '',
  description: '',
  date: '',
  time: '',
  location: '',
  status: 'active',
  category: '',
  type: '',
  price: '',
  capacity: '',
  organizer: '',
  contactEmail: '',
  contactPhone: '',
  contactWebsite: '',
  registrationLink: ''
};

const EventFormModal = ({ isOpen, onClose, event, scrapedData, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    if (scrapedData) {
      // Auto-populate from scraper AI output format
      setFormData({
        name: scrapedData.name || '',
        description: scrapedData.description || '',
        date: scrapedData.date ? scrapedData.date.split('T')[0] : '',
        time: scrapedData.time || '',
        location: scrapedData.location || '',
        status: 'active',
        category: scrapedData.category || '',
        type: scrapedData.type || '',
        price: scrapedData.price !== undefined && scrapedData.price !== null
          ? String(scrapedData.price)
          : '',
        capacity: scrapedData.capacity !== undefined && scrapedData.capacity !== null
          ? String(scrapedData.capacity)
          : '',
        organizer: scrapedData.organizer || '',
        contactEmail: scrapedData.contact?.email || '',
        contactPhone: scrapedData.contact?.phone || '',
        contactWebsite: scrapedData.contact?.website || '',
        registrationLink: scrapedData.registrationLink || ''
      });

      // Attempt to fetch the scraped image URL as a File for upload
      if (scrapedData.imageUrl) {
        fetch(scrapedData.imageUrl)
          .then(res => {
            if (!res.ok) throw new Error('Image fetch failed');
            return res.blob();
          })
          .then(blob => {
            const ext = blob.type.split('/')[1] || 'jpg';
            const file = new File([blob], `scraped-event.${ext}`, { type: blob.type });
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
          })
          .catch(() => {
            // Silently ignore — image stays blank if unreachable
          });
      } else {
        setImagePreview(null);
        setImageFile(null);
      }

      setRemoveExistingImage(false);
      setActiveTab('general');

    } else if (event) {
      // Populate from existing record
      let defaultDate = '';
      let defaultTime = '';
      if (event.date) {
        const d = new Date(event.date);
        const localDate = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
        defaultDate = localDate.split('T')[0];
        defaultTime = localDate.split('T')[1].substring(0, 5);
      }

      setFormData({
        ...INITIAL_FORM_STATE,
        name: event.name || '',
        description: event.description || '',
        date: defaultDate,
        time: defaultTime,
        location: event.location || '',
        status: event.status || 'active',
      });
      
      if (event.image_url || event.image) {
        setImagePreview(event.image_url || event.image);
      } else {
        setImagePreview(null);
      }
      
      setImageFile(null);
      setRemoveExistingImage(false);
      setActiveTab('general');

    } else {
      // Reset form
      setFormData(INITIAL_FORM_STATE);
      setImagePreview(null);
      setImageFile(null);
      setRemoveExistingImage(false);
      setActiveTab('general');
    }
  }, [isOpen, event, scrapedData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleStatusChange = (value) => {
    setFormData(prev => ({ ...prev, status: value }));
  };

  const handleClear = () => {
    setFormData(INITIAL_FORM_STATE);
    setImageFile(null);
    setImagePreview(null);
    setRemoveExistingImage(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    toast.info('Form cleared');
  };

  const processFile = (file) => {
    if (!file) return;
    if (file.size > 20971520) { // 20MB
      toast.error('Image exceeds 20MB limit.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Only image files are allowed.');
      return;
    }
    
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setRemoveExistingImage(false);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setRemoveExistingImage(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.date || !formData.location.trim()) {
      toast.error("Name, date, and location are required.");
      setActiveTab('general');
      return;
    }

    setLoading(true);
    try {
      const submitData = new FormData();
      submitData.append('name', formData.name);
      
      // Handle Date formatting for PocketBase
      let dateStr = formData.date;
      let timeStr = formData.time || '12:00';
      const eventDate = new Date(`${dateStr}T${timeStr}:00.000Z`); // Create ISO date
      
      if (isNaN(eventDate.getTime())) {
        throw new Error("Invalid date or time format.");
      }
      submitData.append('date', eventDate.toISOString());
      
      submitData.append('location', formData.location);
      submitData.append('status', formData.status);

      // Append extra metadata to the description field
      let fullDescription = formData.description || '';
      const extraDetails = [];
      
      if (formData.category) extraDetails.push(`**Category:** ${formData.category}`);
      if (formData.type) extraDetails.push(`**Type:** ${formData.type}`);
      if (formData.price) extraDetails.push(`**Price:** ${formData.price}`);
      if (formData.capacity) extraDetails.push(`**Capacity:** ${formData.capacity}`);
      if (formData.organizer) extraDetails.push(`**Organizer:** ${formData.organizer}`);
      if (formData.contactEmail) extraDetails.push(`**Email:** ${formData.contactEmail}`);
      if (formData.contactPhone) extraDetails.push(`**Phone:** ${formData.contactPhone}`);
      if (formData.contactWebsite) extraDetails.push(`**Website:** ${formData.contactWebsite}`);
      if (formData.registrationLink) extraDetails.push(`**Registration:** ${formData.registrationLink}`);

      if (extraDetails.length > 0) {
        fullDescription += '\n\n---\n### Additional Details\n' + extraDetails.join('\n');
      }
      
      submitData.append('description', fullDescription.trim());

      // Build plain object from submitData
      const eventData = {};
      submitData.forEach((value, key) => { eventData[key] = value; });

      // File upload logic — upload image to Supabase Storage if provided
      if (imageFile) {
        const ext = imageFile.name.split('.').pop();
        const path = `events/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('vault-images').upload(path, imageFile);
        if (!uploadError) {
          eventData.image_url = supabase.storage.from('vault-images').getPublicUrl(path).data.publicUrl;
        }
      } else if (removeExistingImage) {
        eventData.image_url = null;
      }
      delete eventData.image;

      if (event?.id) {
        const { error } = await supabase.from('events').update(eventData).eq('id', event.id);
        if (error) throw error;
        toast.success("Event updated successfully");
      } else {
        const { error } = await supabase.from('events').insert(eventData);
        if (error) throw error;
        toast.success("Event created successfully");
      }
      
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error("Error saving event:", err);
      toast.error(err.message || "Failed to save event");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !loading && !open && onClose()}>
      <DialogContent className="sm:max-w-[800px] w-[95vw] h-[90vh] sm:h-auto max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card border-border shadow-xl">
        <DialogHeader className="px-6 py-5 border-b border-border bg-muted/20 shrink-0">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-2xl font-bold font-heading text-foreground">
              {event ? 'Edit Event' : 'Create New Event'}
            </DialogTitle>
            {scrapedData && (
              <Badge variant="secondary" className="bg-primary/10 text-primary border-none shadow-sm h-6 font-semibold px-3">
                <Wand2 className="w-3.5 h-3.5 mr-1.5" /> Auto-populated from URL
              </Badge>
            )}
          </div>
          <DialogDescription className="text-muted-foreground mt-1">
            {event ? 'Update the details for this community event.' : 'Add a new event. All details will be securely saved to the database.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="px-6 border-b border-border sticky top-0 bg-card z-10 pt-2">
              <TabsList className="w-full justify-start h-12 bg-transparent p-0">
                <TabsTrigger value="general" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 font-bold text-base h-full">General Info</TabsTrigger>
                <TabsTrigger value="details" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 font-bold text-base h-full">Extra Details</TabsTrigger>
                <TabsTrigger value="contact" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 font-bold text-base h-full">Contact & Links</TabsTrigger>
              </TabsList>
            </div>

            <div className="p-6">
              <TabsContent value="general" className="mt-0 space-y-6 animate-in fade-in">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-foreground font-bold">Event Title <span className="text-destructive">*</span></Label>
                  <Input 
                    id="name" name="name" 
                    value={formData.name} onChange={handleChange} 
                    className="bg-background rounded-xl h-11"
                    disabled={loading} required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="date" className="text-foreground font-bold">Date <span className="text-destructive">*</span></Label>
                    <Input 
                      id="date" name="date" type="date"
                      value={formData.date} onChange={handleChange} 
                      className="bg-background rounded-xl h-11"
                      disabled={loading} required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time" className="text-foreground font-bold">Time</Label>
                    <Input 
                      id="time" name="time" type="time"
                      value={formData.time} onChange={handleChange} 
                      className="bg-background rounded-xl h-11"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="location" className="text-foreground font-bold">Location <span className="text-destructive">*</span></Label>
                    <Input 
                      id="location" name="location" 
                      value={formData.location} onChange={handleChange} 
                      className="bg-background rounded-xl h-11"
                      disabled={loading} required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground font-bold">Status</Label>
                    <Select value={formData.status} onValueChange={handleStatusChange} disabled={loading}>
                      <SelectTrigger className="bg-background rounded-xl h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active (Visible)</SelectItem>
                        <SelectItem value="inactive">Inactive (Hidden)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-foreground font-bold">Description</Label>
                  <Textarea 
                    id="description" name="description" 
                    value={formData.description} onChange={handleChange} 
                    className="bg-background min-h-[120px] rounded-xl resize-y"
                    disabled={loading}
                  />
                </div>
              </TabsContent>

              <TabsContent value="details" className="mt-0 space-y-6 animate-in fade-in">
                <div className="bg-muted/30 p-4 rounded-xl border border-border text-sm text-muted-foreground mb-6">
                  These extended fields are embedded into the event's description automatically to display on the storefront.
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="category" className="text-foreground font-bold">Event Category</Label>
                    <Input 
                      id="category" name="category" 
                      value={formData.category} onChange={handleChange} 
                      className="bg-background rounded-xl h-11"
                      placeholder="e.g. Card Show, Tournament"
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type" className="text-foreground font-bold">Event Type</Label>
                    <Input 
                      id="type" name="type" 
                      value={formData.type} onChange={handleChange} 
                      className="bg-background rounded-xl h-11"
                      placeholder="e.g. In-person, Virtual"
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price" className="text-foreground font-bold">Ticket Price</Label>
                    <Input 
                      id="price" name="price" 
                      value={formData.price} onChange={handleChange} 
                      className="bg-background rounded-xl h-11"
                      placeholder="e.g. Free, $15.00"
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capacity" className="text-foreground font-bold">Capacity</Label>
                    <Input 
                      id="capacity" name="capacity" 
                      value={formData.capacity} onChange={handleChange} 
                      className="bg-background rounded-xl h-11"
                      placeholder="e.g. 500 attendees"
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="organizer" className="text-foreground font-bold">Organizer / Host</Label>
                    <Input 
                      id="organizer" name="organizer" 
                      value={formData.organizer} onChange={handleChange} 
                      className="bg-background rounded-xl h-11"
                      disabled={loading}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="contact" className="mt-0 space-y-6 animate-in fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="contactEmail" className="text-foreground font-bold">Contact Email</Label>
                    <Input 
                      id="contactEmail" name="contactEmail" type="email"
                      value={formData.contactEmail} onChange={handleChange} 
                      className="bg-background rounded-xl h-11"
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactPhone" className="text-foreground font-bold">Contact Phone</Label>
                    <Input 
                      id="contactPhone" name="contactPhone" 
                      value={formData.contactPhone} onChange={handleChange} 
                      className="bg-background rounded-xl h-11"
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="contactWebsite" className="text-foreground font-bold">Website</Label>
                    <Input 
                      id="contactWebsite" name="contactWebsite" type="url"
                      value={formData.contactWebsite} onChange={handleChange} 
                      className="bg-background rounded-xl h-11"
                      placeholder="https://"
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="registrationLink" className="text-foreground font-bold">Registration/Tickets URL</Label>
                    <Input 
                      id="registrationLink" name="registrationLink" type="url"
                      value={formData.registrationLink} onChange={handleChange} 
                      className="bg-background rounded-xl h-11"
                      placeholder="https://"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-border mt-4">
                  <Label className="text-foreground font-bold">Cover Image (Optional)</Label>
                  <div 
                    className={`border-2 border-dashed rounded-2xl transition-all duration-200 ${
                      isDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/20 hover:bg-muted/40'
                    }`}
                    onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                  >
                    {imagePreview ? (
                      <div className="relative p-2">
                        <div className="relative aspect-[21/9] w-full rounded-xl overflow-hidden bg-black/5">
                          <img src={imagePreview} alt="Preview" className="w-full h-full object-contain" />
                          <Button
                            type="button" variant="destructive" size="icon"
                            className="absolute top-2 right-2 h-8 w-8 rounded-full shadow-md"
                            onClick={clearImage}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        className="flex flex-col items-center justify-center py-10 px-4 cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <div className="w-12 h-12 rounded-full bg-background border border-border flex items-center justify-center mb-4 shadow-sm text-muted-foreground">
                          <UploadCloud className="w-6 h-6" />
                        </div>
                        <h4 className="font-bold text-foreground mb-1">Click to upload or drag and drop</h4>
                        <p className="text-sm text-muted-foreground text-center">Max 20MB. Formats: JPG, PNG, WEBP.</p>
                      </div>
                    )}
                    <input 
                      type="file" ref={fileInputRef} className="hidden" 
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleFileChange} disabled={loading}
                    />
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter className="px-6 py-4 mt-auto border-t border-border bg-muted/20 flex flex-col sm:flex-row gap-3 sm:justify-between shrink-0">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClear} 
              disabled={loading} 
              className="rounded-xl font-bold text-muted-foreground hover:text-destructive hover:bg-destructive/10 border-transparent hover:border-destructive/20"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear Form
            </Button>
            <div className="flex gap-3 sm:justify-end">
              <Button type="button" variant="ghost" onClick={onClose} disabled={loading} className="rounded-xl font-bold">
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="rounded-xl font-bold px-8 shadow-md">
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {event ? 'Save Changes' : 'Create Event'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EventFormModal;