import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { toast } from 'sonner';
import {
  Sparkles, Plus, Loader2, Trash2, Pencil, ArrowUp, ArrowDown,
  ImageOff, Upload, Link2, Store, Search,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { SHOWCASE_ACCENTS, DEFAULT_ACCENT } from '@/lib/heroShowcase.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { publicImageUrl } from '@/utils/imageUrl.js';

// Resolve a vault image reference (storage path or full URL) to a usable URL.
const resolveVaultImage = (raw) => {
  if (!raw) return null;
  return publicImageUrl(raw);
};

const EMPTY_FORM = { name: '', subtitle: '', rarity: '', value: '', accent: DEFAULT_ACCENT };

const HeroShowcaseAdminPage = () => {
  const [cards, setCards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('upload');
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [urlInput, setUrlInput] = useState('');
  const [existingImage, setExistingImage] = useState(null);
  const fileInputRef = useRef(null);

  // Marketplace picker
  const [vaultItems, setVaultItems] = useState([]);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultSearch, setVaultSearch] = useState('');
  const [selectedVault, setSelectedVault] = useState(null);

  useEffect(() => { fetchCards(); }, []);

  const fetchCards = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('hero_showcase_cards')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      setCards(data || []);
    } catch (err) {
      toast.error('Failed to load showcase cards.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadVaultItems = async () => {
    if (vaultItems.length > 0) return;
    setVaultLoading(true);
    try {
      const { data, error } = await supabase
        .from('vault_items')
        .select('id, card_name, estimated_value_aud, condition, collection_type, image_urls')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setVaultItems(data || []);
    } catch (err) {
      toast.error('Failed to load marketplace cards.');
    } finally {
      setVaultLoading(false);
    }
  };

  // ── Dialog open helpers ──────────────────────────────────────────────────
  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setTab('upload');
    resetImageInputs();
    setExistingImage(null);
    setDialogOpen(true);
  };

  const openEdit = (card) => {
    setEditingId(card.id);
    setForm({
      name: card.name || '',
      subtitle: card.subtitle || '',
      rarity: card.rarity || '',
      value: card.value || '',
      accent: card.accent || DEFAULT_ACCENT,
    });
    setTab('keep');
    resetImageInputs();
    setExistingImage(card.image_url || null);
    setDialogOpen(true);
  };

  const resetImageInputs = () => {
    setFile(null);
    setFilePreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    setUrlInput('');
    setSelectedVault(null);
    setVaultSearch('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setFilePreview((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(f); });
  };

  const handlePickVault = (item) => {
    setSelectedVault(item);
    // Prefill metadata from the marketplace card (admin can still tweak).
    setForm((prev) => ({
      ...prev,
      name: prev.name || item.card_name || '',
      subtitle: prev.subtitle || item.collection_type || '',
      value: prev.value || (item.estimated_value_aud ? `$${Number(item.estimated_value_aud).toLocaleString()}` : ''),
    }));
  };

  const filteredVault = useMemo(() => {
    const q = vaultSearch.trim().toLowerCase();
    if (!q) return vaultItems;
    return vaultItems.filter((v) => (v.card_name || '').toLowerCase().includes(q));
  }, [vaultItems, vaultSearch]);

  // ── Save (create or update) ──────────────────────────────────────────────
  const resolveImageUrl = async () => {
    if (tab === 'upload') {
      if (!file) return null;
      const ext = file.name.split('.').pop().toLowerCase();
      const path = `hero-showcase/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('media').upload(path, file, { cacheControl: '31536000' });
      if (upErr) throw upErr;
      return supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
    }
    if (tab === 'url') return urlInput.trim() || null;
    if (tab === 'marketplace') return resolveVaultImage(selectedVault?.image_urls?.[0]);
    if (tab === 'keep') return existingImage;
    return null;
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Card name is required.'); return; }

    setSaving(true);
    try {
      const imageUrl = await resolveImageUrl();
      if (!imageUrl) {
        toast.error('A card image is required.');
        setSaving(false);
        return;
      }

      const payload = {
        name: form.name.trim(),
        subtitle: form.subtitle.trim() || null,
        rarity: form.rarity.trim() || null,
        value: form.value.trim() || null,
        accent: form.accent,
        image_url: imageUrl,
        vault_item_id: tab === 'marketplace' ? (selectedVault?.id ?? null) : undefined,
      };

      if (editingId) {
        if (payload.vault_item_id === undefined) delete payload.vault_item_id;
        const { data, error } = await supabase
          .from('hero_showcase_cards')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingId)
          .select()
          .single();
        if (error) throw error;
        setCards((prev) => prev.map((c) => (c.id === editingId ? data : c)));
        toast.success('Showcase card updated.');
      } else {
        const nextOrder = cards.length ? Math.max(...cards.map((c) => c.sort_order ?? 0)) + 1 : 0;
        const { data, error } = await supabase
          .from('hero_showcase_cards')
          .insert({ ...payload, vault_item_id: payload.vault_item_id ?? null, sort_order: nextOrder, is_active: true })
          .select()
          .single();
        if (error) throw error;
        setCards((prev) => [...prev, data]);
        toast.success('Card added to the show.');
      }
      setDialogOpen(false);
      resetImageInputs();
    } catch (err) {
      toast.error(err.message || 'Failed to save showcase card.');
    } finally {
      setSaving(false);
    }
  };

  // ── Row actions ──────────────────────────────────────────────────────────
  const toggleActive = async (card) => {
    setBusyId(card.id);
    try {
      const { data, error } = await supabase
        .from('hero_showcase_cards')
        .update({ is_active: !card.is_active, updated_at: new Date().toISOString() })
        .eq('id', card.id)
        .select()
        .single();
      if (error) throw error;
      setCards((prev) => prev.map((c) => (c.id === card.id ? data : c)));
    } catch (err) {
      toast.error('Failed to update card.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (card) => {
    if (!window.confirm(`Remove "${card.name}" from the showcase?`)) return;
    setBusyId(card.id);
    try {
      const { error } = await supabase.from('hero_showcase_cards').delete().eq('id', card.id);
      if (error) throw error;
      setCards((prev) => prev.filter((c) => c.id !== card.id));
      toast.success('Card removed.');
    } catch (err) {
      toast.error('Failed to remove card.');
    } finally {
      setBusyId(null);
    }
  };

  const move = async (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= cards.length) return;

    // Swap array positions, then renumber sequentially. Swapping the two rows'
    // sort_order values broke when they were equal (e.g. both default 0) — the
    // swap wrote identical values and nothing moved. Renumbering is deterministic.
    const reordered = [...cards];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setCards(reordered.map((c, i) => ({ ...c, sort_order: i }))); // optimistic
    try {
      for (let i = 0; i < reordered.length; i++) {
        if (reordered[i].sort_order !== i) {
          const { error } = await supabase.from('hero_showcase_cards').update({ sort_order: i }).eq('id', reordered[i].id);
          if (error) throw error;
        }
      }
    } catch (err) {
      toast.error('Failed to save new order.');
      fetchCards();
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  const previewSrc = filePreview
    || (tab === 'url' ? urlInput : null)
    || (tab === 'marketplace' ? resolveVaultImage(selectedVault?.image_urls?.[0]) : null)
    || (tab === 'keep' ? existingImage : null);

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Admin - Hero Showcase | CardPop</title>
      </Helmet>

      <AdminPageHeader
        icon={Sparkles}
        title="Hero Showcase Cards"
        subtitle="Add card images to the homepage hero animation. Active cards rotate through the show on the back wall and onto the stand."
      >
        <Button onClick={openCreate} className="rounded-xl font-bold gap-2">
          <Plus className="w-4 h-4" /> Add Card
        </Button>
      </AdminPageHeader>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="aspect-[3/4] w-full rounded-2xl" />)}
        </div>
      ) : cards.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-3xl">
          <Sparkles className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-foreground font-bold text-lg">No showcase cards yet.</p>
          <p className="text-muted-foreground text-sm mt-1">Add cards to start the hero animation. Until then the homepage uses the built-in defaults.</p>
          <Button onClick={openCreate} className="mt-5 rounded-xl font-bold gap-2">
            <Plus className="w-4 h-4" /> Add your first card
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {cards.map((card, i) => {
            const accent = SHOWCASE_ACCENTS[card.accent] || SHOWCASE_ACCENTS[DEFAULT_ACCENT];
            return (
              <div
                key={card.id}
                className={`relative bg-card border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col ${card.is_active ? '' : 'opacity-60'}`}
              >
                <div className={`relative aspect-[3/4] bg-gradient-to-br ${accent.gradient}`}>
                  {card.image_url ? (
                    <img src={card.image_url} alt={card.name} className="absolute inset-0 w-full h-full object-contain p-1.5" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center"><ImageOff className="w-6 h-6 text-white/40" /></div>
                  )}
                  {card.vault_item_id && (
                    <Badge className="absolute top-2 left-2 bg-black/70 text-white border-none text-[10px] gap-1">
                      <Store className="w-3 h-3" /> Marketplace
                    </Badge>
                  )}
                  {!card.is_active && (
                    <span className="absolute top-2 right-2 text-[10px] font-bold uppercase tracking-wide bg-black/70 text-white/80 px-2 py-0.5 rounded">Hidden</span>
                  )}
                </div>

                <div className="p-3 flex flex-col gap-2">
                  <div>
                    <p className="font-bold text-sm leading-tight truncate" title={card.name}>{card.name}</p>
                    <p className="text-muted-foreground text-xs truncate">{card.rarity || card.subtitle || '—'}</p>
                    {card.value && <p className="text-xs font-black text-primary mt-0.5">{card.value}</p>}
                  </div>

                  <div className="flex items-center justify-between gap-1 pt-1 border-t border-border">
                    <div className="flex items-center gap-1.5">
                      {busyId === card.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      ) : (
                        <Switch checked={card.is_active} onCheckedChange={() => toggleActive(card)} />
                      )}
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"
                        className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"><ArrowUp className="w-3.5 h-3.5" /></button>
                      <button onClick={() => move(i, 1)} disabled={i === cards.length - 1} aria-label="Move down"
                        className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"><ArrowDown className="w-3.5 h-3.5" /></button>
                      <button onClick={() => openEdit(card)} aria-label="Edit"
                        className="p-1.5 rounded-md hover:bg-muted"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(card)} aria-label="Delete"
                        className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add / edit dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetImageInputs(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit showcase card' : 'Add showcase card'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Image source */}
            <div className="space-y-2">
              <Label>Card image</Label>
              <Tabs value={tab} onValueChange={(v) => { setTab(v); if (v === 'marketplace') loadVaultItems(); }}>
                <TabsList className="grid w-full grid-cols-4">
                  {editingId && <TabsTrigger value="keep" className="text-xs">Keep</TabsTrigger>}
                  <TabsTrigger value="upload" className="text-xs gap-1"><Upload className="w-3 h-3" />Upload</TabsTrigger>
                  <TabsTrigger value="url" className="text-xs gap-1"><Link2 className="w-3 h-3" />URL</TabsTrigger>
                  <TabsTrigger value="marketplace" className="text-xs gap-1"><Store className="w-3 h-3" />Market</TabsTrigger>
                </TabsList>

                {editingId && (
                  <TabsContent value="keep" className="pt-3">
                    <p className="text-xs text-muted-foreground">Keep the current image.</p>
                  </TabsContent>
                )}

                <TabsContent value="upload" className="pt-3">
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange}
                    className="block w-full text-sm text-muted-foreground file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90" />
                  <p className="text-xs text-muted-foreground mt-2">PNG with transparency works best for the stand effect.</p>
                </TabsContent>

                <TabsContent value="url" className="pt-3">
                  <Input placeholder="https://…/card.png" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} className="rounded-xl" />
                </TabsContent>

                <TabsContent value="marketplace" className="pt-3">
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search marketplace cards…" value={vaultSearch} onChange={(e) => setVaultSearch(e.target.value)} className="pl-9 rounded-xl" />
                  </div>
                  <div className="max-h-44 overflow-y-auto rounded-xl border border-border divide-y divide-border">
                    {vaultLoading ? (
                      <div className="p-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                    ) : filteredVault.length === 0 ? (
                      <p className="p-4 text-xs text-muted-foreground text-center">No marketplace cards found.</p>
                    ) : filteredVault.map((item) => {
                      const img = resolveVaultImage(item.image_urls?.[0]);
                      return (
                        <button key={item.id} type="button" onClick={() => handlePickVault(item)}
                          className={`flex items-center gap-3 w-full p-2 text-left hover:bg-muted/50 ${selectedVault?.id === item.id ? 'bg-primary/10' : ''}`}>
                          <div className="w-8 h-11 rounded bg-background border border-border overflow-hidden shrink-0 flex items-center justify-center">
                            {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : <ImageOff className="w-3 h-3 text-muted-foreground/50" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">{item.card_name || 'Untitled'}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{item.collection_type || '—'}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </TabsContent>
              </Tabs>

              {previewSrc && (
                <div className="mt-3 flex justify-center">
                  <img src={previewSrc} alt="Preview" className="h-28 rounded-lg border border-border object-contain bg-muted p-1" />
                </div>
              )}
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="hsc-name">Name</Label>
                <Input id="hsc-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Charizard" className="rounded-xl" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="hsc-sub">Set / subtitle</Label>
                <Input id="hsc-sub" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="Pokémon · Base Set" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hsc-rarity">Rarity / grade</Label>
                <Input id="hsc-rarity" value={form.rarity} onChange={(e) => setForm({ ...form, rarity: e.target.value })} placeholder="PSA 10 GEM MINT" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hsc-value">Value</Label>
                <Input id="hsc-value" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="$12,000" className="rounded-xl" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Accent</Label>
                <Select value={form.accent} onValueChange={(v) => setForm({ ...form, accent: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SHOWCASE_ACCENTS).map(([key, a]) => (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full inline-block" style={{ background: a.swatch }} />
                          {a.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-xl font-bold gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingId ? 'Save changes' : 'Add card'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HeroShowcaseAdminPage;
