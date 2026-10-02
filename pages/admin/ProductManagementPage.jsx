
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Search, Plus, Filter, MoreHorizontal, Edit, Trash2, AlertCircle, RefreshCcw, Package, ChevronLeft, BarChart3, ArrowUp, ArrowDown, ArrowUpDown, X, LayoutList, Rows3, ChevronRight, ChevronsDownUp, ChevronsUpDown, FolderTree } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabaseClient.js';
import { toast } from 'sonner';
import ShopProductForm from '@/components/ShopProductForm.jsx';
import ShopCategoryManager from '@/components/admin/ShopCategoryManager.jsx';
import useShopCategoryGroups from '@/hooks/useShopCategoryGroups.js';
import { grossMargin } from '@/src/utils/shopRrp.js';
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
  { key: 'price', label: 'Price', numeric: true },
  { key: 'rrp', label: 'RRP', numeric: true },
  { key: 'cost', label: 'Cost (inc)', numeric: true },
  { key: 'margin', label: 'Margin', numeric: true },
  { key: 'status', label: 'Status' },
  { key: 'stock', label: 'Stock', numeric: true },
];

// Filter/sort/view state lives in the URL so a refresh, the back button or a
// shared link keeps the admin where they were.
const PARAM_DEFAULTS = { q: '', section: 'all', category: 'all', status: 'all', brand: 'all', sort: 'title', dir: 'asc', view: 'sections' };

// Which section / category headers the admin has collapsed in the Sections
// view. A per-browser convenience, so it lives in localStorage (which can
// throw or be empty in private windows — fall back to everything open).
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
  const [editingProduct, setEditingProduct] = useState(null);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  // Built-in + admin-added categories, minus removed ones.
  const { groups: categoryGroups } = useShopCategoryGroups();
  const isMounted = useRef(true);
  // Keys are `section` or `section/category`.
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const updateCollapsed = (fn) => setCollapsed((prev) => {
    const next = new Set(prev);
    fn(next);
    saveCollapsed(next);
    return next;
  });
  const toggleCollapsed = (key) => updateCollapsed((set) => (set.has(key) ? set.delete(key) : set.add(key)));

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

  const handleEdit = (product) => {
    setEditingProduct(product);
    setIsAddModalOpen(true);
  };

  const handleFormSuccess = () => {
    setIsAddModalOpen(false);
    fetchProducts();
  };

  const filteredProducts = useMemo(
    () => sortProducts(filterProducts(products, filters, { variantsByProduct, groups: categoryGroups }), sortKey, sortDir, { costs }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products, variantsByProduct, costs, searchParams, categoryGroups],
  );
  const sections = useMemo(() => groupProducts(filteredProducts, categoryGroups), [filteredProducts, categoryGroups]);
  const categoryChoices = useMemo(() => categoryOptions(products, filters.section, categoryGroups), [products, filters.section, categoryGroups]);
  const brandChoices = useMemo(() => brandOptions(products), [products]);
  const activeFilterCount = ['section', 'category', 'status', 'brand'].filter((k) => filters[k] !== 'all').length + (searchTerm ? 1 : 0);

  const allGroupKeys = sections.flatMap(({ section, categories }) => [section, ...categories.map(({ category }) => `${section}/${category}`)]);
  const anyCollapsed = allGroupKeys.some((k) => collapsed.has(k));
  const collapseAll = () => updateCollapsed((set) => sections.forEach(({ section }) => set.add(section)));
  const expandAll = () => updateCollapsed((set) => allGroupKeys.forEach((k) => set.delete(k)));

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
    <TableRow key={product.id}>
      <TableCell className="font-bold text-foreground">{product.title}</TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {product.sku || <span className="text-destructive">missing</span>}
        {(variantsByProduct[product.id] || []).filter((v) => v.status !== 'archived').length > 0 && (
          <span className="ml-1.5 font-sans text-[10px] font-semibold text-foreground/70">+{(variantsByProduct[product.id] || []).filter((v) => v.status !== 'archived').length} colours</span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">{product.category || '-'}</TableCell>
      <TableCell className="tabular-nums">${Number(product.price_aud ?? 0).toFixed(2)}</TableCell>
      <TableCell className="tabular-nums text-muted-foreground">
        {product.retail_price_aud != null ? `$${Number(product.retail_price_aud).toFixed(2)}` : '—'}
      </TableCell>
      <TableCell className="tabular-nums text-muted-foreground">
        {costs[product.id]?.wholesale_inc_gst_aud != null ? `$${Number(costs[product.id].wholesale_inc_gst_aud).toFixed(2)}` : '—'}
      </TableCell>
      <TableCell className="tabular-nums">
        {(() => {
          // Ex-GST gross margin: (price ÷ 1.1 − cost ex GST) ÷ (price ÷ 1.1).
          const m = grossMargin(product.price_aud, costs[product.id]?.wholesale_ex_gst_aud);
          if (m == null) return <span className="text-muted-foreground">—</span>;
          const cls = m < 0 ? 'text-destructive' : m < 0.2 ? 'text-amber-600' : 'text-emerald-600';
          return <span className={`font-semibold ${cls}`}>{(m * 100).toFixed(0)}%</span>;
        })()}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={`bg-background capitalize ${product.status === 'active' ? 'text-emerald-600 border-emerald-500/30' : product.status === 'draft' ? 'text-blue-600 border-blue-500/30' : product.status === 'coming_soon' ? 'text-amber-600 border-amber-500/30' : product.status === 'preorder' ? 'text-brand-red border-brand-red/30' : 'text-muted-foreground'}`}>
          {product.status === 'coming_soon' ? 'coming soon' : product.status === 'preorder' ? 'pre-order' : product.status}
        </Badge>
        {product.status === 'preorder' && product.preorder_eta && (
          <p className="mt-1 max-w-[12rem] text-[11px] leading-tight text-muted-foreground">{product.preorder_eta}</p>
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
    <div className="space-y-6 animate-in fade-in duration-300">
      <Helmet><title>Official Shop Management | Admin</title></Helmet>

      <AdminPageHeader
        icon={Package}
        title="Shop Products"
        subtitle="Manage official catalog and inventory."
      >
        <Button variant="outline" className="gap-2 font-bold rounded-xl h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={() => setIsCategoriesOpen(true)}>
          <FolderTree className="w-4 h-4" /> Categories
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
                  <TableCell colSpan={10} className="h-48 text-center text-muted-foreground">
                    <AlertCircle className="w-10 h-10 text-destructive mb-3 mx-auto" />
                    <p>Failed to load products</p>
                  </TableCell>
                </TableRow>
              ) : filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-48 text-center text-muted-foreground">
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
                    return (
                      <React.Fragment key={section}>
                        <TableRow className="bg-muted/60 hover:bg-muted/80">
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
                          const categoryOpen = !collapsed.has(key);
                          return (
                            <React.Fragment key={key}>
                              <TableRow className="bg-muted/20 hover:bg-muted/40">
                                <TableCell colSpan={10} className="p-0">
                                  <button type="button" onClick={() => toggleCollapsed(key)} aria-expanded={categoryOpen}
                                    className="flex w-full items-center gap-1.5 py-1.5 pl-6 pr-2 text-left text-xs font-semibold text-muted-foreground">
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
