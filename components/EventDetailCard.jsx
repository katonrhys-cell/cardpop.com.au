import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Calendar, Clock, Map, Ticket, Share2, Facebook, Twitter, Linkedin, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const EventDetailCard = ({ event }) => {
  const isTradeShow = event.type === 'Trade Show';

  const handleShare = (platform) => {
    const url = window.location.href;
    const text = `Check out ${event.name}`;

    if (platform === 'Facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer,width=600,height=400');
    } else if (platform === 'Twitter') {
      window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer,width=600,height=400');
    } else if (platform === 'LinkedIn') {
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer,width=600,height=400');
    } else if (platform === 'Link') {
      navigator.clipboard.writeText(url).then(() => {
        toast.success('Link copied to clipboard');
      }).catch(() => {
        toast.error('Failed to copy link');
      });
    }
  };

  return (
    <div className="w-full">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6 font-medium">
        <Link to="/community/events" className="hover:text-primary transition-colors">Community</Link>
        <ChevronRight className="w-4 h-4" />
        <Link to="/community/events" className="hover:text-primary transition-colors">Events</Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-foreground">{event.name}</span>
      </nav>

      <div className="bg-card rounded-3xl overflow-hidden border border-border shadow-lg">
        {/* Hero Image */}
        <div className="w-full h-64 md:h-96 lg:h-[450px] relative bg-muted">
          <img 
            src={event.image} 
            alt={event.name} 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 p-6 md:p-10 w-full">
            <Badge 
              variant="secondary" 
              className={`mb-4 font-bold shadow-sm backdrop-blur-md border-none px-3 py-1 text-sm ${
                isTradeShow ? 'bg-primary text-white' : 'bg-secondary text-white'
              }`}
            >
              {event.type}
            </Badge>
            <h1 className="font-serif text-3xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight tracking-tight">
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
                  Free Entry / No Tickets
                </Button>
              )}
              
              <Button variant="outline" className="w-full h-12 border-border hover:bg-muted font-bold" asChild>
                <a href={`https://maps.google.com/?q=${encodeURIComponent(event.location)}`} target="_blank" rel="noopener noreferrer">
                  <Map className="w-5 h-5 mr-2" /> Get Directions
                </a>
              </Button>
            </div>

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