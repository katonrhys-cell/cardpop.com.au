import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { CalendarDays, Plus, Pencil, ExternalLink, Info, MapPin } from 'lucide-react';
import Breadcrumb from '@/components/Breadcrumb.jsx';
import EventFormModal from '@/components/EventFormModal.jsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { eventPath, formatEventDate, formatEventLocation } from '@/lib/eventSeo.js';

const STATUS_BADGES = {
  pending_review: { label: 'Pending Review', cls: 'bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-400' },
  approved:       { label: 'Live',           cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:text-emerald-400' },
  rejected:       { label: 'Rejected',       cls: 'bg-destructive/10 text-destructive border-destructive/30' },
  cancelled:      { label: 'Cancelled',      cls: 'bg-muted text-muted-foreground border-border' },
  completed:      { label: 'Completed',      cls: 'bg-slate-500/10 text-slate-600 border-slate-300 dark:text-slate-400' },
};

const AccountEvents = () => {
  const { currentUser } = useAuth();
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  const fetchMyEvents = useCallback(async () => {
    if (!currentUser?.id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('organiser_id', currentUser.id)
        .order('start_date', { ascending: false });
      if (error) throw error;
      setEvents(data || []);
    } catch (err) {
      console.error('Error fetching my events:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => { fetchMyEvents(); }, [fetchMyEvents]);

  const openSubmit = () => { setEditingEvent(null); setIsModalOpen(true); };
  const openEdit = (event) => { setEditingEvent(event); setIsModalOpen(true); };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 w-full space-y-6">
      <Helmet><title>My Events | CardPop</title></Helmet>
      <Breadcrumb items={[{ label: 'Account', path: '/account' }, { label: 'My Events' }]} />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">My Events</h1>
          <p className="text-muted-foreground mt-1">Submit card events and track their review status.</p>
        </div>
        <Button onClick={openSubmit} className="font-bold rounded-xl h-11 px-6 shadow-sm shrink-0">
          <Plus className="w-5 h-5 mr-2" /> Submit Event
        </Button>
      </div>

      <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-2xl text-sm text-muted-foreground">
        <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <p>
          Every submission is reviewed by the CardPop team before it appears on the{' '}
          <Link to="/community/events" className="text-primary font-semibold hover:underline">public events calendar</Link>.
          You can edit your event while it&apos;s pending review.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-border">
          <CalendarDays className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
          <h2 className="text-xl font-bold mb-2">No events yet</h2>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            Running a card show, tournament or trade night? Submit it and reach collectors across Australia.
          </p>
          <Button onClick={openSubmit} className="rounded-xl font-bold">
            <Plus className="w-4 h-4 mr-2" /> Submit Your First Event
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map(event => {
            const badge = STATUS_BADGES[event.status] || STATUS_BADGES.pending_review;
            return (
              <div key={event.id} className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-1.5">
                    <h3 className="text-lg font-bold text-foreground truncate">{event.title}</h3>
                    <Badge variant="outline" className={`font-semibold ${badge.cls}`}>{badge.label}</Badge>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="w-4 h-4" /> {formatEventDate(event)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4" /> <span className="truncate">{formatEventLocation(event)}</span>
                    </span>
                  </div>
                  {event.status === 'rejected' && event.rejection_reason && (
                    <p className="mt-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
                      Reason: {event.rejection_reason}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  {event.status === 'pending_review' && (
                    <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => openEdit(event)}>
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </Button>
                  )}
                  {event.status === 'approved' && (
                    <Button variant="outline" size="sm" className="rounded-xl gap-1.5" asChild>
                      <Link to={eventPath(event)}>
                        <ExternalLink className="w-3.5 h-3.5" /> View Live
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <EventFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        event={editingEvent}
        mode="user"
        onSaved={fetchMyEvents}
      />
    </div>
  );
};

export default AccountEvents;
