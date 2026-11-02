import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarDays, History, ArrowLeft, Users } from 'lucide-react';
import SEOHead from '@/components/SEOHead.jsx';
import EventCard from '@/components/EventCard.jsx';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient.js';
import { EVENT_CARD_COLUMNS } from '@/lib/eventColumns.js';
import { SITE_URL, toLocalDateStr } from '@/lib/eventSeo.js';
import { isPastEvent } from '@/utils/eventPast.js';
import { safeLogoUrl, isVideoLogoUrl } from '@/utils/eventOrganiserLogo.js';
import { publicImageUrl, publicVideoUrl } from '@/utils/imageUrl.js';
import { ilikeContains, namesOrganiser, organiserPath } from '@/utils/eventOrganisers.js';

// /events/organisers/:slug — an organiser's page: their logo and every public
// event (upcoming and past) whose organizer_name names them, including events
// they co-hosted. Reached from the organiser name / logo on an event page.
const EVENT_LIMIT = 200;

const OrganiserLogo = ({ org }) => {
  const url = safeLogoUrl(org?.logo_url);
  const [failed, setFailed] = useState(false);
  const box = 'w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-white border border-border object-contain p-2 shrink-0';
  if (!url || failed) {
    return (
      <div className={`${box} flex items-center justify-center bg-primary/10`}>
        <Users className="w-10 h-10 text-primary" aria-hidden="true" />
      </div>
    );
  }
  return isVideoLogoUrl(url) ? (
    <video src={publicVideoUrl(url)} autoPlay muted loop playsInline aria-label={`${org.name} logo`} onError={() => setFailed(true)} className={box} />
  ) : (
    <img src={publicImageUrl(url)} alt={`${org.name} logo`} onError={() => setFailed(true)} className={box} />
  );
};

const EventGrid = ({ events }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
    {events.map(event => <EventCard key={event.id} event={event} isAdmin={false} />)}
  </div>
);

export default function EventOrganiserPage() {
  const { slug } = useParams();
  const [org, setOrg] = useState(null);
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | missing | error

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus('loading');
      try {
        const { data: found, error: orgError } = await supabase
          .from('event_organisers')
          .select('id, name, slug, logo_url')
          .eq('slug', slug)
          .maybeSingle();
        if (orgError) throw orgError;
        if (!found) { if (!cancelled) setStatus('missing'); return; }

        const { data: rows, error: eventsError } = await supabase
          .from('events_public')
          .select(`${EVENT_CARD_COLUMNS},organizer_logo_url`)
          .ilike('organizer_name', ilikeContains(found.name))
          .order('start_date', { ascending: false })
          .limit(EVENT_LIMIT);
        if (eventsError) throw eventsError;
        if (cancelled) return;
        setOrg(found);
        // ilike is a substring match; keep only whole-name mentions.
        setEvents((rows || []).filter(e => namesOrganiser(e.organizer_name, found.name)));
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const { upcoming, past } = useMemo(() => {
    const today = toLocalDateStr(new Date());
    const up = [];
    const done = [];
    for (const e of events) {
      if (e.status === 'approved' && !isPastEvent(e, today)) up.push(e); else done.push(e);
    }
    up.sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));
    return { upcoming: up, past: done };
  }, [events]);

  if (status === 'missing' || status === 'error') {
    return (
      <div className="max-w-3xl mx-auto px-5 py-24 text-center">
        <SEOHead title="Organiser not found | CardPop Events" noindex />
        <h1 className="text-2xl font-bold mb-3">{status === 'missing' ? 'Organiser not found' : 'Could not load this organiser'}</h1>
        <p className="text-muted-foreground mb-6">
          {status === 'missing' ? 'This organiser page doesn’t exist or has moved.' : 'Please try again in a moment.'}
        </p>
        <Button asChild><Link to="/events">Browse all events</Link></Button>
      </div>
    );
  }

  const name = org?.name ?? '';
  const total = upcoming.length + past.length;
  const description = name
    ? `Card shows and trading card events hosted by ${name}: ${upcoming.length} upcoming and ${past.length} past event${past.length === 1 ? '' : 's'} on CardPop.`
    : '';

  return (
    <div className="min-h-screen bg-background">
      {status === 'ready' && (
        <SEOHead
          title={`${name} — Card Shows & Events | CardPop`}
          description={description}
          canonicalUrl={`${SITE_URL}${organiserPath(org)}`}
          ogImage={safeLogoUrl(org.logo_url) && !isVideoLogoUrl(org.logo_url) ? publicImageUrl(org.logo_url) : undefined}
          noindex={total === 0}
        />
      )}

      <section className="border-b border-border bg-card">
        <div className="max-w-[90rem] mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 py-10">
          <Link to="/events" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> All events
          </Link>
          {status === 'loading' ? (
            <div className="flex items-center gap-6">
              <Skeleton className="w-24 h-24 md:w-32 md:h-32 rounded-2xl" />
              <div className="space-y-3"><Skeleton className="h-8 w-64" /><Skeleton className="h-4 w-40" /></div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
              <OrganiserLogo org={org} />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Event organiser</p>
                <h1 className="font-serif text-3xl md:text-5xl font-extrabold text-foreground leading-tight">{name}</h1>
                <p className="text-muted-foreground mt-2">
                  {total === 0
                    ? 'No public events listed yet.'
                    : `${upcoming.length} upcoming · ${past.length} past event${past.length === 1 ? '' : 's'} on CardPop`}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="max-w-[90rem] mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 py-12 space-y-14">
        {status === 'loading' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[0, 1, 2].map(i => <Skeleton key={i} className="h-80 rounded-2xl" />)}
          </div>
        ) : (
          <>
            <section aria-labelledby="org-upcoming">
              <div className="flex items-center gap-4 mb-6">
                <CalendarDays className="w-6 h-6 text-primary" aria-hidden="true" />
                <h2 id="org-upcoming" className="text-2xl font-bold whitespace-nowrap">Upcoming events</h2>
                <div className="flex-1 h-px bg-border" />
                <Badge variant="secondary">{upcoming.length}</Badge>
              </div>
              {upcoming.length ? <EventGrid events={upcoming} /> : (
                <p className="text-muted-foreground">No upcoming events from {name} right now — check back soon.</p>
              )}
            </section>

            {past.length > 0 && (
              <section aria-labelledby="org-past">
                <div className="flex items-center gap-4 mb-6">
                  <History className="w-6 h-6 text-primary" aria-hidden="true" />
                  <h2 id="org-past" className="text-2xl font-bold whitespace-nowrap">Past events</h2>
                  <div className="flex-1 h-px bg-border" />
                  <Badge variant="secondary">{past.length}</Badge>
                </div>
                <EventGrid events={past} />
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
