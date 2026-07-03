import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { Factory, Plus, MoreHorizontal, Edit, Trash2, AlertCircle, Mail, Globe } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabaseClient.js';
import { toast } from 'sonner';

const EMPTY_SUPPLIER = {
  name: '',
  contact_email: '',
  phone: '',
  website_url: '',
  portal_url: '',
  ordering_method: 'email',
  ordering_instructions: '',
  supports_blind_shipping: false,
  notes: '',
  status: 'active',
};

const SupplierForm = ({ supplier, onSuccess, onCancel }) => {
  const [form, setForm] = useState(supplier ? { ...EMPTY_SUPPLIER, ...supplier } : EMPTY_SUPPLIER);
  const [saving, setSaving] = useState(false);
  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Supplier name is required');
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        contact_email: form.contact_email.trim() || null,
        phone: form.phone.trim() || null,
        website_url: form.website_url.trim() || null,
        portal_url: form.portal_url.trim() || null,
        ordering_method: form.ordering_method,
        ordering_instructions: form.ordering_instructions.trim() || null,
        supports_blind_shipping: form.supports_blind_shipping,
        notes: form.notes.trim() || null,
        status: form.status,
      };
      if (supplier?.id) {
        const { error } = await supabase.from('suppliers')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', supplier.id);
        if (error) throw error;
        toast.success('Supplier updated.');
      } else {
        const { error } = await supabase.from('suppliers').insert(payload);
        if (error) throw error;
        toast.success('Supplier added.');
      }
      onSuccess();
    } catch (err) {
      toast.error(err.message || 'Failed to save supplier.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label>Name <span className="text-destructive">*</span></Label>
          <Input required value={form.name} onChange={e => set('name', e.target.value)} className="bg-background" />
        </div>
        <div className="space-y-2">
          <Label>Order Email</Label>
          <Input type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} placeholder="orders@supplier.com.au" className="bg-background" />
        </div>
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input value={form.phone} onChange={e => set('phone', e.target.value)} className="bg-background" />
        </div>
        <div className="space-y-2">
          <Label>Website</Label>
          <Input value={form.website_url} onChange={e => set('website_url', e.target.value)} placeholder="https://" className="bg-background" />
        </div>
        <div className="space-y-2">
          <Label>Ordering Method</Label>
          <Select value={form.ordering_method} onValueChange={v => set('ordering_method', v)}>
            <SelectTrigger className="bg-background h-10 font-medium"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="portal">Portal / Website</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Ordering Portal URL</Label>
          <Input value={form.portal_url} onChange={e => set('portal_url', e.target.value)} placeholder="https://" className="bg-background" disabled={form.ordering_method !== 'portal'} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Ordering Instructions</Label>
        <Textarea value={form.ordering_instructions} onChange={e => set('ordering_instructions', e.target.value)} placeholder="Account number, minimum order, cut-off times..." className="bg-background" rows={2} />
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="bg-background" rows={2} />
      </div>

      <div className="flex items-center justify-between gap-6 flex-wrap">
        <div className="flex items-center gap-3">
          <Switch checked={form.supports_blind_shipping} onCheckedChange={v => set('supports_blind_shipping', v)} aria-label="Blind shipping" />
          <div>
            <Label className="font-semibold">Blind Shipping</Label>
            <p className="text-xs text-muted-foreground">Ships with no supplier branding in the parcel</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={form.status === 'active'} onCheckedChange={v => set('status', v ? 'active' : 'inactive')} aria-label="Active" />
          <Label className="font-semibold">{form.status === 'active' ? 'Active' : 'Inactive'}</Label>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel} disabled={saving} className="rounded-xl">Cancel</Button>}
        <Button type="submit" disabled={saving} className="font-bold rounded-xl">
          {supplier?.id ? 'Update Supplier' : 'Add Supplier'}
        </Button>
      </div>
    </form>
  );
};

const SuppliersManagementPage = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('suppliers').select('*').order('name');
      if (error) throw error;
      setSuppliers(data || []);
      setError(null);
    } catch (err) {
      setError(err.message);
      toast.error('Failed to load suppliers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this supplier? Products linked to it keep selling but lose their sourcing link.')) return;
    try {
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw error;
      toast.success('Supplier deleted.');
      setSuppliers(suppliers.filter(s => s.id !== id));
    } catch (err) {
      toast.error('Failed to delete supplier.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Helmet><title>Suppliers | Admin</title></Helmet>

      <AdminPageHeader
        icon={Factory}
        title="Suppliers"
        subtitle="Dropship suppliers for the card supplies range."
      >
        <Button variant="outline" className="gap-2 font-bold rounded-xl h-10 px-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus className="w-4 h-4" /> New Supplier
        </Button>
      </AdminPageHeader>

      <Card className="rounded-xl border border-border shadow-sm overflow-hidden bg-card">
        <div className="overflow-x-auto relative w-full">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="font-semibold text-foreground">Supplier</TableHead>
                <TableHead className="font-semibold text-foreground">Contact</TableHead>
                <TableHead className="font-semibold text-foreground">Ordering</TableHead>
                <TableHead className="font-semibold text-foreground">Blind Ship</TableHead>
                <TableHead className="font-semibold text-foreground">Status</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-40 text-center text-muted-foreground">
                    <AlertCircle className="w-8 h-8 text-destructive mb-2 mx-auto" />
                    <p>Failed to load suppliers</p>
                  </TableCell>
                </TableRow>
              ) : suppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-40 text-center text-muted-foreground">
                    <Factory className="w-8 h-8 mb-2 mx-auto opacity-40" />
                    <p>No suppliers yet. Add your first supplier to start selling supplies.</p>
                  </TableCell>
                </TableRow>
              ) : (
                suppliers.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-bold text-foreground">{s.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        {s.contact_email ? (<><Mail className="w-3.5 h-3.5" /> {s.contact_email}</>) :
                          s.website_url ? (<><Globe className="w-3.5 h-3.5" /> {s.website_url}</>) : '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground capitalize">{s.ordering_method}</TableCell>
                    <TableCell>{s.supports_blind_shipping ? '✓' : '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`bg-background capitalize ${s.status === 'active' ? 'text-emerald-600 border-emerald-500/30' : 'text-muted-foreground'}`}>
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem onClick={() => { setEditing(s); setModalOpen(true); }} className="cursor-pointer gap-2 font-medium">
                            <Edit className="w-4 h-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(s.id)} className="cursor-pointer gap-2 text-destructive focus:bg-destructive/10 font-medium">
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

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background rounded-2xl border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{editing ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle>
          </DialogHeader>
          <SupplierForm
            supplier={editing}
            onSuccess={() => { setModalOpen(false); fetchSuppliers(); }}
            onCancel={() => setModalOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuppliersManagementPage;
