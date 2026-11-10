import React, { useEffect, useState } from 'react';
import { Users, Eye, Search, MousePointerClick, CalendarDays } from 'lucide-react';
import { getPlatformStats, getTrafficSummary } from '@/lib/homepageData.js';
import {
  formatCount, publicPageviewStat, publicSearchStats, publicTrafficStat,
} from '@/utils/siteTraffic.js';

/**
 * "Who you'll reach": CardPop's live audience, for organisers deciding whether
 * to list or feature an event (/list-your-event and the Feature dialog in My
 * Events). Same nightly GA4 / Search Console summary the home page reads, so
 * every tile hides below its floor or when the sync is stale
 * (utils/siteTraffic.js). Nothing is typed in by hand.
 */
export const buildOrganiserStats = (trafficSummary, platformStats) => {
  const stats = [];
  const visitors = publicTrafficStat(trafficSummary);
  if (visitors) stats.push({ ...visitors, label: 'Visitors in the last 30 days' });
  const pageviews = publicPageviewStat(trafficSummary);
  if (pageviews) stats.push({ ...pageviews, label: 'Page views in the last 30 days' });
  const [impressions, clicks] = publicSearchStats(trafficSummary);
  if (impressions) stats.push({ ...impressions, label: 'Times CardPop showed in Google, last 30 days' });
  if (clicks) stats.push({ ...clicks, label: 'Clicks from Google, last 30 days' });
  const events = Number(platformStats?.events) || 0;
  if (events > 0) stats.push({ key: 'events', value: events, label: 'Upcoming events on the calendar' });
  return stats;
};

const STAT_ICONS = { visitors: Users, pageviews: Eye, impressions: Search, clicks: MousePointerClick, events: CalendarDays };

export const useOrganiserStats = () => {
  const [stats, setStats] = useState([]);
  useEffect(() => {
    let alive = true;
    Promise.all([
      getTrafficSummary().catch(() => null),
      getPlatformStats().catch(() => null),
    ]).then(([traffic, platform]) => {
      if (alive) setStats(buildOrganiserStats(traffic?.data, platform?.data));
    });
    return () => { alive = false; };
  }, []);
  return stats;
};

/** Full-width tiles for /list-your-event. Renders nothing until there's an honest number. */
export const OrganiserReachSection = ({ stats }) => {
  if (!stats.length) return null;
  return (
    <section aria-labelledby="audience-heading">
      <h2 id="audience-heading" className="mb-6 text-center font-serif text-2xl font-bold sm:text-3xl">
        Who you&rsquo;ll reach
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {stats.map((s) => {
          const Icon = STAT_ICONS[s.key] || Users;
          return (
            <div key={s.key} className="rounded-3xl border border-border bg-card p-4 text-center sm:p-6">
              <Icon className="mx-auto mb-3 h-5 w-5 text-primary" aria-hidden="true" />
              <div className="text-2xl font-bold tabular-nums sm:text-3xl">{formatCount(s.value)}</div>
              <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
              {s.sub && <div className="mt-1 text-xs text-muted-foreground/80">{s.sub}</div>}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        From Google Analytics and Search Console, updated nightly.
      </p>
    </section>
  );
};

/** Compact strip for the Feature dialog. */
export const OrganiserReachStrip = ({ stats }) => {
  const shown = stats.filter((s) => s.key !== 'events').slice(0, 4);
  if (!shown.length) return null;
  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">CardPop in the last 30 days</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
        {shown.map((s) => (
          <div key={s.key}>
            <dt className="text-xs text-muted-foreground">{s.label.replace(/,? (in the )?last 30 days$/i, '')}</dt>
            <dd className="text-lg font-bold tabular-nums text-foreground">{formatCount(s.value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};
