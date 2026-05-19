import React, { useState, useEffect, useRef } from 'react';
import { Search, Calendar as CalendarIcon, AlertCircle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import pb from '@/lib/pocketbaseClient.js';
import EventCard from '@/components/EventCard.jsx';
import EventDetailModal from '@/components/EventDetailModal.jsx';

const CommunityEventsPage = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Search
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  
  const isMounted = useRef(true);

  const fetchEvents = async () => {
    if (!isMounted.current) return;
    setLoading(true);
    setError(null);
    try {
      // Only fetch active events for the public display
      const records = await pb.collection('events').getList(1, 100, {
        sort: 'date',
        filter: 'status = "active"',
        $autoCancel: false
      });
      if (isMounted.current) setEvents(records.items);
    } catch (err) {
      console.error("Error fetching events:", err);
      if (isMounted.current) setError(err.message || "Failed to load events.");
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    fetchEvents();
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleView = (event) => {
    setSelectedEvent(event);
    setIsDetailOpen(true);
  };

  const filteredEvents = events.filter(e => {
    return e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
           (e.location && e.location.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  const now = new Date();
  const upcomingEvents = filteredEvents.filter(e => new Date(e.date) >= now);
  const pastEvents = filteredEvents.filter(e => new Date(e.date) < now);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 space-y-12">
      
      {/* Header Section */}
      <div className="flex flex-col justify-between gap-6">
        <div className="max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-extrabold font-heading text-foreground tracking-tight" style={{ letterSpacing: '-0.02em' }}>
            Community Events
          </h1>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
            Connect with fellow collectors, attend local trading shows, and participate in exclusive CardPop gatherings.
          </p>
        </div>
      </div>

      {/* Search Section */}
      <div className="bg-card border border-border p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input 
            placeholder="Search events by name or location..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-12 bg-background border-border text-foreground rounded-xl"
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="space-y-10">
        
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col space-y-4">
                <Skeleton className="h-48 w-full rounded-2xl" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </div>
        ) : error ? (
           <div className="flex flex-col items-center justify-center py-24 text-center bg-muted/30 rounded-3xl border border-border dashed">
            <AlertCircle className="w-12 h-12 text-destructive mb-4" />
            <h3 className="text-xl font-bold text-foreground mb-2">Failed to load events</h3>
            <p className="text-muted-foreground mb-6 max-w-md">We encountered an issue while connecting to the events database. Please try again.</p>
            <Button onClick={fetchEvents} variant="outline" className="gap-2 font-medium">
              <RefreshCcw className="w-4 h-4" /> Retry Connection
            </Button>
          </div>
        ) : (
          <>
            {upcomingEvents.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
                  Upcoming Events <Badge variant="secondary" className="ml-2">{upcomingEvents.length}</Badge>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {upcomingEvents.map((event, index) => (
                    <motion.div 
                      key={event.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: index * 0.05 }}
                      className="h-full"
                    >
                      <EventCard 
                        event={event} 
                        isAdmin={false}
                        onView={handleView}
                      />
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {pastEvents.length > 0 && (
              <section className="pt-8">
                <h2 className="text-2xl font-bold text-muted-foreground mb-6">Past Events</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 opacity-70 hover:opacity-100 transition-opacity duration-300">
                  {pastEvents.map((event) => (
                    <EventCard 
                      key={event.id}
                      event={event} 
                      isAdmin={false}
                      onView={handleView}
                    />
                  ))}
                </div>
              </section>
            )}

            {filteredEvents.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center bg-muted/20 rounded-3xl border border-border border-dashed">
                <CalendarIcon className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-2xl font-bold text-foreground mb-2">No events found</h3>
                <p className="text-muted-foreground mb-6 max-w-md">
                  {searchTerm 
                    ? "Try adjusting your search to find what you're looking for." 
                    : "There are currently no events scheduled. Check back later!"}
                </p>
                {searchTerm && (
                  <Button variant="outline" onClick={() => setSearchTerm('')}>
                    Clear Search
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <EventDetailModal 
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        event={selectedEvent}
      />

    </div>
  );
};

export default CommunityEventsPage;