import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Plus, Pencil, ExternalLink, Info, MapPin, Store } from 'lucide-react';
import AccountPageShell from '@/components/account/AccountPageShell.jsx';
import EventFormModal from '@/components/EventFormModal.jsx';
import OrganiserVendorsDialog from '@/components/events/OrganiserVendorsDialog.jsx';
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
  const [loadError, setLoadError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [isVerifiedOrganiser, setIsVerifiedOrganiser] = useState(false);
  const [vendorsEvent, setVendorsEvent] = useState(null);

  const fetchMyEvents = useCallback(async () => {
    if (!currentUser?.id) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('organiser_id', currentUser.id)
        .order('start_date', { ascending: false });
      if (error) throw error;
      setEvents(data || []);
    } catch (err) {
      console.error('Failed to load your events:', err);
      setLoadError('We couldn’t load your events right now. Please try again shortly.');
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => { fetchMyEvents(); }, [fetchMyEvents]);

  // A verified organiser (set by an admin) can see the vendor list for their
  // events. RLS lets a user read only their own verification row.
  useEffect(() => {
    if (!currentUser?.id) return undefined;
    let cancelled = false;
    supabase
      .from('event_organiser_verifications')
      .select('user_id')
      .eq('user_id', currentUser.id)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) setIsVerifiedOrganiser(!!data); });
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  const openSubmit = () => { setEditingEvent(null); setIsModalOpen(true); };
  const openEdit = (event) => { setEditingEvent(event); setIsModalOpen(true); };

  return (
    <AccountPageShell
      documentTitle="My Events | CardPop"
      breadcrumb={[{ label: 'Account', path: '/account' }, { label: 'My Events' }]}
      title="My Events"
      description="Submit card events and track their review status."
      actions={
        <Button size="sm" onClick={openSubmit} className="rounded-xl shadow-sm h-10 px-4 font-bold">
          <Plus className="w-4 h-4 mr-2" /> Submit Event
        </Button>
      }
    >

      <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-2xl text-sm text-muted-foreground">
        <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <p>
          Every submission is reviewed by the CardPop team before it appears on the{' '}
          <Link to="/events" className="text-primary font-semibold hover:underline">public events calendar</Link>.
          You can edit your event while it&apos;s pending review.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
        </div>
      ) : loadError ? (
        <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-destructive/30">
          <CalendarDays className="w-14 h-14 text-destructive mx-auto mb-4 opacity-40" />
          <h2 className="text-xl font-bold mb-2">Couldn’t load your events</h2>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">{loadError}</p>
          <Button onClick={fetchMyEvents} variant="outline" className="rounded-xl font-bold">
            Try again
          </Button>
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
                  {isVerifiedOrganiser && (
                    <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => setVendorsEvent(event)}>
                      <Store className="w-3.5 h-3.5" /> Vendors
                    </Button>
                  )}
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

      <OrganiserVendorsDialog event={vendorsEvent} onClose={() => setVendorsEvent(null)} />

      <EventFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        event={editingEvent}
        mode="user"
        onSaved={fetchMyEvents}
      />
    </AccountPageShell>
  );
};

export default AccountEvents;
