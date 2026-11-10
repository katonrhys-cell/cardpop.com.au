import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, Plus, Pencil, ExternalLink, Info, MapPin, Store, BadgeCheck, RotateCcw, Trash2, FileText, Star } from 'lucide-react';
import { toast } from 'sonner';
import AccountPageShell from '@/components/account/AccountPageShell.jsx';
import EventFormModal from '@/components/EventFormModal.jsx';
import OrganiserVendorsDialog from '@/components/events/OrganiserVendorsDialog.jsx';
import EventBadgeDialog from '@/components/events/EventBadgeDialog.jsx';
import FeatureEventDialog from '@/components/events/FeatureEventDialog.jsx';
import { featureEligibility, todayInAustralia } from '@/utils/featuredPackages.js';
import { MY_EVENT_BUCKETS, myEventBucket, countMyEventBuckets, normaliseBucket } from '@/utils/myEventStatus.js';
import WorkspaceReferralCard from '@/components/WorkspaceReferralCard.jsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { eventPath, formatEventDate, formatEventLocation } from '@/lib/eventSeo.js';

const STATUS_BADGES = {
  draft:          { label: 'Draft',          cls: 'bg-muted text-muted-foreground border-dashed border-border' },
  pending_review: { label: 'Pending Review', cls: 'bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-400' },
  approved:       { label: 'Live',           cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:text-emerald-400' },
  rejected:       { label: 'Rejected',       cls: 'bg-destructive/10 text-destructive border-destructive/30' },
  cancelled:      { label: 'Cancelled',      cls: 'bg-muted text-muted-foreground border-border' },
  completed:      { label: 'Completed',      cls: 'bg-slate-500/10 text-slate-600 border-slate-300 dark:text-slate-400' },
};

// An approved event's badge follows the calendar: on today, or finished.
const BUCKET_BADGES = {
  now:  { label: 'Happening now', cls: 'bg-primary/10 text-primary border-primary/40' },
  past: { label: 'Past',          cls: 'bg-slate-500/10 text-slate-600 border-slate-300 dark:text-slate-400' },
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
  const [badgeEvent, setBadgeEvent] = useState(null);
  const [featureEvent, setFeatureEvent] = useState(null);
  const today = todayInAustralia();

  // `silent`: refresh after a save without swapping the list for skeletons.
  const fetchMyEvents = useCallback(async ({ silent = false } = {}) => {
    if (!currentUser?.id) return;
    if (!silent) setIsLoading(true);
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
      if (silent) {
        toast.error('Saved — but we couldn’t refresh your list. Reload the page to see the latest.');
      } else {
        setLoadError('We couldn’t load your events right now. Please try again shortly.');
        setEvents([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => { fetchMyEvents(); }, [fetchMyEvents]);
  const refreshAfterSave = useCallback(() => fetchMyEvents({ silent: true }), [fetchMyEvents]);

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

  // `?new=1` (the "List an event" option after email confirmation) opens the
  // submit form straight away; the param is dropped so a refresh or closing
  // the form doesn't reopen it.
  const [searchParams, setSearchParams] = useSearchParams();
  // Back from Stripe after paying for Featured Placement. The webhook switches
  // featuring on; refetch shortly so the badge shows without a reload.
  useEffect(() => {
    if (searchParams.get('featured') !== 'success') return undefined;
    toast.success('Payment received. Your event is now featured.');
    const next = new URLSearchParams(searchParams);
    next.delete('featured');
    setSearchParams(next, { replace: true });
    const t = setTimeout(() => fetchMyEvents({ silent: true }), 3000);
    return () => clearTimeout(t);
  }, [searchParams, setSearchParams, fetchMyEvents]);

  // `?feature=1` ("Feature Now" on /list-your-event): open the package picker
  // for the one event that can be featured, point at the buttons if there are
  // several, or open the submit form when there's nothing to feature yet.
  useEffect(() => {
    if (isLoading || searchParams.get('feature') !== '1') return;
    const next = new URLSearchParams(searchParams);
    next.delete('feature');
    setSearchParams(next, { replace: true });
    const featurable = events.filter((ev) => featureEligibility(ev, today).ok);
    if (featurable.length === 1) setFeatureEvent(featurable[0]);
    else if (featurable.length > 1) toast.info('Press "Feature" next to the event you want to promote.');
    else {
      toast.info('Submit your event first. You can feature it straight after.');
      openSubmit();
    }
  }, [isLoading, events, searchParams, setSearchParams, today]);

  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    openSubmit();
    const next = new URLSearchParams(searchParams);
    next.delete('new');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // Only a draft can be deleted by its organiser (RLS); submitted and live
  // events are the CardPop team's to remove.
  const deleteDraft = async (event) => {
    if (!window.confirm(`Delete the draft “${event.title}”? This can’t be undone.`)) return;
    const { data, error } = await supabase.from('events').delete().eq('id', event.id).eq('status', 'draft').select('id');
    if (error || !data?.length) {
      toast.error('Couldn’t delete that draft. Please try again.');
      return;
    }
    setEvents((prev) => prev.filter((ev) => ev.id !== event.id));
    toast.success('Draft deleted.');
  };
  const openEdit = (event) => { setEditingEvent(event); setIsModalOpen(true); };

  const drafts = events.filter((ev) => ev.status === 'draft');
  const submitted = events.filter((ev) => ev.status !== 'draft');

  // `?status=` picks a lifecycle tab (the dashboard's Active Events tile
  // links to `?status=live`). Unknown values fall back to All.
  const bucket = normaliseBucket(searchParams.get('status'));
  const counts = countMyEventBuckets(events, today);
  const bucketMeta = MY_EVENT_BUCKETS.find((b) => b.key === bucket);
  const bucketEvents = bucket === 'all' ? events : events.filter((ev) => myEventBucket(ev, today) === bucket);
  const selectBucket = (key) => {
    const next = new URLSearchParams(searchParams);
    if (key === 'all') next.delete('status'); else next.set('status', key);
    setSearchParams(next, { replace: true });
  };

  const renderEvent = (event) => {
    const eventBucket = myEventBucket(event, today);
    const badge = (event.status === 'approved' && BUCKET_BADGES[eventBucket])
      || STATUS_BADGES[event.status] || STATUS_BADGES.pending_review;
    return (
      <article key={event.id} aria-labelledby={`event-${event.id}-title`} className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-1.5">
            <h3 id={`event-${event.id}-title`} className="text-lg font-bold text-foreground break-words min-w-0">{event.title}</h3>
            <Badge variant="outline" className={`font-semibold ${badge.cls}`}>{badge.label}</Badge>
            {event.is_featured && (
              <Badge variant="outline" className="font-semibold bg-amber-400/15 text-amber-800 border-amber-400 dark:text-amber-300 gap-1">
                <Star className="w-3 h-3 fill-current" aria-hidden="true" /> Featured
              </Badge>
            )}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 shrink-0" aria-hidden="true" /> {formatEventDate(event)}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" /> <span className="truncate">{formatEventLocation(event)}</span>
            </span>
          </div>
          {event.status === 'pending_review' && (
            <p className="mt-2 text-sm text-muted-foreground">
              With the CardPop team for review — you can keep editing it in the meantime.
            </p>
          )}
          {event.status === 'rejected' && event.rejection_reason && (
            <p className="mt-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
              Reason: {event.rejection_reason}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {isVerifiedOrganiser && (
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => setVendorsEvent(event)} aria-label={`Vendors for ${event.title}`}>
              <Store className="w-3.5 h-3.5" aria-hidden="true" /> Vendors
            </Button>
          )}
          {(event.status === 'draft' || event.status === 'pending_review' || event.status === 'approved') && (
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => openEdit(event)} aria-label={`${event.status === 'draft' ? 'Edit & submit' : 'Edit'} ${event.title}`}>
              <Pencil className="w-3.5 h-3.5" aria-hidden="true" /> {event.status === 'draft' ? 'Edit & submit' : 'Edit'}
            </Button>
          )}
          {event.status === 'draft' && (
            <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 text-muted-foreground hover:text-destructive" onClick={() => deleteDraft(event)} aria-label={`Delete draft ${event.title}`}>
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Delete
            </Button>
          )}
          {event.status === 'rejected' && (
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => openEdit(event)} aria-label={`Edit & resubmit ${event.title}`}>
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> Edit &amp; resubmit
            </Button>
          )}
          {featureEligibility(event, today).ok && (
            <Button size="sm" className="rounded-xl gap-1.5 font-bold" onClick={() => setFeatureEvent(event)} aria-label={`Feature ${event.title}`}>
              <Star className="w-3.5 h-3.5" aria-hidden="true" /> Feature
            </Button>
          )}
          {event.status === 'approved' && (
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => setBadgeEvent(event)} aria-label={`Website badge for ${event.title}`}>
              <BadgeCheck className="w-3.5 h-3.5" aria-hidden="true" /> Website badge
            </Button>
          )}
          {event.status === 'approved' && (
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5" asChild>
              <Link to={eventPath(event)} aria-label={`View ${event.title} live`}>
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /> View Live
              </Link>
            </Button>
          )}
        </div>
      </article>
    );
  };

  return (
    <AccountPageShell
      documentTitle="My Events | CardPop"
      breadcrumb={[{ label: 'Account', path: '/account' }, { label: 'My Events' }]}
      title="My Events"
      description="Submit card events and track their review status."
      actions={
        <Button size="sm" onClick={openSubmit} className="rounded-xl shadow-sm h-10 px-4 font-bold">
          <Plus className="w-4 h-4 mr-2" aria-hidden="true" /> Submit Event
        </Button>
      }
    >

      <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-2xl text-sm text-muted-foreground">
        <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
        <p>
          Every submission is reviewed by the CardPop team before it appears on the{' '}
          <Link to="/events" className="text-primary font-semibold hover:underline">public events calendar</Link>.
          Not ready to submit? <strong>Save Draft</strong> keeps an event private until you are.
          You can edit an event while it&apos;s pending review, or edit and resubmit it if it wasn&apos;t approved.
          Once it&apos;s live, your edits go live straight away and our team is notified of what changed.
          You can only see and edit events you submitted.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4" role="status" aria-label="Loading your events">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
        </div>
      ) : loadError ? (
        <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-destructive/30">
          <CalendarDays className="w-14 h-14 text-destructive mx-auto mb-4 opacity-40" aria-hidden="true" />
          <h2 className="text-xl font-bold mb-2">Couldn’t load your events</h2>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">{loadError}</p>
          <Button onClick={() => fetchMyEvents()} variant="outline" className="rounded-xl font-bold">
            Try again
          </Button>
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-border">
          <CalendarDays className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" aria-hidden="true" />
          <h2 className="text-xl font-bold mb-2">No events yet</h2>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            Running a card show, tournament or trade night? Submit it and reach collectors across Australia.
          </p>
          <Button onClick={openSubmit} className="rounded-xl font-bold">
            <Plus className="w-4 h-4 mr-2" aria-hidden="true" /> Submit Your First Event
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div role="group" aria-label="Filter your events by status" className="-mx-1 px-1 flex gap-2 overflow-x-auto pb-1">
            {MY_EVENT_BUCKETS.filter((b) => b.key === 'all' || b.key === bucket || counts[b.key] > 0).map((b) => (
              <button
                key={b.key}
                type="button"
                onClick={() => selectBucket(b.key)}
                aria-pressed={bucket === b.key}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  bucket === b.key
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-foreground border-border hover:border-primary/40'
                }`}
              >
                {b.label}
                <span className={`tabular-nums text-xs ${bucket === b.key ? 'opacity-90' : 'text-muted-foreground'}`}>{counts[b.key]}</span>
              </button>
            ))}
          </div>

          {bucket !== 'all' ? (
            <section aria-labelledby="bucket-heading" className="space-y-4">
              <div>
                <h2 id="bucket-heading" className="text-lg font-bold">
                  {bucketMeta.label} <span className="text-sm font-semibold text-muted-foreground">({bucketEvents.length})</span>
                </h2>
                {bucketMeta.description && <p className="text-sm text-muted-foreground">{bucketMeta.description}</p>}
              </div>
              {bucketEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground bg-card border border-dashed border-border rounded-2xl p-6 text-center">
                  Nothing here right now.{' '}
                  <button type="button" onClick={() => selectBucket('all')} className="text-primary font-semibold hover:underline">Show all events</button>
                </p>
              ) : bucketEvents.map(renderEvent)}
            </section>
          ) : (
        <div className="space-y-8">
          {drafts.length > 0 && (
            <section aria-labelledby="drafts-heading" className="space-y-4">
              <div>
                <h2 id="drafts-heading" className="text-lg font-bold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-muted-foreground" aria-hidden="true" /> Drafts
                  <span className="text-sm font-semibold text-muted-foreground">({drafts.length})</span>
                </h2>
                <p className="text-sm text-muted-foreground">
                  Only you can see these. Finish them off, then <strong>Submit for Review</strong> when they’re ready — we’re only notified once you submit.
                </p>
              </div>
              {drafts.map(renderEvent)}
            </section>
          )}
          {submitted.length > 0 && (
            <section aria-labelledby="submitted-heading" className="space-y-4">
              <h2 id="submitted-heading" className={drafts.length > 0 ? 'text-lg font-bold' : 'sr-only'}>Submitted &amp; live</h2>
              {submitted.map(renderEvent)}
            </section>
          )}
        </div>
          )}
        </div>
      )}

      {!isLoading && !loadError && <WorkspaceReferralCard placement="organiser" />}

      <OrganiserVendorsDialog event={vendorsEvent} onClose={() => setVendorsEvent(null)} />
      <EventBadgeDialog event={badgeEvent} onClose={() => setBadgeEvent(null)} />
      <FeatureEventDialog event={featureEvent} onClose={() => setFeatureEvent(null)} />

      <EventFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        event={editingEvent}
        mode="user"
        onSaved={refreshAfterSave}
      />
    </AccountPageShell>
  );
};

export default AccountEvents;
