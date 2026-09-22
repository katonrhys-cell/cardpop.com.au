
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Search, Plus, Filter, MoreHorizontal, Edit, Trash2, AlertCircle, RefreshCcw, Package, ChevronLeft, BarChart3 } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabaseClient.js';
import { toast } from 'sonner';
import ShopProductForm from '@/components/ShopProductForm.jsx';

const ProductManagementPage = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const isMounted = useRef(true);

  const fetchProducts = async () => {
    if (!isMounted.current) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('shop_products').select('*').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      if (isMounted.current) setProducts(data ?? []);
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

  const filteredProducts = products.filter(p =>
    p.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: products.length,
    active: products.filter(p => p.status === 'active').length,
    draft: products.filter(p => p.status === 'draft').length,
    archived: products.filter(p => p.status === 'archived').length
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Helmet><title>Official Shop Management | Admin</title></Helmet>

      <AdminPageHeader
        icon={Package}
        title="Shop Products"
        subtitle="Manage official catalog and inventory."
      >
        <Button variant="outline" className="gap-2 font-bold rounded-xl h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={() => { setEditingProduct(null); setIsAddModalOpen(true); }}>
          <Plus className="w-4 h-4" /> New Product
        </Button>
      </AdminPageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-5 rounded-2xl bg-card border border-border shadow-sm flex items-center gap-4">
          <div className="p-3 bg-primary/10 text-primary rounded-xl"><Package className="w-6 h-6" /></div>
          <div><p className="text-sm font-bold text-muted-foreground uppercase">Total Products</p><p className="text-2xl font-bold">{stats.total}</p></div>
        </Card>
        <Card className="p-5 rounded-2xl bg-card border border-border shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl"><BarChart3 className="w-6 h-6" /></div>
          <div><p className="text-sm font-bold text-muted-foreground uppercase">Active</p><p className="text-2xl font-bold">{stats.active}</p></div>
        </Card>
        <Card className="p-5 rounded-2xl bg-card border border-border shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl"><BarChart3 className="w-6 h-6" /></div>
          <div><p className="text-sm font-bold text-muted-foreground uppercase">Draft</p><p className="text-2xl font-bold">{stats.draft}</p></div>
        </Card>
        <Card className="p-5 rounded-2xl bg-card border border-border shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl"><BarChart3 className="w-6 h-6" /></div>
          <div><p className="text-sm font-bold text-muted-foreground uppercase">Archived</p><p className="text-2xl font-bold">{stats.archived}</p></div>
        </Card>
      </div>

      <Card className="rounded-xl border border-border shadow-sm overflow-hidden bg-card">
        <div className="p-4 border-b border-border bg-muted/20 flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              name="admin-product-search"
              aria-label="Search products"
              placeholder="Search by name, SKU or category..."
              className="pl-9 h-10 rounded-xl bg-background border-border text-foreground"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto relative w-full">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="font-semibold text-foreground">Product Name</TableHead>
                <TableHead className="font-semibold text-foreground">SKU</TableHead>
                <TableHead className="font-semibold text-foreground">Category</TableHead>
                <TableHead className="font-semibold text-foreground">Price</TableHead>
                <TableHead className="font-semibold text-foreground">RRP</TableHead>
                <TableHead className="font-semibold text-foreground">Status</TableHead>
                <TableHead className="font-semibold text-foreground">Stock</TableHead>
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
                    <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-48 text-center text-muted-foreground">
                    <AlertCircle className="w-10 h-10 text-destructive mb-3 mx-auto" />
                    <p>Failed to load products</p>
                  </TableCell>
                </TableRow>
              ) : filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-48 text-center text-muted-foreground">
                    <Package className="w-10 h-10 mb-3 mx-auto opacity-40" />
                    <p>No products found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-bold text-foreground">{product.title}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{product.sku || <span className="text-destructive">missing</span>}</TableCell>
                    <TableCell className="text-muted-foreground">{product.category || '-'}</TableCell>
                    <TableCell className="tabular-nums">${Number(product.price_aud ?? 0).toFixed(2)}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {product.retail_price_aud != null ? `$${Number(product.retail_price_aud).toFixed(2)}` : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`bg-background capitalize ${product.status === 'active' ? 'text-emerald-600 border-emerald-500/30' : product.status === 'draft' ? 'text-blue-600 border-blue-500/30' : 'text-muted-foreground'}`}>
                        {product.status}
                      </Badge>
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
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

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

export default ProductManagementPage;
