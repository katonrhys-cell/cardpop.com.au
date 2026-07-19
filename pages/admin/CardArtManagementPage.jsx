import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Plus, Search, Trash2, Image as ImageIcon, AlertCircle, RefreshCw, UploadCloud } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient.js';
import apiServerClient from '@/lib/apiServerClient.js';
import { compressImage } from '@/utils/compressImage.js';

const EMPTY_FORM = { name: '', card_set: '', collection: '' };

const CardArtManagementPage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const fetchItems = async (showToast = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiServerClient.fetch('/admin/card-art');
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.cardArt || []);
      if (showToast) toast.success('Card art refreshed');
    } catch (err) {
      setError(err.message || 'Failed to load card art.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSelected(null);
  };

  const openAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openDeleteDialog = (item) => {
    setSelected(item);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error('Card name is required'); return; }
    if (!file) { toast.error('Please choose an image'); return; }

    setIsSubmitting(true);
    try {
      // Compress, then upload to the public `media` bucket under a timestamped
      // immutable path (served via the CDN and cached into R2 on first view).
      const compressed = await compressImage(file);
      const ext = (compressed.name || file.name || 'png').split('.').pop().toLowerCase();
      const base = formData.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'card';
      const storagePath = `card-art/${Date.now()}-${base}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('media')
        .upload(storagePath, compressed, { cacheControl: '31536000', upsert: false });
      if (upErr) throw upErr;

      const imageUrl = supabase.storage.from('media').getPublicUrl(storagePath).data.publicUrl;

      const res = await apiServerClient.fetch('/admin/card-art', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          card_set: formData.card_set.trim() || null,
          collection: formData.collection.trim() || null,
          image_url: imageUrl,
          storage_path: storagePath,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);

      toast.success('Card art saved');
      setIsModalOpen(false);
      resetForm();
      fetchItems();
    } catch (err) {
      toast.error(err.message || 'Failed to save card art');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setIsSubmitting(true);
    try {
      const res = await apiServerClient.fetch(`/admin/card-art/${selected.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      toast.success('Card art deleted');
      setIsDeleteDialogOpen(false);
      setSelected(null);
      fetchItems();
    } catch (err) {
      toast.error(err.message || 'Failed to delete card art');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = items.filter(i =>
    i.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (i.collection && i.collection.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (i.card_set && i.card_set.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Helmet>
        <title>Card Art | Admin Portal</title>
      </Helmet>

      <AdminPageHeader
        icon={ImageIcon}
        title="Card Art"
        subtitle="Upload thumbnails for cards the free card APIs don't cover (sports cards), or override any card's art in the analytics & market-movers tables."
      >
        <Button variant="outline" onClick={() => fetchItems(true)} disabled={loading} className="rounded-xl h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Button variant="outline" onClick={openAddModal} className="rounded-xl h-10 px-4 font-bold border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
          <Plus className="w-4 h-4 mr-2" />
          Add Card Art
        </Button>
      </AdminPageHeader>

      {error ? (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-6 rounded-xl flex flex-col items-center justify-center text-center">
          <AlertCircle className="w-10 h-10 mb-3 opacity-80" />
          <h3 className="text-lg font-bold mb-1">Error Loading Card Art</h3>
          <p className="text-sm opacity-90 max-w-md">{error}</p>
          <Button variant="outline" className="mt-4 border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => fetchItems(true)}>
            Try Again
          </Button>
        </div>
      ) : (
        <Card className="border-border shadow-sm rounded-xl overflow-hidden w-full">
          <div className="p-4 border-b border-border bg-muted/20 flex justify-between items-center">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search cards..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 rounded-xl bg-background border-border"
              />
            </div>
            <div className="text-sm text-muted-foreground font-medium px-4 whitespace-nowrap">
              {filtered.length} {filtered.length === 1 ? 'card' : 'cards'}
            </div>
          </div>

          <div className="overflow-x-auto relative w-full">
            <Table className="w-full">
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-20">Art</TableHead>
                  <TableHead className="font-bold text-foreground">Card</TableHead>
                  <TableHead className="font-bold text-foreground hidden md:table-cell">Set</TableHead>
                  <TableHead className="font-bold text-foreground hidden sm:table-cell">Collection</TableHead>
                  <TableHead className="text-right font-bold text-foreground w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-14 w-10 rounded" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <ImageIcon className="w-10 h-10 mb-3 opacity-40" />
                        <p className="font-medium text-foreground">No card art yet</p>
                        <p className="text-sm mt-1">
                          {searchQuery ? 'None match your search.' : 'Upload art for a sports card or any card the APIs miss.'}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((item) => (
                    <TableRow key={item.id} className="group transition-colors hover:bg-muted/30">
                      <TableCell>
                        <img src={item.image_url} alt={item.name} loading="lazy" className="h-14 w-10 object-contain rounded bg-muted/30" />
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{item.name}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{item.card_set || '-'}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">{item.collection || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg" onClick={() => openDeleteDialog(item)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Add modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-xl border-border shadow-lg w-[95vw] mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Add Card Art</DialogTitle>
            <DialogDescription>
              Enter the card exactly as it appears in the analytics/movers table, then upload its image. Re-uploading for the same card replaces the art.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5 py-4 w-full">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-bold">Card name <span className="text-destructive">*</span></Label>
              <Input id="name" name="name" value={formData.name} onChange={handleInputChange} placeholder="e.g. LeBron James RC Auto" className="h-11 rounded-xl bg-background border-border" required />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="card_set" className="text-sm font-bold">Set</Label>
                <Input id="card_set" name="card_set" value={formData.card_set} onChange={handleInputChange} placeholder="e.g. 2003-04 Upper Deck" className="h-11 rounded-xl bg-background border-border" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="collection" className="text-sm font-bold">Collection</Label>
                <Input id="collection" name="collection" value={formData.collection} onChange={handleInputChange} placeholder="e.g. NBA" className="h-11 rounded-xl bg-background border-border" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="image" className="text-sm font-bold">Image <span className="text-destructive">*</span></Label>
              <div className="flex items-center gap-4">
                <label htmlFor="image" className="flex-1 flex items-center gap-2 h-11 px-3 rounded-xl border border-dashed border-border bg-background cursor-pointer text-sm text-muted-foreground hover:border-primary/50">
                  <UploadCloud className="w-4 h-4" />
                  {file ? file.name : 'Choose an image…'}
                  <input id="image" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </label>
                {previewUrl && <img src={previewUrl} alt="preview" className="h-16 w-12 object-contain rounded bg-muted/30" />}
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="rounded-xl h-11 px-6 font-bold w-full sm:w-auto" disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl h-11 px-6 font-bold w-full sm:w-auto mt-2 sm:mt-0" disabled={isSubmitting}>
                {isSubmitting ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  'Save Card Art'
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
            <AlertDialogTitle className="font-serif text-xl">Delete Card Art</AlertDialogTitle>
            <AlertDialogDescription>
              Remove the uploaded art for <strong className="text-foreground">{selected?.name}</strong>? The card falls back to the API lookup (or a placeholder). This cannot be undone.
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

export default CardArtManagementPage;
