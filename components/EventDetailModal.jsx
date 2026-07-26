import React from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Clock, Info, Ticket, ExternalLink, Accessibility, ShieldAlert } from 'lucide-react';
import { eventPath, eventTypeLabel, formatEventDate, formatEventTime, formatEventLocation } from '@/lib/eventSeo.js';
import EventRsvp from '@/components/EventRsvp.jsx';
import AddToCalendarButton from '@/components/AddToCalendarButton.jsx';

const EventDetailModal = ({ isOpen, onClose, event }) => {
  if (!event) return null;

  const eventTitle = event.title || event.name;
  const formattedDate = formatEventDate(event, true);
  const formattedTime = formatEventTime(event);
  const formattedLocation = formatEventLocation(event);
  const ticketLink = event.ticket_url || event.website_url || event.ticketLink;

  const imageUrl = event.image_url || event.image || null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[650px] p-0 overflow-hidden gap-0 border-none shadow-xl max-h-[90vh] flex flex-col">
        <DialogHeader className="sr-only">
          <DialogTitle>Event Details: {eventTitle}</DialogTitle>
          <DialogDescription>Full details for {eventTitle}</DialogDescription>
        </DialogHeader>

        <div className="relative h-72 w-full bg-muted flex items-center justify-center overflow-hidden shrink-0 mt-8 rounded-t-lg">
          {imageUrl ? (
            <img src={imageUrl} alt={eventTitle} className="object-contain w-full h-full" />
          ) : (
            <div className="flex flex-col items-center text-muted-foreground opacity-50">
              <Calendar className="w-16 h-16 mb-2" />
              <span>No Image Available</span>
            </div>
          )}
        </div>

        {/* Title & type — below the image so the poster stays fully visible */}
        <div className="px-6 pt-5 bg-background shrink-0">
          <Badge className="mb-3 border-none bg-primary text-primary-foreground">
            {eventTypeLabel(event)}
          </Badge>
          <h2 className="text-3xl font-bold font-heading text-foreground text-balance line-clamp-2">
            {eventTitle}
          </h2>
        </div>

        <div className="p-6 space-y-6 bg-background flex-1 overflow-y-auto">
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
                <p className="text-sm font-semibold text-foreground">{formattedLocation}</p>
                {event.address && <p className="text-xs text-muted-foreground">{event.address}</p>}
              </div>
            </div>
          </div>

          <div className="bg-secondary/50 p-4 rounded-xl border border-border">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Attending?</h3>
            <EventRsvp event={event} variant="detail" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" /> About this event
            </h3>
            <p className="text-muted-foreground leading-relaxed text-balance whitespace-pre-wrap bg-muted/30 p-4 rounded-xl border border-border">
              {event.description || 'No description provided for this event.'}
            </p>
          </div>

          {event.accessibility_info && (
            <div>
              <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                <Accessibility className="w-5 h-5 text-primary" aria-hidden="true" /> Accessibility
              </h3>
              <p className="text-muted-foreground leading-relaxed text-balance whitespace-pre-wrap bg-muted/30 p-4 rounded-xl border border-border">
                {event.accessibility_info}
              </p>
            </div>
          )}

          {event.age_restrictions && (
            <div>
              <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-primary" aria-hidden="true" /> Age Restrictions
              </h3>
              <p className="text-muted-foreground leading-relaxed text-balance whitespace-pre-wrap bg-muted/30 p-4 rounded-xl border border-border">
                {event.age_restrictions}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 bg-muted/20 border-t border-border flex flex-col-reverse sm:flex-row sm:justify-end gap-2 shrink-0">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <AddToCalendarButton event={event} className="w-full sm:w-auto h-9" />
          {ticketLink && (
            <Button variant="secondary" asChild>
              <a href={ticketLink} target="_blank" rel="noopener noreferrer">
                <Ticket className="w-4 h-4 mr-2" /> Tickets & Info
              </a>
            </Button>
          )}
          <Button asChild onClick={onClose}>
            <Link to={eventPath(event)}>
              <ExternalLink className="w-4 h-4 mr-2" /> Full Event Page
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EventDetailModal;