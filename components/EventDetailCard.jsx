import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Calendar, Clock, Map, Ticket, Share2, Facebook, Twitter, Linkedin, ChevronRight, Users, DollarSign, Instagram, Globe, Handshake, Store } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatEntryFee } from '@/lib/eventSeo.js';
import EventRsvp from '@/components/EventRsvp.jsx';
import { toast } from 'sonner';

const EVENT_TYPE_STYLES = {
  card_show:       { gradient: 'from-red-500 to-rose-600',      Icon: Ticket    },
  trade_event:     { gradient: 'from-blue-500 to-indigo-600',   Icon: Handshake },
  community_event: { gradient: 'from-violet-500 to-purple-600', Icon: Users     },
  lgs_event:       { gradient: 'from-amber-500 to-orange-500',  Icon: Store     },
};

const EventDetailCard = ({ event }) => {

  const handleShare = (platform) => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(`Check out ${event.name}!`);

    const shareUrls = {
      Facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      Twitter: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      LinkedIn: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
    };

    if (platform === 'Link') {
      navigator.clipboard.writeText(window.location.href).then(() => {
        toast.success('Link copied to clipboard!');
      }).catch(() => {
        toast.error('Failed to copy link.');
      });
      return;
    }

    window.open(shareUrls[platform], '_blank', 'noopener,noreferrer,width=600,height=400');
  };

  return (
    <div className="w-full">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6 font-medium">
        <Link to="/" className="hover:text-primary transition-colors">Home</Link>
        <ChevronRight className="w-4 h-4" />
        <Link to="/events" className="hover:text-primary transition-colors">Events</Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-foreground">{event.name}</span>
      </nav>

      <div className="bg-card rounded-3xl overflow-hidden border border-border shadow-lg">
        {/* Hero Image */}
        <div className="w-full h-64 md:h-96 lg:h-[450px] relative bg-muted overflow-hidden">
          {/* Blurred backdrop fills the frame so tall portrait posters don't leave bare side bars */}
          <img
            src={event.image}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-50"
          />
          {/* Foreground poster shown in full — never cropped */}
          <img
            src={event.image}
            alt={event.name}
            className="absolute inset-0 w-full h-full object-contain"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />

          {/* Type pill — top-left */}
          <div className="absolute top-4 left-4">
            {(() => {
              const style = EVENT_TYPE_STYLES[event.event_type];
              if (style) {
                const { gradient, Icon } = style;
                return (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r ${gradient} text-white text-sm font-bold shadow-md backdrop-blur-sm`}>
                    <Icon className="w-3.5 h-3.5" />
                    {event.type}
                  </span>
                );
              }
              return (
                <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm text-white text-sm font-bold shadow-md">
                  {event.type}
                </span>
              );
            })()}
          </div>

          {/* Title — bottom of hero, with strong text shadow for legibility */}
          <div className="absolute bottom-0 left-0 px-5 pb-5 md:px-10 md:pb-8 w-full">
            <h1
              className="font-serif text-2xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight tracking-tight"
              style={{ textShadow: '0 2px 16px rgba(0,0,0,0.85), 0 1px 4px rgba(0,0,0,0.95)' }}
            >
              {event.name}
            </h1>
          </div>
        </div>

        {/* Content Split */}
        <div className="grid lg:grid-cols-3 gap-0">
          
          {/* Main Description */}
          <div className="lg:col-span-2 p-6 md:p-10 border-r border-border">
            <h2 className="font-serif text-2xl font-bold mb-4">About This Event</h2>
            <p className="text-muted-foreground leading-relaxed text-lg whitespace-pre-wrap">
              {event.description}
            </p>
          </div>

          {/* Sidebar Details */}
          <div className="p-6 md:p-10 bg-muted/20 flex flex-col gap-8">
            
            <div className="space-y-5">
              <h3 className="font-bold text-lg uppercase tracking-wider text-muted-foreground border-b border-border pb-2">Event Details</h3>
              
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-foreground">Date</p>
                  <p className="text-muted-foreground">{event.date}</p>
                </div>
              </div>
              
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-foreground">Time</p>
                  <p className="text-muted-foreground">{event.time}</p>
                </div>
              </div>
              
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-foreground">Location</p>
                  <p className="text-muted-foreground leading-snug">{event.location}</p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                  <DollarSign className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-foreground">Entry</p>
                  <p className="text-muted-foreground leading-snug">{formatEntryFee(event)}</p>
                </div>
              </div>

              {event.organizer_name && (
                <div className="flex gap-4 items-start">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground">Organiser</p>
                    <p className="text-muted-foreground leading-snug">{event.organizer_name}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 pt-4 border-t border-border">
              <h3 className="font-bold text-lg uppercase tracking-wider text-muted-foreground pb-1">Attending?</h3>
              <EventRsvp event={event} variant="detail" />
            </div>

            <div className="space-y-3 pt-4">
              {event.ticketLink ? (
                <Button className="w-full h-12 text-base font-bold shadow-lg shadow-primary/20" asChild>
                  <a href={event.ticketLink} target="_blank" rel="noopener noreferrer">
                    <Ticket className="w-5 h-5 mr-2" /> Get Tickets
                  </a>
                </Button>
              ) : (
                <Button className="w-full h-12 text-base font-bold" variant="secondary" disabled>
                  {event.is_free ? 'Free Entry — No Ticket Needed' : 'Tickets at the Door'}
                </Button>
              )}
              
              <Button variant="outline" className="w-full h-12 border-border hover:bg-muted font-bold" asChild>
                <a href={`https://maps.google.com/?q=${encodeURIComponent(event.location)}`} target="_blank" rel="noopener noreferrer">
                  <Map className="w-5 h-5 mr-2" /> Get Directions
                </a>
              </Button>
            </div>

            {(event.instagram_url || event.facebook_url || event.website_url) && (
              <div className="pt-6 border-t border-border">
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Follow the Organiser</p>
                <div className="flex flex-col gap-2">
                  {event.instagram_url && (
                    <Button variant="outline" className="w-full justify-start h-11 border-border hover:bg-muted font-semibold" asChild>
                      <a href={event.instagram_url} target="_blank" rel="noopener noreferrer">
                        <Instagram className="w-4 h-4 mr-2 text-pink-600" /> Instagram
                      </a>
                    </Button>
                  )}
                  {event.facebook_url && (
                    <Button variant="outline" className="w-full justify-start h-11 border-border hover:bg-muted font-semibold" asChild>
                      <a href={event.facebook_url} target="_blank" rel="noopener noreferrer">
                        <Facebook className="w-4 h-4 mr-2 text-blue-600" /> Facebook
                      </a>
                    </Button>
                  )}
                  {event.website_url && (
                    <Button variant="outline" className="w-full justify-start h-11 border-border hover:bg-muted font-semibold" asChild>
                      <a href={event.website_url} target="_blank" rel="noopener noreferrer">
                        <Globe className="w-4 h-4 mr-2 text-primary" /> Official Website
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="pt-6 border-t border-border">
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Share Event</p>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => handleShare('Facebook')} className="rounded-full w-10 h-10 hover:text-blue-600 hover:border-blue-600">
                  <Facebook className="w-4 h-4" />
                  <span className="sr-only">Share on Facebook</span>
                </Button>
                <Button variant="outline" size="icon" onClick={() => handleShare('Twitter')} className="rounded-full w-10 h-10 hover:text-sky-500 hover:border-sky-500">
                  <Twitter className="w-4 h-4" />
                  <span className="sr-only">Share on Twitter</span>
                </Button>
                <Button variant="outline" size="icon" onClick={() => handleShare('LinkedIn')} className="rounded-full w-10 h-10 hover:text-blue-700 hover:border-blue-700">
                  <Linkedin className="w-4 h-4" />
                  <span className="sr-only">Share on LinkedIn</span>
                </Button>
                <Button variant="outline" size="icon" onClick={() => handleShare('Link')} className="rounded-full w-10 h-10">
                  <Share2 className="w-4 h-4" />
                  <span className="sr-only">Copy Link</span>
                </Button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default EventDetailCard;