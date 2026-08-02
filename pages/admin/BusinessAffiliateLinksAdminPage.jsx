import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Plus, Search, Edit, Trash2, Rocket, AlertCircle, RefreshCw, ExternalLink, EyeOff } from 'lucide-react';
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

const ICON_OPTIONS = ['CreditCard', 'Mail', 'Radio', 'Facebook', 'Briefcase', 'Users', 'Globe', 'Store', 'Megaphone', 'TrendingUp', 'Rocket', 'Sparkles'];

const slugify = (str) =>
  (str || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const EMPTY_FORM = {
  name: '', slug: '', category: '', tagline: '', description: '',
  why_i_use_it: '', how_it_helps_you: '', affiliate_url: '', cta_label: 'Learn more',
  logo_url: '', icon: 'Sparkles', accent: 'from-brand-red to-brand-charcoal', badge: '',
  sort_order: 0, is_published: true,
};

const BusinessAffiliateLinksAdminPage = () => {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const fetchLinks = async (showToast = false) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('business_affiliate_links')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (err) throw err;
      setLinks(data || []);
      if (showToast) toast.success('Recommendations refreshed');
    } catch (err) {
      setError(err.message || 'Failed to load recommendations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
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

  const openEditModal = (link) => {
    setFormData({
      name: link.name || '',
      slug: link.slug || '',
      category: link.category || '',
      tagline: link.tagline || '',
      description: link.description || '',
      why_i_use_it: link.why_i_use_it || '',
      how_it_helps_you: link.how_it_helps_you || '',
      affiliate_url: link.affiliate_url || '',
      cta_label: link.cta_label || 'Learn more',
      logo_url: link.logo_url || '',
      icon: link.icon || 'Sparkles',
      accent: link.accent || 'from-brand-red to-brand-charcoal',
      badge: link.badge || '',
      sort_order: link.sort_order ?? 0,
      is_published: link.is_published ?? true,
    });
    setSelected(link);
    setIsModalOpen(true);
  };

  const openDeleteDialog = (link) => {
    setSelected(link);
    setIsDeleteDialogOpen(true);
  };

  const togglePublished = async (link) => {
    try {
      const { error: err } = await supabase
        .from('business_affiliate_links')
        .update({ is_published: !link.is_published, updated_at: new Date().toISOString() })
        .eq('id', link.id);
      if (err) throw err;
      setLinks(prev => prev.map(l => (l.id === link.id ? { ...l, is_published: !l.is_published } : l)));
      toast.success(link.is_published ? 'Hidden from the public page' : 'Published to the public page');
    } catch (err) {
      toast.error(err.message || 'Failed to update visibility');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error('Name is required'); return; }
    if (!formData.affiliate_url.trim()) { toast.error('Link URL is required'); return; }

    setIsSubmitting(true);
    const slug = slugify(formData.slug) || slugify(formData.name);
    const payload = {
      name: formData.name.trim(),
      slug,
      category: formData.category.trim() || null,
      tagline: formData.tagline.trim() || null,
      description: formData.description.trim() || null,
      why_i_use_it: formData.why_i_use_it.trim() || null,
      how_it_helps_you: formData.how_it_helps_you.trim() || null,
      affiliate_url: formData.affiliate_url.trim(),
      cta_label: formData.cta_label.trim() || 'Learn more',
      logo_url: formData.logo_url.trim() || null,
      icon: formData.icon || null,
      accent: formData.accent.trim() || 'from-brand-red to-brand-charcoal',
      badge: formData.badge.trim() || null,
      sort_order: Number.isFinite(Number(formData.sort_order)) ? parseInt(formData.sort_order, 10) : 0,
      is_published: !!formData.is_published,
      updated_at: new Date().toISOString(),
    };

    try {
      if (selected) {
        const { error: err } = await supabase
          .from('business_affiliate_links')
          .update(payload)
          .eq('id', selected.id);
        if (err) throw err;
        toast.success('Recommendation updated');
      } else {
        const { error: err } = await supabase
          .from('business_affiliate_links')
          .insert([payload]);
        if (err) throw err;
        toast.success('Recommendation added');
      }
      setIsModalOpen(false);
      resetForm();
      fetchLinks();
    } catch (err) {
      if (err.code === '23505') {
        toast.error('That slug is already in use — pick a different one.');
      } else {
        toast.error(err.message || 'Failed to save recommendation');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setIsSubmitting(true);
    try {
      const { error: err } = await supabase
        .from('business_affiliate_links')
        .delete()
        .eq('id', selected.id);
      if (err) throw err;
      toast.success('Recommendation deleted');
      setIsDeleteDialogOpen(false);
      setSelected(null);
      fetchLinks();
    } catch (err) {
      toast.error(err.message || 'Failed to delete recommendation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = links.filter(l =>
    l.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (l.category && l.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (l.tagline && l.tagline.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Helmet>
        <title>Building Your Business | Admin Portal</title>
      </Helmet>

      <AdminPageHeader
        icon={Rocket}
        title="Building Your Business"
        subtitle="Manage the affiliate & referral tools shown on the Community → Building Your Business page."
      >
        <Button variant="outline" onClick={() => fetchLinks(true)} disabled={loading} className="rounded-xl h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Button variant="outline" onClick={openAddModal} className="rounded-xl h-10 px-4 font-bold border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
          <Plus className="w-4 h-4 mr-2" />
          Add Tool
        </Button>
      </AdminPageHeader>

      {error ? (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-6 rounded-xl flex flex-col items-center justify-center text-center">
          <AlertCircle className="w-10 h-10 mb-3 opacity-80" />
          <h3 className="text-lg font-bold mb-1">Error Loading Recommendations</h3>
          <p className="text-sm opacity-90 max-w-md">{error}</p>
          <Button variant="outline" className="mt-4 border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => fetchLinks(true)}>
            Try Again
          </Button>
        </div>
      ) : (
        <Card className="border-border shadow-sm rounded-xl overflow-hidden w-full">
          <div className="p-4 border-b border-border bg-muted/20 flex justify-between items-center">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search tools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 rounded-xl bg-background border-border"
              />
            </div>
            <div className="text-sm text-muted-foreground font-medium px-4 whitespace-nowrap">
              {filtered.length} {filtered.length === 1 ? 'tool' : 'tools'}
            </div>
          </div>

          <div className="overflow-x-auto relative w-full">
            <Table className="w-full">
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-16 text-center">Order</TableHead>
                  <TableHead className="font-bold text-foreground">Name</TableHead>
                  <TableHead className="font-bold text-foreground hidden md:table-cell">Category</TableHead>
                  <TableHead className="font-bold text-foreground hidden lg:table-cell">Tagline</TableHead>
                  <TableHead className="font-bold text-foreground w-28 text-center">Published</TableHead>
                  <TableHead className="text-right font-bold text-foreground w-28">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-8 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-56" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-10 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <Rocket className="w-10 h-10 mb-3 opacity-40" />
                        <p className="font-medium text-foreground">No tools yet</p>
                        <p className="text-sm mt-1">
                          {searchQuery ? 'None match your search.' : 'Add your first recommended tool to get started.'}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((link) => (
                    <TableRow key={link.id} className="group transition-colors hover:bg-muted/30 cursor-pointer" onClick={() => openEditModal(link)}>
                      <TableCell className="text-center text-sm text-muted-foreground font-medium">{link.sort_order}</TableCell>
                      <TableCell className="font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          {link.name}
                          {link.badge && <Badge variant="secondary" className="text-[10px] hidden xl:inline-flex">{link.badge}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{link.category || '-'}</TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground truncate max-w-[260px] text-sm">{link.tagline || '-'}</TableCell>
                      <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                        {link.is_published ? (
                          <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 border-0">Live</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-muted-foreground"><EyeOff className="w-3 h-3 mr-1" />Draft</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary rounded-lg" onClick={() => openEditModal(link)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg" onClick={() => openDeleteDialog(link)}>
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
            <DialogTitle className="font-serif text-xl">{selected ? 'Edit Tool' : 'Add Tool'}</DialogTitle>
            <DialogDescription>
              {selected ? 'Update this recommended tool.' : 'Add a new tool to the Building Your Business page.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5 py-4 w-full">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-bold">Name <span className="text-destructive">*</span></Label>
                <Input id="name" name="name" value={formData.name} onChange={handleInputChange} placeholder="e.g. Stripe" className="h-11 rounded-xl bg-background border-border" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug" className="text-sm font-bold">Slug</Label>
                <Input id="slug" name="slug" value={formData.slug} onChange={handleInputChange} placeholder="auto from name" className="h-11 rounded-xl bg-background border-border" />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category" className="text-sm font-bold">Category</Label>
                <Input id="category" name="category" value={formData.category} onChange={handleInputChange} placeholder="e.g. Payments" className="h-11 rounded-xl bg-background border-border" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="badge" className="text-sm font-bold">Badge <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input id="badge" name="badge" value={formData.badge} onChange={handleInputChange} placeholder="e.g. Powers our checkout" className="h-11 rounded-xl bg-background border-border" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tagline" className="text-sm font-bold">Tagline</Label>
              <Input id="tagline" name="tagline" value={formData.tagline} onChange={handleInputChange} placeholder="One-line hook" className="h-11 rounded-xl bg-background border-border" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-bold">Description</Label>
              <Textarea id="description" name="description" value={formData.description} onChange={handleInputChange} placeholder="What the tool is..." className="min-h-[70px] rounded-xl bg-background border-border resize-y" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="why_i_use_it" className="text-sm font-bold">Why we use it</Label>
              <Textarea id="why_i_use_it" name="why_i_use_it" value={formData.why_i_use_it} onChange={handleInputChange} placeholder="How it serves the CardPop business..." className="min-h-[70px] rounded-xl bg-background border-border resize-y" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="how_it_helps_you" className="text-sm font-bold">How it helps their card business</Label>
              <Textarea id="how_it_helps_you" name="how_it_helps_you" value={formData.how_it_helps_you} onChange={handleInputChange} placeholder="How it helps a member selling at shows / online..." className="min-h-[70px] rounded-xl bg-background border-border resize-y" />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="affiliate_url" className="text-sm font-bold">Link URL <span className="text-destructive">*</span></Label>
                <Input id="affiliate_url" name="affiliate_url" type="url" value={formData.affiliate_url} onChange={handleInputChange} placeholder="https://... (your referral link)" className="h-11 rounded-xl bg-background border-border" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cta_label" className="text-sm font-bold">Button label</Label>
                <Input id="cta_label" name="cta_label" value={formData.cta_label} onChange={handleInputChange} placeholder="Learn more" className="h-11 rounded-xl bg-background border-border" />
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="icon" className="text-sm font-bold">Icon</Label>
                <select id="icon" name="icon" value={formData.icon} onChange={handleInputChange} className="h-11 w-full rounded-xl bg-background border border-border px-3 text-sm">
                  {ICON_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="accent" className="text-sm font-bold">Accent gradient</Label>
                <Input id="accent" name="accent" value={formData.accent} onChange={handleInputChange} placeholder="from-indigo-500 to-purple-600" className="h-11 rounded-xl bg-background border-border" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sort_order" className="text-sm font-bold">Sort order</Label>
                <Input id="sort_order" name="sort_order" type="number" value={formData.sort_order} onChange={handleInputChange} className="h-11 rounded-xl bg-background border-border" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="logo_url" className="text-sm font-bold">Logo URL <span className="text-muted-foreground font-normal">(optional — overrides icon)</span></Label>
              <Input id="logo_url" name="logo_url" value={formData.logo_url} onChange={handleInputChange} placeholder="https://.../logo.png" className="h-11 rounded-xl bg-background border-border" />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-4">
              <div>
                <Label htmlFor="is_published" className="text-sm font-bold">Published</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Show this tool on the public page.</p>
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
                  selected ? 'Save Changes' : 'Add Tool'
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
            <AlertDialogTitle className="font-serif text-xl">Delete Tool</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong className="text-foreground">{selected?.name}</strong>? This cannot be undone.
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

export default BusinessAffiliateLinksAdminPage;
