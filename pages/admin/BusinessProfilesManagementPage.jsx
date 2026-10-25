import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { Store, Plus, Search, MapPin, CheckCircle2, XCircle, Ban, Pencil, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import apiServerClient from '@/lib/apiServerClient.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const AU_STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

const STATUS_CONFIG = {
  pending_review: { label: 'Pending Review', cls: 'bg-amber-500/10 text-amber-700 border-amber-200' },
  approved:       { label: 'Approved',       cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-200' },
  suspended:      { label: 'Suspended',      cls: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const emptyForm = {
  business_name: '', user_email: '', tagline: '', about: '', business_type: '',
  website_url: '', phone: '', email: '', logo_url: '',
  has_physical_store: false, store_address: '', store_suburb: '', store_state: '', store_postcode: '',
};

const BusinessProfilesManagementPage = () => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = create, object = edit
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const fetchRef = useRef(null);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiServerClient.fetch('/admin/business-profiles');
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to load business profiles.');
      const data = await res.json();
      setProfiles(data.businessProfiles || []);
    } catch (err) {
      setError(err.message || 'Failed to load business profiles.');
    } finally {
      setLoading(false);
    }
  }, []);
  fetchRef.current = fetchProfiles;

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const openCreate = () => { setEditing(null); setFormData(emptyForm); setModalOpen(true); };
  const openEdit = (p) => {
    setEditing(p);
    setFormData({
      business_name: p.business_name || '', user_email: '', tagline: p.tagline || '', about: p.about || '',
      business_type: p.business_type || '', website_url: p.website_url || '', phone: p.phone || '',
      email: p.email || '', logo_url: p.logo_url || '', has_physical_store: p.has_physical_store || false,
      store_address: p.store_address || '', store_suburb: p.store_suburb || '',
      store_state: p.store_state || '', store_postcode: p.store_postcode || '',
    });
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditing(null); };

  const set = (key, val) => setFormData(f => ({ ...f, [key]: val }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.business_name.trim()) { toast.error('Business name is required.'); return; }
    if (!editing && !formData.user_email.trim()) { toast.error('An account email is required to create a storefront.'); return; }

    setSaving(true);
    try {
      const { user_email, ...fields } = formData;
      const payload = editing ? fields : { ...fields, user_email: user_email.trim() };
      const url = editing ? `/admin/business-profiles/${editing.id}` : '/admin/business-profiles';
      const res = await apiServerClient.fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to save.');
      toast.success(editing ? 'Business profile updated.' : 'Business profile created.');
      closeModal();
      fetchRef.current?.();
    } catch (err) {
      toast.error(err.message || 'Failed to save business profile.');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (id, storefront_status, rejection_reason) => {
    try {
      const res = await apiServerClient.fetch(`/admin/business-profiles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storefront_status, ...(rejection_reason ? { rejection_reason } : {}) }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to update status.');
      toast.success(`Storefront ${storefront_status === 'approved' ? 'approved' : storefront_status}.`);
      fetchRef.current?.();
    } catch (err) {
      toast.error(err.message || 'Failed to update status.');
    }
  };

  const filtered = profiles.filter(p => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (p.business_name || '').toLowerCase().includes(q) || (p.store_suburb || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-8">
      <Helmet><title>Business Profiles | Admin</title></Helmet>

      <AdminPageHeader icon={Store} title="Business Profiles" subtitle="Curated physical retail locations shown on the Retailers directory and Community Map.">
        <Button onClick={openCreate} className="rounded-xl font-bold gap-1.5">
          <Plus className="w-4 h-4" /> Add Storefront
        </Button>
      </AdminPageHeader>

      <Card className="shadow-sm">
        <div className="p-4 border-b border-border bg-muted/20">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by name or suburb…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Store className="w-12 h-12 text-destructive mb-4 opacity-40" />
            <p className="font-bold text-lg mb-2">Couldn't load business profiles</p>
            <p className="text-sm text-muted-foreground mb-6">{error}</p>
            <Button onClick={fetchProfiles} variant="outline" className="rounded-xl font-bold">Try again</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Store className="w-12 h-12 text-muted-foreground mb-4 opacity-40" />
            <p className="font-bold text-lg mb-2">No business profiles yet</p>
            <p className="text-sm text-muted-foreground">Add one to get it listed on the Retailers directory and map.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs font-bold uppercase tracking-wider">Business</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider">Location</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(p => {
                const cfg = STATUS_CONFIG[p.storefront_status] || STATUS_CONFIG.pending_review;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="py-4">
                      <p className="font-semibold">{p.business_name}</p>
                      {p.business_type && <p className="text-xs text-muted-foreground">{p.business_type}</p>}
                      {p.website_url && (
                        <a href={p.website_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-0.5">
                          Website <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="py-4 text-sm text-muted-foreground">
                      {p.has_physical_store && (p.store_suburb || p.store_state) ? (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          {[p.store_suburb, p.store_state].filter(Boolean).join(', ')}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">Online only</span>
                      )}
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge variant="outline" className={cfg.cls}>{cfg.label}</Badge>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {p.storefront_status !== 'approved' && (
                          <Button size="icon" variant="ghost" title="Approve" className="h-8 w-8 text-emerald-600 hover:bg-emerald-500/10"
                            onClick={() => setStatus(p.id, 'approved')}>
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                        )}
                        {p.storefront_status !== 'suspended' && (
                          <Button size="icon" variant="ghost" title="Suspend" className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => setStatus(p.id, 'suspended', 'Suspended by admin')}>
                            <Ban className="w-4 h-4" />
                          </Button>
                        )}
                        {p.storefront_status === 'pending_review' && (
                          <Button size="icon" variant="ghost" title="Reject" className="h-8 w-8 text-muted-foreground hover:bg-muted"
                            onClick={() => setStatus(p.id, 'suspended', 'Rejected by admin')}>
                            <XCircle className="w-4 h-4" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" title="Edit" className="h-8 w-8" onClick={() => openEdit(p)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={modalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Storefront' : 'Add Storefront'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Update this business’s details and store location.'
                : 'Link a storefront to an existing CardPop account by email — its listings stay curated on that account.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            {!editing && (
              <div className="space-y-1.5">
                <Label htmlFor="user_email">Account Email *</Label>
                <Input id="user_email" type="email" value={formData.user_email}
                  onChange={e => set('user_email', e.target.value)} placeholder="seller@example.com" required />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="business_name">Business Name *</Label>
              <Input id="business_name" value={formData.business_name}
                onChange={e => set('business_name', e.target.value)} placeholder="e.g. Parallel House AU" required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="business_type">Type</Label>
                <Input id="business_type" value={formData.business_type}
                  onChange={e => set('business_type', e.target.value)} placeholder="e.g. Hobby Store" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="website_url">Website</Label>
                <Input id="website_url" type="url" value={formData.website_url}
                  onChange={e => set('website_url', e.target.value)} placeholder="https://…" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tagline">Tagline</Label>
              <Input id="tagline" value={formData.tagline}
                onChange={e => set('tagline', e.target.value)} maxLength={160} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="about">About</Label>
              <Textarea id="about" value={formData.about} onChange={e => set('about', e.target.value)}
                className="min-h-[80px] resize-none" maxLength={2000} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="logo_url">Logo URL</Label>
              <Input id="logo_url" type="url" value={formData.logo_url}
                onChange={e => set('logo_url', e.target.value)} placeholder="https://…" />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div>
                <p className="font-semibold text-sm">Has a physical store</p>
                <p className="text-xs text-muted-foreground">Shown on the Community Map when set.</p>
              </div>
              <Switch checked={formData.has_physical_store} onCheckedChange={v => set('has_physical_store', v)} />
            </div>

            {formData.has_physical_store && (
              <div className="space-y-3 p-3 rounded-xl bg-muted/30 border border-border">
                <div className="space-y-1.5">
                  <Label htmlFor="store_address">Street Address</Label>
                  <Input id="store_address" value={formData.store_address}
                    onChange={e => set('store_address', e.target.value)} placeholder="123 Example St" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5 col-span-1">
                    <Label htmlFor="store_suburb">Suburb</Label>
                    <Input id="store_suburb" value={formData.store_suburb}
                      onChange={e => set('store_suburb', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="store_state">State</Label>
                    <Select value={formData.store_state} onValueChange={v => set('store_state', v)}>
                      <SelectTrigger id="store_state"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {AU_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="store_postcode">Postcode</Label>
                    <Input id="store_postcode" value={formData.store_postcode}
                      onChange={e => set('store_postcode', e.target.value)} maxLength={4} />
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
              <Button type="submit" disabled={saving} className="font-bold">
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Storefront'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BusinessProfilesManagementPage;
