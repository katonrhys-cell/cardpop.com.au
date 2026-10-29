import React from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Clock, DollarSign, Info, Ticket, ExternalLink, Accessibility, ShieldAlert, History } from 'lucide-react';
import { eventPath, eventTypeLabel, formatEventDate, formatEventTime, formatEventLocation, toLocalDateStr } from '@/lib/eventSeo.js';
import { isPastEvent } from '@/utils/eventPast.js';
import EventRsvp from '@/components/EventRsvp.jsx';
import AddToCalendarButton from '@/components/AddToCalendarButton.jsx';
import { publicImageUrl } from '@/utils/imageUrl.js';
import EventEntryPrices from '@/components/events/EventEntryPrices.jsx';
import EventTicketOffer from '@/components/events/EventTicketOffer.jsx';
import useEventTicketOffer from '@/hooks/useEventTicketOffer.js';
import { ticketDestination, recordEventTicketClick } from '@/lib/eventTicketOffers.js';

const EventDetailModal = ({ isOpen, onClose, event }) => {
  const past = event ? isPastEvent(event, toLocalDateStr(new Date())) : true;
  // Hooks run before the early return; only ask while the dialog is open.
  const ticketOffer = useEventTicketOffer(event?.id, { enabled: Boolean(isOpen && event && !past) });
  if (!event) return null;

  const eventTitle = event.title || event.name;
  const formattedDate = formatEventDate(event, true);
  const formattedTime = formatEventTime(event);
  const formattedLocation = formatEventLocation(event);
  // A finished event (`past`) takes reviews, not RSVPs or tickets.
  const ticketLink = ticketDestination(event, ticketOffer);
  const countTicketClick = () => { if (ticketOffer) recordEventTicketClick(event.id); };

  const imageUrl = publicImageUrl(event.image_url || event.image || null);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {/* On a phone the dialog is a full-height sheet: the poster, title and
          details all scroll together and only the action bar stays pinned, so
          the copy gets the whole screen instead of the strip left over under a
          fixed poster + title + three stacked buttons. From `sm` up it is the
          usual centred card capped at 90vh. */}
      <DialogContent className="sm:max-w-[650px] p-0 overflow-hidden gap-0 border-none shadow-xl flex flex-col h-[100vh] supports-[height:100dvh]:h-[100dvh] max-h-none supports-[height:100dvh]:max-h-none sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-lg"
        closeClassName="z-10 rounded-full bg-background/90 p-1.5 shadow-md ring-1 ring-border opacity-100 data-[state=open]:bg-background/90 data-[state=open]:text-foreground">
        <DialogHeader className="sr-only">
          <DialogTitle>Event Details: {eventTitle}</DialogTitle>
          <DialogDescription>Full details for {eventTitle}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="relative h-52 sm:h-72 w-full bg-muted flex items-center justify-center overflow-hidden shrink-0 mt-8 rounded-t-lg">
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
          <div className="px-4 sm:px-6 pt-5 bg-background shrink-0">
            <Badge className="mb-3 border-none bg-primary text-primary-foreground">
              {eventTypeLabel(event)}
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold font-heading text-foreground text-balance">
              {eventTitle}
            </h2>
          </div>

          <div className="p-4 sm:p-6 space-y-6 bg-background">
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

              <div className="flex items-start gap-3 sm:col-span-2">
                <div className="p-2 bg-background rounded-lg shadow-sm shrink-0 text-primary">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0 max-w-xs">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Entry</p>
                  <EventEntryPrices event={event} className="text-sm font-semibold text-foreground" valueClassName="font-semibold text-foreground" />
                </div>
              </div>
            </div>

            {past ? (
              <div className="bg-secondary/50 p-4 rounded-xl border border-border flex items-start gap-3">
                <History className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-1">This event has ended</h3>
                  <p className="text-sm text-muted-foreground">
                    Were you there? Open the event page to read what collectors thought and leave your own review.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-secondary/50 p-4 rounded-xl border border-border">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Attending?</h3>
                <EventRsvp event={event} variant="detail" />
              </div>
            )}

            {!past && <EventTicketOffer eventId={event.id} offer={ticketOffer} />}

            <div>
              <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                <Info className="w-5 h-5 text-primary" /> About this event
              </h3>
              <p className="text-base text-foreground leading-relaxed whitespace-pre-wrap bg-muted/30 p-4 rounded-xl border border-border">
                {event.description || 'No description provided for this event.'}
              </p>
            </div>

            {event.accessibility_info && (
              <div>
                <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                  <Accessibility className="w-5 h-5 text-primary" aria-hidden="true" /> Accessibility
                </h3>
                <p className="text-base text-foreground leading-relaxed whitespace-pre-wrap bg-muted/30 p-4 rounded-xl border border-border">
                  {event.accessibility_info}
                </p>
              </div>
            )}

            {event.age_restrictions && (
              <div>
                <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-primary" aria-hidden="true" /> Age Restrictions
                </h3>
                <p className="text-base text-foreground leading-relaxed whitespace-pre-wrap bg-muted/30 p-4 rounded-xl border border-border">
                  {event.age_restrictions}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Equal-width columns so every action reads as the same size — the
            dialog's own X is the only way out, so there's no Close button. */}
        <DialogFooter className="p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-4 bg-muted/20 border-t border-border grid grid-cols-2 sm:grid-flow-col sm:auto-cols-fr gap-2 sm:space-x-0 shrink-0">
          {!past && <AddToCalendarButton event={event} className={`h-11 px-2 sm:px-4 max-[374px]:text-xs max-[374px]:[&>svg]:mr-1 max-[359px]:[&>svg]:hidden font-semibold ${ticketLink ? '' : 'col-span-2 sm:col-span-1'}`} />}
          {!past && ticketLink && (
            <Button variant="secondary" className="w-full h-11 px-2 sm:px-4 max-[374px]:text-xs max-[374px]:[&>svg]:mr-1 font-semibold" asChild>
              <a href={ticketLink} target="_blank" rel="noopener noreferrer" onClick={countTicketClick} onAuxClick={countTicketClick}>
                <Ticket className="w-4 h-4 mr-2" /> Tickets & Info
              </a>
            </Button>
          )}
          <Button className="w-full h-11 font-semibold col-span-2 sm:col-span-1" asChild onClick={onClose}>
            <Link to={past ? `${eventPath(event)}#reviews` : eventPath(event)}>
              <ExternalLink className="w-4 h-4 mr-2" /> {past ? 'Event Page & Reviews' : 'Full Event Page'}
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EventDetailModal;