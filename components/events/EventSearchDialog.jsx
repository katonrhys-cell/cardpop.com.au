import React, { useEffect, useState } from 'react';
import { Eye, Loader2, MousePointerClick, Search, TrendingUp } from 'lucide-react';
import apiServerClient from '@/lib/apiServerClient.js';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { describeRange, formatCtr, formatPosition } from '@/utils/eventSearchStats.js';

// "Search" on a live event in Account → My Events: how the event's page is doing
// in Google (Search Console, last 28 days). Owner-only — the API checks it.
// docs/event-views.md

const Tile = ({ icon: Icon, label, value }) => (
  <div className="rounded-xl border border-border bg-muted/30 p-3">
    <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
      <Icon className="w-3.5 h-3.5" aria-hidden="true" /> {label}
    </p>
    <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
  </div>
);

export default function EventSearchDialog({ event, open, onOpenChange }) {
  const [state, setState] = useState({ status: 'loading', data: null });

  useEffect(() => {
    if (!open || !event?.id) return undefined;
    let cancelled = false;
    setState({ status: 'loading', data: null });
    (async () => {
      try {
        const res = await apiServerClient.fetch(`/events/${event.id}/search-performance`);
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.status === 503) return setState({ status: 'unconfigured', data: null });
        if (!res.ok) return setState({ status: 'error', data: null });
        setState({ status: body.available ? 'ready' : 'notlive', data: body });
      } catch {
        if (!cancelled) setState({ status: 'error', data: null });
      }
    })();
    return () => { cancelled = true; };
  }, [open, event?.id]);

  const { status, data } = state;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Google search: {event?.title}</DialogTitle>
          <DialogDescription>
            How your event page shows up in Google Search.
            {data?.startDate && <> {describeRange(data.startDate, data.endDate)}.</>}
          </DialogDescription>
        </DialogHeader>

        {status === 'loading' && (
          <p className="flex items-center gap-2 text-muted-foreground py-6">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading…
          </p>
        )}
        {status === 'error' && <p className="text-sm text-muted-foreground py-4">We couldn’t load Google’s figures just now. Please try again shortly.</p>}
        {status === 'unconfigured' && <p className="text-sm text-muted-foreground py-4">Google search figures aren’t available yet.</p>}
        {status === 'notlive' && <p className="text-sm text-muted-foreground py-4">Search figures appear once your event is live.</p>}

        {status === 'ready' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Tile icon={Eye} label="Impressions" value={data.impressions.toLocaleString('en-AU')} />
              <Tile icon={MousePointerClick} label="Clicks" value={data.clicks.toLocaleString('en-AU')} />
              <Tile icon={TrendingUp} label="Click rate" value={formatCtr(data.ctr)} />
              <Tile icon={Search} label="Avg position" value={formatPosition(data.position)} />
            </div>

            {data.impressions === 0 ? (
              <p className="text-sm text-muted-foreground">
                Google hasn’t shown this page in results yet. New pages can take a few days to appear, and
                figures run about two days behind.
              </p>
            ) : (
              <div>
                <h3 className="text-sm font-bold mb-2">Top searches that showed your event</h3>
                {data.queries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Google hides rare searches to protect searchers’ privacy.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                          <th className="py-1.5 pr-3 font-bold">Search</th>
                          <th className="py-1.5 px-2 font-bold text-right">Shown</th>
                          <th className="py-1.5 px-2 font-bold text-right">Clicks</th>
                          <th className="py-1.5 pl-2 font-bold text-right">Position</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.queries.map((q) => (
                          <tr key={q.query} className="border-b border-border/50 last:border-0">
                            <td className="py-1.5 pr-3 break-words">{q.query}</td>
                            <td className="py-1.5 px-2 text-right tabular-nums">{q.impressions.toLocaleString('en-AU')}</td>
                            <td className="py-1.5 px-2 text-right tabular-nums">{q.clicks.toLocaleString('en-AU')}</td>
                            <td className="py-1.5 pl-2 text-right tabular-nums">{formatPosition(q.position)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Figures come from Google Search Console and run about two days behind. Position 1 is the top result.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
