import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { COLLECTION_CONFIGS } from '@/data/collectionConfigs.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import {
  Plus, Pencil, Trash2, ArrowUp, ArrowDown, ChevronRight,
  Layers, GripVertical,
} from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';

// ─── Gradient palette (all classes already in codebase so Tailwind won't purge) ──
const GRADIENT_OPTIONS = [
  { label: 'Violet → Fuchsia',  value: 'from-violet-500 to-fuchsia-600' },
  { label: 'Cyan → Blue',       value: 'from-cyan-400 to-blue-500' },
  { label: 'Blue → Indigo',     value: 'from-blue-500 to-indigo-600' },
  { label: 'Orange → Amber',    value: 'from-orange-400 to-amber-500' },
  { label: 'Teal → Cyan',       value: 'from-teal-500 to-cyan-600' },
  { label: 'Gray → Slate',      value: 'from-gray-600 to-slate-700' },
  { label: 'Yellow → Amber',    value: 'from-yellow-500 to-amber-600' },
  { label: 'Stone → Amber',     value: 'from-stone-500 to-amber-700' },
  { label: 'Green → Teal',      value: 'from-green-500 to-teal-600' },
  { label: 'Red → Rose',        value: 'from-red-500 to-rose-700' },
  { label: 'Purple → Violet',   value: 'from-purple-500 to-violet-700' },
  { label: 'Sky → Blue',        value: 'from-sky-400 to-blue-500' },
  { label: 'Amber → Yellow',    value: 'from-amber-300 to-yellow-500' },
  { label: 'Indigo → Purple',   value: 'from-indigo-500 to-purple-600' },
  { label: 'Slate (dark)',       value: 'from-slate-600 to-slate-800' },
  { label: 'Orange → Red',      value: 'from-orange-500 to-red-600' },
  { label: 'Emerald → Green',   value: 'from-emerald-500 to-green-700' },
];

const COLLECTIONS = Object.entries(COLLECTION_CONFIGS).map(([slug, cfg]) => ({
  slug,
  name: cfg.name,
  accentHex: cfg.accentHex,
}));

const emptyForm = {
  name: '',
  years: '',
  gradient: 'from-blue-500 to-indigo-600',
  hint: '',
  sort_order: 0,
  is_active: true,
};

// ─── Era form modal ───────────────────────────────────────────────────────────
const EraModal = ({ open, onClose, onSaved, era, collectionSlug }) => {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(era
      ? { name: era.name, years: era.years || '', gradient: era.gradient, hint: era.hint || '', sort_order: era.sort_order, is_active: era.is_active }
      : emptyForm
    );
  }, [era, open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Era name is required'); return; }
    setSaving(true);
    try {
      const payload = { ...form, name: form.name.trim(), collection_slug: collectionSlug };
      const { error } = era
        ? await supabase.from('collection_eras').update(payload).eq('id', era.id)
        : await supabase.from('collection_eras').insert(payload);
      if (error) throw error;
      toast.success(era ? 'Era updated' : 'Era added');
      onSaved();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{era ? 'Edit Era' : 'Add Era'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Era / Set Name *</Label>
            <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Scarlet & Violet" />
          </div>

          <div className="space-y-1">
            <Label>Years</Label>
            <Input value={form.years} onChange={e => set('years', e.target.value)} placeholder="e.g. 2023–Now or 1999–2003" />
          </div>

          <div className="space-y-1">
            <Label>Gradient Colour</Label>
            <Select value={form.gradient} onValueChange={v => set('gradient', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GRADIENT_OPTIONS.map(g => (
                  <SelectItem key={g.value} value={g.value}>
                    <div className="flex items-center gap-2">
                      <span className={`inline-block w-8 h-3 rounded bg-gradient-to-r ${g.value}`} />
                      {g.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className={`h-6 rounded-lg bg-gradient-to-r ${form.gradient} mt-1`} />
          </div>

          <div className="space-y-1">
            <Label>Hint / Description</Label>
            <Input value={form.hint} onChange={e => set('hint', e.target.value)} placeholder="Short description shown as tooltip" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Sort Order</Label>
              <Input type="number" min="0" value={form.sort_order} onChange={e => set('sort_order', Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Active</Label>
              <div className="flex items-center h-10 gap-2">
                <Switch checked={form.is_active} onCheckedChange={v => set('is_active', v)} />
                <span className="text-sm text-muted-foreground">{form.is_active ? 'Visible' : 'Hidden'}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : era ? 'Save Changes' : 'Add Era'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
const CollectionsManagementPage = () => {
  const [selectedSlug, setSelectedSlug] = useState(COLLECTIONS[0]?.slug ?? 'pokemon');
  const [eras, setEras] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEra, setEditingEra] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const fetchEras = async () => {
    if (!isMounted.current) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('collection_eras')
      .select('*')
      .eq('collection_slug', selectedSlug)
      .order('sort_order');
    if (!isMounted.current) return;
    if (error) toast.error('Failed to load eras');
    setEras(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchEras(); }, [selectedSlug]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('collection_eras').delete().eq('id', deleteTarget.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Era deleted');
    setDeleteTarget(null);
    fetchEras();
  };

  const moveOrder = async (era, direction) => {
    const newOrder = era.sort_order + direction;
    await supabase.from('collection_eras').update({ sort_order: newOrder }).eq('id', era.id);
    fetchEras();
  };

  const selectedConfig = COLLECTION_CONFIGS[selectedSlug];

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        <AdminPageHeader
          icon={Layers}
          title="Collections & Eras"
          subtitle="Manage the eras and sets displayed on each collection browse page and in the vault listing form."
        />

        <div className="flex flex-col lg:flex-row gap-6">

          {/* ── Collection sidebar ──────────────────────────────────────────── */}
          <aside className="w-full lg:w-64 shrink-0">
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-border">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Collections</p>
              </div>
              <nav className="p-2 space-y-0.5 max-h-[70vh] overflow-y-auto">
                {COLLECTIONS.map(col => (
                  <button
                    key={col.slug}
                    onClick={() => setSelectedSlug(col.slug)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                      selectedSlug === col.slug
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    <span className="truncate">{col.name}</span>
                    <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-60" />
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* ── Era table ───────────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            <div className="bg-card border border-border rounded-2xl overflow-hidden">

              {/* Table header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div>
                  <h2 className="font-bold text-lg">{selectedConfig?.name ?? selectedSlug} — Eras</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {eras.length} era{eras.length !== 1 ? 's' : ''} · changes appear immediately on the collection page and vault form
                  </p>
                </div>
                <Button
                  size="sm"
                  className="rounded-xl gap-1.5"
                  onClick={() => { setEditingEra(null); setIsModalOpen(true); }}
                >
                  <Plus className="w-4 h-4" /> Add Era
                </Button>
              </div>

              {/* Table */}
              {loading ? (
                <div className="p-4 space-y-3">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
                </div>
              ) : eras.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-center text-muted-foreground">
                  <Layers className="w-10 h-10 mb-3 opacity-30" />
                  <p className="font-medium">No eras yet for this collection.</p>
                  <p className="text-sm">Click "Add Era" to create the first one.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead>Era / Set Name</TableHead>
                      <TableHead>Years</TableHead>
                      <TableHead>Gradient</TableHead>
                      <TableHead>Hint</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eras.map((era, idx) => (
                      <TableRow key={era.id}>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <button
                              className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                              disabled={idx === 0}
                              onClick={() => moveOrder(era, -1)}
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                              disabled={idx === eras.length - 1}
                              onClick={() => moveOrder(era, 1)}
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">{era.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{era.years || '—'}</TableCell>
                        <TableCell>
                          <div className={`w-16 h-4 rounded bg-gradient-to-r ${era.gradient}`} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                          {era.hint || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={era.is_active ? 'default' : 'secondary'} className="text-xs">
                            {era.is_active ? 'Active' : 'Hidden'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => { setEditingEra(era); setIsModalOpen(true); }}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteTarget(era)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit modal */}
      <EraModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={() => { setIsModalOpen(false); fetchEras(); }}
        era={editingEra}
        collectionSlug={selectedSlug}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove it from the collection browse page and the vault listing form immediately.
              Existing vault items with this era stored as their set name are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CollectionsManagementPage;
