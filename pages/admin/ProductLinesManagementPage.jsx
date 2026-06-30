
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Plus, Search, Edit, Trash2, Layers, AlertCircle, RefreshCw, ImageOff, ChevronLeft } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const ProductLinesManagementPage = () => {
  const navigate = useNavigate();
  const [productLines, setProductLines] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedLine, setSelectedLine] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    brand: '',
    image: null
  });
  
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  const fetchData = async (showToast = false) => {
    setLoading(true);
    try {
      const { data: allCats } = await supabase.from('categories').select('*').order('sort_order');
      const topLevel = (allCats ?? []).filter(c => !c.parent_id);
      const secondLevel = (allCats ?? []).filter(c => c.parent_id);
      setProductLines(secondLevel.map(c => ({ ...c, brand: c.parent_id })));
      setBrands(topLevel);
      setError(null);
      if (showToast) toast.success('Product lines refreshed');
    } catch (err) {
      setError("Failed to load product lines from database. Please check your connection.");
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
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBrandChange = (value) => {
    setFormData(prev => ({ ...prev, brand: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        toast.error("File size exceeds 20MB limit");
        return;
      }
      setFormData(prev => ({ ...prev, image: file }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', brand: '', image: null });
    setImagePreview(null);
    setSelectedLine(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (line) => {
    setFormData({
      name: line.name || '',
      description: line.description || '',
      brand: line.brand || '',
      image: null
    });
    
    setImagePreview(line.image_url ?? null);
    
    setSelectedLine(line);
    setIsModalOpen(true);
  };

  const openDeleteDialog = (line) => {
    setSelectedLine(line);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.brand) {
      toast.error('Name and Brand are required');
      return;
    }

    setIsSubmitting(true);
    try {
      let image_url = selectedLine?.image_url ?? null;
      if (formData.image instanceof File) {
        const path = `categories/${Date.now()}-${formData.image.name}`;
        const { error: upErr } = await supabase.storage.from('categories').upload(path, formData.image, { upsert: true });
        if (!upErr) image_url = supabase.storage.from('categories').getPublicUrl(path).data.publicUrl;
      }
      const payload = { name: formData.name.trim(), description: formData.description.trim(), parent_id: formData.brand || null, image_url };

      if (selectedLine) {
        const { error } = await supabase.from('categories').update(payload).eq('id', selectedLine.id);
        if (error) throw error;
        toast.success('Product line updated successfully');
      } else {
        const { error } = await supabase.from('categories').insert(payload);
        if (error) throw error;
        toast.success('Product line created successfully');
      }
      
      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to save product line');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedLine) return;
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('categories').delete().eq('id', selectedLine.id);
      if (error) throw error;
      toast.success('Product line deleted successfully');
      setIsDeleteDialogOpen(false);
      setSelectedLine(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to delete product line.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredLines = productLines.filter(line => {
    const brandName = brands.find(b => b.id === line.brand)?.name ?? '';
    return (
      line.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      brandName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      line.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Helmet>
        <title>Product Lines Management | Admin Portal</title>
      </Helmet>
      
      <AdminPageHeader
        icon={Layers}
        title="Product Lines"
        subtitle="Manage game sets, expansions, and product lines."
      >
        <Button variant="outline" onClick={() => fetchData(true)} disabled={loading} className="rounded-xl h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Button variant="outline" onClick={openAddModal} className="rounded-xl h-10 px-4 font-bold border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
          <Plus className="w-4 h-4 mr-2" />
          Add Product Line
        </Button>
      </AdminPageHeader>

      {error ? (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-6 rounded-xl flex flex-col items-center justify-center text-center">
          <AlertCircle className="w-10 h-10 mb-3 opacity-80" />
          <h3 className="text-lg font-bold mb-1">Error Loading Product Lines</h3>
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
                placeholder="Search product lines..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 rounded-xl bg-background border-border" 
              />
            </div>
            <div className="text-sm text-muted-foreground font-medium whitespace-nowrap">
              {filteredLines.length} {filteredLines.length === 1 ? 'line' : 'lines'} total
            </div>
          </div>
          
          <div className="overflow-x-auto relative w-full">
            <Table className="w-full">
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-20 text-center">Image</TableHead>
                  <TableHead className="font-bold text-foreground">Name</TableHead>
                  <TableHead className="font-bold text-foreground">Brand</TableHead>
                  <TableHead className="font-bold text-foreground hidden lg:table-cell">Description</TableHead>
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
                      <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredLines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <Layers className="w-10 h-10 mb-3 opacity-40" />
                        <p className="font-medium text-foreground">No product lines found</p>
                        <p className="text-sm mt-1">
                          {searchQuery ? 'No product lines match your search.' : 'Create your first product line to get started.'}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLines.map((line) => (
                    <TableRow key={line.id} className="group hover:bg-muted/40 transition-colors">
                      <TableCell className="text-center">
                        <div className="w-10 h-10 rounded-xl bg-background border border-border flex items-center justify-center mx-auto overflow-hidden shadow-sm p-1">
                          {line.image_url ? (
                            <img src={line.image_url} alt={line.name} className="w-full h-full object-contain" />
                          ) : (
                            <ImageOff className="w-4 h-4 text-muted-foreground opacity-50" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{line.name}</TableCell>
                      <TableCell>
                        <span className="bg-secondary text-secondary-foreground text-xs font-medium px-2 py-1 rounded-md">
                          {brands.find(b => b.id === line.brand)?.name || 'Unknown Brand'}
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground truncate max-w-xs xl:max-w-md text-sm">
                        {line.description || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary rounded-lg" onClick={() => openEditModal(line)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg" onClick={() => openDeleteDialog(line)}>
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
            <DialogTitle className="font-serif text-xl">{selectedLine ? 'Edit Product Line' : 'Add Product Line'}</DialogTitle>
            <DialogDescription>
              {selectedLine ? 'Update the details for this product line.' : 'Create a new product line.'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-5 py-4 w-full">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-bold">Line Name <span className="text-destructive">*</span></Label>
              <Input 
                id="name" 
                name="name" 
                value={formData.name} 
                onChange={handleInputChange} 
                placeholder="e.g. Base Set" 
                className="h-11 rounded-xl bg-background border-border"
                required 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="brand" className="text-sm font-bold">Brand <span className="text-destructive">*</span></Label>
              <Select value={formData.brand} onValueChange={handleBrandChange} required>
                <SelectTrigger className="bg-background border-border rounded-xl h-11">
                  <SelectValue placeholder="Select a brand" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map(brand => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
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
                placeholder="Brief description of this product line..." 
                className="min-h-[100px] rounded-xl bg-background border-border resize-y"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-bold">Image (Optional)</Label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="w-16 h-16 rounded-xl border border-border bg-background shadow-sm flex items-center justify-center overflow-hidden shrink-0 p-1">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-contain" />
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
                  selectedLine ? 'Save Changes' : 'Create Product Line'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-xl border-border shadow-lg w-[95vw] mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-xl">Delete Product Line</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong className="text-foreground">{selectedLine?.name}</strong>? 
              This action cannot be undone and may break products linked to this line.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="rounded-xl h-11 px-6 font-bold m-0" disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => { e.preventDefault(); handleDelete(); }} 
              className="rounded-xl h-11 px-6 font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 m-0"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Deleting...' : 'Delete Product Line'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProductLinesManagementPage;
