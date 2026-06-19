
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Plus, Search, Edit, Trash2, FolderTree, AlertCircle, RefreshCw, ImageOff, ChevronLeft } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient.js';

const SubcategoryManagementPage = () => {
  const navigate = useNavigate();
  const [subcategories, setSubcategories] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    parentCategory: '',
    icon: null
  });
  
  const [iconPreview, setIconPreview] = useState(null);
  const fileInputRef = useRef(null);

  const fetchData = async (showToast = false) => {
    setLoading(true);
    try {
      const { data: allCats } = await supabase.from('categories').select('*').order('sort_order');
      const topLevel = (allCats ?? []).filter(c => !c.parent_id);
      const children = (allCats ?? []).filter(c => c.parent_id);
      setSubcategories(children.map(c => ({ ...c, parentCategory: c.parent_id })));
      setCategories(topLevel);
      setError(null);
      if (showToast) toast.success('Data refreshed');
    } catch (err) {
      console.error('[SubcategoryManagementPage] Failed to fetch data:', err);
      setError("Failed to load subcategories from database. Please check your connection.");
      if (showToast) toast.error('Failed to refresh data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      if (name === 'name' && !selectedSubcategory) {
        newData.slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      }
      return newData;
    });
  };

  const handleCategoryChange = (value) => {
    setFormData(prev => ({ ...prev, parentCategory: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        toast.error("File size exceeds 20MB limit");
        return;
      }
      setFormData(prev => ({ ...prev, icon: file }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setIconPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', slug: '', description: '', parentCategory: '', icon: null });
    setIconPreview(null);
    setSelectedSubcategory(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (subcategory) => {
    setFormData({
      name: subcategory.name || '',
      slug: subcategory.slug || '',
      description: subcategory.description || '',
      parentCategory: subcategory.parentCategory || '',
      icon: null
    });
    
    setIconPreview(subcategory.icon_url ?? null);
    
    setSelectedSubcategory(subcategory);
    setIsModalOpen(true);
  };

  const openDeleteDialog = (subcategory) => {
    setSelectedSubcategory(subcategory);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.slug || !formData.parentCategory) {
      toast.error('Name, slug, and parent category are required');
      return;
    }

    setIsSubmitting(true);
    
    try {
      let icon_url = selectedSubcategory?.icon_url ?? null;
      if (formData.icon instanceof File) {
        const path = `categories/${Date.now()}-icon-${formData.icon.name}`;
        const { error: upErr } = await supabase.storage.from('categories').upload(path, formData.icon, { upsert: true });
        if (!upErr) icon_url = supabase.storage.from('categories').getPublicUrl(path).data.publicUrl;
      }
      const payload = { name: formData.name, slug: formData.slug, description: formData.description, parent_id: formData.parentCategory || null, icon_url };

      if (selectedSubcategory) {
        const { error } = await supabase.from('categories').update(payload).eq('id', selectedSubcategory.id);
        if (error) throw error;
        toast.success('Subcategory updated successfully');
      } else {
        const { error } = await supabase.from('categories').insert(payload);
        if (error) throw error;
        toast.success('Subcategory created successfully');
      }
      
      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (err) {
      console.error('Error saving subcategory:', err);
      toast.error(err.message || 'Failed to save subcategory');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedSubcategory) return;
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('categories').delete().eq('id', selectedSubcategory.id);
      if (error) throw error;
      toast.success('Subcategory deleted successfully');
      setIsDeleteDialogOpen(false);
      setSelectedSubcategory(null);
      fetchData();
    } catch (err) {
      console.error('Error deleting subcategory:', err);
      toast.error('Failed to delete subcategory. It may be in use.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSubcategories = subcategories.filter(sub => {
    const parentName = categories.find(c => c.id === sub.parentCategory)?.name ?? '';
    return (
      sub.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      parentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Helmet>
        <title>Subcategory Management | Admin Portal</title>
      </Helmet>

      <AdminPageHeader
        icon={FolderTree}
        title="Subcategories"
        subtitle="Manage nested product categories."
      >
        <Button variant="outline" onClick={() => fetchData(true)} disabled={loading} className="rounded-xl h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Button variant="outline" onClick={openAddModal} className="rounded-xl h-10 px-4 font-bold border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
          <Plus className="w-4 h-4 mr-2" />
          Add Subcategory
        </Button>
      </AdminPageHeader>

      {error ? (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-6 rounded-xl flex flex-col items-center justify-center text-center">
          <AlertCircle className="w-10 h-10 mb-3 opacity-80" />
          <h3 className="text-lg font-bold mb-1">Error Loading Subcategories</h3>
          <p className="text-sm opacity-90 max-w-md">{error}</p>
          <Button variant="outline" className="mt-4 border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => fetchData(true)}>
            Try Again
          </Button>
        </div>
      ) : (
        <Card className="border-border shadow-sm rounded-xl overflow-hidden w-full">
          <div className="p-4 border-b border-border bg-muted/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search subcategories..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 rounded-xl bg-background border-border" 
              />
            </div>
            <div className="text-sm text-muted-foreground font-medium whitespace-nowrap">
              {filteredSubcategories.length} {filteredSubcategories.length === 1 ? 'subcategory' : 'subcategories'} total
            </div>
          </div>
          
          <div className="overflow-x-auto relative w-full">
            <Table className="w-full">
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-20 text-center">Icon</TableHead>
                  <TableHead className="font-bold text-foreground">Name</TableHead>
                  <TableHead className="font-bold text-foreground">Parent Category</TableHead>
                  <TableHead className="font-bold text-foreground hidden md:table-cell">Description</TableHead>
                  <TableHead className="text-right font-bold text-foreground w-28">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="w-10 h-10 rounded-lg mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredSubcategories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <FolderTree className="w-10 h-10 mb-3 opacity-40" />
                        <p className="font-medium text-foreground">No subcategories found</p>
                        <p className="text-sm mt-1">
                          {searchQuery ? 'No subcategories match your search.' : 'Create your first subcategory to get started.'}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSubcategories.map((subcategory) => (
                    <TableRow key={subcategory.id} className="group hover:bg-muted/40 transition-colors">
                      <TableCell className="text-center">
                        <div className="w-10 h-10 rounded-xl bg-background border border-border flex items-center justify-center mx-auto overflow-hidden shadow-sm p-1">
                          {subcategory.icon_url ? (
                            <img src={subcategory.icon_url} alt={subcategory.name} className="w-full h-full object-contain" />
                          ) : (
                            <ImageOff className="w-4 h-4 text-muted-foreground opacity-50" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{subcategory.name}</TableCell>
                      <TableCell>
                        <span className="bg-secondary text-secondary-foreground text-xs font-medium px-2 py-1 rounded-md">
                          {categories.find(c => c.id === subcategory.parentCategory)?.name || 'Unknown Category'}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground truncate max-w-xs xl:max-w-md text-sm">
                        {subcategory.description || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary rounded-lg" onClick={() => openEditModal(subcategory)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg" onClick={() => openDeleteDialog(subcategory)}>
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

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-xl border-border shadow-lg w-[95vw] mx-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">{selectedSubcategory ? 'Edit Subcategory' : 'Add New Subcategory'}</DialogTitle>
            <DialogDescription>
              {selectedSubcategory ? 'Update the details for this subcategory.' : 'Create a new nested category.'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-5 py-4 w-full">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-bold">Subcategory Name <span className="text-destructive">*</span></Label>
              <Input 
                id="name" 
                name="name" 
                value={formData.name} 
                onChange={handleInputChange} 
                placeholder="e.g. Booster Boxes" 
                className="h-11 rounded-xl bg-background border-border"
                required 
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="slug" className="text-sm font-bold">URL Slug <span className="text-destructive">*</span></Label>
              <Input 
                id="slug" 
                name="slug" 
                value={formData.slug} 
                onChange={handleInputChange} 
                placeholder="e.g. booster-boxes" 
                className="h-11 rounded-xl bg-background border-border font-mono text-sm"
                required 
              />
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Must be unique, lowercase, no spaces</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="parentCategory" className="text-sm font-bold">Parent Category <span className="text-destructive">*</span></Label>
              <Select value={formData.parentCategory} onValueChange={handleCategoryChange} required>
                <SelectTrigger className="bg-background border-border rounded-xl h-11">
                  <SelectValue placeholder="Select a parent category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-bold">Description</Label>
              <Textarea 
                id="description" 
                name="description" 
                value={formData.description} 
                onChange={handleInputChange} 
                placeholder="Brief description of this subcategory..." 
                className="min-h-[100px] rounded-xl bg-background border-border resize-y"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-bold">Subcategory Icon</Label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="w-16 h-16 rounded-xl border border-border bg-background shadow-sm flex items-center justify-center overflow-hidden shrink-0 p-1">
                  {iconPreview ? (
                    <img src={iconPreview} alt="Preview" className="w-full h-full object-contain" />
                  ) : (
                    <ImageOff className="w-6 h-6 text-muted-foreground opacity-50" />
                  )}
                </div>
                <div className="flex-1 w-full">
                  <Input 
                    type="file" 
                    accept="image/jpeg,image/png,image/webp,image/gif" 
                    onChange={handleFileChange} 
                    ref={fileInputRef}
                    className="text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer border-border h-auto py-1"
                  />
                  <p className="text-[10px] text-muted-foreground mt-2 uppercase font-bold tracking-wider">Max 20MB. JPEG, PNG, WEBP.</p>
                </div>
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
                  selectedSubcategory ? 'Save Changes' : 'Create Subcategory'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-xl border-border shadow-lg w-[95vw] mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-xl">Delete Subcategory</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong className="text-foreground">{selectedSubcategory?.name}</strong>? 
              This action cannot be undone and may break products linked to this subcategory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="rounded-xl h-11 px-6 font-bold m-0" disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => { e.preventDefault(); handleDelete(); }} 
              className="rounded-xl h-11 px-6 font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 m-0"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Deleting...' : 'Delete Subcategory'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SubcategoryManagementPage;
