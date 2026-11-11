import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, Eye, Search, Plus, Pencil, ExternalLink, Info, MapPin, Store, BadgeCheck, RotateCcw, Trash2, FileText, Star } from 'lucide-react';
import { toast } from 'sonner';
import AccountPageShell from '@/components/account/AccountPageShell.jsx';
import EventFormModal from '@/components/EventFormModal.jsx';
import OrganiserAccessCard from '@/components/events/OrganiserAccessCard.jsx';
import { useOrganiserAccess } from '@/hooks/useOrganiserAccess.js';
import OrganiserVendorsDialog from '@/components/events/OrganiserVendorsDialog.jsx';
import EventSearchDialog from '@/components/events/EventSearchDialog.jsx';
import EventBadgeDialog from '@/components/events/EventBadgeDialog.jsx';
import FeatureEventDialog from '@/components/events/FeatureEventDialog.jsx';
import FeatureUpsellCard from '@/components/events/FeatureUpsellCard.jsx';
import {
  BUNDLE, FEATURED_PACKAGES, bundleCents, featureEligibility, formatAud, todayInAustralia,
} from '@/utils/featuredPackages.js';
import { MY_EVENT_BUCKETS, myEventBucket, countMyEventBuckets, normaliseBucket } from '@/utils/myEventStatus.js';
import WorkspaceReferralCard from '@/components/WorkspaceReferralCard.jsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { fetchEventViewStats, formatViews } from '@/lib/eventViews.js';
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
  // { [eventId]: { total, last7, last30 } } — other people's views of live events.
  const [viewStats, setViewStats] = useState({});
  const organiserAccess = useOrganiserAccess(currentUser?.id);
  const [vendorsEvent, setVendorsEvent] = useState(null);
  const [badgeEvent, setBadgeEvent] = useState(null);
  const [searchEvent, setSearchEvent] = useState(null);
  const [featureEvent, setFeatureEvent] = useState(null);
  const [featurePack, setFeaturePack] = useState(false);
  const today = todayInAustralia();
  // Soonest first: the pack picker ticks the next shows by default.
  const featurableEvents = useMemo(
    () => events
      .filter((ev) => featureEligibility(ev, today).ok)
      .sort((a, b) => String(a.start_date || '').localeCompare(String(b.start_date || ''))),
    [events, today],
  );

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
      // Best-effort: view counts never block the list.
      const liveIds = (data || []).filter((ev) => ev.status === 'approved' || ev.status === 'completed').map((ev) => ev.id);
      fetchEventViewStats(liveIds).then(setViewStats);
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
  // The event just submitted for review — offered featuring once, right away.
  const [justSubmittedId, setJustSubmittedId] = useState(null);

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
  // `?feature=<event id>` (the "your event is live" email) opens that event's
  // picker when it can still be featured.
  useEffect(() => {
    const wanted = searchParams.get('feature');
    if (isLoading || !wanted) return;
    const next = new URLSearchParams(searchParams);
    next.delete('feature');
    setSearchParams(next, { replace: true });
    const featurable = events.filter((ev) => featureEligibility(ev, today).ok);
    if (wanted !== '1') {
      const target = events.find((ev) => ev.id === wanted);
      if (target && featureEligibility(target, today).ok) setFeatureEvent(target);
      else if (target) toast.info(featureEligibility(target, today).reason);
      return;
    }
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

  // `?status=` picks a lifecycle tab, so a tab can be linked to directly.
  // Unknown values fall back to All.
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
          {(event.status === 'approved' || event.status === 'completed') && (() => {
            const v = viewStats[event.id] || { total: 0, last7: 0, last30: 0 };
            return (
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground" data-testid={`event-views-${event.id}`}>
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Eye className="w-4 h-4 shrink-0" aria-hidden="true" /> {formatViews(v.total)}
                </span>
                <span>{v.last7.toLocaleString('en-AU')} in the last 7 days</span>
                <span>{v.last30.toLocaleString('en-AU')} in the last 30 days</span>
              </p>
            );
          })()}
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
          {/* A draft's one job is to be finished and submitted, so its button
              is the page's primary action: a red pill, white capitals. */}
          {event.status === 'draft' && (
            <Button size="sm" className="rounded-full gap-1.5 px-4 bg-primary text-primary-foreground hover:bg-primary/90 font-bold uppercase tracking-wide" onClick={() => openEdit(event)} aria-label={`Edit & submit ${event.title}`}>
              <Pencil className="w-3.5 h-3.5" aria-hidden="true" /> Edit &amp; submit
            </Button>
          )}
          {(event.status === 'pending_review' || event.status === 'approved') && (
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => openEdit(event)} aria-label={`Edit ${event.title}`}>
              <Pencil className="w-3.5 h-3.5" aria-hidden="true" /> Edit
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
          {(event.status === 'approved' || event.status === 'completed') && (
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => setSearchEvent(event)} aria-label={`Google search figures for ${event.title}`}>
              <Search className="w-3.5 h-3.5" aria-hidden="true" /> Search
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

      <OrganiserAccessCard access={organiserAccess} />

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

      {(() => {
        const submitted = justSubmittedId && events.find((ev) => ev.id === justSubmittedId);
        if (!submitted || !featureEligibility(submitted, today).ok) return null;
        return (
          <FeatureUpsellCard
            event={submitted}
            today={today}
            onFeature={() => { setFeatureEvent(submitted); setJustSubmittedId(null); }}
            onDismiss={() => setJustSubmittedId(null)}
          />
        );
      })()}

      {!isLoading && !loadError && featurableEvents.length >= BUNDLE.size && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold text-foreground flex items-center gap-2">
              <Star className="w-4 h-4 text-primary fill-current" aria-hidden="true" /> Feature {BUNDLE.size} events, pay less
            </p>
            <p className="text-sm text-muted-foreground">
              The {BUNDLE.size}-event pack features three of your shows in one payment, from {formatAud(bundleCents(FEATURED_PACKAGES[0].key))} instead of {formatAud(FEATURED_PACKAGES[0].priceAud * 100 * BUNDLE.size)}.
            </p>
          </div>
          <Button
            size="sm"
            className="rounded-xl gap-1.5 font-bold shrink-0"
            onClick={() => { setFeaturePack(true); setFeatureEvent(featurableEvents[0]); }}
          >
            <Star className="w-3.5 h-3.5" aria-hidden="true" /> Choose {BUNDLE.size} events
          </Button>
        </div>
      )}

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
      {searchEvent && (
        <EventSearchDialog event={searchEvent} open onOpenChange={(o) => { if (!o) setSearchEvent(null); }} />
      )}
      <FeatureEventDialog
        event={featureEvent}
        featurable={featurableEvents}
        startInPack={featurePack}
        onClose={() => { setFeatureEvent(null); setFeaturePack(false); }}
      />

      <EventFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        event={editingEvent}
        mode="user"
        onSaved={refreshAfterSave}
        onSubmitted={setJustSubmittedId}
      />
    </AccountPageShell>
  );
};

export default AccountEvents;
