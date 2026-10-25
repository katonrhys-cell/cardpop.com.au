import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2, RefreshCw, ExternalLink, UsersRound, GripVertical } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient.js';
import { PLAYER_PAGE_COLUMNS } from '@/lib/players.js';
import { resetPlayersCache } from '@/hooks/usePlayers.js';
import { SPORTS_COLLECTIONS } from '@/data/collections.js';
import { cleanKeyCards, isValidBirthDate, matchPlayers, parseAliases, playerPath, playerSlug } from '@/utils/players.js';
import { PlayerAvatar } from '@/components/PlayerPicker.jsx';

const EMPTY = {
  name: '', slug: '', sport: 'NBA', team: '', position: '', nationality: '', born_on: '', born_year: '', career_span: '',
  headline: '', bio: '', collecting_notes: '', key_cards: [{ name: '', note: '', image_url: '' }], aliases: '', image_url: '',
  sort_order: 100, is_published: true,
};

const toForm = (p) => ({
  ...EMPTY,
  ...p,
  born_on: p.born_on || '',
  born_year: p.born_year ?? '',
  team: p.team || '', position: p.position || '', nationality: p.nationality || '', career_span: p.career_span || '',
  headline: p.headline || '', bio: p.bio || '', collecting_notes: p.collecting_notes || '', image_url: p.image_url || '',
  key_cards: Array.isArray(p.key_cards) && p.key_cards.length ? p.key_cards.map((c) => ({ name: c.name || '', note: c.note || '', image_url: c.image_url || '' })) : [{ name: '', note: '', image_url: '' }],
  aliases: (p.aliases || []).join(', '),
});

/** Form → row. Returns { row } or { errors }. Exported for tests. */
export const buildPlayerRow = (form) => {
  const errors = {};
  const name = String(form.name || '').trim();
  const slug = playerSlug(form.slug || name);
  const sport = String(form.sport || '').trim();
  if (!name) errors.name = 'Name is required.';
  if (!slug) errors.slug = 'Slug is required.';
  if (!sport) errors.sport = 'Sport is required.';
  const bornOn = String(form.born_on ?? '').trim() || null;
  if (bornOn && !isValidBirthDate(bornOn)) errors.born_on = 'Enter a date between 1850 and 2100.';
  const born = String(form.born_year ?? '').trim();
  // A full date of birth decides the year (the DB trigger does the same).
  const bornYear = bornOn ? Number(bornOn.slice(0, 4)) : born ? Number(born) : null;
  if (!bornOn && born && (!Number.isInteger(bornYear) || bornYear < 1850 || bornYear > 2100)) errors.born_year = 'Enter a four-digit year.';
  const sortOrder = Number(form.sort_order);
  if (Object.keys(errors).length) return { errors };
  const nul = (v) => { const s = String(v ?? '').trim(); return s || null; };
  return {
    row: {
      name,
      slug,
      sport,
      team: nul(form.team),
      position: nul(form.position),
      nationality: nul(form.nationality),
      born_on: bornOn,
      born_year: bornYear,
      career_span: nul(form.career_span),
      headline: nul(form.headline),
      bio: nul(form.bio),
      collecting_notes: nul(form.collecting_notes),
      key_cards: cleanKeyCards(form.key_cards),
      aliases: parseAliases(form.aliases),
      image_url: nul(form.image_url),
      sort_order: Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 100,
      is_published: form.is_published !== false,
    },
  };
};

const PlayersAdminPage = () => {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | player row
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const load = async (showToast = false) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('players')
      .select(PLAYER_PAGE_COLUMNS)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
      .limit(1000);
    setLoading(false);
    if (error) { toast.error(`Could not load players: ${error.message}`); return; }
    setPlayers(data || []);
    if (showToast) toast.success('Players refreshed');
  };

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => matchPlayers(players, query, players.length || 1), [players, query]);
  const sports = useMemo(() => {
    const set = new Set([...SPORTS_COLLECTIONS, ...players.map((p) => p.sport).filter(Boolean)]);
    return [...set].sort();
  }, [players]);

  const openNew = () => { setForm(EMPTY); setErrors({}); setEditing('new'); };
  const openEdit = (p) => { setForm(toForm(p)); setErrors({}); setEditing(p); };
  const close = () => { if (!saving) { setEditing(null); setErrors({}); } };
  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setKeyCard = (i, key, value) => setForm((f) => {
    const next = f.key_cards.map((c, idx) => (idx === i ? { ...c, [key]: value } : c));
    return { ...f, key_cards: next };
  });

  const save = async (e) => {
    e?.preventDefault?.();
    const built = buildPlayerRow(form);
    if (built.errors) { setErrors(built.errors); return; }
    setSaving(true);
    const isNew = editing === 'new';
    const q = isNew
      ? supabase.from('players').insert(built.row).select(PLAYER_PAGE_COLUMNS).single()
      : supabase.from('players').update(built.row).eq('id', editing.id).select(PLAYER_PAGE_COLUMNS).single();
    const { data, error } = await q;
    setSaving(false);
    if (error) {
      if (error.code === '23505') setErrors({ slug: 'That slug is already used by another player.' });
      else toast.error(`Save failed: ${error.message}`);
      return;
    }
    resetPlayersCache();
    setPlayers((list) => (isNew ? [...list, data] : list.map((p) => (p.id === data.id ? data : p)))
      .sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name)));
    toast.success(isNew ? `${data.name} added` : `${data.name} saved`);
    setEditing(null);
  };

  const togglePublished = async (p) => {
    const { error } = await supabase.from('players').update({ is_published: !p.is_published }).eq('id', p.id);
    if (error) { toast.error(`Could not update: ${error.message}`); return; }
    resetPlayersCache();
    setPlayers((list) => list.map((x) => (x.id === p.id ? { ...x, is_published: !p.is_published } : x)));
  };

  const remove = async () => {
    if (!deleting) return;
    const { error } = await supabase.from('players').delete().eq('id', deleting.id);
    if (error) { toast.error(`Delete failed: ${error.message}`); return; }
    resetPlayersCache();
    setPlayers((list) => list.filter((p) => p.id !== deleting.id));
    toast.success(`${deleting.name} deleted. Cards tagged with them are kept, just untagged.`);
    setDeleting(null);
  };

  return (
    <div className="container-default py-8">
      <Helmet><title>Players | Admin | CardPop</title></Helmet>
      <AdminPageHeader
        title="Players"
        subtitle="The athletes with their own public page (/players). Sellers tag cards with a player in the card form; the page lists every tagged card plus the price-tracker cards linked to the player."
      >
        <Button variant="outline" size="sm" onClick={() => load(true)}><RefreshCw className="mr-1.5 h-4 w-4" /> Refresh</Button>
        <Button size="sm" onClick={openNew}><Plus className="mr-1.5 h-4 w-4" /> Add player</Button>
      </AdminPageHeader>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search players…" className="pl-9" aria-label="Search players" />
        </div>
        <p className="text-sm text-muted-foreground">
          {players.length} player{players.length === 1 ? '' : 's'} · {players.filter((p) => p.is_published).length} published ·{' '}
          <Link to="/players" className="text-primary hover:underline">view public index</Link>
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"><span className="sr-only">Order</span></TableHead>
              <TableHead>Player</TableHead>
              <TableHead>Sport / team</TableHead>
              <TableHead className="hidden md:table-cell">Headline</TableHead>
              <TableHead>Published</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array(5).fill(0).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
              ))
            ) : visible.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                {players.length ? 'No player matches that search.' : 'No players yet — add the first one.'}
              </TableCell></TableRow>
            ) : visible.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><GripVertical className="h-3 w-3" />{p.sort_order}</span></TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <PlayerAvatar player={p} className="h-9 w-9 text-xs" />
                    <div className="min-w-0">
                      <p className="truncate font-bold text-foreground">{p.name}</p>
                      <Link to={playerPath(p)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                        /players/{p.slug} <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-bold">{p.sport}</Badge>
                  {p.team && <div className="mt-1 text-xs text-muted-foreground">{p.team}</div>}
                </TableCell>
                <TableCell className="hidden md:table-cell max-w-md"><p className="line-clamp-2 text-sm text-muted-foreground">{p.headline}</p></TableCell>
                <TableCell>
                  <Switch checked={!!p.is_published} onCheckedChange={() => togglePublished(p)} aria-label={`Publish ${p.name}`} />
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(p)} aria-label={`Edit ${p.name}`}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleting(p)} aria-label={`Delete ${p.name}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add / edit */}
      <Dialog open={editing !== null} onOpenChange={(o) => { if (!o) close(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <form onSubmit={save} className="space-y-5">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-primary" /> {editing === 'new' ? 'Add player' : `Edit ${editing?.name || ''}`}</DialogTitle>
              <DialogDescription>Plain text only. Separate paragraphs with a blank line. Never type a price — prices come from the tracker.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pl-name">Name *</Label>
                <Input id="pl-name" value={form.name} onChange={(e) => setField('name', e.target.value)} required />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pl-slug">URL slug</Label>
                <Input id="pl-slug" value={form.slug} onChange={(e) => setField('slug', e.target.value)} placeholder={playerSlug(form.name) || 'auto from name'} />
                {errors.slug && <p className="text-xs text-destructive">{errors.slug}</p>}
                <p className="text-[11px] text-muted-foreground">Changing a published slug breaks links already shared. /players/{playerSlug(form.slug || form.name) || '…'}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pl-sport">Sport *</Label>
                <Input id="pl-sport" list="pl-sports" value={form.sport} onChange={(e) => setField('sport', e.target.value)} required />
                <datalist id="pl-sports">{sports.map((s) => <option key={s} value={s} />)}</datalist>
                {errors.sport && <p className="text-xs text-destructive">{errors.sport}</p>}
                <p className="text-[11px] text-muted-foreground">Use the marketplace collection name (NBA, AFL, Soccer…) so the page can link to it.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pl-team">Team</Label>
                <Input id="pl-team" value={form.team} onChange={(e) => setField('team', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pl-position">Position</Label>
                <Input id="pl-position" value={form.position} onChange={(e) => setField('position', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pl-nationality">Nationality</Label>
                <Input id="pl-nationality" value={form.nationality} onChange={(e) => setField('nationality', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pl-born-on">Date of birth</Label>
                <Input id="pl-born-on" type="date" min="1850-01-01" max="2100-12-31" value={form.born_on} onChange={(e) => setField('born_on', e.target.value)} />
                {errors.born_on && <p className="text-xs text-destructive">{errors.born_on}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pl-born">Born (year)</Label>
                <Input id="pl-born" inputMode="numeric" value={form.born_year} disabled={Boolean(form.born_on)} onChange={(e) => setField('born_year', e.target.value)} placeholder="If only the year is known" />
                {errors.born_year && <p className="text-xs text-destructive">{errors.born_year}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pl-career">Career span</Label>
                <Input id="pl-career" value={form.career_span} onChange={(e) => setField('career_span', e.target.value)} placeholder="2003–present" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pl-headline">Headline</Label>
              <Input id="pl-headline" value={form.headline} onChange={(e) => setField('headline', e.target.value)} placeholder="One sentence shown on cards, in search and as the page description." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pl-bio">About</Label>
              <Textarea id="pl-bio" rows={6} value={form.bio} onChange={(e) => setField('bio', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pl-notes">Collecting notes</Label>
              <Textarea id="pl-notes" rows={4} value={form.collecting_notes} onChange={(e) => setField('collecting_notes', e.target.value)} placeholder="Why collectors chase them, which cards matter, what to check before buying." />
            </div>

            <div className="space-y-2">
              <Label>Cards worth knowing</Label>
              {form.key_cards.map((c, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_1fr_auto]">
                  <Input value={c.name} onChange={(e) => setKeyCard(i, 'name', e.target.value)} placeholder="2003-04 Topps Chrome #111" aria-label={`Key card ${i + 1} name`} />
                  <Input value={c.note} onChange={(e) => setKeyCard(i, 'note', e.target.value)} placeholder="Why it matters" aria-label={`Key card ${i + 1} note`} />
                  <Input value={c.image_url || ''} onChange={(e) => setKeyCard(i, 'image_url', e.target.value)} placeholder="Photo URL or /images/… (optional)" aria-label={`Key card ${i + 1} photo`} />
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove key card" onClick={() => setForm((f) => ({ ...f, key_cards: f.key_cards.length > 1 ? f.key_cards.filter((_, idx) => idx !== i) : [{ name: '', note: '', image_url: '' }] }))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setForm((f) => ({ ...f, key_cards: [...f.key_cards, { name: '', note: '', image_url: '' }] }))}>
                <Plus className="mr-1.5 h-4 w-4" /> Add a card
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pl-aliases">Also known as</Label>
                <Input id="pl-aliases" value={form.aliases} onChange={(e) => setField('aliases', e.target.value)} placeholder="MJ, Air Jordan" />
                <p className="text-[11px] text-muted-foreground">Comma-separated nicknames and alternate spellings the picker and search should match.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pl-image">Image URL</Label>
                <Input id="pl-image" value={form.image_url} onChange={(e) => setField('image_url', e.target.value)} placeholder="Storage path or https://…" />
                <p className="text-[11px] text-muted-foreground">Only use a photo CardPop has the rights to. Blank shows the player's initials.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pl-sort">Sort order</Label>
                <Input id="pl-sort" inputMode="numeric" value={form.sort_order} onChange={(e) => setField('sort_order', e.target.value)} />
                <p className="text-[11px] text-muted-foreground">Lower shows first on the index page and in the picker.</p>
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch id="pl-published" checked={form.is_published !== false} onCheckedChange={(v) => setField('is_published', v)} />
                <Label htmlFor="pl-published">Published</Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editing === 'new' ? 'Add player' : 'Save changes'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting !== null} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The page at /players/{deleting?.slug} will stop working. Cards tagged with this player are kept — they just lose the tag. To hide the page without losing anything, switch Published off instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PlayersAdminPage;
