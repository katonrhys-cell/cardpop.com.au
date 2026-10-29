import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Gift, Plus, RefreshCw, Pencil, Users, Dice5, Download, Trash2, Loader2, Trophy, ExternalLink } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { apiServerClient as apiClient } from '@/lib/apiServerClient.js';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cleanPrizes, prizeKeyFromLabel, tallyPrizePicks, GIVEAWAY_STATUSES } from '@/utils/giveaway.js';

// Admin → Giveaways. Create the promotion (prizes, window, terms), watch the
// entries come in, tick the ones whose Instagram comment you found, export a
// CSV, and run the one recorded random draw once entries close. Everything
// goes through /giveaways/admin (service role behind the admin + MFA gate) —
// see docs/giveaways.md.

const fmtWhen = (ts) => (ts ? format(new Date(ts), 'dd MMM yyyy, h:mm a') : '—');

const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (value) => (value ? new Date(value).toISOString() : null);

const PHASE_STYLE = {
  hidden: 'bg-muted text-muted-foreground border-border',
  upcoming: 'bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-400',
  open: 'bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:text-emerald-400',
  closed: 'bg-muted text-muted-foreground border-border',
  drawn: 'bg-red-500/10 text-red-700 border-red-300 dark:text-red-400',
};
const phaseLabel = (g) => (g.phase === 'hidden' ? g.status : g.phase);

const DEFAULT_TERMS = `Promoter: CardPop Australia, PO Box 1024, Ascot Vale VIC 3032.
Entry is free and open to Australian residents aged 18 or over. Employees of the promoter and their immediate families are not eligible.
To enter: follow @cardpop.au on Instagram, comment on the giveaway post, register a CardPop account and submit the entry form on this page before the closing time. One entry per person. Entries from the same Instagram account through more than one CardPop account are void.
The winner is drawn at random from all eligible entries after entries close, and is notified by email and by direct message from @cardpop.au within two days of the draw. The winner has 7 days to claim by supplying an Australian postal address; an unclaimed prize is redrawn.
The prize is the single card named in the winner's entry, posted within Australia by tracked mail at the promoter's cost. No cash alternative. The promoter's decision is final.
This promotion is in no way sponsored, endorsed or administered by, or associated with, Instagram or Meta.
Entrants' details are used only to run this promotion and, where ticked, to send CardPop news. See cardpop.com.au/privacy.`;

const EMPTY_FORM = {
  slug: '', title: '', description: '', imageUrl: '', instagramPostUrl: '',
  entryMode: 'pick_prize', prizes: [{ label: '', detail: '', image_url: '' }, { label: '', detail: '', image_url: '' }],
  opensAt: toLocalInput(new Date().toISOString()), closesAt: '', status: 'draft', terms: DEFAULT_TERMS, minAge: '18',
};

const formFromRow = (g) => ({
  slug: g.slug, title: g.title, description: g.description || '', imageUrl: g.image_url || '',
  instagramPostUrl: g.instagram_post_url || '', entryMode: g.entry_mode,
  prizes: (g.prizes || []).map((p) => ({ key: p.key, label: p.label || '', detail: p.detail || '', image_url: p.image_url || '' })),
  opensAt: toLocalInput(g.opens_at), closesAt: toLocalInput(g.closes_at), status: g.status, terms: g.terms || '', minAge: String(g.min_age ?? 18),
});

const bodyFromForm = (f) => ({
  slug: f.slug.trim().toLowerCase(),
  title: f.title.trim(),
  description: f.description.trim() || null,
  imageUrl: f.imageUrl.trim() || null,
  instagramPostUrl: f.instagramPostUrl.trim() || null,
  entryMode: f.entryMode,
  prizes: cleanPrizes(f.prizes),
  opensAt: fromLocalInput(f.opensAt),
  closesAt: fromLocalInput(f.closesAt),
  status: f.status,
  terms: f.terms.trim() || null,
  minAge: Number(f.minAge) || 18,
});

const StatCard = ({ label, value, loading }) => (
  <Card className="border-border shadow-sm">
    <CardContent className="p-5">
      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      {loading ? <Skeleton className="h-9 w-20 mt-3" /> : <p className="text-3xl font-extrabold tabular-nums tracking-tight text-foreground mt-2">{value}</p>}
    </CardContent>
  </Card>
);

const GiveawaysAdminPage = () => {
  const [giveaways, setGiveaways] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | row
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [entriesFor, setEntriesFor] = useState(null);
  const [entries, setEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [pool, setPool] = useState('verified');
  const [drawing, setDrawing] = useState(false);
  const [drawResult, setDrawResult] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.fetch('/giveaways/admin');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGiveaways(data.giveaways ?? []);
    } catch {
      toast.error('Failed to load giveaways');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => ({
    open: giveaways.filter((g) => g.phase === 'open').length,
    entries: giveaways.reduce((n, g) => n + (g.entry_count || 0), 0),
    drawn: giveaways.filter((g) => g.status === 'drawn').length,
  }), [giveaways]);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const setFromEvent = (key) => (e) => set(key)(e.target.value);
  const setPrize = (i, key, value) => setForm((f) => ({ ...f, prizes: f.prizes.map((p, j) => (j === i ? { ...p, [key]: value } : p)) }));
  const addPrize = () => setForm((f) => ({ ...f, prizes: [...f.prizes, { label: '', detail: '', image_url: '' }] }));
  const removePrize = (i) => setForm((f) => ({ ...f, prizes: f.prizes.filter((_, j) => j !== i) }));

  const openNew = () => { setForm(EMPTY_FORM); setEditing('new'); };
  const openEdit = (g) => { setForm(formFromRow(g)); setEditing(g); };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const isNew = editing === 'new';
      const res = await apiClient.fetch(isNew ? '/giveaways/admin' : `/giveaways/admin/${editing.id}`, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyFromForm(form)),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.issues?.[0]?.message || 'Could not save the giveaway');
      toast.success(isNew ? 'Giveaway created' : 'Giveaway saved');
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const loadEntries = useCallback(async (g) => {
    setEntriesLoading(true);
    try {
      const res = await apiClient.fetch(`/giveaways/admin/${g.id}/entries`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEntries(data.entries ?? []);
    } catch {
      toast.error('Failed to load entries');
    } finally {
      setEntriesLoading(false);
    }
  }, []);

  const openEntries = (g) => { setEntriesFor(g); setEntries([]); setDrawResult(null); loadEntries(g); };

  const toggleVerified = async (entry) => {
    const verified = !entry.verified_at;
    setEntries((rows) => rows.map((r) => (r.id === entry.id ? { ...r, verified_at: verified ? new Date().toISOString() : null } : r)));
    try {
      const res = await apiClient.fetch(`/giveaways/admin/${entriesFor.id}/entries/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verified }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error('Could not update the entry');
      loadEntries(entriesFor);
    }
  };

  const exportCsv = async () => {
    try {
      const res = await apiClient.fetch(`/giveaways/admin/${entriesFor.id}/entries.csv`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `giveaway-${entriesFor.slug}-entries.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not export entries');
    }
  };

  const runDraw = async () => {
    setDrawing(true);
    try {
      const res = await apiClient.fetch(`/giveaways/admin/${entriesFor.id}/draw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pool }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'The draw failed');
      setDrawResult(data);
      setEntriesFor((g) => ({ ...g, ...data.giveaway, phase: 'drawn' }));
      toast.success(`Winner: @${data.winner.instagram_handle}`);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDrawing(false);
    }
  };

  const tally = useMemo(() => (entriesFor ? tallyPrizePicks(entriesFor, entries) : []), [entriesFor, entries]);
  const verifiedCount = entries.filter((e) => e.verified_at).length;
  const isNew = editing === 'new';
  const canDrawNow = entriesFor && entriesFor.phase === 'closed' && entriesFor.status !== 'drawn';
  const winnerEntry = entriesFor?.winner_entry_id ? entries.find((e) => e.id === entriesFor.winner_entry_id) : null;

  return (
    <div className="space-y-8">
      <Helmet><title>Giveaways | Admin</title></Helmet>

      <AdminPageHeader icon={Gift} title="Giveaways" subtitle="Instagram-led promotions: prizes, entries, verification and the recorded random draw.">
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading} className="rounded-xl h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button onClick={openNew} className="rounded-xl h-10 px-4"><Plus className="w-4 h-4 mr-2" /> New giveaway</Button>
        </div>
      </AdminPageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Open now" value={totals.open} loading={loading} />
        <StatCard label="Entries, all time" value={totals.entries} loading={loading} />
        <StatCard label="Drawn" value={totals.drawn} loading={loading} />
      </div>

      <Card className="border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Giveaway</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Window</TableHead>
                <TableHead className="text-right">Entries</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [0, 1, 2].map((i) => <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-6 w-full" /></TableCell></TableRow>)
              ) : giveaways.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-10">No giveaways yet. Create the first one.</TableCell></TableRow>
              ) : giveaways.map((g) => (
                <TableRow key={g.id}>
                  <TableCell>
                    <p className="font-semibold">{g.title}</p>
                    <a className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1" href={`/giveaways/${g.slug}`} target="_blank" rel="noreferrer">/giveaways/{g.slug} <ExternalLink className="w-3 h-3" /></a>
                  </TableCell>
                  <TableCell><Badge variant="outline" className={PHASE_STYLE[g.phase] || ''}>{phaseLabel(g)}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{fmtWhen(g.opens_at)}<br />→ {fmtWhen(g.closes_at)}</TableCell>
                  <TableCell className="text-right tabular-nums">{g.entry_count}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEntries(g)}><Users className="w-4 h-4 mr-1" /> Entries</Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(g)}><Pencil className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* ── Create / edit ── */}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={save} className="space-y-5">
            <DialogHeader>
              <DialogTitle>{isNew ? 'New giveaway' : 'Edit giveaway'}</DialogTitle>
              <DialogDescription>Publish the terms before you set it to open; the public page shows them as written here.</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="g-title">Title</Label>
                <Input id="g-title" value={form.title} onChange={(e) => { set('title')(e.target.value); if (isNew && !form.slug) set('slug')(prizeKeyFromLabel(e.target.value)); }} required className="mt-1" />
              </div>
              <div>
                <Label htmlFor="g-slug">Slug</Label>
                <Input id="g-slug" value={form.slug} onChange={(e) => set('slug')(prizeKeyFromLabel(e.target.value))} required className="mt-1 font-mono" disabled={!isNew && editing?.status === 'drawn'} />
              </div>
            </div>
            <div>
              <Label htmlFor="g-desc">Description</Label>
              <Textarea id="g-desc" value={form.description} onChange={setFromEvent('description')} rows={3} className="mt-1" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="g-image">Hero image URL</Label>
                <Input id="g-image" value={form.imageUrl} onChange={setFromEvent('imageUrl')} className="mt-1" placeholder="https://…" />
              </div>
              <div>
                <Label htmlFor="g-post">Instagram post URL</Label>
                <Input id="g-post" value={form.instagramPostUrl} onChange={setFromEvent('instagramPostUrl')} className="mt-1" placeholder="https://www.instagram.com/p/…" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="g-mode">Entry mode</Label>
                <Select value={form.entryMode} onValueChange={set('entryMode')}>
                  <SelectTrigger id="g-mode" className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pick_prize">Entrant picks a card</SelectItem>
                    <SelectItem value="single_prize">One prize</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="g-status">Status</Label>
                <Select value={form.status} onValueChange={set('status')}>
                  <SelectTrigger id="g-status" className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{GIVEAWAY_STATUSES.map((s) => <SelectItem key={s} value={s} disabled={s === 'drawn'}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="g-age">Minimum age</Label>
                <Input id="g-age" type="number" min="0" max="21" value={form.minAge} onChange={setFromEvent('minAge')} className="mt-1" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="g-opens">Opens (your local time)</Label>
                <Input id="g-opens" type="datetime-local" value={form.opensAt} onChange={setFromEvent('opensAt')} required className="mt-1" />
              </div>
              <div>
                <Label htmlFor="g-closes">Closes</Label>
                <Input id="g-closes" type="datetime-local" value={form.closesAt} onChange={setFromEvent('closesAt')} required className="mt-1" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Prizes {form.entryMode === 'pick_prize' ? '(the cards they can name)' : ''}</Label>
                <Button type="button" size="sm" variant="outline" onClick={addPrize} disabled={form.prizes.length >= 12}><Plus className="w-3.5 h-3.5 mr-1" /> Add</Button>
              </div>
              <div className="space-y-2">
                {form.prizes.map((p, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                    <Input value={p.label} onChange={(e) => setPrize(i, 'label', e.target.value)} placeholder="Sacha Boisvert" aria-label={`Prize ${i + 1} name`} />
                    <Input value={p.detail} onChange={(e) => setPrize(i, 'detail', e.target.value)} placeholder="2026-27 UD Series 1 Young Guns #243" aria-label={`Prize ${i + 1} detail`} />
                    <Input value={p.image_url} onChange={(e) => setPrize(i, 'image_url', e.target.value)} placeholder="Image URL" aria-label={`Prize ${i + 1} image`} />
                    <Button type="button" size="icon" variant="ghost" onClick={() => removePrize(i)} aria-label="Remove prize"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="g-terms">Terms and conditions</Label>
              <Textarea id="g-terms" value={form.terms} onChange={setFromEvent('terms')} rows={8} className="mt-1 text-sm" />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : isNew ? 'Create' : 'Save'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Entries + draw ── */}
      <Dialog open={entriesFor !== null} onOpenChange={(o) => !o && setEntriesFor(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{entriesFor?.title} — entries</DialogTitle>
            <DialogDescription>
              Tick each entry once you've found that handle's comment under the post. The draw uses ticked entries unless you choose all.
            </DialogDescription>
          </DialogHeader>

          {entriesFor && (
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2 items-center">
                {tally.map((p) => <Badge key={p.key} variant="outline">{p.label}: {p.count}</Badge>)}
                <span className="text-sm text-muted-foreground ml-auto">{verifiedCount} of {entries.length} verified</span>
                <Button size="sm" variant="outline" onClick={exportCsv} disabled={!entries.length}><Download className="w-4 h-4 mr-1" /> CSV</Button>
              </div>

              {(entriesFor.status === 'drawn' || drawResult) ? (
                <Card className="border-primary/40">
                  <CardContent className="p-5 flex items-start gap-4">
                    <Trophy className="w-8 h-8 text-primary shrink-0" />
                    <div className="text-sm">
                      <p className="font-bold text-base">Winner: @{drawResult?.winner?.instagram_handle || winnerEntry?.instagram_handle || '…'}</p>
                      <p className="text-muted-foreground">
                        {(drawResult?.winner?.name || winnerEntry?.name) && <>{drawResult?.winner?.name || winnerEntry?.name} · </>}
                        {drawResult?.winner?.email || winnerEntry?.email}
                        {(drawResult?.winner?.prize?.label || winnerEntry?.prize_key) && <> · prize: {drawResult?.winner?.prize?.label || tally.find((p) => p.key === winnerEntry?.prize_key)?.label}</>}
                      </p>
                      {(drawResult?.record || entriesFor.draw_record) && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Drawn {fmtWhen((drawResult?.record || entriesFor.draw_record).drawn_at)} from {(drawResult?.record || entriesFor.draw_record).count} {(drawResult?.record || entriesFor.draw_record).pool} entries,
                          index {(drawResult?.record || entriesFor.draw_record).index}, nonce {(drawResult?.record || entriesFor.draw_record).nonce}. The winner has been emailed.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 text-sm">
                      <p className="font-semibold">Run the draw</p>
                      <p className="text-muted-foreground">{canDrawNow ? 'Entries are closed. One random pick, recorded on the giveaway.' : 'Available once the closing time has passed.'}</p>
                    </div>
                    <Select value={pool} onValueChange={setPool}>
                      <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="verified">Verified entries only</SelectItem>
                        <SelectItem value="all">All entries</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={runDraw} disabled={!canDrawNow || drawing}>
                      {drawing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Dice5 className="w-4 h-4 mr-2" /> Draw winner</>}
                    </Button>
                  </CardContent>
                </Card>
              )}

              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">✓</TableHead>
                      <TableHead>Instagram</TableHead>
                      <TableHead>Pick</TableHead>
                      <TableHead>Member</TableHead>
                      <TableHead>Where</TableHead>
                      <TableHead>Entered</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entriesLoading ? (
                      <TableRow><TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                    ) : entries.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No entries yet.</TableCell></TableRow>
                    ) : entries.map((e) => (
                      <TableRow key={e.id} className={entriesFor.winner_entry_id === e.id ? 'bg-primary/5' : ''}>
                        <TableCell><Checkbox checked={!!e.verified_at} onCheckedChange={() => toggleVerified(e)} aria-label={`Verified @${e.instagram_handle}`} disabled={entriesFor.status === 'drawn'} /></TableCell>
                        <TableCell className="font-medium">@{e.instagram_handle}</TableCell>
                        <TableCell>{tally.find((p) => p.key === e.prize_key)?.label || e.prize_key || '—'}</TableCell>
                        <TableCell className="text-sm"><p>{e.name || '—'}</p><p className="text-muted-foreground text-xs">{e.email || ''}</p></TableCell>
                        <TableCell className="text-sm whitespace-nowrap">{e.state} {e.postcode}</TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{fmtWhen(e.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GiveawaysAdminPage;
