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
import { Radar, Loader2, Plus, Trash2, AlertTriangle, CheckCircle2, Clock, Instagram, Users } from 'lucide-react';
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

const isInstagramKind = (kind) => kind === 'instagram_account' || kind === 'instagram_tagged';

const SOURCE_KIND_LABELS = {
  search_query: 'Search',
  seed_url: 'Listing page · re-read weekly',
  instagram_account: 'Instagram account',
  instagram_tagged: 'Instagram',
};

const SOURCE_PLACEHOLDERS = {
  search_query: 'e.g. Pokemon card show Sydney upcoming',
  seed_url: 'https://example.com.au/events',
  instagram_account: '@handle or instagram.com/handle',
};

const sourceTitle = (source) => {
  if (source.kind === 'instagram_tagged') return 'Posts that tag CardPop';
  if (source.kind === 'instagram_account') return `@${source.value}`;
  return source.value;
};

const EventScanPanel = ({ isOpen, onClose, onScanFinished }) => {
  const [runs, setRuns] = useState([]);
  const [sources, setSources] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isScanningInstagram, setIsScanningInstagram] = useState(false);
  const [isReadingBacklog, setIsReadingBacklog] = useState(false);
  const [unreadPages, setUnreadPages] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [instagram, setInstagram] = useState(null);
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
      // Pages a scan found but hasn't read yet. Best effort — the count is a
      // convenience, not something worth failing the panel for.
      const unread = await supabase
        .from('event_scan_candidates')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      setUnreadPages(unread.error ? null : unread.count ?? 0);
    } catch {
      toast.error('Failed to load scan history.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  // Whether the Instagram account is connected. Asked once per open; a failure
  // just leaves the status line out.
  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    apiServerClient.fetch('/event-scan/instagram/status')
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => { if (!cancelled) setInstagram(body); })
      .catch(() => { if (!cancelled) setInstagram(null); });
    return () => { cancelled = true; };
  }, [isOpen]);

  // Both scans run on the 300s function, called directly — not through
  // apiServerClient, which targets /hcgi/api (the 40s function).
  const runScan = async ({ path, setBusy, label }) => {
    setBusy(true);
    toast.info(`${label} started — this takes a few minutes.`);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Your session has expired. Sign in again.');

      const response = await window.fetch(path, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `Scan failed (HTTP ${response.status})`);

      const created = body.eventsCreated ?? 0;
      toast.success(
        created > 0
          ? `${label} finished — ${created} new draft${created === 1 ? '' : 's'} awaiting review.`
          : `${label} finished — nothing new found.`,
      );
      await load();
      onScanFinished?.();
    } catch (err) {
      toast.error(err.message || 'Scan failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleRunNow = () => runScan({ path: '/cron/event-scan', setBusy: setIsScanning, label: 'Scan' });
  const handleReadBacklog = () => runScan({
    path: '/cron/event-scan?mode=backlog',
    setBusy: setIsReadingBacklog,
    label: 'Backlog read',
  });
  const handleRunInstagram = () => runScan({
    path: '/cron/event-scan?mode=instagram',
    setBusy: setIsScanningInstagram,
    label: 'Instagram scan',
  });

  const handleImportOrganisers = async () => {
    setIsImporting(true);
    try {
      const response = await apiServerClient.fetch('/event-scan/instagram/import-organisers', { method: 'POST' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Failed to add the accounts.');
      const added = body.added ?? [];
      if (added.length) setSources(prev => [...prev, ...added]);
      toast.success(
        added.length
          ? `Added ${added.length} organiser account${added.length === 1 ? '' : 's'}.`
          : 'Every organiser account on the site is already listed.',
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsImporting(false);
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
    if (!window.confirm(`Remove "${sourceTitle(source)}" from the scan list?`)) return;
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
            published automatically. Listing pages, pages a scan found but had no time to read,
            and Instagram accounts are read once a day.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="history" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="history">Recent runs</TabsTrigger>
            <TabsTrigger value="sources">What it searches for</TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="space-y-3 pt-4">
            {unreadPages > 0 && (
              <div className="flex flex-col gap-2 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm">
                  <span className="font-bold">{unreadPages} found page{unreadPages === 1 ? '' : 's'} not read yet.</span>{' '}
                  <span className="text-muted-foreground">Up to 30 are read each day; you can read the next batch now.</span>
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleReadBacklog}
                  disabled={isReadingBacklog}
                  className="rounded-lg shrink-0"
                >
                  {isReadingBacklog && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                  Read next batch
                </Button>
              </div>
            )}
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
                      {run.scope === 'backlog' && (
                        <Badge variant="outline" className="text-xs">Listing pages &amp; backlog</Badge>
                      )}
                      {run.scope === 'instagram' && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Instagram className="w-3 h-3" /> Instagram
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground capitalize">{run.trigger}</span>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {run.scope === 'instagram' ? (
                      <>
                        <span>{run.queries_run} accounts checked</span>
                        <span>{run.candidates_found} new posts</span>
                        <span>{run.pages_fetched} posts read</span>
                      </>
                    ) : run.scope === 'backlog' ? (
                      <>
                        <span>{run.queries_run} listing pages</span>
                        <span>{run.candidates_found} pages queued</span>
                        <span>{run.pages_fetched} pages read</span>
                      </>
                    ) : (
                      <>
                        <span>{run.queries_run} queries</span>
                        <span>{run.candidates_found} results</span>
                        <span>{run.pages_fetched} pages read</span>
                      </>
                    )}
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
              <Label htmlFor="scan-source-value" className="text-sm font-bold">Add a search, a listing page or an Instagram account</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  aria-label="Source type"
                  value={draft.kind}
                  onChange={(e) => setDraft(d => ({ ...d, kind: e.target.value }))}
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="search_query">Search</option>
                  <option value="seed_url">Listing page (calendar)</option>
                  <option value="instagram_account">Instagram account</option>
                </select>
                <Input
                  id="scan-source-value"
                  value={draft.value}
                  onChange={(e) => setDraft(d => ({ ...d, value: e.target.value }))}
                  placeholder={SOURCE_PLACEHOLDERS[draft.kind]}
                  className="flex-1"
                />
                <Button type="submit" className="rounded-lg font-bold">
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </div>
            </form>

            <div className="border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-2">
                <Instagram className="w-4 h-4 mt-0.5 shrink-0 text-brand-red" />
                <div className="min-w-0 text-sm">
                  <p className="font-bold">Instagram</p>
                  <p className="text-xs text-muted-foreground">
                    {instagram == null && 'Checking the connection…'}
                    {instagram && !instagram.configured && 'Not connected yet. Add the CardPop account\u2019s access token (INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_ACCOUNT_ID) to switch this on.'}
                    {instagram?.configured && instagram.connected && `Connected as @${instagram.username}. Reads public posts from the business and creator accounts listed below, and posts that tag CardPop. It never posts, likes or messages.`}
                    {instagram?.configured && !instagram.connected && `The token is set, but Instagram refused it: ${instagram.error}`}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleImportOrganisers}
                  disabled={isImporting}
                  className="rounded-lg"
                >
                  {isImporting
                    ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    : <Users className="w-4 h-4 mr-1.5" />}
                  Add organisers&rsquo; accounts
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRunInstagram}
                  disabled={isScanningInstagram || !instagram?.configured}
                  className="rounded-lg"
                >
                  {isScanningInstagram
                    ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    : <Instagram className="w-4 h-4 mr-1.5" />}
                  Scan Instagram now
                </Button>
              </div>
            </div>

            {isLoading ? (
              [1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-xl" />)
            ) : (
              <div className="divide-y divide-border border border-border rounded-xl">
                {sources.map(source => (
                  <div key={source.id} className="flex items-center gap-3 p-3">
                    <Switch
                      checked={source.is_active}
                      onCheckedChange={() => handleToggleSource(source)}
                      aria-label={`Toggle ${sourceTitle(source)}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{sourceTitle(source)}</p>
                      <p className="text-xs text-muted-foreground">
                        {SOURCE_KIND_LABELS[source.kind] || source.kind}
                        {isInstagramKind(source.kind) && source.label && source.kind !== 'instagram_tagged' ? ` · ${source.label}` : ''}
                        {source.state ? ` · ${source.state}` : ''}
                        {source.last_scanned_at
                          ? ` · last run ${formatDistanceToNow(new Date(source.last_scanned_at), { addSuffix: true })}`
                          : ' · never run'}
                      </p>
                    </div>
                    {/* The tagged-posts source is one fixed row: switch it off rather than remove it. */}
                    {source.kind !== 'instagram_tagged' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSource(source)}
                        aria-label={`Remove ${sourceTitle(source)}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
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
