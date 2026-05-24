import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Clock, Info } from 'lucide-react';
import pb from '@/lib/pocketbaseClient.js';

const EventDetailModal = ({ isOpen, onClose, event }) => {
  if (!event) return null;

  const eventDate = new Date(event.date);
  const formattedDate = eventDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
  const formattedTime = eventDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  const imageUrl = event.image 
    ? pb.files.getUrl(event, event.image) 
    : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[650px] p-0 overflow-hidden gap-0 border-none shadow-xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Event Details: {event.name}</DialogTitle>
          <DialogDescription>Full details for {event.name}</DialogDescription>
        </DialogHeader>

        <div className="relative h-72 w-full bg-muted flex items-center justify-center overflow-hidden">
          {imageUrl ? (
            <>
              <img src={imageUrl} alt={event.name} className="object-cover w-full h-full" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            </>
          ) : (
            <div className="flex flex-col items-center text-muted-foreground opacity-50">
              <Calendar className="w-16 h-16 mb-2" />
              <span>No Image Available</span>
            </div>
          )}
          
          <div className="absolute bottom-4 left-6 right-6">
            <Badge 
              variant={event.status === 'active' ? 'default' : 'secondary'} 
              className={`mb-3 border-none ${event.status === 'active' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
            >
              {event.status === 'active' ? 'Active' : 'Inactive'}
            </Badge>
            <h2 className="text-3xl font-bold font-heading text-white text-balance line-clamp-2 drop-shadow-md">
              {event.name}
            </h2>
          </div>
        </div>

        <div className="p-6 space-y-6 bg-background max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-secondary/50 p-4 rounded-xl border border-border">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-background rounded-lg shadow-sm shrink-0 text-primary">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Date</p>
                <p className="text-sm font-semibold text-foreground">{formattedDate}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="p-2 bg-background rounded-lg shadow-sm shrink-0 text-primary">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Time</p>
                <p className="text-sm font-semibold text-foreground">{formattedTime}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 sm:col-span-2">
              <div className="p-2 bg-background rounded-lg shadow-sm shrink-0 text-primary">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Location</p>
                <p className="text-sm font-semibold text-foreground">{event.location}</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" /> About this event
            </h3>
            <p className="text-muted-foreground leading-relaxed text-balance whitespace-pre-wrap bg-muted/30 p-4 rounded-xl border border-border">
              {event.description || 'No description provided for this event.'}
            </p>
          </div>
        </div>

        <DialogFooter className="p-4 bg-muted/20 border-t border-border flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EventDetailModal;