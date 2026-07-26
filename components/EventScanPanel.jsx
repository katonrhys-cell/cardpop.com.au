import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Radar, Loader2, Plus, Trash2, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import apiServerClient from '@/lib/apiServerClient';

// Admin control panel for the nightly event scanner.
//
// Reads come straight from Supabase under the admin read policies on
// event_scan_runs / event_scan_sources. Writes go through /event-scan on the
// API, which holds the service-role key.
//
// "Run scan now" is the exception: it posts to /cron/event-scan directly rather
// than through /hcgi/api, because a scan runs for minutes and that path is the
// one with the 300s function budget. The signed-in admin's Supabase token is
// the credential — the cron secret never leaves the server.

const RUN_STATUS_STYLES = {
  running:   'bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-400',
  completed: 'bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-400',
  failed:    'bg-destructive/10 text-destructive border-destructive/20',
};

const emptyDraft = { kind: 'search_query', value: '', label: '', priority: 100 };

const EventScanPanel = ({ isOpen, onClose, onScanFinished }) => {
  const [runs, setRuns] = useState([]);
  const [sources, setSources] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [runsResult, sourcesResult] = await Promise.all([
        supabase.from('event_scan_runs').select('*').order('started_at', { ascending: false }).limit(10),
        supabase.from('event_scan_sources').select('*').order('priority', { ascending: true }).order('value'),
      ]);
      if (runsResult.error) throw runsResult.error;
      if (sourcesResult.error) throw sourcesResult.error;
      setRuns(runsResult.data ?? []);
      setSources(sourcesResult.data ?? []);
    } catch {
      toast.error('Failed to load scan history.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  const handleRunNow = async () => {
    setIsScanning(true);
    toast.info('Scan started — this takes a few minutes.');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Your session has expired. Sign in again.');

      // Not apiServerClient: that targets /hcgi/api, which is the 40s function.
      const response = await window.fetch('/cron/event-scan', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `Scan failed (HTTP ${response.status})`);

      const created = body.eventsCreated ?? 0;
      toast.success(
        created > 0
          ? `Scan finished — ${created} new draft${created === 1 ? '' : 's'} awaiting review.`
          : 'Scan finished — nothing new found.',
      );
      await load();
      onScanFinished?.();
    } catch (err) {
      toast.error(err.message || 'Scan failed.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleToggleSource = async (source) => {
    const next = !source.is_active;
    setSources(prev => prev.map(s => (s.id === source.id ? { ...s, is_active: next } : s)));
    try {
      const response = await apiServerClient.fetch(`/event-scan/sources/${source.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: next }),
      });
      if (!response.ok) throw new Error('Update failed');
    } catch {
      setSources(prev => prev.map(s => (s.id === source.id ? { ...s, is_active: !next } : s)));
      toast.error('Failed to update source.');
    }
  };

  const handleAddSource = async (event) => {
    event.preventDefault();
    if (!draft.value.trim()) return;
    try {
      const response = await apiServerClient.fetch('/event-scan/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Failed to add source.');
      setSources(prev => [...prev, body.source]);
      setDraft(emptyDraft);
      toast.success('Source added.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDeleteSource = async (source) => {
    if (!window.confirm(`Remove "${source.value}" from the scan list?`)) return;
    try {
      const response = await apiServerClient.fetch(`/event-scan/sources/${source.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Delete failed');
      setSources(prev => prev.filter(s => s.id !== source.id));
      toast.success('Source removed.');
    } catch {
      toast.error('Failed to remove source.');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radar className="w-5 h-5 text-brand-red" /> Automated Event Scan
          </DialogTitle>
          <DialogDescription>
            Runs nightly at 3am AEST. Searches the web for upcoming Australian trading card
            events and files anything new here as a draft for you to review — nothing is
            published automatically.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="history" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="history">Recent runs</TabsTrigger>
            <TabsTrigger value="sources">What it searches for</TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="space-y-3 pt-4">
            {isLoading ? (
              [1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
            ) : runs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No scans have run yet. The first one fires tonight, or start one now.
              </p>
            ) : (
              runs.map(run => (
                <div key={run.id} className="border border-border rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs font-bold ${RUN_STATUS_STYLES[run.status]}`}>
                        {run.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground capitalize">{run.trigger}</span>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{run.queries_run} queries</span>
                    <span>{run.candidates_found} results</span>
                    <span>{run.pages_fetched} pages read</span>
                    <span className="font-bold text-foreground">{run.events_created} drafts created</span>
                    <span>{run.duplicates_skipped} already known</span>
                  </div>

                  {run.error && (
                    <p className="flex items-start gap-1.5 text-xs text-destructive">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {run.error}
                    </p>
                  )}

                  {Array.isArray(run.warnings) && run.warnings.length > 0 && (
                    <details className="text-xs text-muted-foreground">
                      <summary className="cursor-pointer">{run.warnings.length} warning(s)</summary>
                      <ul className="mt-1 space-y-0.5 pl-4 list-disc">
                        {run.warnings.map((warning, i) => <li key={i} className="break-all">{warning}</li>)}
                      </ul>
                    </details>
                  )}
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="sources" className="space-y-4 pt-4">
            <form onSubmit={handleAddSource} className="border border-border rounded-xl p-4 space-y-3">
              <Label htmlFor="scan-source-value" className="text-sm font-bold">Add a search or a listing page</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  aria-label="Source type"
                  value={draft.kind}
                  onChange={(e) => setDraft(d => ({ ...d, kind: e.target.value }))}
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="search_query">Search</option>
                  <option value="seed_url">Page URL</option>
                </select>
                <Input
                  id="scan-source-value"
                  value={draft.value}
                  onChange={(e) => setDraft(d => ({ ...d, value: e.target.value }))}
                  placeholder={draft.kind === 'search_query'
                    ? 'e.g. Pokemon card show Sydney upcoming'
                    : 'https://example.com.au/events'}
                  className="flex-1"
                />
                <Button type="submit" className="rounded-lg font-bold">
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </div>
            </form>

            {isLoading ? (
              [1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-xl" />)
            ) : (
              <div className="divide-y divide-border border border-border rounded-xl">
                {sources.map(source => (
                  <div key={source.id} className="flex items-center gap-3 p-3">
                    <Switch
                      checked={source.is_active}
                      onCheckedChange={() => handleToggleSource(source)}
                      aria-label={`Toggle ${source.value}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{source.value}</p>
                      <p className="text-xs text-muted-foreground">
                        {source.kind === 'seed_url' ? 'Page' : 'Search'}
                        {source.state ? ` · ${source.state}` : ''}
                        {source.last_scanned_at
                          ? ` · last run ${formatDistanceToNow(new Date(source.last_scanned_at), { addSuffix: true })}`
                          : ' · never run'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteSource(source)}
                      aria-label={`Remove ${source.value}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                {sources.length === 0 && (
                  <p className="text-sm text-muted-foreground p-6 text-center">
                    Nothing configured — the scan has nothing to look for.
                  </p>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl">Close</Button>
          <Button onClick={handleRunNow} disabled={isScanning} className="rounded-xl font-bold">
            {isScanning
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scanning…</>
              : <><CheckCircle2 className="w-4 h-4 mr-2" /> Run scan now</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EventScanPanel;
