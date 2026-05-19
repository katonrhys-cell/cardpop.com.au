
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { FolderTree, Plus, RefreshCw, Loader2, AlertCircle, Info, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { useDragDrop } from '@/hooks/useDragDrop.js';
import { toast } from 'sonner';
import pb from '@/lib/pocketbaseClient.js';

import CategoryDragItem from '@/components/admin/CategoryDragItem.jsx';
import SubcategoryDragItem from '@/components/admin/SubcategoryDragItem.jsx';
import BrandDragItem from '@/components/admin/BrandDragItem.jsx';
import SeriesDragItem from '@/components/admin/SeriesDragItem.jsx';
import DropZoneContainer from '@/components/admin/DropZoneContainer.jsx';
import MigrationPanel from '@/components/admin/MigrationPanel.jsx';

const TreeNode = ({ node, type, childrenNodes, onAddChild, onEdit, onDelete, onDropSuccess }) => {
  const [expanded, setExpanded] = useState(true);

  const handleToggle = () => {
    setExpanded(!expanded);
  };

  const childType = type === 'category' ? 'subcategory' : type === 'subcategory' ? 'brand' : 'series';
  const childCount = childrenNodes ? childrenNodes.length : 0;

  const renderNode = () => {
    const props = {
      expanded,
      onToggle: handleToggle,
      onEdit,
      onDelete,
      onAddChild,
      onDropSuccess,
      childCount
    };

    switch (type) {
      case 'category': return <CategoryDragItem category={node} {...props} />;
      case 'subcategory': return <SubcategoryDragItem subcategory={node} {...props} />;
      case 'brand': return <BrandDragItem brand={node} {...props} />;
      case 'series': return <SeriesDragItem series={node} {...props} />;
      default: return null;
    }
  };

  return (
    <div className="w-full relative">
      {renderNode()}

      {expanded && type !== 'series' && (
        <div className="relative pl-6 ml-6 border-l-2 border-border/40 mt-1 mb-3">
          {childrenNodes && childrenNodes.length > 0 ? (
            <div className="space-y-1">
              {childrenNodes.map(child => (
                <TreeNode 
                  key={child.node.id} 
                  node={child.node} 
                  type={childType} 
                  childrenNodes={child.children}
                  onAddChild={onAddChild} 
                  onEdit={onEdit} 
                  onDelete={onDelete} 
                  onDropSuccess={onDropSuccess}
                />
              ))}
              <DropZoneContainer 
                targetType={`${childType}_list`} 
                targetId={node.id} 
                onDropSuccess={(draggedData, targetData) => onDropSuccess(draggedData, { ...targetData, parentId: node.id })}
                className="h-4 w-full rounded-md mt-1"
              />
            </div>
          ) : (
            <DropZoneContainer 
              targetType={`${childType}_list`} 
              targetId={node.id} 
              onDropSuccess={(draggedData, targetData) => onDropSuccess(draggedData, { ...targetData, parentId: node.id })}
              className="py-4 px-4 text-sm text-muted-foreground italic opacity-70 border border-dashed border-border rounded-lg text-center"
            >
              No {childType}s found. Drag items here to add.
            </DropZoneContainer>
          )}
        </div>
      )}
    </div>
  );
};

const CategoryManagementPage = () => {
  const { 
    updateItemParent,
    updateSeriesParentBrand,
    updateBrandParentSubcategory,
    deleteSeries,
    deleteBrand,
    convertCategoryToSubcategory,
    convertBrandToSubcategory,
    convertBrandToSeries,
    convertSeriesToBrand
  } = useDragDrop();
  
  const [treeData, setTreeData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [errors, setErrors] = useState({
    categories: null,
    subcategories: null,
    brands: null,
    series: null
  });
  
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [modalType, setModalType] = useState('category');
  const [activeNode, setActiveNode] = useState(null); 
  const [formData, setFormData] = useState({ 
    name: '', 
    slug: '', 
    description: '', 
    releaseYear: '',
    logo_url: '',
    website_url: ''
  });

  const checkAuthStatus = () => {
    setIsAdmin(pb.authStore.isValid && pb.authStore.model?.role === 'admin');
  };

  const loadAllData = async () => {
    setIsLoading(true);
    setErrors({
      categories: null,
      subcategories: null,
      brands: null,
      series: null
    });
    
    let fetchedCats = [];
    let fetchedSubcats = [];
    let fetchedBrands = [];
    let fetchedSeries = [];

    try {
      fetchedCats = await pb.collection('categories').getFullList({ sort: '-created', $autoCancel: false });
    } catch (err) {
      setErrors(prev => ({ ...prev, categories: err.message || "Failed to load categories" }));
    }

    try {
      fetchedSubcats = await pb.collection('subcategories').getFullList({ sort: '-created', $autoCancel: false });
    } catch (err) {
      setErrors(prev => ({ ...prev, subcategories: err.message || "Failed to load subcategories" }));
    }

    try {
      fetchedBrands = await pb.collection('brands').getFullList({ sort: '-created', $autoCancel: false });
    } catch (err) {
      setErrors(prev => ({ ...prev, brands: err.message || "Failed to load brands" }));
    }

    try {
      fetchedSeries = await pb.collection('series').getFullList({ sort: '-created', $autoCancel: false });
    } catch (err) {
      setErrors(prev => ({ ...prev, series: err.message || "Failed to load series" }));
    }

    const tree = fetchedCats.map(cat => ({
      node: cat,
      children: fetchedSubcats
        .filter(s => s.parentCategory === cat.id)
        .map(subcat => ({
          node: subcat,
          children: fetchedBrands
            .filter(b => b.parentSubcategory === subcat.id)
            .map(brand => ({
              node: brand,
              children: fetchedSeries
                .filter(ser => ser.parentBrand === brand.id)
                .map(ser => ({
                  node: ser,
                  children: []
                }))
            }))
        }))
    }));

    setTreeData(tree);
    setIsLoading(false);
  };

  useEffect(() => {
    checkAuthStatus();
    loadAllData();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAllData();
    setIsRefreshing(false);
    if (!Object.values(errors).some(Boolean)) {
      toast.success('Hierarchy refreshed successfully');
    }
  };

  const handleMigrationComplete = () => {
    loadAllData();
  };

  const handleAddChild = (parentNode, childType) => {
    setModalMode('add');
    setModalType(childType);
    setActiveNode(parentNode);
    setFormData({ name: '', slug: '', description: '', releaseYear: '', logo_url: '', website_url: '' });
    setModalOpen(true);
  };

  const handleAddRoot = () => {
    setModalMode('add');
    setModalType('category');
    setActiveNode(null);
    setFormData({ name: '', slug: '', description: '', releaseYear: '', logo_url: '', website_url: '' });
    setModalOpen(true);
  };

  const handleEdit = (node, type) => {
    setModalMode('edit');
    setModalType(type);
    setActiveNode(node);
    setFormData({ 
      name: node.name || '', 
      slug: node.slug || '', 
      description: node.description || '',
      releaseYear: node.releaseYear || '',
      logo_url: node.logo_url || '',
      website_url: node.website_url || ''
    });
    setModalOpen(true);
  };

  const handleDelete = async (node, type) => {
    if (!window.confirm(`Delete ${type} "${node.name}"? This cannot be undone.`)) return;
    
    try {
      if (type === 'series') {
        await deleteSeries(node.id);
      } else if (type === 'brand') {
        await deleteBrand(node.id);
      } else {
        const collectionMap = {
          'category': 'categories',
          'subcategory': 'subcategories'
        };
        await pb.collection(collectionMap[type]).delete(node.id, { $autoCancel: false });
      }
      
      toast.success(`${type} deleted successfully`);
      loadAllData();
    } catch (err) {
      console.error(`[Hierarchy] Error deleting ${type}:`, err);
      toast.error(`Failed to delete: ${err.message}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const collectionMap = {
      'category': 'categories',
      'subcategory': 'subcategories',
      'brand': 'brands',
      'series': 'series'
    };
    const collection = collectionMap[modalType];

    const payload = { 
      name: formData.name, 
      description: formData.description 
    };

    if (['category', 'subcategory'].includes(modalType)) {
      payload.slug = formData.slug || formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    }
    
    if (modalType === 'series' && formData.releaseYear) {
      payload.releaseYear = parseInt(formData.releaseYear, 10);
    }

    if (modalType === 'brand') {
      if (formData.logo_url) payload.logo_url = formData.logo_url;
      if (formData.website_url) payload.website_url = formData.website_url;
    }

    try {
      setIsSaving(true);
      if (modalMode === 'add') {
        if (modalType === 'subcategory') payload.parentCategory = activeNode.id;
        if (modalType === 'brand') payload.parentSubcategory = activeNode.id;
        if (modalType === 'series') payload.parentBrand = activeNode.id;
        await pb.collection(collection).create(payload, { $autoCancel: false });
        toast.success(`${modalType} created successfully`);
      } else {
        await pb.collection(collection).update(activeNode.id, payload, { $autoCancel: false });
        toast.success(`${modalType} updated successfully`);
      }

      setModalOpen(false);
      await loadAllData();
    } catch (err) {
      console.error(`[Hierarchy] Error saving ${modalType}:`, err);
      toast.error(`Failed to save: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDropSuccess = async (draggedData, targetData) => {
    setIsSaving(true);
    try {
      if (draggedData.type === 'category' && targetData.targetType === 'category') {
        if (draggedData.id === targetData.targetId) return false;
        await convertCategoryToSubcategory(draggedData.id, targetData.targetId);
        toast.success(`Converted "${draggedData.name}" to a subcategory`);
        await loadAllData();
        return true;
      }

      if (draggedData.type === 'brand' && targetData.targetType === 'category') {
        await convertBrandToSubcategory(draggedData.id, targetData.targetId);
        toast.success(`Converted brand "${draggedData.name}" to a subcategory`);
        await loadAllData();
        return true;
      }

      if (draggedData.type === 'brand' && targetData.targetType === 'brand') {
        if (draggedData.id === targetData.targetId) return false;
        await convertBrandToSeries(draggedData.id, targetData.targetId);
        toast.success(`Converted brand "${draggedData.name}" to a series`);
        await loadAllData();
        return true;
      }

      if (draggedData.type === 'series' && targetData.targetType === 'subcategory') {
        await convertSeriesToBrand(draggedData.id, targetData.targetId);
        toast.success(`Converted series "${draggedData.name}" to a brand`);
        await loadAllData();
        return true;
      }

      // Explicit reparenting handling based on type
      if (['category', 'subcategory', 'brand', 'series'].includes(draggedData.type)) {
        if (draggedData.parentId !== targetData.targetId && targetData.targetType !== `${draggedData.type}_list`) {
          
          if (draggedData.type === 'series' && targetData.targetType === 'brand') {
            await updateSeriesParentBrand(draggedData.id, targetData.targetId);
          } else if (draggedData.type === 'brand' && targetData.targetType === 'subcategory') {
            await updateBrandParentSubcategory(draggedData.id, targetData.targetId);
          } else if (draggedData.type !== 'series' && draggedData.type !== 'brand') {
            await updateItemParent(draggedData.type, draggedData.id, targetData.targetId);
          }
          
          toast.success(`Moved ${draggedData.name} successfully`);
          await loadAllData();
          return true;
        }
      }
      
      if (targetData.targetType.endsWith('_list')) {
        if (draggedData.type === 'category') {
          toast.success(`Dropped ${draggedData.name} in category list`);
          await loadAllData();
          return true;
        } else {
          if (draggedData.parentId !== targetData.parentId) {
            
            if (draggedData.type === 'series') {
              await updateSeriesParentBrand(draggedData.id, targetData.parentId);
            } else if (draggedData.type === 'brand') {
              await updateBrandParentSubcategory(draggedData.id, targetData.parentId);
            } else {
              await updateItemParent(draggedData.type, draggedData.id, targetData.parentId);
            }

            toast.success(`Moved ${draggedData.name} successfully`);
            await loadAllData();
            return true;
          }
        }
      }
      
      return false;
    } catch (error) {
      console.error('[Hierarchy] Drag and drop error:', error);
      toast.error(`Failed to move item: ${error.message}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const hasAnyErrors = Object.values(errors).some(Boolean);

  return (
    <div className="w-full space-y-6 py-6 px-4 sm:px-6 md:px-8 max-w-5xl mx-auto">
      <Helmet><title>Category Hierarchy | Admin</title></Helmet>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            Hierarchy Tree
            {isSaving && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
          </h1>
          <p className="text-muted-foreground mt-1">Manage nested categories, brands, and series across the platform.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={handleRefresh} 
            disabled={isRefreshing || isLoading}
            className="rounded-xl font-bold shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button onClick={handleAddRoot} className="rounded-xl font-bold shadow-sm">
            <Plus className="w-4 h-4 mr-2" /> Add Category
          </Button>
        </div>
      </div>

      {isAdmin && (
        <Accordion type="single" collapsible className="w-full bg-transparent border-none">
          <AccordionItem value="migration" className="border-none">
            <AccordionTrigger className="bg-card px-4 py-3 rounded-xl border border-border shadow-sm hover:no-underline hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Settings2 className="w-4 h-4 text-primary" />
                Data Migration Tools
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-0">
              <MigrationPanel onMigrationComplete={handleMigrationComplete} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {hasAnyErrors && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-destructive font-bold">
            <AlertCircle className="w-5 h-5" />
            Some collections failed to load
          </div>
          <ul className="text-sm text-destructive/80 space-y-1 list-disc list-inside pl-7">
            {errors.categories && <li><strong>Categories:</strong> {errors.categories}</li>}
            {errors.subcategories && <li><strong>Subcategories:</strong> {errors.subcategories}</li>}
            {errors.brands && <li><strong>Brands:</strong> {errors.brands}</li>}
            {errors.series && <li><strong>Series:</strong> {errors.series}</li>}
          </ul>
          <div className="mt-2 text-sm text-foreground/80 flex items-center gap-1.5 font-medium">
            <Info className="w-4 h-4 text-primary" /> Partial data is displayed. Please resolve the errors and refresh.
          </div>
        </div>
      )}

      <Card className="border-border shadow-sm rounded-2xl overflow-hidden p-4 sm:p-6 bg-card">
        {isLoading ? (
          <div className="py-24 text-center text-muted-foreground flex flex-col items-center">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary/50" />
            Loading hierarchy tree...
          </div>
        ) : treeData.length === 0 && !errors.categories ? (
          <div className="p-16 text-center flex flex-col items-center bg-background rounded-xl border border-dashed border-border">
            <FolderTree className="w-12 h-12 text-muted-foreground opacity-30 mb-4" />
            <p className="font-medium text-foreground">No categories created yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Click "Add Category" to get started.</p>
          </div>
        ) : (
          <DropZoneContainer 
            targetType="category_list" 
            targetId="root" 
            onDropSuccess={handleDropSuccess}
            className="space-y-3 min-h-[400px] p-2"
          >
            {treeData.map(cat => (
              <TreeNode 
                key={cat.node.id} 
                node={cat.node} 
                type="category" 
                childrenNodes={cat.children}
                onAddChild={handleAddChild}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onDropSuccess={handleDropSuccess}
              />
            ))}
          </DropZoneContainer>
        )}
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">
              {modalMode === 'edit' ? `Editing ${modalType}` : activeNode ? `Adding ${modalType} to ${activeNode.name}` : `New Category`}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 pt-4">
            <div className="space-y-2">
              <Label className="font-bold text-foreground">Name <span className="text-destructive">*</span></Label>
              <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-background rounded-xl text-foreground" />
            </div>
            
            {['category', 'subcategory'].includes(modalType) && (
              <div className="space-y-2">
                <Label className="font-bold text-foreground">Slug</Label>
                <Input value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} placeholder="auto-generated if empty" className="font-mono text-sm bg-background rounded-xl text-foreground" />
              </div>
            )}

            {modalType === 'brand' && (
              <>
                <div className="space-y-2">
                  <Label className="font-bold text-foreground">Logo URL</Label>
                  <Input type="url" value={formData.logo_url} onChange={e => setFormData({...formData, logo_url: e.target.value})} placeholder="https://example.com/logo.png" className="bg-background rounded-xl text-foreground" />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-foreground">Website URL</Label>
                  <Input type="url" value={formData.website_url} onChange={e => setFormData({...formData, website_url: e.target.value})} placeholder="https://example.com" className="bg-background rounded-xl text-foreground" />
                </div>
              </>
            )}

            {modalType === 'series' && (
              <div className="space-y-2">
                <Label className="font-bold text-foreground">Release Year</Label>
                <Input type="number" value={formData.releaseYear} onChange={e => setFormData({...formData, releaseYear: e.target.value})} className="bg-background rounded-xl text-foreground" />
              </div>
            )}

            <div className="space-y-2">
              <Label className="font-bold text-foreground">Description</Label>
              <Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="bg-background rounded-xl text-foreground" />
            </div>

            <DialogFooter className="pt-6 border-t border-border mt-2">
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)} className="rounded-xl">Cancel</Button>
              <Button type="submit" disabled={isSaving} className="rounded-xl font-bold shadow-sm">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CategoryManagementPage;
