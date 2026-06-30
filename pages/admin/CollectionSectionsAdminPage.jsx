import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { toast } from 'sonner';
import {
  LayoutList, Loader2, Trash2, ArrowUp, ArrowDown, ImageOff, Search, Plus, Info,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import { COLLECTION_CONFIGS } from '@/data/collectionConfigs.js';
import { COLLECTION_SECTIONS } from '@/lib/collectionSections.js';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';

const resolveVaultImage = (item) => {
  const raw = item?.image_urls?.[0] || item?.vault_images?.[0]?.storage_path || null;
  if (!raw) return null;
  return raw.startsWith('http')
    ? raw
    : supabase.storage.from('vault-images').getPublicUrl(raw).data.publicUrl;
};

const VAULT_SELECT = 'id, card_name, estimated_value_aud, condition, collection_type, image_urls, vault_images(*)';

const COLLECTION_OPTIONS = Object.values(COLLECTION_CONFIGS)
  .map((c) => ({ slug: c.slug, name: c.name }))
  .sort((a, b) => a.name.localeCompare(b.name));

const CollectionSectionsAdminPage = () => {
  const [slug, setSlug] = useState(COLLECTION_OPTIONS[0]?.slug || '');
  const [section, setSection] = useState(COLLECTION_SECTIONS[0].key);

  const [pins, setPins] = useState([]); // { id, vault_item_id, sort_order, item }
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // ── Load pinned cards for the current collection + section ─────────────────
  const loadPins = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from('collection_section_cards')
        .select('*')
        .eq('collection_slug', slug)
        .eq('section', section)
        .order('sort_order', { ascending: true });
      if (error) throw error;

      const ids = (rows ?? []).map((r) => r.vault_item_id);
      let itemsById = {};
      if (ids.length) {
        const { data: items } = await supabase.from('vault_items').select(VAULT_SELECT).in('id', ids);
        itemsById = Object.fromEntries((items ?? []).map((it) => [it.id, it]));
      }
      setPins((rows ?? []).map((r) => ({ ...r, item: itemsById[r.vault_item_id] || null })));
    } catch (err) {
      toast.error('Failed to load pinned cards.');
    } finally {
      setLoading(false);
    }
  }, [slug, section]);

  useEffect(() => { loadPins(); }, [loadPins]);

  // ── Marketplace search ─────────────────────────────────────────────────────
  useEffect(() => {
    const q = search.trim();
    let cancelled = false;
    setSearching(true);
    const id = setTimeout(async () => {
      try {
        let query = supabase.from('vault_items').select(VAULT_SELECT).order('created_at', { ascending: false }).limit(40);
        if (q) query = query.ilike('card_name', `%${q}%`);
        const { data, error } = await query;
        if (error) throw error;
        if (!cancelled) setResults(data ?? []);
      } catch (err) {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(id); };
  }, [search]);

  const pinnedIds = useMemo(() => new Set(pins.map((p) => p.vault_item_id)), [pins]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const addCard = async (item) => {
    if (pinnedIds.has(item.id)) { toast.info('Already pinned to this section.'); return; }
    setBusyId(item.id);
    try {
      const nextOrder = pins.length ? Math.max(...pins.map((p) => p.sort_order ?? 0)) + 1 : 0;
      const { data, error } = await supabase
        .from('collection_section_cards')
        .insert({ collection_slug: slug, section, vault_item_id: item.id, sort_order: nextOrder })
        .select()
        .single();
      if (error) throw error;
      setPins((prev) => [...prev, { ...data, item }]);
      toast.success('Card pinned.');
    } catch (err) {
      toast.error(err.message || 'Failed to pin card.');
    } finally {
      setBusyId(null);
    }
  };

  const removePin = async (pin) => {
    setBusyId(pin.id);
    try {
      const { error } = await supabase.from('collection_section_cards').delete().eq('id', pin.id);
      if (error) throw error;
      setPins((prev) => prev.filter((p) => p.id !== pin.id));
      toast.success('Card removed.');
    } catch (err) {
      toast.error('Failed to remove card.');
    } finally {
      setBusyId(null);
    }
  };

  const move = async (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= pins.length) return;
    const a = pins[index];
    const b = pins[target];
    const aOrder = a.sort_order ?? index;
    const bOrder = b.sort_order ?? target;
    const reordered = [...pins];
    reordered[index] = { ...b, sort_order: aOrder };
    reordered[target] = { ...a, sort_order: bOrder };
    reordered.sort((x, y) => (x.sort_order ?? 0) - (y.sort_order ?? 0));
    setPins(reordered);
    try {
      const [r1, r2] = await Promise.all([
        supabase.from('collection_section_cards').update({ sort_order: bOrder }).eq('id', a.id),
        supabase.from('collection_section_cards').update({ sort_order: aOrder }).eq('id', b.id),
      ]);
      if (r1.error || r2.error) throw (r1.error || r2.error);
    } catch (err) {
      toast.error('Failed to save new order.');
      loadPins();
    }
  };

  const sectionLabel = COLLECTION_SECTIONS.find((s) => s.key === section)?.label;

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Admin - Collection Sections | CardPop</title>
      </Helmet>

      <AdminPageHeader
        icon={LayoutList}
        title="Collection Section Cards"
        subtitle="Hand-pick which marketplace cards appear in each collection's strips. Pinned cards show first, then the rest auto-fill."
      />

      {/* Selectors */}
      <div className="bg-card border border-border rounded-3xl p-5 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Collection</label>
          <Select value={slug} onValueChange={setSlug}>
            <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              {COLLECTION_OPTIONS.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Section</label>
          <Select value={section} onValueChange={setSection}>
            <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {COLLECTION_SECTIONS.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 border border-border rounded-xl p-3">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <span>Pinned cards appear first in <strong>{sectionLabel}</strong> for the selected collection, in the order below. Any remaining slots fill automatically with the usual cards.</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pinned list */}
        <div className="bg-card border border-border rounded-3xl overflow-hidden">
          <div className="p-4 border-b border-border font-bold text-sm flex items-center justify-between">
            <span>Pinned cards</span>
            <Badge variant="secondary" className="font-bold">{pins.length}</Badge>
          </div>
          {loading ? (
            <div className="p-4 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
          ) : pins.length === 0 ? (
            <div className="text-center py-12 px-4">
              <p className="text-foreground font-bold">No pinned cards yet.</p>
              <p className="text-muted-foreground text-sm mt-1">This section is fully automatic until you add cards.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {pins.map((pin, i) => {
                const item = pin.item;
                const img = item ? resolveVaultImage(item) : null;
                return (
                  <li key={pin.id} className="flex items-center gap-3 p-3">
                    <span className="text-xs font-bold text-muted-foreground w-5 text-center">{i + 1}</span>
                    <div className="w-10 h-14 rounded bg-background border border-border overflow-hidden shrink-0 flex items-center justify-center">
                      {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : <ImageOff className="w-4 h-4 text-muted-foreground/50" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm truncate">{item?.card_name || (pin.item === null ? 'Card unavailable' : 'Untitled')}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item?.collection_type || '—'}{item?.estimated_value_aud ? ` · $${Number(item.estimated_value_aud).toLocaleString()}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
                      <button onClick={() => move(i, 1)} disabled={i === pins.length - 1} aria-label="Move down" className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
                      {busyId === pin.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mx-1.5" />
                      ) : (
                        <button onClick={() => removePin(pin)} aria-label="Remove" className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Marketplace picker */}
        <div className="bg-card border border-border rounded-3xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search marketplace cards by name…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-xl h-11" />
            </div>
          </div>
          <div className="max-h-[28rem] overflow-y-auto divide-y divide-border">
            {searching ? (
              <div className="p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : results.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">No marketplace cards found.</p>
            ) : results.map((item) => {
              const img = resolveVaultImage(item);
              const already = pinnedIds.has(item.id);
              return (
                <div key={item.id} className="flex items-center gap-3 p-3">
                  <div className="w-10 h-14 rounded bg-background border border-border overflow-hidden shrink-0 flex items-center justify-center">
                    {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : <ImageOff className="w-4 h-4 text-muted-foreground/50" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm truncate">{item.card_name || 'Untitled'}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.collection_type || '—'}{item.estimated_value_aud ? ` · $${Number(item.estimated_value_aud).toLocaleString()}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => addCard(item)}
                    disabled={already || busyId === item.id}
                    className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {busyId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    {already ? 'Added' : 'Add'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollectionSectionsAdminPage;
