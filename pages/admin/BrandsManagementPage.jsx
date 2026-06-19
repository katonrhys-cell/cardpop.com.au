
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Plus, Search, Edit, Trash2, Building2, AlertCircle, RefreshCw, ImageOff, ChevronLeft } from 'lucide-react';
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
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient.js';

const BrandsManagementPage = () => {
  const navigate = useNavigate();
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    logo: null
  });
  
  const [iconPreview, setIconPreview] = useState(null);
  const fileInputRef = useRef(null);

  const fetchBrands = async (showToast = false) => {
    // brands collection has been consolidated into Categories in the new schema.
    setLoading(false);
    setBrands([]);
    setError(null);
    if (showToast) toast.info('Brands are no longer a separate collection.');
  };

  useEffect(() => {
    fetchBrands();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        toast.error("File size exceeds 20MB limit");
        return;
      }
      setFormData(prev => ({ ...prev, logo: file }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setIconPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', logo: null });
    setIconPreview(null);
    setSelectedBrand(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (brand) => {
    setFormData({
      name: brand.name || '',
      description: brand.description || '',
      logo: null
    });
    
    setIconPreview(brand.logo_url || null);
    
    setSelectedBrand(brand);
    setIsModalOpen(true);
  };

  const openDeleteDialog = (brand) => {
    setSelectedBrand(brand);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Brand name is required');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const submitData = new FormData();
      submitData.append('name', formData.name.trim());
      submitData.append('description', formData.description ? formData.description.trim() : '');
      
      if (formData.logo instanceof File) {
        submitData.append('logo', formData.logo);
      }

      // Brands collection removed — no-op
      toast.info('This taxonomy level has been consolidated into Categories in the new schema.');
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      console.error("Error saving brand:", err);
      toast.error(err.message || 'Failed to save brand');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedBrand) return;
    
    setIsSubmitting(true);
    try {
      // Brands collection removed — no-op
      toast.info('This taxonomy level has been consolidated into Categories in the new schema.');
      setIsDeleteDialogOpen(false);
      setSelectedBrand(null);
    } catch (err) {
      console.error("Error deleting brand:", err);
      toast.error('Failed to delete brand. It may be in use.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredBrands = brands.filter(brand => 
    brand.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (brand.description && brand.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Helmet>
        <title>Brand Management | Admin Portal</title>
      </Helmet>

      <AdminPageHeader
        icon={Building2}
        title="Brands"
        subtitle="Add and manage card game and sports brands."
      >
        <Button variant="outline" onClick={() => fetchBrands(true)} disabled={loading} className="rounded-xl h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Button variant="outline" onClick={openAddModal} className="rounded-xl h-10 px-4 font-bold border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
          <Plus className="w-4 h-4 mr-2" />
          Add Brand
        </Button>
      </AdminPageHeader>

      {error ? (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-6 rounded-xl flex flex-col items-center justify-center text-center">
          <AlertCircle className="w-10 h-10 mb-3 opacity-80" />
          <h3 className="text-lg font-bold mb-1">Error Loading Brands</h3>
          <p className="text-sm opacity-90 max-w-md">{error}</p>
          <Button variant="outline" className="mt-4 border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => fetchBrands(true)}>
            Try Again
          </Button>
        </div>
      ) : (
        <Card className="border-border shadow-sm rounded-xl overflow-hidden w-full">
          <div className="p-4 border-b border-border bg-muted/20 flex justify-between items-center">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search brands..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 rounded-xl bg-background border-border" 
              />
            </div>
            <div className="text-sm text-muted-foreground font-medium px-4 whitespace-nowrap">
              {filteredBrands.length} {filteredBrands.length === 1 ? 'brand' : 'brands'} total
            </div>
          </div>
          
          <div className="overflow-x-auto relative w-full">
            <Table className="w-full">
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-20 text-center">Logo</TableHead>
                  <TableHead className="font-bold text-foreground">Name</TableHead>
                  <TableHead className="font-bold text-foreground hidden md:table-cell">Description</TableHead>
                  <TableHead className="text-right font-bold text-foreground w-28">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="w-10 h-10 rounded-lg mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-64" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredBrands.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <Building2 className="w-10 h-10 mb-3 opacity-40" />
                        <p className="font-medium text-foreground">No brands found</p>
                        <p className="text-sm mt-1">
                          {searchQuery ? 'No brands match your search.' : 'Create your first brand to get started.'}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBrands.map((brand) => (
                    <TableRow key={brand.id} className="group transition-colors hover:bg-muted/30 cursor-pointer" onClick={() => openEditModal(brand)}>
                      <TableCell className="text-center">
                        <div className="w-10 h-10 rounded-xl bg-background border border-border flex items-center justify-center mx-auto overflow-hidden shadow-sm p-1">
                          {brand.logo_url ? (
                            <img src={brand.logo_url} alt={brand.name} className="w-full h-full object-contain" />
                          ) : (
                            <ImageOff className="w-4 h-4 text-muted-foreground opacity-50" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{brand.name}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground truncate max-w-[200px] lg:max-w-md text-sm">
                        {brand.description || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary rounded-lg" onClick={() => openEditModal(brand)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg" onClick={() => openDeleteDialog(brand)}>
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
            <DialogTitle className="font-serif text-xl">{selectedBrand ? 'Edit Brand' : 'Add New Brand'}</DialogTitle>
            <DialogDescription>
              {selectedBrand ? 'Update the details for this brand.' : 'Create a new brand.'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-5 py-4 w-full">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-bold">Brand Name <span className="text-destructive">*</span></Label>
              <Input 
                id="name" 
                name="name" 
                value={formData.name} 
                onChange={handleInputChange} 
                placeholder="e.g. Pokemon" 
                className="h-11 rounded-xl bg-background border-border"
                required 
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-bold">Description</Label>
              <Textarea 
                id="description" 
                name="description" 
                value={formData.description} 
                onChange={handleInputChange} 
                placeholder="Brief description of this brand..." 
                className="min-h-[100px] rounded-xl bg-background border-border resize-y"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-bold">Brand Logo</Label>
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
                  <p className="text-[10px] text-muted-foreground mt-2 uppercase font-bold tracking-wider">Max 20MB. Square format recommended.</p>
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
                  selectedBrand ? 'Save Changes' : 'Create Brand'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-xl border-border shadow-lg w-[95vw] mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-xl">Delete Brand</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong className="text-foreground">{selectedBrand?.name}</strong>? 
              This action cannot be undone and may break product lines linked to this brand.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="rounded-xl h-11 px-6 font-bold m-0" disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => { e.preventDefault(); handleDelete(); }} 
              className="rounded-xl h-11 px-6 font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 m-0"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Deleting...' : 'Delete Brand'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BrandsManagementPage;
