import React, { useCallback, useEffect, useState } from 'react';
import { Eye, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabaseClient.js';
import { apiServerClient } from '@/lib/apiServerClient.js';
import { toast } from 'sonner';
import { formatCount, sparklinePath } from '@/utils/siteTraffic.js';

const SPARK_W = 320;
const SPARK_H = 56;

const fmtDay = (iso) => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' });
};

const fmtSynced = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
};

/**
 * Admin → Dashboard "Visitors" card: GA4 visitor counts synced nightly into
 * site_traffic_summary / site_traffic_daily (docs/site-traffic.md). Shows the
 * last-30-days and since-launch figures, a 30-day sparkline of daily visitors
 * with hover read-out, and a "Sync now" button that runs the same pull the
 * cron does. Self-contained so it can sit on any admin page.
 */
const SiteTrafficCard = () => {
  const [summary, setSummary] = useState(null);
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [hover, setHover] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [sum, daily] = await Promise.all([
      supabase.from('site_traffic_summary').select('*').eq('id', true).maybeSingle(),
      supabase.from('site_traffic_daily').select('day, users, sessions, pageviews').order('day', { ascending: false }).limit(30),
    ]);
    if (sum.error) console.error('[SiteTrafficCard] summary load failed:', sum.error);
    if (daily.error) console.error('[SiteTrafficCard] daily load failed:', daily.error);
    setSummary(sum.data || null);
    setDays(daily.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const syncNow = async () => {
    setSyncing(true);
    try {
      const res = await apiServerClient.fetch('/admin/site-traffic/sync', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Sync failed (${res.status})`);
      const parts = [];
      if (body.visitors_30d != null) parts.push(`${formatCount(body.visitors_30d)} visitors`);
      if (body.search_clicks_30d != null) parts.push(`${formatCount(body.search_clicks_30d)} Google clicks`);
      toast.success(`Synced — ${parts.join(', ') || 'no figures'} in the last 30 days`);
      await load();
    } catch (err) {
      toast.error(err.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const spark = sparklinePath(days, { width: SPARK_W, height: SPARK_H, pad: 3 });
  const configured = Boolean(summary);
  const synced = fmtSynced(summary?.synced_at || summary?.search_synced_at);
  // Search Console figures land in the same row once GSC_SITE_URL is set.
  const hasSearch = Boolean(summary?.search_synced_at);

  const onMove = (e) => {
    if (!spark) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * SPARK_W;
    let best = spark.points[0];
    for (const p of spark.points) if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
    setHover(best);
  };

  return (
    <Card className="shadow-sm border-border" data-testid="site-traffic-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Visitors</CardTitle>
        <Eye className="w-5 h-5 text-primary" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24 mb-2" />
        ) : !configured ? (
          <div className="text-sm text-muted-foreground space-y-2">
            <p>No visitor data yet. Set <code className="text-xs">GA4_PROPERTY_ID</code> and <code className="text-xs">GA4_SERVICE_ACCOUNT_JSON</code> in Vercel (plus <code className="text-xs">GSC_SITE_URL</code> for Google Search clicks and impressions), then run a sync.</p>
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-2 flex-wrap">
              <div className="text-3xl font-extrabold tabular-nums tracking-tight text-foreground">{formatCount(summary.visitors_30d)}</div>
              <span className="text-xs font-medium text-muted-foreground">last 30 days</span>
            </div>
            <p className="text-xs font-medium text-muted-foreground mt-1 tabular-nums">
              {formatCount(summary.visitors_all_time)} since launch
              {summary.since_date ? ` (${fmtDay(summary.since_date)})` : ''}
              {' · '}{formatCount(summary.pageviews_30d)} page views
            </p>
            {hasSearch ? (
              <p className="text-xs font-medium text-muted-foreground mt-1 tabular-nums" data-testid="site-traffic-search">
                Google Search · {formatCount(summary.search_impressions_30d)} impressions, {formatCount(summary.search_clicks_30d)} clicks (30 days)
                {' · '}{formatCount(summary.search_impressions_all_time)} / {formatCount(summary.search_clicks_all_time)} since {fmtDay(summary.search_since_date) || 'launch'}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                Google Search clicks and impressions appear here once <code className="text-[11px]">GSC_SITE_URL</code> is set.
              </p>
            )}
            {spark && (
              <div className="mt-3">
                <svg
                  viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
                  className="w-full h-14 text-primary"
                  role="img"
                  aria-label={`Daily visitors over the last ${spark.points.length} days`}
                  onMouseMove={onMove}
                  onMouseLeave={() => setHover(null)}
                >
                  <path d={spark.area} fill="currentColor" opacity="0.12" />
                  <path d={spark.line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                  {hover && (
                    <>
                      <line x1={hover.x} x2={hover.x} y1={0} y2={SPARK_H} stroke="currentColor" strokeWidth="1" opacity="0.4" />
                      <circle cx={hover.x} cy={hover.y} r="4" fill="currentColor" stroke="hsl(var(--card))" strokeWidth="2" />
                    </>
                  )}
                </svg>
                <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums mt-1">
                  <span>{fmtDay(spark.points[0].day)}</span>
                  <span className="font-medium text-foreground">
                    {hover ? `${fmtDay(hover.day)}: ${formatCount(hover.value)} visitors` : `peak ${formatCount(spark.max)}/day`}
                  </span>
                  <span>{fmtDay(spark.points[spark.points.length - 1].day)}</span>
                </div>
              </div>
            )}
          </>
        )}
        <div className="flex items-center justify-between mt-3 gap-2">
          <span className="text-[11px] text-muted-foreground">{synced ? `Synced ${synced}` : 'Nightly from Google Analytics'}</span>
          <Button variant="outline" size="sm" className="rounded-lg h-7 text-xs" onClick={syncNow} disabled={syncing}>
            <RefreshCw className={`w-3 h-3 mr-1 ${syncing ? 'animate-spin' : ''}`} /> Sync now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SiteTrafficCard;
