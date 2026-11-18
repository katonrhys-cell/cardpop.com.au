
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Search, Plus, Save, DollarSign, Filter, MoreHorizontal, Edit, Trash2, AlertCircle, RefreshCcw, Package, ChevronLeft, BarChart3, ArrowUp, ArrowDown, ArrowUpDown, X, LayoutList, Rows3, ChevronRight, ChevronsDownUp, ChevronsUpDown, FolderTree, Upload, ExternalLink, ImageOff } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import ConfirmChangesDialog from '@/components/admin/ConfirmChangesDialog.jsx';
import { buildPriceChanges, buildStatusChanges, statusLabel } from '@/utils/adminProductChanges.js';
import { PREORDER_ETA_MAX_LENGTH } from '@/utils/shopStock.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabaseClient.js';
import { toast } from 'sonner';
import ShopProductForm from '@/components/ShopProductForm.jsx';
import ShopCategoryManager from '@/components/admin/ShopCategoryManager.jsx';
import BulkProductImport from '@/components/admin/BulkProductImport.jsx';
import useShopCategoryGroups from '@/hooks/useShopCategoryGroups.js';
import { grossMargin } from '@/src/utils/shopRrp.js';
import { shopProductPath } from '@/utils/shopProductUrl.js';
import { cardThumbUrl } from '@/utils/imageUrl.js';
import { variantKind } from '@/utils/shopVariants.js';
import {
  SECTION_NAMES, filterProducts, sortProducts, groupProducts, categoryOptions, brandOptions,
} from '@/utils/adminProductList.js';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'preorder', label: 'Pre-order' },
  { value: 'coming_soon', label: 'Coming soon' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
];

// Sortable columns, in table order. `key` matches SORT_VALUES in
// utils/adminProductList.js; numeric columns default to high → low.
const COLUMNS = [
  { key: 'title', label: 'Product Name' },
  { key: 'sku', label: 'SKU' },
  { key: 'category', label: 'Category' },
  { key: 'price', label: 'Sale price', numeric: true },
  { key: 'rrp', label: 'RRP', numeric: true },
  { key: 'cost', label: 'Cost (inc)', numeric: true },
  { key: 'margin', label: 'Margin', numeric: true },
  { key: 'status', label: 'Status' },
  { key: 'stock', label: 'Stock', numeric: true },
];

// Filter/sort/view state lives in the URL so a refresh, the back button or a
// shared link keeps the admin where they were.
const PARAM_DEFAULTS = { q: '', section: 'all', category: 'all', status: 'all', brand: 'all', sort: 'title', dir: 'asc', view: 'sections' };

// Which section headers the admin has collapsed in the Sections view. A
// per-browser convenience, so it lives in localStorage (which can throw or be
// empty in private windows — fall back to every section open). Category rows
// are not persisted: they start closed on every open so the page lands as a
// compact index of sections and categories with their counts, and the admin
// opens only the category they came for.
const COLLAPSED_STORAGE_KEY = 'cardpop.admin.products.collapsed';
const loadCollapsed = () => {
  try {
    const raw = window.localStorage.getItem(COLLAPSED_STORAGE_KEY);
    const keys = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(keys) ? keys : []);
  } catch {
    return new Set();
  }
};
const saveCollapsed = (set) => {
  try {
    window.localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify([...set]));
  } catch { /* storage unavailable — collapse state just won't persist */ }
};

const ProductManagementPage = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  // Admin-only wholesale costs (shop_product_costs), keyed by product id.
  const [costs, setCosts] = useState({});
  // Colour variants keyed by product id (for barcode/SKU search and the count).
  const [variantsByProduct, setVariantsByProduct] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const param = (k) => searchParams.get(k) || PARAM_DEFAULTS[k];
  const setParams = (updates) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(updates)) {
        if (v === undefined || v === null || v === PARAM_DEFAULTS[k]) next.delete(k);
        else next.set(k, v);
      }
      return next;
    }, { replace: true });
  };
  const searchTerm = param('q');
  const filters = { search: searchTerm, section: param('section'), category: param('category'), status: param('status'), brand: param('brand') };
  const sortKey = param('sort');
  const sortDir = param('dir');
  const view = param('view');
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  // Built-in + admin-added categories, minus removed ones.
  const { groups: categoryGroups } = useShopCategoryGroups();
  const isMounted = useRef(true);
  // Sections the admin has collapsed (persisted) and the `section/category`
  // keys they have opened this visit (every category starts closed).
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const updateCollapsed = (fn) => setCollapsed((prev) => {
    const next = new Set(prev);
    fn(next);
    saveCollapsed(next);
    return next;
  });
  const toggleCollapsed = (key) => updateCollapsed((set) => (set.has(key) ? set.delete(key) : set.add(key)));
  const [openCategories, setOpenCategories] = useState(() => new Set());
  const toggleCategory = (key) => setOpenCategories((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const fetchProducts = async () => {
    if (!isMounted.current) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('shop_products').select('*').order('created_at', { ascending: false }).limit(1000);
      if (error) throw error;
      if (isMounted.current) setProducts(data ?? []);
      // Costs are a separate admin-only table; a failure here (e.g. the
      // migration not yet applied) must not take the product list down.
      const { data: costRows } = await supabase
        .from('shop_product_costs')
        .select('product_id, wholesale_ex_gst_aud, wholesale_inc_gst_aud, supplier_sku');
      if (isMounted.current) setCosts(Object.fromEntries((costRows || []).map((c) => [c.product_id, c])));
      const { data: variantRows } = await supabase
        .from('shop_product_variants')
        .select('id, product_id, sku, barcode, colour, stock_quantity, status');
      if (isMounted.current) {
        const grouped = {};
        for (const v of variantRows || []) (grouped[v.product_id] ||= []).push(v);
        setVariantsByProduct(grouped);
      }
    } catch (err) {
      if (isMounted.current) setError(err.message);
      toast.error("Failed to load products.");
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    fetchProducts();
    return () => { isMounted.current = false; };
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this shop product?")) return;
    try {
      const { error } = await supabase.from('shop_products').delete().eq('id', id);
      if (error) throw error;
      toast.success("Product deleted.");
      setProducts(products.filter(p => p.id !== id));
    } catch (err) {
      toast.error("Failed to delete product.");
    }
  };

  // ── Inline price editing ────────────────────────────────────────────────
  // `drafts[id]` holds only the fields the admin has touched, as input
  // strings: { price, rrp, cost } (cost = inc GST). A field equal to the saved
  // value is dropped, so the Save button counts real changes only.
  const [priceEdit, setPriceEdit] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(false);
  const money = (v) => (v == null || v === '' ? '' : Number(v).toFixed(2));
  const savedField = (p, field) => field === 'price' ? money(p.price_aud)
    : field === 'rrp' ? money(p.retail_price_aud)
    : money(costs[p.id]?.wholesale_inc_gst_aud);
  const fieldValue = (p, field) => drafts[p.id]?.[field] ?? savedField(p, field);
  const setDraft = (p, field, value) => setDrafts((prev) => {
    const row = { ...prev[p.id], [field]: value };
    const same = (f) => row[f] === undefined || row[f].trim() === savedField(p, f)
      || (row[f].trim() !== '' && savedField(p, f) !== '' && Number(row[f]) === Number(savedField(p, f)));
    for (const f of ['price', 'rrp', 'cost']) if (same(f)) delete row[f];
    const next = { ...prev };
    if (Object.keys(row).length) next[p.id] = row; else delete next[p.id];
    return next;
  });
  const dirtyCount = Object.keys(drafts).length;
  const leavePriceEdit = () => {
    if (dirtyCount && !window.confirm(`Discard ${dirtyCount} unsaved price change${dirtyCount === 1 ? '' : 's'}?`)) return;
    setDrafts({});
    setPriceFocus(null);
    setPriceEdit(false);
  };

  // Nothing is written until the admin has seen the list of changes and
  // confirmed it: Save opens the review box, Confirm runs the save.
  const [priceReview, setPriceReview] = useState(null);
  const [priceFocus, setPriceFocus] = useState(null);
  const startPriceEdit = (product, field) => {
    setPriceFocus(`${product.id}:${field}`);
    setPriceEdit(true);
  };
  const reviewPrices = () => {
    const { error: invalid, changes } = buildPriceChanges(drafts, products, costs);
    if (invalid) return toast.error(invalid);
    if (changes.length) setPriceReview(changes);
  };

  const savePrices = async () => {
    const parsed = (priceReview || []).map((c) => ({ id: c.id, title: c.title, ...c.values }));
    setSaving(true);
    const failed = [];
    const now = new Date().toISOString();
    const updatedProducts = {};
    const updatedCosts = {};
    await Promise.all(parsed.map(async (r) => {
      try {
        const patch = {};
        if ('price' in r) patch.price_aud = r.price;
        if ('rrp' in r) patch.retail_price_aud = r.rrp;
        if (Object.keys(patch).length) {
          patch.updated_at = now;
          const { error: e } = await supabase.from('shop_products').update(patch).eq('id', r.id);
          if (e) throw e;
          updatedProducts[r.id] = patch;
        }
        if ('cost' in r) {
          // Same GST rule as the product form: the ex-GST figure is derived at 10%.
          const inc = r.cost;
          const ex = inc === null ? null : Math.round((inc / 1.1) * 100) / 100;
          if (inc === null && !costs[r.id]) { /* nothing stored, nothing to clear */ } else {
            const { error: e } = await supabase.from('shop_product_costs')
              .upsert({ product_id: r.id, wholesale_ex_gst_aud: ex, wholesale_inc_gst_aud: inc, updated_at: now }, { onConflict: 'product_id' });
            if (e) throw e;
            updatedCosts[r.id] = { ...costs[r.id], product_id: r.id, wholesale_ex_gst_aud: ex, wholesale_inc_gst_aud: inc };
          }
        }
      } catch (err) {
        failed.push(r.id);
        toast.error(`"${r.title}" not saved: ${err.message}`);
      }
    }));
    if (isMounted.current) {
      setProducts((prev) => prev.map((p) => (updatedProducts[p.id] ? { ...p, ...updatedProducts[p.id] } : p)));
      setCosts((prev) => ({ ...prev, ...updatedCosts }));
      setDrafts((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => failed.includes(id))));
      setSaving(false);
      setPriceReview(null);
    }
    const saved = parsed.length - failed.length;
    if (saved) toast.success(`Saved ${saved} product${saved === 1 ? '' : 's'}.`);
  };

  // ── Selecting products and changing their status together ───────────────
  const [selected, setSelected] = useState(() => new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [statusReview, setStatusReview] = useState(null);
  const [bulkEta, setBulkEta] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const setRowsSelected = (rows, on) => setSelected((prev) => {
    const next = new Set(prev);
    for (const r of rows) { if (on) next.add(r.id); else next.delete(r.id); }
    return next;
  });
  // true / 'indeterminate' / false for a "select these rows" checkbox.
  const groupChecked = (rows) => {
    const n = rows.filter((r) => selected.has(r.id)).length;
    return n === 0 ? false : n === rows.length ? true : 'indeterminate';
  };
  const selectedCount = products.filter((p) => selected.has(p.id)).length;

  const reviewStatus = () => {
    if (!bulkStatus) return toast.error('Choose the status to change to first.');
    const review = buildStatusChanges(products, selected, bulkStatus);
    if (!review.changes.length) return toast.info(`The selected products are already ${statusLabel(bulkStatus)}.`);
    setBulkEta('');
    setStatusReview({ ...review, status: bulkStatus });
  };
  const etaNeeded = statusReview ? statusReview.changes.filter((c) => c.needsEta).length : 0;

  const applyStatus = async () => {
    const { changes, status } = statusReview;
    const eta = bulkEta.trim();
    setBulkSaving(true);
    const now = new Date().toISOString();
    // Products missing a dispatch estimate get the one typed in the box; the
    // rest keep their own.
    const batches = [
      { ids: changes.filter((c) => !c.needsEta).map((c) => c.id), patch: { status, updated_at: now } },
      { ids: changes.filter((c) => c.needsEta).map((c) => c.id), patch: { status, preorder_eta: eta, updated_at: now } },
    ].filter((b) => b.ids.length);
    const done = {};
    let failure = null;
    for (const { ids, patch } of batches) {
      const { error: e } = await supabase.from('shop_products').update(patch).in('id', ids);
      if (e) { failure = e; break; }
      for (const id of ids) done[id] = patch;
    }
    if (!isMounted.current) return;
    const count = Object.keys(done).length;
    setProducts((prev) => prev.map((p) => (done[p.id] ? { ...p, ...done[p.id] } : p)));
    setSelected((prev) => new Set([...prev].filter((id) => !done[id])));
    setBulkSaving(false);
    setStatusReview(null);
    if (failure) toast.error(`${count ? `${count} updated, the rest were not` : 'Status not changed'}: ${failure.message}`);
    else {
      toast.success(`${count} product${count === 1 ? '' : 's'} set to ${statusLabel(status)}.`);
      setBulkStatus('');
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setIsAddModalOpen(true);
  };

  const handleFormSuccess = () => {
    setIsAddModalOpen(false);
    fetchProducts();
  };

  // "Edit categories" on a shop category page lands here as ?categories=1:
  // open the Categories manager, then drop the param.
  const openCategoriesParam = searchParams.get('categories');
  useEffect(() => {
    if (!openCategoriesParam) return;
    setIsCategoriesOpen(true);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('categories');
      return next;
    }, { replace: true });
  }, [openCategoriesParam, setSearchParams]);

  // "Edit product" on a shop product's public page lands here as ?edit=<id>.
  // Read the row directly rather than from the list (which is capped), open
  // its form, and drop the param so a refresh doesn't reopen it.
  const editId = searchParams.get('edit');
  useEffect(() => {
    if (!editId) return undefined;
    let cancelled = false;
    (async () => {
      const { data, error: loadError } = await supabase
        .from('shop_products').select('*').eq('id', editId).maybeSingle();
      if (cancelled) return;
      if (loadError || !data) toast.error('Could not find that product to edit.');
      else handleEdit(data);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('edit');
        return next;
      }, { replace: true });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per ?edit= value
  }, [editId]);

  const filteredProducts = useMemo(
    () => sortProducts(filterProducts(products, filters, { variantsByProduct, groups: categoryGroups }), sortKey, sortDir, { costs }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products, variantsByProduct, costs, searchParams, categoryGroups],
  );
  const sections = useMemo(() => groupProducts(filteredProducts, categoryGroups), [filteredProducts, categoryGroups]);
  const categoryChoices = useMemo(() => categoryOptions(products, filters.section, categoryGroups), [products, filters.section, categoryGroups]);
  const brandChoices = useMemo(() => brandOptions(products), [products]);
  const activeFilterCount = ['section', 'category', 'status', 'brand'].filter((k) => filters[k] !== 'all').length + (searchTerm ? 1 : 0);

  const allCategoryKeys = sections.flatMap(({ section, categories }) => categories.map(({ category }) => `${section}/${category}`));
  // A search or filter has already narrowed the table to what the admin is
  // looking for, so show those rows rather than making them open each
  // category; clearing it returns to the compact closed-category index.
  // Re-run when the filter changes and once the catalogue first arrives (a
  // shared link can carry a filter before there are rows to open) — not on
  // every refetch after an edit, which would snap the admin's open category shut.
  const filterSignature = `${searchTerm}|${filters.section}|${filters.category}|${filters.status}|${filters.brand}`;
  const hasProducts = products.length > 0;
  useEffect(() => {
    setOpenCategories(activeFilterCount > 0 ? new Set(allCategoryKeys) : new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSignature, hasProducts]);
  const anyCollapsed = sections.some(({ section }) => collapsed.has(section)) || allCategoryKeys.some((k) => !openCategories.has(k));
  const collapseAll = () => {
    updateCollapsed((set) => sections.forEach(({ section }) => set.add(section)));
    setOpenCategories(new Set());
  };
  const expandAll = () => {
    updateCollapsed((set) => sections.forEach(({ section }) => set.delete(section)));
    setOpenCategories(new Set(allCategoryKeys));
  };

  const toggleSort = (col) => {
    if (sortKey === col.key) setParams({ dir: sortDir === 'asc' ? 'desc' : 'asc' });
    else setParams({ sort: col.key, dir: col.numeric ? 'desc' : 'asc' });
  };
  const clearFilters = () => setParams({ q: null, section: null, category: null, status: null, brand: null });

  const stats = {
    total: products.length,
    active: products.filter(p => p.status === 'active').length,
    draft: products.filter(p => p.status === 'draft').length,
    comingSoon: products.filter(p => p.status === 'coming_soon').length,
    preorder: products.filter(p => p.status === 'preorder').length,
    archived: products.filter(p => p.status === 'archived').length
  };

  const renderRow = (product) => (
    <TableRow key={product.id} data-state={selected.has(product.id) ? 'selected' : undefined}>
      <TableCell className="w-10 pr-0">
        <Checkbox
          aria-label={`Select ${product.title}`}
          checked={selected.has(product.id)}
          onCheckedChange={(on) => setRowsSelected([product], on === true)}
        />
      </TableCell>
      <TableCell className="font-bold text-foreground">
        <div className="flex items-center gap-2.5">
          {/* Photo indicator: a small thumbnail when at least one photo is
              uploaded, a red "no photo" icon when there is none, so a product
              missing its picture stands out while scanning the list. */}
          {(() => {
            const firstImage = Array.isArray(product.images) ? product.images.find(Boolean) : null;
            const thumb = firstImage ? cardThumbUrl(firstImage) : null;
            return thumb ? (
              <img
                src={thumb}
                alt=""
                loading="lazy"
                title={`${product.images.filter(Boolean).length} photo(s) uploaded`}
                className="h-8 w-8 shrink-0 rounded border border-border bg-muted object-cover"
              />
            ) : (
              <span
                title="No photo uploaded"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-dashed border-destructive/40 bg-destructive/5 text-destructive"
              >
                <ImageOff className="h-4 w-4" aria-label="No photo uploaded" />
              </span>
            );
          })()}
          {/* The name opens the product's public page in a new tab — the same
              canonical URL shoppers use (utils/shopProductUrl.js), so a draft
              or archived row shows the admin exactly what the shop would. */}
          <a
            href={shopProductPath(product)}
            target="_blank"
            rel="noopener noreferrer"
            title="Open product page in a new tab"
            className="inline-flex items-center gap-1.5 hover:text-primary hover:underline underline-offset-2"
          >
            {product.title}
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          </a>
        </div>
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {product.sku || <span className="text-destructive">missing</span>}
        {(variantsByProduct[product.id] || []).filter((v) => v.status !== 'archived').length > 0 && (
          <span className="ml-1.5 font-sans text-[10px] font-semibold text-foreground/70">+{(variantsByProduct[product.id] || []).filter((v) => v.status !== 'archived').length} {variantKind({ variants: variantsByProduct[product.id] }).toLowerCase()}s</span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">{product.category || '-'}</TableCell>
      {priceEdit ? (
        ['price', 'rrp', 'cost'].map((field) => (
          <TableCell key={field}>
            <div className="relative w-24">
              <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
              <Input
                type="number" inputMode="decimal" min="0" step="0.01"
                aria-label={`${field === 'price' ? 'Sale price' : field === 'rrp' ? 'RRP' : 'Cost inc GST'} for ${product.title}`}
                className={`h-8 pl-5 pr-1 tabular-nums ${drafts[product.id]?.[field] !== undefined ? 'border-primary bg-primary/5' : ''}`}
                autoFocus={priceFocus === `${product.id}:${field}`}
                value={fieldValue(product, field)}
                onChange={(e) => setDraft(product, field, e.target.value)}
              />
            </div>
          </TableCell>
        ))
      ) : (
        <>
          {/* Click any price to start editing it in place. */}
          {[
            { field: 'price', label: 'sale price', text: `$${Number(product.price_aud ?? 0).toFixed(2)}`, cls: '' },
            { field: 'rrp', label: 'RRP', text: product.retail_price_aud != null ? `$${Number(product.retail_price_aud).toFixed(2)}` : '—', cls: 'text-muted-foreground' },
            { field: 'cost', label: 'cost', text: costs[product.id]?.wholesale_inc_gst_aud != null ? `$${Number(costs[product.id].wholesale_inc_gst_aud).toFixed(2)}` : '—', cls: 'text-muted-foreground' },
          ].map(({ field, label, text, cls }) => (
            <TableCell key={field} className={`tabular-nums ${cls}`}>
              <button
                type="button"
                title={`Edit ${label}`}
                aria-label={`Edit ${label} for ${product.title}`}
                onClick={() => startPriceEdit(product, field)}
                className="-mx-1.5 rounded px-1.5 py-1 text-left hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {text}
              </button>
            </TableCell>
          ))}
        </>
      )}
      <TableCell className="tabular-nums">
        {(() => {
          // Ex-GST gross margin: (price ÷ 1.1 − cost ex GST) ÷ (price ÷ 1.1).
          // While editing, it follows the unsaved sale price and cost.
          const dp = drafts[product.id];
          const costInc = dp?.cost !== undefined ? (dp.cost.trim() === '' ? null : Number(dp.cost)) : null;
          const price = dp?.price !== undefined && dp.price.trim() !== '' ? Number(dp.price) : product.price_aud;
          const costEx = dp?.cost !== undefined ? (costInc == null ? null : costInc / 1.1) : costs[product.id]?.wholesale_ex_gst_aud;
          const m = grossMargin(price, costEx);
          if (m == null) return <span className="text-muted-foreground">—</span>;
          const cls = m < 0 ? 'text-destructive' : m < 0.2 ? 'text-amber-600' : 'text-emerald-600';
          return <span className={`font-semibold ${cls}`}>{(m * 100).toFixed(0)}%</span>;
        })()}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={`bg-background capitalize whitespace-nowrap ${product.status === 'active' ? 'text-emerald-600 border-emerald-500/30' : product.status === 'draft' ? 'text-blue-600 border-blue-500/30' : product.status === 'coming_soon' ? 'text-amber-600 border-amber-500/30' : product.status === 'preorder' ? 'text-brand-red border-brand-red/30' : 'text-muted-foreground'}`}>
          {product.status === 'coming_soon' ? 'coming soon' : product.status === 'preorder' ? 'pre-order' : product.status}
        </Badge>
        {product.status === 'preorder' && product.preorder_eta && (
          <p className="mt-1 max-w-[12rem] truncate whitespace-nowrap text-[11px] leading-tight text-muted-foreground" title={product.preorder_eta}>{product.preorder_eta}</p>
        )}
      </TableCell>
      <TableCell className="tabular-nums">{product.stock_quantity ?? '-'}</TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl">
            <DropdownMenuItem onClick={() => handleEdit(product)} className="cursor-pointer gap-2 font-medium">
              <Edit className="w-4 h-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDelete(product.id)} className="cursor-pointer gap-2 text-destructive focus:bg-destructive/10 font-medium">
              <Trash2 className="w-4 h-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-6">
      <Helmet><title>Official Shop Management | Admin</title></Helmet>

      <AdminPageHeader
        icon={Package}
        title="Shop Products"
        subtitle="Manage official catalog and inventory."
      >
        <Button variant="outline" className="gap-2 font-bold rounded-xl h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white" aria-pressed={priceEdit} onClick={() => (priceEdit ? leavePriceEdit() : setPriceEdit(true))}>
          <DollarSign className="w-4 h-4" /> {priceEdit ? 'Done editing' : 'Edit prices'}
        </Button>
        <Button variant="outline" className="gap-2 font-bold rounded-xl h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={() => setIsCategoriesOpen(true)}>
          <FolderTree className="w-4 h-4" /> Categories
        </Button>
        <Button variant="outline" className="gap-2 font-bold rounded-xl h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={() => setIsBulkImportOpen(true)}>
          <Upload className="w-4 h-4" /> Bulk Import
        </Button>
        <Button variant="outline" className="gap-2 font-bold rounded-xl h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={() => { setEditingProduct(null); setIsAddModalOpen(true); }}>
          <Plus className="w-4 h-4" /> New Product
        </Button>
      </AdminPageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <Card role="button" tabIndex={0} aria-pressed={filters.status === 'all'} onClick={() => setParams({ status: 'all' })} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setParams({ status: 'all' }))} className={`p-5 rounded-2xl bg-card border shadow-sm flex items-center gap-4 cursor-pointer transition-colors hover:border-primary/50 ${filters.status === 'all' ? 'border-primary ring-1 ring-primary' : 'border-border'}`}>
          <div className="p-3 bg-primary/10 text-primary rounded-xl"><Package className="w-6 h-6" /></div>
          <div><p className="text-sm font-bold text-muted-foreground uppercase">Total Products</p><p className="text-2xl font-bold">{stats.total}</p></div>
        </Card>
        <Card role="button" tabIndex={0} aria-pressed={filters.status === 'active'} onClick={() => setParams({ status: 'active' })} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setParams({ status: 'active' }))} className={`p-5 rounded-2xl bg-card border shadow-sm flex items-center gap-4 cursor-pointer transition-colors hover:border-primary/50 ${filters.status === 'active' ? 'border-primary ring-1 ring-primary' : 'border-border'}`}>
          <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl"><BarChart3 className="w-6 h-6" /></div>
          <div><p className="text-sm font-bold text-muted-foreground uppercase">Active</p><p className="text-2xl font-bold">{stats.active}</p></div>
        </Card>
        <Card role="button" tabIndex={0} aria-pressed={filters.status === 'preorder'} onClick={() => setParams({ status: 'preorder' })} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setParams({ status: 'preorder' }))} className={`p-5 rounded-2xl bg-card border shadow-sm flex items-center gap-4 cursor-pointer transition-colors hover:border-primary/50 ${filters.status === 'preorder' ? 'border-primary ring-1 ring-primary' : 'border-border'}`}>
          <div className="p-3 bg-brand-red/10 text-brand-red rounded-xl"><BarChart3 className="w-6 h-6" /></div>
          <div><p className="text-sm font-bold text-muted-foreground uppercase">Pre-order</p><p className="text-2xl font-bold">{stats.preorder}</p></div>
        </Card>
        <Card role="button" tabIndex={0} aria-pressed={filters.status === 'draft'} onClick={() => setParams({ status: 'draft' })} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setParams({ status: 'draft' }))} className={`p-5 rounded-2xl bg-card border shadow-sm flex items-center gap-4 cursor-pointer transition-colors hover:border-primary/50 ${filters.status === 'draft' ? 'border-primary ring-1 ring-primary' : 'border-border'}`}>
          <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl"><BarChart3 className="w-6 h-6" /></div>
          <div><p className="text-sm font-bold text-muted-foreground uppercase">Draft</p><p className="text-2xl font-bold">{stats.draft}</p></div>
        </Card>
        <Card role="button" tabIndex={0} aria-pressed={filters.status === 'coming_soon'} onClick={() => setParams({ status: 'coming_soon' })} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setParams({ status: 'coming_soon' }))} className={`p-5 rounded-2xl bg-card border shadow-sm flex items-center gap-4 cursor-pointer transition-colors hover:border-primary/50 ${filters.status === 'coming_soon' ? 'border-primary ring-1 ring-primary' : 'border-border'}`}>
          <div className="p-3 bg-brand-charcoal/10 text-brand-charcoal dark:text-foreground rounded-xl"><BarChart3 className="w-6 h-6" /></div>
          <div><p className="text-sm font-bold text-muted-foreground uppercase">Coming Soon</p><p className="text-2xl font-bold">{stats.comingSoon}</p></div>
        </Card>
        <Card role="button" tabIndex={0} aria-pressed={filters.status === 'archived'} onClick={() => setParams({ status: 'archived' })} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setParams({ status: 'archived' }))} className={`p-5 rounded-2xl bg-card border shadow-sm flex items-center gap-4 cursor-pointer transition-colors hover:border-primary/50 ${filters.status === 'archived' ? 'border-primary ring-1 ring-primary' : 'border-border'}`}>
          <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl"><BarChart3 className="w-6 h-6" /></div>
          <div><p className="text-sm font-bold text-muted-foreground uppercase">Archived</p><p className="text-2xl font-bold">{stats.archived}</p></div>
        </Card>
      </div>

      <Card className="rounded-xl border border-border shadow-sm overflow-hidden bg-card">
        <div className="p-4 border-b border-border bg-muted/20 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              name="admin-product-search"
              aria-label="Search products"
              placeholder="Search by name, SKU, barcode, colour or category..."
              className="pl-9 h-10 rounded-xl bg-background border-border text-foreground"
              value={searchTerm}
              onChange={(e) => setParams({ q: e.target.value })}
            />
          </div>
          <FilterSelect label="Section" value={filters.section} onChange={(v) => setParams({ section: v, category: null })}
            options={SECTION_NAMES.map((n) => ({ value: n, label: n }))} allLabel="All sections" />
          <FilterSelect label="Category" value={filters.category} onChange={(v) => setParams({ category: v })}
            options={categoryChoices.map((n) => ({ value: n, label: n }))} allLabel="All categories" />
          <FilterSelect label="Status" value={filters.status} onChange={(v) => setParams({ status: v })}
            options={STATUS_OPTIONS} allLabel="All statuses" />
          <FilterSelect label="Brand" value={filters.brand} onChange={(v) => setParams({ brand: v })}
            options={brandChoices.map((n) => ({ value: n, label: n }))} allLabel="All brands" />
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" className="gap-1 h-10 rounded-xl text-muted-foreground" onClick={clearFilters}>
              <X className="w-4 h-4" /> Clear ({activeFilterCount})
            </Button>
          )}
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-muted-foreground tabular-nums">
              {filteredProducts.length} of {products.length}
            </span>
            {view === 'sections' && sections.length > 0 && (
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-lg text-muted-foreground" onClick={anyCollapsed ? expandAll : collapseAll}>
                {!anyCollapsed
                  ? <><ChevronsDownUp className="w-4 h-4" /> Collapse all</>
                  : <><ChevronsUpDown className="w-4 h-4" /> Expand all</>}
              </Button>
            )}
            <div className="inline-flex rounded-xl border border-border bg-background p-0.5" role="group" aria-label="Table layout">
              <Button variant={view === 'sections' ? 'secondary' : 'ghost'} size="sm" className="h-8 gap-1.5 rounded-lg" aria-pressed={view === 'sections'} onClick={() => setParams({ view: 'sections' })}>
                <Rows3 className="w-4 h-4" /> Sections
              </Button>
              <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="sm" className="h-8 gap-1.5 rounded-lg" aria-pressed={view === 'list'} onClick={() => setParams({ view: 'list' })}>
                <LayoutList className="w-4 h-4" /> List
              </Button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto relative w-full">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-10 pr-0">
                  <Checkbox
                    aria-label="Select all products shown"
                    disabled={filteredProducts.length === 0}
                    checked={groupChecked(filteredProducts)}
                    onCheckedChange={(on) => setRowsSelected(filteredProducts, on === true)}
                  />
                </TableHead>
                {COLUMNS.map((col) => {
                  const active = sortKey === col.key;
                  const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
                  return (
                    <TableHead key={col.key} className="font-semibold text-foreground" aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" onClick={() => toggleSort(col)} className="inline-flex items-center gap-1 hover:text-primary whitespace-nowrap">
                        {col.label}
                        <Icon className={`w-3.5 h-3.5 ${active ? 'text-primary' : 'text-muted-foreground/60'}`} />
                      </button>
                    </TableHead>
                  );
                })}
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-48 text-center text-muted-foreground">
                    <AlertCircle className="w-10 h-10 text-destructive mb-3 mx-auto" />
                    <p>Failed to load products</p>
                  </TableCell>
                </TableRow>
              ) : filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-48 text-center text-muted-foreground">
                    <Package className="w-10 h-10 mb-3 mx-auto opacity-40" />
                    <p>No products match{activeFilterCount > 0 ? ' these filters' : ''}</p>
                    {activeFilterCount > 0 && (
                      <Button variant="link" size="sm" onClick={clearFilters}>Clear filters</Button>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                view === 'sections' ? (
                  sections.map(({ section, count, categories }) => {
                    const sectionOpen = !collapsed.has(section);
                    const sectionRows = categories.flatMap((c) => c.products);
                    return (
                      <React.Fragment key={section}>
                        <TableRow className="bg-muted/60 hover:bg-muted/80">
                          <TableCell className="w-10 pr-0">
                            <Checkbox
                              aria-label={`Select all ${count} products in ${section}`}
                              checked={groupChecked(sectionRows)}
                              onCheckedChange={(on) => setRowsSelected(sectionRows, on === true)}
                            />
                          </TableCell>
                          <TableCell colSpan={10} className="p-0">
                            <button type="button" onClick={() => toggleCollapsed(section)} aria-expanded={sectionOpen}
                              className="flex w-full items-center gap-2 px-2 py-2.5 text-left font-bold uppercase tracking-wide text-foreground">
                              <ChevronRight aria-hidden="true" className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${sectionOpen ? 'rotate-90' : ''}`} />
                              {section} <span className="font-semibold text-muted-foreground normal-case tracking-normal">· {count}</span>
                            </button>
                          </TableCell>
                        </TableRow>
                        {sectionOpen && categories.map(({ category, products: rows }) => {
                          const key = `${section}/${category}`;
                          const categoryOpen = openCategories.has(key);
                          return (
                            <React.Fragment key={key}>
                              <TableRow className="bg-muted/20 hover:bg-muted/40">
                                <TableCell className="w-10 pr-0">
                                  <Checkbox
                                    aria-label={`Select all ${rows.length} products in ${category}`}
                                    checked={groupChecked(rows)}
                                    onCheckedChange={(on) => setRowsSelected(rows, on === true)}
                                  />
                                </TableCell>
                                <TableCell colSpan={10} className="p-0">
                                  <button type="button" onClick={() => toggleCategory(key)} aria-expanded={categoryOpen}
                                    className="flex w-full items-center gap-1.5 py-1.5 pl-4 pr-2 text-left text-xs font-semibold text-muted-foreground">
                                    <ChevronRight aria-hidden="true" className={`w-3.5 h-3.5 shrink-0 transition-transform ${categoryOpen ? 'rotate-90' : ''}`} />
                                    {category} · {rows.length}
                                  </button>
                                </TableCell>
                              </TableRow>
                              {categoryOpen && rows.map(renderRow)}
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    );
                  })
                ) : (
                  filteredProducts.map(renderRow)
                )
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {(priceEdit || selectedCount > 0) && (
        <div className="sticky bottom-4 z-20 mx-auto flex w-fit max-w-full flex-col items-center gap-2">
          {selectedCount > 0 && (
            <div role="region" aria-label="Selected products" className="flex max-w-full flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-lg">
              <span className="text-sm font-semibold text-foreground">{selectedCount} selected</span>
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger aria-label="Status to change the selected products to" className="h-9 w-[190px] rounded-xl bg-background">
                  <SelectValue placeholder="Change status to…" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" className="font-bold" disabled={!bulkStatus} onClick={reviewStatus}>Change status</Button>
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => setSelected(new Set())}>
                <X className="w-4 h-4" /> Clear selection
              </Button>
            </div>
          )}
          {priceEdit && (
            <div className="flex max-w-full flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-lg">
              <span className="text-sm text-muted-foreground">
                {dirtyCount ? `${dirtyCount} product${dirtyCount === 1 ? '' : 's'} changed` : 'Edit sale price, RRP or cost (inc GST), then save'}
              </span>
              <Button variant="ghost" size="sm" disabled={!dirtyCount || saving} onClick={() => setDrafts({})}>Reset</Button>
              <Button size="sm" className="gap-1.5 font-bold" disabled={!dirtyCount || saving} onClick={reviewPrices}>
                <Save className="w-4 h-4" /> {`Save ${dirtyCount || ''} change${dirtyCount === 1 ? '' : 's'}`.replace('  ', ' ')}
              </Button>
              <Button variant="ghost" size="sm" disabled={saving} onClick={leavePriceEdit}>Done</Button>
            </div>
          )}
        </div>
      )}

      <ConfirmChangesDialog
        open={!!priceReview}
        title="Save these price changes?"
        description={`You are about to change pricing on ${priceReview?.length ?? 0} product${priceReview?.length === 1 ? '' : 's'}. Sale price changes show in the shop straight away.`}
        changes={priceReview || []}
        confirmLabel="Yes, save changes"
        busy={saving}
        onConfirm={savePrices}
        onCancel={() => setPriceReview(null)}
      />

      <ConfirmChangesDialog
        open={!!statusReview}
        title={`Change ${statusReview?.changes.length ?? 0} product${statusReview?.changes.length === 1 ? '' : 's'} to ${statusLabel(statusReview?.status)}?`}
        description={statusReview?.unchanged
          ? `${statusReview.unchanged} of the selected products ${statusReview.unchanged === 1 ? 'is' : 'are'} already ${statusLabel(statusReview.status)} and will be left as ${statusReview.unchanged === 1 ? 'it is' : 'they are'}.`
          : 'Check the list below, then confirm.'}
        changes={statusReview?.changes || []}
        notes={statusReview?.notes || []}
        confirmLabel="Yes, change status"
        confirmDisabled={etaNeeded > 0 && (!bulkEta.trim() || bulkEta.trim().length > PREORDER_ETA_MAX_LENGTH)}
        busy={bulkSaving}
        onConfirm={applyStatus}
        onCancel={() => setStatusReview(null)}
      >
        {etaNeeded > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="bulk-preorder-eta">Estimated dispatch *</Label>
            <Input
              id="bulk-preorder-eta"
              value={bulkEta}
              maxLength={PREORDER_ETA_MAX_LENGTH}
              placeholder="e.g. Ships in 4–6 weeks"
              onChange={(e) => setBulkEta(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Shown to buyers on {etaNeeded === 1 ? 'the 1 product that has' : `the ${etaNeeded} products that have`} no estimate yet. Products with their own estimate keep it.
            </p>
          </div>
        )}
      </ConfirmChangesDialog>

      <ShopCategoryManager open={isCategoriesOpen} onOpenChange={setIsCategoriesOpen} products={products} />

      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-background rounded-2xl border-border p-0">
          <div className="p-8">
            <DialogHeader className="mb-8">
              <DialogTitle className="text-2xl font-bold font-serif text-foreground">
                {editingProduct ? 'Edit Shop Product' : 'Add Shop Product'}
              </DialogTitle>
            </DialogHeader>
            <ShopProductForm product={editingProduct} onSuccess={handleFormSuccess} onCancel={() => setIsAddModalOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Mounted only while open: the importer reads auth and the category
          overlay in its body, and there's no reason for every admin page load
          to pay for that (or to require an AuthProvider) just to render a
          closed dialog. Radix treats the other dialogs here the same way. */}
      {isBulkImportOpen && (
        <BulkProductImport
          open={isBulkImportOpen}
          onOpenChange={setIsBulkImportOpen}
          onComplete={fetchProducts}
        />
      )}
    </div>
  );
};

// Compact labelled dropdown for the filter bar; 'all' is the no-filter value.
const FilterSelect = ({ label, value, onChange, options, allLabel }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger aria-label={`Filter by ${label.toLowerCase()}`} className={`h-10 w-[170px] rounded-xl bg-background ${value !== 'all' ? 'border-primary text-foreground' : ''}`}>
      <SelectValue placeholder={allLabel} />
    </SelectTrigger>
    <SelectContent className="rounded-xl">
      <SelectItem value="all">{allLabel}</SelectItem>
      {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
    </SelectContent>
  </Select>
);

export default ProductManagementPage;
