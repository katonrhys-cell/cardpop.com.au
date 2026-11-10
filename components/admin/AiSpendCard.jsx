import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import apiServerClient from '@/lib/apiServerClient.js';
import { formatAud } from '@/utils/revenue.js';

// AI spend on Admin → Finance: what the Claude calls behind card scans, grade
// estimates, descriptions, the blog, the event scan and the supplier price
// check cost in the selected period (GET /admin/ai-usage, from the
// ai_usage_events ledger), against what the platform earned in the same period.

const FEATURE_LABELS = {
  card_scan: 'Card scans',
  card_scan_escalation: 'Card scans (second pass)',
  grade_estimate: 'Grade estimates',
  card_description: 'Listing descriptions',
  blog_draft: 'Blog drafts',
  event_discovery: 'Event scan: search',
  event_extraction: 'Event scan: page reading',
  supplier_price: 'Supplier price checks',
};

const isoDay = (d) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const allowance = (data, key) => {
  const limit = data?.allowances?.[key]?.limit;
  return limit === 0 ? 'unlimited' : (limit ?? '—');
};

const usd = (n) => `US$${Number(n || 0).toFixed(2)}`;
const compact = (n) => new Intl.NumberFormat('en-AU', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n || 0));

/**
 * @param {{ period: { start: Date|null, end: Date|null, label: string }, earningsEx: number }} props
 *   earningsEx — marketplace fee revenue + shop gross profit, ex GST, same period.
 */
const AiSpendCard = ({ period, earningsEx }) => {
  const [state, setState] = useState({ loading: true, error: null, data: null });

  useEffect(() => {
    let cancelled = false;
    const from = period?.start ? isoDay(period.start) : '2025-01-01';
    const to = isoDay(period?.end && period.end < new Date() ? period.end : new Date());
    setState({ loading: true, error: null, data: null });
    apiServerClient.fetch(`/admin/ai-usage?from=${from}&to=${to}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Could not load AI usage.');
        return body;
      })
      .then((body) => {
        // Never let an unexpected body take the whole Finance page down.
        const data = {
          rows: Array.isArray(body?.rows) ? body.rows : [],
          totals: { calls: 0, cost_usd: 0, cost_aud: null, ...(body?.totals || {}) },
          usd_to_aud: Number(body?.usd_to_aud) || null,
          allowances: body?.allowances || {},
        };
        if (!cancelled) setState({ loading: false, error: null, data });
      })
      .catch((err) => { if (!cancelled) setState({ loading: false, error: err.message, data: null }); });
    return () => { cancelled = true; };
  }, [period?.start, period?.end]);

  const { loading, error, data } = state;
  const costAud = data?.totals?.cost_aud;
  const share = costAud != null && earningsEx > 0 ? (costAud / earningsEx) * 100 : null;

  return (
    <Card className="shadow-sm border-border">
      <CardHeader>
        <CardTitle className="text-base">AI spend</CardTitle>
        <CardDescription>
          Claude API calls · {period?.label}
          {data?.usd_to_aud ? ` · billed in USD, shown in AUD at ${Number(data.usd_to_aud).toFixed(4)}` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && <Skeleton className="h-24 rounded-lg" />}
        {!loading && error && <p className="text-sm text-destructive">{error}</p>}
        {!loading && data && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Cost" value={costAud != null ? formatAud(costAud) : usd(data.totals.cost_usd)} />
              <Stat label="Calls" value={compact(data.totals.calls)} />
              <Stat label="Share of earnings" value={share != null ? `${share.toFixed(1)}%` : '—'} hint="Fee revenue + shop gross profit, ex GST" />
              <Stat label="In USD" value={usd(data.totals.cost_usd)} />
            </div>
            {data.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No AI calls recorded in this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Feature</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead className="text-right">Calls</TableHead>
                      <TableHead className="text-right">Members</TableHead>
                      <TableHead className="text-right">Tokens in / out</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.rows.map((r) => (
                      <TableRow key={`${r.feature}-${r.model}`}>
                        <TableCell className="font-medium">{FEATURE_LABELS[r.feature] || r.feature}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{r.model}</TableCell>
                        <TableCell className="text-right tabular-nums">{compact(r.calls)}</TableCell>
                        <TableCell className="text-right tabular-nums">{Number(r.members) || '—'}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">
                          {compact(Number(r.input_tokens) + Number(r.cache_read_tokens) + Number(r.cache_write_tokens))} / {compact(r.output_tokens)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">
                          {data.usd_to_aud ? formatAud(r.cost_usd * data.usd_to_aud) : usd(r.cost_usd)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Monthly allowance per member: {allowance(data, 'card_scan')} card scans, {allowance(data, 'grade_estimate')} grade
              estimates, {allowance(data, 'card_description')} AI descriptions. Change them with the <code>ai_monthly_limit_*</code>{' '}
              platform settings (0 = unlimited). Admins are exempt.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

const Stat = ({ label, value, hint }) => (
  <div className="rounded-xl border border-border p-3">
    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="text-lg font-extrabold tabular-nums mt-1">{value}</p>
    {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
  </div>
);

export default AiSpendCard;
