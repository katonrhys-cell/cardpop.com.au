import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Clock, Users, Edit, Trash2, Info } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { eventPath, eventTypeLabel, formatEventDate, formatEventTime, formatEventLocation } from '@/lib/eventSeo.js';
import { toast } from 'sonner';

const EventCard = ({ event, isAdmin, onView, onEdit, onDelete }) => {
  const eventTitle = event.title || event.name;
  const formattedDate = formatEventDate(event);
  const formattedTime = formatEventTime(event);
  const formattedLocation = formatEventLocation(event);

  const imageUrl = event.image_url || event.image
    || 'https://images.unsplash.com/photo-1540317580384-e5d43616b9aa?q=80&w=800&auto=format&fit=crop';

  const handleRsvp = (e) => {
    e.stopPropagation();
    toast('RSVP Feature coming soon.', {
      description: 'We are working on adding attendee management.',
    });
  };

  return (
    <Card className="flex flex-col overflow-hidden h-full shadow-md hover:shadow-lg transition-all duration-300 rounded-2xl group border-border">
      <div className="relative h-48 w-full overflow-hidden bg-muted">
        <img
          src={imageUrl}
          alt={eventTitle}
          className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute top-3 left-3 flex gap-2">
          <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm text-foreground">{eventTypeLabel(event)}</Badge>
          {event.status === 'inactive' && (
            <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm text-foreground">Inactive</Badge>
          )}
        </div>
        <div className="absolute bottom-3 right-3 bg-background/90 backdrop-blur-md px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-primary" />
          {formattedDate}
        </div>
      </div>
      
      <CardHeader className="pb-3 flex-none">
        <CardTitle className="text-xl font-bold line-clamp-1 group-hover:text-primary transition-colors">
          <Link to={eventPath(event)}>{eventTitle}</Link>
        </CardTitle>
        <CardDescription className="flex flex-col gap-1.5 mt-2 text-sm">
          <span className="flex items-center gap-1.5 text-foreground">
            <Clock className="w-4 h-4 text-muted-foreground" /> {formattedTime}
          </span>
          <span className="flex items-center gap-1.5 text-foreground">
            <MapPin className="w-4 h-4 text-muted-foreground" /> <span className="line-clamp-1">{formattedLocation}</span>
          </span>
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 text-sm text-muted-foreground">
        <p className="line-clamp-3 text-balance leading-relaxed">
          {event.short_description || event.description || 'No description provided.'}
        </p>
      </CardContent>

      <CardFooter className="pt-4 border-t border-border flex flex-col gap-3">
        <div className="w-full flex items-center justify-between text-sm text-muted-foreground mb-1">
          <span className="flex items-center gap-1.5">
            <Users className="w-4 h-4" /> 0 Attendees
          </span>
        </div>
        
        <div className="flex w-full items-center gap-2">
          {onView ? (
            <Button variant="default" className="flex-1 gap-2 font-semibold" onClick={() => onView(event)}>
              <Info className="w-4 h-4" /> Details
            </Button>
          ) : (
            <Button variant="default" className="flex-1 gap-2 font-semibold" asChild>
              <Link to={eventPath(event)}>
                <Info className="w-4 h-4" /> Details
              </Link>
            </Button>
          )}
          <Button 
            variant="secondary" 
            className="flex-1 font-semibold opacity-50 cursor-not-allowed" 
            onClick={handleRsvp}
          >
            RSVP
          </Button>
        </div>

        {isAdmin && (
          <div className="flex w-full items-center gap-2 mt-2">
            <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={(e) => { e.stopPropagation(); onEdit(event); }}>
              <Edit className="w-3.5 h-3.5" /> Edit
            </Button>
            <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20" onClick={(e) => { e.stopPropagation(); onDelete(event); }}>
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  );
};

export default EventCard;