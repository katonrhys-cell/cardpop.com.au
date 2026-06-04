import React, { useState, useEffect, useMemo } from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabaseClient.js';
import EventCard from '@/components/EventCard.jsx';
import { Skeleton } from '@/components/ui/skeleton';

const CommunityEventsPage = () => {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    let isMounted = true;

    const fetchEvents = async () => {
      try {
        setIsLoading(true);
        const { data, error: fetchError } = await supabase
          .from('events')
          .select('*')
          .eq('status', 'approved')
          .order('start_date', { ascending: true });
        if (fetchError) throw fetchError;
        if (isMounted) {
          setEvents(data || []);
          setError(null);
        }
      } catch (err) {
        console.error('Error fetching events:', err);
        if (isMounted) setError('Failed to load upcoming events.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchEvents();

    const channel = supabase.channel(`community-events-page-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, payload => {
        if (!isMounted) return;
        const record = payload.new;
        if (payload.eventType === 'INSERT' && record.status === 'approved') {
          setEvents(prev => [...prev, record].sort((a, b) => new Date(a.start_date) - new Date(b.start_date)));
        } else if (payload.eventType === 'UPDATE') {
          setEvents(prev => {
            let updatedList = prev.filter(ev => ev.id !== record.id);
            if (record.status === 'approved') {
              updatedList.push(record);
            }
            return updatedList.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
          });
        } else if (payload.eventType === 'DELETE') {
          setEvents(prev => prev.filter(ev => ev.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const groupedEvents = useMemo(() => {
    const groups = {};
    events.forEach(event => {
      const monthYear = event.start_date ? format(new Date(event.start_date), 'MMMM yyyy') : 'TBA';
      if (!groups[monthYear]) {
        groups[monthYear] = [];
      }
      groups[monthYear].push(event);
    });
    return groups;
  }, [events]);
  
  return (
    <div className="flex flex-col bg-background font-sans min-h-screen">
      <SEOHead title="Community Events | CardPop" description="Find TCG tournaments, card fairs and collector shows happening across Australia." />
      
      <div className="bg-card py-16 relative overflow-hidden border-b border-border shadow-sm">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1593814681464-eef5af2b0628?auto=format&fit=crop&w=1920&q=80')] opacity-5 mix-blend-overlay bg-cover bg-center" />
        <div className="max-w-7xl mx-auto px-4 relative z-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 border border-primary/20 backdrop-blur-sm">
            <CalendarDays className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4 tracking-tight">
            Community Events
          </h1>
          <p className="text-muted-foreground text-lg md:text-xl max-w-2xl text-balance">
            Connect with collectors at the biggest trading card conventions and discover the rarest cards at trade shows and exhibits across Australia.
          </p>
        </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto px-4 py-16 w-full">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex flex-col gap-4 bg-card p-4 rounded-2xl border border-border shadow-sm">
                <Skeleton className="aspect-[16/9] w-full rounded-xl bg-background" />
                <Skeleton className="h-6 w-3/4 bg-background" />
                <Skeleton className="h-4 w-full bg-background" />
                <Skeleton className="h-4 w-2/3 bg-background" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-24 bg-card rounded-3xl border border-dashed border-border shadow-sm">
            <CalendarDays className="w-12 h-12 text-destructive mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-foreground mb-2">Connection Issue</h3>
            <p className="text-muted-foreground">{error}</p>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-24 bg-card rounded-3xl border border-dashed border-border shadow-sm">
            <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-foreground mb-2">No upcoming events</h3>
            <p className="text-muted-foreground">Check back soon as we continuously update our schedule.</p>
          </div>
        ) : (
          <div className="space-y-16">
            {Object.entries(groupedEvents).map(([monthYear, monthEvents]) => (
              <section key={monthYear}>
                <div className="flex items-center gap-4 mb-8">
                  <h2 className="font-serif text-3xl font-bold text-foreground">{monthYear}</h2>
                  <div className="flex-1 h-px bg-border mt-2" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {monthEvents.map(event => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommunityEventsPage;