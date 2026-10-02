// Admin → Products → "Categories": add and remove shop categories without a
// deploy. The built-in taxonomy lives in utils/shopCategories.js; this edits the
// shop_categories overlay table (see that file and its migration):
//   • Add    → a custom leaf category under one of the five sections.
//   • Remove → deletes a custom category, or hides a built-in one.
//   • Restore → un-hides a removed built-in.
// Products are never touched — a removed category's products stay in the shop
// and show under "Other" in the product list until they're moved.
import React, { useMemo, useState } from 'react';
import { Plus, Trash2, RotateCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient.js';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import useShopCategoryGroups, { refreshShopCategories } from '@/hooks/useShopCategoryGroups.js';
import { SHOP_CATEGORY_GROUPS } from '@/utils/shopCategories.js';
import { shopCategorySlug } from '@/utils/shopProductUrl.js';

// Mirrors the CHECK constraint on shop_categories.name.
export const CATEGORY_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 &'+/-]*$/;
const NAME_MAX = 60;

const key = (name) => String(name || '').trim().toLowerCase();

/** Why a new category name can't be used, or null if it's fine. */
export function categoryNameError(name, categories) {
  const trimmed = String(name || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'Enter a category name.';
  if (trimmed.length > NAME_MAX) return `Keep it under ${NAME_MAX} characters.`;
  if (!CATEGORY_NAME_PATTERN.test(trimmed)) return "Use letters, numbers, spaces and & ' + / - only.";
  if (!shopCategorySlug({ category: trimmed })) return 'That name is reserved — try another.';
  const slug = shopCategorySlug({ category: trimmed });
  const clash = categories.find((c) => key(c.name) === key(trimmed) || c.slug === slug);
  if (clash) return `“${clash.name}” already exists under ${clash.group}.`;
  return null;
}

const ShopCategoryManager = ({ open, onOpenChange, products = [] }) => {
  const { groups, categories, rows } = useShopCategoryGroups();
  const [section, setSection] = useState(SHOP_CATEGORY_GROUPS[0].slug);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(null);

  // Products per category name, so a removal can say what it affects.
  const counts = useMemo(() => {
    const m = new Map();
    for (const p of products) m.set(key(p.category), (m.get(key(p.category)) || 0) + 1);
    return m;
  }, [products]);

  const removedBuiltIns = rows.filter((r) => r.hidden);
  const nameError = name.trim() ? categoryNameError(name, categories) : null;

  const run = async (label, fn, success) => {
    setBusy(label);
    try {
      const { error } = await fn();
      if (error) throw error;
      await refreshShopCategories();
      toast.success(success);
      return true;
    } catch (err) {
      toast.error(err?.message ? `Couldn't save: ${err.message}` : "Couldn't save the change.");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const trimmed = name.trim().replace(/\s+/g, ' ');
    const err = categoryNameError(trimmed, categories);
    if (err) { toast.error(err); return; }
    const group = groups.find((g) => g.slug === section);
    // Re-adding a removed built-in just restores it (its row is the hide marker).
    const hiddenRow = removedBuiltIns.find((r) => key(r.name) === key(trimmed));
    const ok = hiddenRow
      ? await run('add', () => supabase.from('shop_categories').delete().eq('id', hiddenRow.id), `Restored “${hiddenRow.name}”.`)
      : await run('add', () => supabase.from('shop_categories').insert({
        section_slug: section, name: trimmed, description: description.trim() || null,
      }), `Added “${trimmed}” to ${group?.label}.`);
    if (ok) { setName(''); setDescription(''); }
  };

  const handleRemove = async (group, item) => {
    const n = counts.get(key(item.name)) || 0;
    const note = n
      ? `\n\n${n} product${n === 1 ? '' : 's'} use it. They stay in the shop but will show under “Other” here until you move them to another category.`
      : '';
    if (!window.confirm(`Remove “${item.name}” from ${group.label}?${note}`)) return;
    await run(`remove:${item.name}`, () => (item.custom
      ? supabase.from('shop_categories').delete().eq('id', item.id)
      : supabase.from('shop_categories').insert({ section_slug: group.slug, name: item.name, hidden: true })),
    `Removed “${item.name}”.`);
  };

  const handleRestore = (row) =>
    run(`restore:${row.name}`, () => supabase.from('shop_categories').delete().eq('id', row.id), `Restored “${row.name}”.`);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background rounded-2xl border-border">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold font-serif text-foreground">Shop categories</DialogTitle>
          <DialogDescription>
            Add or remove the categories in the Shop menu and the product form. Changes go live straight away.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleAdd} className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">Add a category</p>
          <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="new-category-section">Section</Label>
              <Select value={section} onValueChange={setSection}>
                <SelectTrigger id="new-category-section" aria-label="Section" className="h-10 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SHOP_CATEGORY_GROUPS.map((g) => <SelectItem key={g.slug} value={g.slug}>{g.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-category-name">Name</Label>
              <Input id="new-category-name" value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Booster Box Protectors" className="h-10 bg-background" aria-invalid={!!nameError} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-category-desc">Short description <span className="font-normal text-muted-foreground">(optional, shown in the Shop menu)</span></Label>
            <Input id="new-category-desc" value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Clear cases for sealed booster boxes" className="h-10 bg-background" />
          </div>
          {nameError && <p className="text-sm text-destructive">{nameError}</p>}
          <Button type="submit" className="gap-2 rounded-xl" disabled={!name.trim() || !!nameError || !!busy}>
            {busy === 'add' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add category
          </Button>
        </form>

        <div className="space-y-4">
          {groups.map((group) => (
            <section key={group.slug} aria-label={group.label}>
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
                {group.label} · {group.items.length}
              </h3>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {group.items.map((item) => {
                  const n = counts.get(key(item.name)) || 0;
                  return (
                    <li key={item.slug} className="flex items-center gap-3 px-3 py-2">
                      <span className="flex-1 min-w-0 truncate text-sm font-medium text-foreground">{item.name}</span>
                      {item.custom && <Badge variant="outline" className="text-[10px]">Added</Badge>}
                      <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">{n} product{n === 1 ? '' : 's'}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${item.name}`} disabled={!!busy} onClick={() => handleRemove(group, item)}>
                        {busy === `remove:${item.name}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </Button>
                    </li>
                  );
                })}
                {group.items.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">No categories</li>}
              </ul>
            </section>
          ))}

          {removedBuiltIns.length > 0 && (
            <section aria-label="Removed categories">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Removed</h3>
              <ul className="divide-y divide-border rounded-xl border border-dashed border-border">
                {removedBuiltIns.map((row) => (
                  <li key={row.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="flex-1 min-w-0 truncate text-sm text-muted-foreground line-through">{row.name}</span>
                    <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg" disabled={!!busy}
                      aria-label={`Restore ${row.name}`} onClick={() => handleRestore(row)}>
                      {busy === `restore:${row.name}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Restore
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShopCategoryManager;
