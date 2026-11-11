import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fetchEventViewSeries } from '@/lib/eventViews.js';
import { axisTicks, barGeometry, describeSeries, longDay, shortDay, summarizeSeries } from '@/utils/eventViewsChart.js';

// "Trend" on a live event in Account → My Events: views per day for the last
// 30 days. Owner-only — the database checks it. docs/event-views.md

const W = 600;
const H = 160;
const DAYS = 30;

export default function EventViewsDialog({ event, open, onOpenChange }) {
  const [state, setState] = useState({ status: 'loading', series: [] });

  useEffect(() => {
    if (!open || !event?.id) return undefined;
    let cancelled = false;
    setState({ status: 'loading', series: [] });
    fetchEventViewSeries(event.id, DAYS).then((series) => {
      if (!cancelled) setState({ status: series.length ? 'ready' : 'error', series });
    });
    return () => { cancelled = true; };
  }, [open, event?.id]);

  const { series } = state;
  const { bars, yMax } = useMemo(() => barGeometry(series, { width: W, height: H }), [series]);
  const { total, days } = useMemo(() => summarizeSeries(series), [series]);
  const summary = describeSeries(series);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Views: {event?.title}</DialogTitle>
          <DialogDescription>
            How many people opened your event page each day{days ? `, last ${days} days` : ''}. Your own visits aren’t counted.
          </DialogDescription>
        </DialogHeader>

        {state.status === 'loading' && (
          <p className="flex items-center gap-2 text-muted-foreground py-6">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading…
          </p>
        )}
        {state.status === 'error' && (
          <p className="text-sm text-muted-foreground py-4">We couldn’t load your views just now. Please try again shortly.</p>
        )}

        {state.status === 'ready' && (
          <div className="space-y-3">
            <p className="text-sm font-semibold" data-testid="views-summary">{summary}</p>
            {total === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nobody has opened this page in this window yet. Sharing the link, or featuring the event, is the quickest way to change that.
              </p>
            ) : (
              <svg
                viewBox={`-34 -8 ${W + 42} ${H + 34}`}
                role="img"
                aria-label={summary}
                className="w-full h-auto text-muted-foreground"
              >
                {/* y axis: 0, half and the top of the scale */}
                {axisTicks(yMax).map((f) => (
                  <g key={f}>
                    <line x1="0" x2={W} y1={H - f * H} y2={H - f * H} stroke="currentColor" strokeOpacity={f === 0 ? 0.5 : 0.15} />
                    <text x="-6" y={H - f * H + 4} textAnchor="end" fontSize="11" fill="currentColor">
                      {Math.round(f * yMax).toLocaleString('en-AU')}
                    </text>
                  </g>
                ))}
                {bars.map((b) => (
                  <rect key={b.day} x={b.x} y={b.y} width={b.w} height={b.h} rx="1.5" className="fill-primary">
                    <title>{`${longDay(b.day)}: ${b.views.toLocaleString('en-AU')} view${b.views === 1 ? '' : 's'}`}</title>
                  </rect>
                ))}
                <text x="0" y={H + 18} fontSize="11" fill="currentColor">{shortDay(series[0].day)}</text>
                <text x={W} y={H + 18} fontSize="11" textAnchor="end" fill="currentColor">{shortDay(series[series.length - 1].day)}</text>
              </svg>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
