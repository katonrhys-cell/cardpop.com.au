import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, RefreshCw, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient.js';
import { apiServerClient } from '@/lib/apiServerClient.js';

// "Website to scrape" for an event, with a weekly re-scan.
//
// When the admin saves an event with a website here and "Re-scan weekly" on,
// the page is scanned straight away and then every seven days (daily GitHub
// Actions job → /cron/event-scan?mode=watches). A scan fills in any detail the
// event is still missing and lists anything that has *changed* (date, venue,
// price…) below for the admin to apply or dismiss — it never overwrites.
//
// The watch row is read straight from Supabase under the admin read policy;
// writes go through /event-scan/watches on the API; the scan itself posts to
// the 300s function at /cron/event-scan (the 40s API function is too short).
// Runbook: docs/event-scanning.md → "Weekly re-scan of an event's website".

const FIELD_LABELS = {
  start_date: 'Start date',
  end_date: 'End date',
  start_time: 'Start time',
  end_time: 'End time',
  venue_name: 'Venue',
  address: 'Address',
  suburb: 'Suburb',
  state: 'State',
  postcode: 'Postcode',
  entry_fee_aud: 'Entry fee (AUD)',
  presale_fee_aud: 'Presale fee (AUD)',
  ticket_url: 'Ticket link',
  capacity: 'Capacity',
};

const STATUS_TEXT = {
  updated: 'New details added',
  changes_found: 'Changes to review',
  no_change: 'Nothing new',
  unchanged_page: 'Page unchanged',
  rejected: 'Page not recognised as this event',
  failed: 'Scan failed',
};

const show = (value) => (value === null || value === undefined || value === '' ? '—' : String(value));

/** Turn weekly re-scanning on/off for a saved event. Resolves `{ watch, scanNow }`. */
export async function syncEventSourceWatch(eventId, enabled) {
  const response = await apiServerClient.fetch(`/event-scan/watches/${eventId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Failed to set up the weekly re-scan.');
  return body;
}

/** Scan an event's website now. Resolves the scan result. */
export async function runEventSourceScan(eventId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Your session has expired. Sign in again.');

  // Not apiServerClient: that targets /hcgi/api, which is the 40s function.
  const response = await window.fetch(`/cron/event-scan?mode=watches&event=${encodeURIComponent(eventId)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || body.message || `Scan failed (HTTP ${response.status})`);
  return body;
}

/** Toast for a finished scan, shared by save-time scans and "Scan now". */
export function toastScanResult(result) {
  if (result.status === 'failed') toast.error(`Website scan failed: ${result.message}`);
  else if (result.status === 'updated' || result.status === 'changes_found') toast.success(`Website scanned — ${result.message}`);
  else toast.info(`Website scanned — ${result.message}`);
}

const EventSourceWatchPanel = ({ eventId, url, onUrlChange, enabled, onEnabledChange, onWatchLoaded, onEventChanged, disabled }) => {
  const [watch, setWatch] = useState(null);
  const [busy, setBusy] = useState(null); // 'scan' | 'apply' | 'dismiss'

  const load = useCallback(async () => {
    if (!eventId) { setWatch(null); return; }
    const { data } = await supabase
      .from('event_source_watches')
      .select('*')
      .eq('event_id', eventId)
      .maybeSingle();
    setWatch(data ?? null);
    onWatchLoaded?.(data ?? null);
  }, [eventId, onWatchLoaded]);

  useEffect(() => { load(); }, [load]);

  const savedUrl = watch?.url ?? null;
  const urlDirty = (url || '').trim() !== (savedUrl || '');
  const pending = Object.entries(watch?.pending_changes || {});

  const handleScanNow = async () => {
    setBusy('scan');
    try {
      toastScanResult(await runEventSourceScan(eventId));
      await load();
      onEventChanged?.();
    } catch (err) {
      toast.error(err.message || 'Scan failed.');
    } finally {
      setBusy(null);
    }
  };

  const resolve = async (action, fields) => {
    setBusy(action);
    try {
      const response = await apiServerClient.fetch(`/event-scan/watches/${eventId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Request failed.');
      setWatch(body.watch);
      if (action === 'apply') {
        toast.success(`Applied ${fields.length} change${fields.length === 1 ? '' : 's'} to the event.`);
        onEventChanged?.(body.applied);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3 p-4 rounded-xl border border-border bg-muted/20">
      <div className="space-y-2">
        <Label htmlFor="source_url" className="font-bold">Website to scrape</Label>
        <Input
          id="source_url"
          name="source_url"
          type="url"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          className="bg-background rounded-xl h-11"
          placeholder="https://organiser-site.com.au/event-page"
          disabled={disabled}
        />
      </div>

      <div className="flex items-center gap-3">
        <Switch checked={enabled} onCheckedChange={onEnabledChange} disabled={disabled || !url?.trim()} />
        <div>
          <p className="text-sm font-semibold">Re-scan weekly for updates</p>
          <p className="text-xs text-muted-foreground">
            Scans on save, then every 7 days. Missing details are added automatically; changes to dates, venue or price wait for you below.
          </p>
        </div>
      </div>

      {watch && (
        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border">
          <p>
            {watch.last_scanned_at
              ? <>Last scanned {formatDistanceToNow(new Date(watch.last_scanned_at), { addSuffix: true })}{watch.last_status ? ` — ${STATUS_TEXT[watch.last_status] || watch.last_status}` : ''}.</>
              : 'Not scanned yet.'}
            {watch.is_active && watch.next_scan_at && <> Next scan {formatDistanceToNow(new Date(watch.next_scan_at), { addSuffix: true })}.</>}
            {!watch.is_active && ' Weekly re-scan is off.'}
          </p>
          {watch.last_message && <p className="text-foreground/80">{watch.last_message}</p>}
          <Button
            type="button" variant="outline" size="sm"
            className="rounded-lg mt-1"
            onClick={handleScanNow}
            disabled={disabled || busy !== null || urlDirty}
            title={urlDirty ? 'Save the event first to scan the new address.' : undefined}
          >
            {busy === 'scan' ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
            Scan now
          </Button>
        </div>
      )}

      {pending.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold">Changes found on the website</p>
            <div className="flex gap-2">
              <Button type="button" size="sm" className="rounded-lg" disabled={busy !== null} onClick={() => resolve('apply', pending.map(([f]) => f))}>
                Apply all
              </Button>
              <Button type="button" size="sm" variant="ghost" className="rounded-lg" disabled={busy !== null} onClick={() => resolve('dismiss', pending.map(([f]) => f))}>
                Dismiss all
              </Button>
            </div>
          </div>
          <ul className="space-y-1.5">
            {pending.map(([field, change]) => (
              <li key={field} className="flex items-center justify-between gap-2 text-sm bg-background rounded-lg px-3 py-2 border border-border">
                <span className="min-w-0">
                  <span className="font-semibold">{FIELD_LABELS[field] || field}:</span>{' '}
                  <span className="line-through text-muted-foreground">{show(change.current)}</span>{' → '}
                  <span className="font-medium break-all">{show(change.found)}</span>
                </span>
                <span className="flex gap-1 shrink-0">
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label={`Apply ${FIELD_LABELS[field] || field}`} disabled={busy !== null} onClick={() => resolve('apply', [field])}>
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label={`Dismiss ${FIELD_LABELS[field] || field}`} disabled={busy !== null} onClick={() => resolve('dismiss', [field])}>
                    <X className="w-4 h-4" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default EventSourceWatchPanel;
