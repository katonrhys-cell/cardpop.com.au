import { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import {
  ChevronRight, ChevronDown, Plus, Pencil, Trash2, Loader2,
  FolderTree, Tag, Factory, Check, X,
} from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient.js';

// ─── helpers ──────────────────────────────────────────────────────────────────

const slug = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ─── Inline editable text ─────────────────────────────────────────────────────

const InlineEdit = ({ value, onSave, onCancel }) => {
  const [text, setText] = useState(value);
  return (
    <span className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
      <Input
        autoFocus
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onSave(text); if (e.key === 'Escape') onCancel(); }}
        className="h-7 text-sm w-48 px-2"
      />
      <button onClick={() => onSave(text)} className="text-emerald-600 hover:text-emerald-700"><Check className="w-4 h-4" /></button>
      <button onClick={onCancel} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
    </span>
  );
};

// ─── Add-row inline form ───────────────────────────────────────────────────────

const AddRow = ({ placeholder, onAdd, onCancel }) => {
  const [text, setText] = useState('');
  return (
    <div className="flex items-center gap-2 mt-2 ml-2" onClick={e => e.stopPropagation()}>
      <Input
        autoFocus
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && text.trim()) onAdd(text.trim()); if (e.key === 'Escape') onCancel(); }}
        placeholder={placeholder}
        className="h-7 text-sm w-52 px-2"
      />
      <Button size="sm" className="h-7 px-3 text-xs" onClick={() => text.trim() && onAdd(text.trim())}>Add</Button>
      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onCancel}>Cancel</Button>
    </div>
  );
};

// ─── Confirm delete button ────────────────────────────────────────────────────

const DeleteButton = ({ onConfirm, label }) => {
  const [confirming, setConfirming] = useState(false);
  if (confirming) return (
    <span className="flex items-center gap-1 text-xs" onClick={e => e.stopPropagation()}>
      <span className="text-destructive font-medium">Delete {label}?</span>
      <button onClick={() => { setConfirming(false); onConfirm(); }} className="text-destructive hover:text-destructive/80 font-bold">Yes</button>
      <button onClick={() => setConfirming(false)} className="text-muted-foreground hover:text-foreground">No</button>
    </span>
  );
  return (
    <button onClick={e => { e.stopPropagation(); setConfirming(true); }} className="text-muted-foreground hover:text-destructive transition-colors">
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const CategoryManagementPage = () => {
  const [rootCategories, setRootCategories] = useState([]);
  const [franchises, setFranchises]         = useState({});       // { categoryId: [...] }
  const [manufacturers, setManufacturers]   = useState({});       // { franchiseId: [...] }
  const [expanded, setExpanded]             = useState({});       // { id: bool }
  const [loading, setLoading]               = useState(true);
  const [editingId, setEditingId]           = useState(null);
  const [addingUnder, setAddingUnder]       = useState(null);     // { type, parentId }
  const [saving, setSaving]                 = useState(false);

  // ── Load all data ────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: cats }, { data: mfrs }] = await Promise.all([
        supabase.from('categories').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('manufacturers').select('*').eq('is_active', true).order('sort_order'),
      ]);

      const roots = (cats ?? []).filter(c => c.parent_id === null);
      const franchMap = {};
      roots.forEach(r => {
        franchMap[r.id] = (cats ?? []).filter(c => c.parent_id === r.id);
      });
      const mfrMap = {};
      (mfrs ?? []).forEach(m => {
        if (!mfrMap[m.franchise_id]) mfrMap[m.franchise_id] = [];
        mfrMap[m.franchise_id].push(m);
      });

      setRootCategories(roots);
      setFranchises(franchMap);
      setManufacturers(mfrMap);
      // Auto-expand roots
      const exp = {};
      roots.forEach(r => { exp[r.id] = true; });
      setExpanded(exp);
    } catch (err) {
      toast.error('Failed to load hierarchy');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const toggle = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  // ── Save name edit ───────────────────────────────────────────────────────
  const saveEdit = async (type, id, name) => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (type === 'manufacturer') {
        const { error } = await supabase.from('manufacturers').update({ name: name.trim(), slug: slug(name) }).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('categories').update({ name: name.trim(), slug: slug(name) }).eq('id', id);
        if (error) throw error;
      }
      toast.success('Updated');
      setEditingId(null);
      loadAll();
    } catch (err) {
      toast.error(err.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async (type, id) => {
    setSaving(true);
    try {
      if (type === 'manufacturer') {
        const { error } = await supabase.from('manufacturers').update({ is_active: false }).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('categories').update({ is_active: false }).eq('id', id);
        if (error) throw error;
      }
      toast.success('Removed');
      loadAll();
    } catch (err) {
      toast.error(err.message || 'Failed to delete');
    } finally {
      setSaving(false);
    }
  };

  // ── Add ──────────────────────────────────────────────────────────────────
  const handleAdd = async (type, name, parentId) => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (type === 'manufacturer') {
        const { error } = await supabase.from('manufacturers').insert({
          name: name.trim(),
          slug: slug(name),
          franchise_id: parentId,
          sort_order: (manufacturers[parentId]?.length ?? 0) + 1,
          is_active: true,
        });
        if (error) throw error;
      } else {
        const sortBase = type === 'category'
          ? rootCategories.length + 1
          : (franchises[parentId]?.length ?? 0) + 1;
        const { error } = await supabase.from('categories').insert({
          name: name.trim(),
          slug: slug(name),
          parent_id: parentId ?? null,
          category_group: type === 'category' ? 'root' : (
            rootCategories.find(r => r.id === parentId)?.category_group ?? 'other'
          ),
          sort_order: sortBase,
          is_active: true,
        });
        if (error) throw error;
      }
      toast.success(`${name} added`);
      setAddingUnder(null);
      loadAll();
    } catch (err) {
      toast.error(err.message || 'Failed to add');
    } finally {
      setSaving(false);
    }
  };

  // ── Counts ───────────────────────────────────────────────────────────────
  const franchiseCount = Object.values(franchises).reduce((s, a) => s + a.length, 0);
  const mfrCount       = Object.values(manufacturers).reduce((s, a) => s + a.length, 0);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <Helmet><title>Hierarchy Management | CardPop Admin</title></Helmet>

      <AdminPageHeader
        icon={FolderTree}
        title="Hierarchy Management"
        subtitle={`${rootCategories.length} categories · ${franchiseCount} franchises · ${mfrCount} manufacturers`}
      >
        <Button
          variant="outline"
          onClick={() => setAddingUnder({ type: 'category', parentId: null })}
          className="gap-1.5 rounded-xl h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
        >
          <Plus className="w-4 h-4" /> Add Category
        </Button>
      </AdminPageHeader>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-2">

          {/* Root category add row */}
          {addingUnder?.type === 'category' && addingUnder?.parentId === null && (
            <AddRow
              placeholder="New category name…"
              onAdd={name => handleAdd('category', name, null)}
              onCancel={() => setAddingUnder(null)}
            />
          )}

          {rootCategories.map(cat => (
            <div key={cat.id} className="rounded-xl border border-border bg-card overflow-hidden">

              {/* ── Category row ── */}
              <div
                className="group flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-muted/40 select-none"
                onClick={() => toggle(cat.id)}
              >
                <button className="text-muted-foreground" onClick={e => { e.stopPropagation(); toggle(cat.id); }}>
                  {expanded[cat.id]
                    ? <ChevronDown className="w-4 h-4" />
                    : <ChevronRight className="w-4 h-4" />}
                </button>
                <FolderTree className="w-4 h-4 text-brand-blue shrink-0" />

                {editingId === cat.id ? (
                  <InlineEdit
                    value={cat.name}
                    onSave={name => saveEdit('category', cat.id, name)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <span className="font-bold text-sm flex-1">{cat.name}</span>
                )}

                <Badge variant="outline" className="text-xs ml-auto mr-3">
                  {franchises[cat.id]?.length ?? 0} franchises
                </Badge>

                <span className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={e => e.stopPropagation()}>
                  <button className="text-muted-foreground hover:text-foreground" onClick={() => setEditingId(cat.id)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <DeleteButton label={cat.name} onConfirm={() => handleDelete('category', cat.id)} />
                  <button
                    className="text-muted-foreground hover:text-primary ml-1"
                    onClick={() => setAddingUnder({ type: 'franchise', parentId: cat.id })}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </span>
              </div>

              {/* ── Franchises ── */}
              {expanded[cat.id] && (
                <div className="border-t border-border/50 bg-muted/20">

                  {addingUnder?.type === 'franchise' && addingUnder?.parentId === cat.id && (
                    <div className="px-4 py-2">
                      <AddRow
                        placeholder="New franchise name…"
                        onAdd={name => handleAdd('franchise', name, cat.id)}
                        onCancel={() => setAddingUnder(null)}
                      />
                    </div>
                  )}

                  {(franchises[cat.id] ?? []).length === 0 && addingUnder?.parentId !== cat.id && (
                    <p className="text-xs text-muted-foreground px-10 py-3 italic">No franchises yet.</p>
                  )}

                  {(franchises[cat.id] ?? []).map(fr => (
                    <div key={fr.id}>

                      {/* franchise row */}
                      <div
                        className="flex items-center gap-2 px-10 py-2.5 cursor-pointer hover:bg-muted/40 select-none border-b border-border/30 last:border-b-0"
                        onClick={() => toggle(fr.id)}
                      >
                        <button className="text-muted-foreground">
                          {expanded[fr.id]
                            ? <ChevronDown className="w-3.5 h-3.5" />
                            : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                        <Tag className="w-3.5 h-3.5 text-amber-500 shrink-0" />

                        {editingId === fr.id ? (
                          <InlineEdit
                            value={fr.name}
                            onSave={name => saveEdit('franchise', fr.id, name)}
                            onCancel={() => setEditingId(null)}
                          />
                        ) : (
                          <span className="text-sm flex-1">{fr.name}</span>
                        )}

                        <span className="text-xs text-muted-foreground mr-3">
                          {manufacturers[fr.id]?.length ?? 0} manufacturers
                        </span>

                        <span className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                          <button className="text-muted-foreground hover:text-foreground" onClick={() => setEditingId(fr.id)}>
                            <Pencil className="w-3 h-3" />
                          </button>
                          <DeleteButton label={fr.name} onConfirm={() => handleDelete('franchise', fr.id)} />
                          <button
                            className="text-muted-foreground hover:text-primary ml-1"
                            onClick={() => setAddingUnder({ type: 'manufacturer', parentId: fr.id })}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </span>
                      </div>

                      {/* ── Manufacturers ── */}
                      {expanded[fr.id] && (
                        <div className="bg-muted/10">

                          {addingUnder?.type === 'manufacturer' && addingUnder?.parentId === fr.id && (
                            <div className="px-16 py-2">
                              <AddRow
                                placeholder="New manufacturer name…"
                                onAdd={name => handleAdd('manufacturer', name, fr.id)}
                                onCancel={() => setAddingUnder(null)}
                              />
                            </div>
                          )}

                          {(manufacturers[fr.id] ?? []).length === 0 && addingUnder?.parentId !== fr.id && (
                            <p className="text-xs text-muted-foreground px-16 py-2 italic">No manufacturers yet.</p>
                          )}

                          {(manufacturers[fr.id] ?? []).map(mfr => (
                            <div
                              key={mfr.id}
                              className="flex items-center gap-2 px-16 py-2 border-b border-border/20 last:border-b-0 hover:bg-muted/30"
                            >
                              <Factory className="w-3 h-3 text-muted-foreground shrink-0" />

                              {editingId === mfr.id ? (
                                <InlineEdit
                                  value={mfr.name}
                                  onSave={name => saveEdit('manufacturer', mfr.id, name)}
                                  onCancel={() => setEditingId(null)}
                                />
                              ) : (
                                <span className="text-xs text-muted-foreground flex-1">{mfr.name}</span>
                              )}

                              <span className="flex items-center gap-1.5">
                                <button className="text-muted-foreground hover:text-foreground" onClick={() => setEditingId(mfr.id)}>
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <DeleteButton label={mfr.name} onConfirm={() => handleDelete('manufacturer', mfr.id)} />
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                    </div>
                  ))}

                  {/* Add franchise button at bottom */}
                  {addingUnder?.parentId !== cat.id && (
                    <button
                      className="w-full text-xs text-muted-foreground hover:text-primary flex items-center gap-1.5 px-10 py-2 hover:bg-muted/30 transition-colors"
                      onClick={() => setAddingUnder({ type: 'franchise', parentId: cat.id })}
                    >
                      <Plus className="w-3 h-3" /> Add franchise
                    </button>
                  )}
                </div>
              )}

            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CategoryManagementPage;
