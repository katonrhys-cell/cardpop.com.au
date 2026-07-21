import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Plus, Search, Edit, Trash2, ShoppingBag, AlertCircle, RefreshCw, ExternalLink, EyeOff } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient.js';

const EMPTY_FORM = {
  title: '', description: '', image_url: '', price_label: '',
  network: 'amazon', affiliate_url: '', cta_label: 'View on Amazon',
  badge: '', category: '', sort_order: 0, is_published: true,
};

const ShopAffiliateProductsAdminPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const fetchProducts = async (showToast = false) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('shop_affiliate_products')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('title', { ascending: true });
      if (err) throw err;
      setProducts(data || []);
      if (showToast) toast.success('Affiliate products refreshed');
    } catch (err) {
      setError(err.message || 'Failed to load affiliate products.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setSelected(null);
  };

  const openAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (product) => {
    setFormData({
      title: product.title || '',
      description: product.description || '',
      image_url: product.image_url || '',
      price_label: product.price_label || '',
      network: product.network || 'amazon',
      affiliate_url: product.affiliate_url || '',
      cta_label: product.cta_label || 'View on Amazon',
      badge: product.badge || '',
      category: product.category || '',
      sort_order: product.sort_order ?? 0,
      is_published: product.is_published ?? true,
    });
    setSelected(product);
    setIsModalOpen(true);
  };

  const openDeleteDialog = (product) => {
    setSelected(product);
    setIsDeleteDialogOpen(true);
  };

  const togglePublished = async (product) => {
    try {
      const { error: err } = await supabase
        .from('shop_affiliate_products')
        .update({ is_published: !product.is_published, updated_at: new Date().toISOString() })
        .eq('id', product.id);
      if (err) throw err;
      setProducts(prev => prev.map(p => (p.id === product.id ? { ...p, is_published: !p.is_published } : p)));
      toast.success(product.is_published ? 'Hidden from the shop' : 'Published to the shop');
    } catch (err) {
      toast.error(err.message || 'Failed to update visibility');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) { toast.error('Title is required'); return; }
    if (!formData.affiliate_url.trim()) { toast.error('Affiliate URL is required'); return; }

    setIsSubmitting(true);
    const payload = {
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      image_url: formData.image_url.trim() || null,
      price_label: formData.price_label.trim() || null,
      network: formData.network.trim() || 'amazon',
      affiliate_url: formData.affiliate_url.trim(),
      cta_label: formData.cta_label.trim() || 'View on Amazon',
      badge: formData.badge.trim() || null,
      category: formData.category.trim() || null,
      sort_order: Number.isFinite(Number(formData.sort_order)) ? parseInt(formData.sort_order, 10) : 0,
      is_published: !!formData.is_published,
      updated_at: new Date().toISOString(),
    };

    try {
      if (selected) {
        const { error: err } = await supabase
          .from('shop_affiliate_products')
          .update(payload)
          .eq('id', selected.id);
        if (err) throw err;
        toast.success('Affiliate product updated');
      } else {
        const { error: err } = await supabase
          .from('shop_affiliate_products')
          .insert([payload]);
        if (err) throw err;
        toast.success('Affiliate product added');
      }
      setIsModalOpen(false);
      resetForm();
      fetchProducts();
    } catch (err) {
      toast.error(err.message || 'Failed to save affiliate product');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setIsSubmitting(true);
    try {
      const { error: err } = await supabase
        .from('shop_affiliate_products')
        .delete()
        .eq('id', selected.id);
      if (err) throw err;
      toast.success('Affiliate product deleted');
      setIsDeleteDialogOpen(false);
      setSelected(null);
      fetchProducts();
    } catch (err) {
      toast.error(err.message || 'Failed to delete affiliate product');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = products.filter(p =>
    p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (p.network && p.network.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Helmet>
        <title>Shop Affiliate Products | Admin Portal</title>
      </Helmet>

      <AdminPageHeader
        icon={ShoppingBag}
        title="Shop Affiliate Products"
        subtitle="Manage the Amazon (and other) affiliate products shown at the bottom of the shop and shop category pages."
      >
        <Button variant="outline" onClick={() => fetchProducts(true)} disabled={loading} className="rounded-xl h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Button variant="outline" onClick={openAddModal} className="rounded-xl h-10 px-4 font-bold border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
          <Plus className="w-4 h-4 mr-2" />
          Add Product
        </Button>
      </AdminPageHeader>

      {error ? (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-6 rounded-xl flex flex-col items-center justify-center text-center">
          <AlertCircle className="w-10 h-10 mb-3 opacity-80" />
          <h3 className="text-lg font-bold mb-1">Error Loading Affiliate Products</h3>
          <p className="text-sm opacity-90 max-w-md">{error}</p>
          <Button variant="outline" className="mt-4 border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => fetchProducts(true)}>
            Try Again
          </Button>
        </div>
      ) : (
        <Card className="border-border shadow-sm rounded-xl overflow-hidden w-full">
          <div className="p-4 border-b border-border bg-muted/20 flex justify-between items-center">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 rounded-xl bg-background border-border"
              />
            </div>
            <div className="text-sm text-muted-foreground font-medium px-4 whitespace-nowrap">
              {filtered.length} {filtered.length === 1 ? 'product' : 'products'}
            </div>
          </div>

          <div className="overflow-x-auto relative w-full">
            <Table className="w-full">
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-16 text-center">Order</TableHead>
                  <TableHead className="w-16 text-center hidden sm:table-cell">Image</TableHead>
                  <TableHead className="font-bold text-foreground">Title</TableHead>
                  <TableHead className="font-bold text-foreground hidden md:table-cell">Category</TableHead>
                  <TableHead className="font-bold text-foreground hidden lg:table-cell w-24">Network</TableHead>
                  <TableHead className="font-bold text-foreground w-28 text-center">Published</TableHead>
                  <TableHead className="text-right font-bold text-foreground w-28">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-8 mx-auto" /></TableCell>
                      <TableCell className="hidden sm:table-cell"><Skeleton className="h-10 w-10 rounded mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell className="hidden lg:table-cell"><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-10 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <ShoppingBag className="w-10 h-10 mb-3 opacity-40" />
                        <p className="font-medium text-foreground">No affiliate products yet</p>
                        <p className="text-sm mt-1">
                          {searchQuery ? 'None match your search.' : 'Add your first Amazon affiliate product to get started.'}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((product) => (
                    <TableRow key={product.id} className="group transition-colors hover:bg-muted/30 cursor-pointer" onClick={() => openEditModal(product)}>
                      <TableCell className="text-center text-sm text-muted-foreground font-medium">{product.sort_order}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {product.image_url ? (
                          <img src={product.image_url} alt="" className="h-10 w-10 object-contain rounded bg-white mx-auto" />
                        ) : (
                          <div className="h-10 w-10 rounded bg-muted flex items-center justify-center mx-auto">
                            <ShoppingBag className="w-4 h-4 text-muted-foreground/50" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <span className="line-clamp-1 max-w-[260px]">{product.title}</span>
                          {product.badge && <Badge variant="secondary" className="text-[10px] hidden xl:inline-flex shrink-0">{product.badge}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{product.category || <span className="italic opacity-60">Main /shop</span>}</TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-sm capitalize">{product.network || 'amazon'}</TableCell>
                      <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                        <button type="button" onClick={() => togglePublished(product)} className="inline-flex">
                          {product.is_published ? (
                            <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 border-0">Live</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-muted-foreground"><EyeOff className="w-3 h-3 mr-1" />Draft</Badge>
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary rounded-lg" onClick={() => openEditModal(product)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg" onClick={() => openDeleteDialog(product)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Add / Edit modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-2xl rounded-xl border-border shadow-lg w-[95vw] mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">{selected ? 'Edit Affiliate Product' : 'Add Affiliate Product'}</DialogTitle>
            <DialogDescription>
              {selected ? 'Update this affiliate product.' : 'Add a new affiliate product to the bottom of the shop pages.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5 py-4 w-full">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-bold">Title <span className="text-destructive">*</span></Label>
              <Input id="title" name="title" value={formData.title} onChange={handleInputChange} placeholder="e.g. Ultra Pro Card Sleeves (100ct)" className="h-11 rounded-xl bg-background border-border" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-bold">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea id="description" name="description" value={formData.description} onChange={handleInputChange} placeholder="Short one or two line description..." className="min-h-[70px] rounded-xl bg-background border-border resize-y" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="affiliate_url" className="text-sm font-bold">Affiliate URL <span className="text-destructive">*</span></Label>
              <Input id="affiliate_url" name="affiliate_url" type="url" value={formData.affiliate_url} onChange={handleInputChange} placeholder="https://www.amazon.com.au/dp/...?tag=yourtag-22" className="h-11 rounded-xl bg-background border-border" required />
              <p className="text-xs text-muted-foreground">Paste your full Amazon Associates link including your <code>?tag=</code> tracking ID.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="image_url" className="text-sm font-bold">Image URL <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input id="image_url" name="image_url" value={formData.image_url} onChange={handleInputChange} placeholder="https://.../product.jpg" className="h-11 rounded-xl bg-background border-border" />
              <p className="text-xs text-muted-foreground">Direct link to the product image (e.g. from the Amazon listing).</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price_label" className="text-sm font-bold">Price label <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input id="price_label" name="price_label" value={formData.price_label} onChange={handleInputChange} placeholder="e.g. $29.99 or From $19" className="h-11 rounded-xl bg-background border-border" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="badge" className="text-sm font-bold">Badge <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input id="badge" name="badge" value={formData.badge} onChange={handleInputChange} placeholder="e.g. Best seller" className="h-11 rounded-xl bg-background border-border" />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="network" className="text-sm font-bold">Network</Label>
                <Input id="network" name="network" value={formData.network} onChange={handleInputChange} placeholder="amazon" className="h-11 rounded-xl bg-background border-border" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cta_label" className="text-sm font-bold">Button label</Label>
                <Input id="cta_label" name="cta_label" value={formData.cta_label} onChange={handleInputChange} placeholder="View on Amazon" className="h-11 rounded-xl bg-background border-border" />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category" className="text-sm font-bold">Category <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input id="category" name="category" value={formData.category} onChange={handleInputChange} placeholder="e.g. Card Sleeves" className="h-11 rounded-xl bg-background border-border" />
                <p className="text-xs text-muted-foreground">Leave blank to show only on the main /shop page. Set it to a shop category name to show only on that category page.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sort_order" className="text-sm font-bold">Sort order</Label>
                <Input id="sort_order" name="sort_order" type="number" value={formData.sort_order} onChange={handleInputChange} className="h-11 rounded-xl bg-background border-border" />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-4">
              <div>
                <Label htmlFor="is_published" className="text-sm font-bold">Published</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Show this product on the shop pages.</p>
              </div>
              <Switch id="is_published" checked={formData.is_published} onCheckedChange={(v) => setFormData(prev => ({ ...prev, is_published: v }))} />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="rounded-xl h-11 px-6 font-bold w-full sm:w-auto" disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl h-11 px-6 font-bold w-full sm:w-auto mt-2 sm:mt-0" disabled={isSubmitting}>
                {isSubmitting ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  selected ? 'Save Changes' : 'Add Product'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-xl border-border shadow-lg w-[95vw] mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-xl">Delete Affiliate Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong className="text-foreground">{selected?.title}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="rounded-xl h-11 px-6 font-bold m-0" disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleDelete(); }} className="rounded-xl h-11 px-6 font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 m-0" disabled={isSubmitting}>
              {isSubmitting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ShopAffiliateProductsAdminPage;
