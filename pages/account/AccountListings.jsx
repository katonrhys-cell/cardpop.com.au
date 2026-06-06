import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { List, Plus, RefreshCw, AlertCircle, Trash2, Edit, PackageOpen, ShoppingCart, ArrowRightLeft, Layers, Tag } from 'lucide-react';
import Breadcrumb from '@/components/Breadcrumb.jsx';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  'For Sale':        { label: 'For Sale',        className: 'bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:text-emerald-400', icon: ShoppingCart },
  'active':          { label: 'Active',           className: 'bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:text-emerald-400', icon: ShoppingCart },
  'For Trade':       { label: 'For Trade',        className: 'bg-blue-500/10 text-blue-700 border-blue-300 dark:text-blue-400', icon: ArrowRightLeft },
  'For Sale & Trade':{ label: 'Sale & Trade',     className: 'bg-violet-500/10 text-violet-700 border-violet-300 dark:text-violet-400', icon: Layers },
  'sold':            { label: 'Sold',             className: 'bg-muted text-muted-foreground border-border', icon: ShoppingCart },
  'Sold':            { label: 'Sold',             className: 'bg-muted text-muted-foreground border-border', icon: ShoppingCart },
};

const getStatusConfig = (status) => STATUS_CONFIG[status] ?? { label: status ?? 'Unknown', className: 'bg-muted text-muted-foreground border-border', icon: List };

const AccountListings = () => {
  const { currentUser } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [editListing, setEditListing] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [acceptsOffers, setAcceptsOffers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRef = useRef(null);

  useEffect(() => {
    if (!currentUser?.id) { setLoading(false); return; }
    let cancelled = false;
    const uid = currentUser.id;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('listings')
          .select('*')
          .eq('seller_id', uid)
          .order('created_at', { ascending: false })
          .limit(100);

        if (fetchError) throw fetchError;
        if (!cancelled) setListings(data ?? []);
      } catch (err) {
        console.error('Failed to fetch listings:', err);
        if (!cancelled) setError(err.message || 'Failed to load listings.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRef.current = run;
    run();
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  const handleUpdateStatus = async () => {
    if (!editListing || !newStatus) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('listings')
        .update({ status: newStatus, accepts_offers: acceptsOffers })
        .eq('id', editListing.id);
      if (error) throw error;
      toast.success('Listing status updated');
      setEditListing(null);
      fetchRef.current?.();
    } catch (err) {
      toast.error(err.message || 'Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('listings')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('Listing removed');
      setDeleteTarget(null);
      fetchRef.current?.();
    } catch (err) {
      toast.error(err.message || 'Failed to delete listing');
    } finally {
      setDeleting(false);
    }
  };

  const openEdit = (listing) => {
    setEditListing(listing);
    setNewStatus(listing.status ?? 'For Sale');
    setAcceptsOffers(listing.accepts_offers ?? false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Helmet>
        <title>My Listings | CardPop</title>
      </Helmet>

      <Breadcrumb items={[{ label: 'Account', path: '/account' }, { label: 'Listings' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading mb-2">My Listings</h1>
          <p className="text-muted-foreground">Manage your active items for sale or trade.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => fetchRef.current?.()} disabled={loading} className="rounded-xl h-10 px-4">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button asChild className="rounded-xl h-10 px-4 font-bold">
            <Link to="/vault/add">
              <Plus className="w-4 h-4 mr-2" /> Add Card
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Failed to load listings</p>
            <p className="text-sm opacity-90">{error}</p>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-10 w-1/3" />
                <Skeleton className="h-10 w-1/5" />
                <Skeleton className="h-10 w-1/5" />
                <Skeleton className="h-10 w-1/5" />
              </div>
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="p-12 text-center">
            <PackageOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-bold mb-2">No listings yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              Add cards to your vault and list them for sale or trade on the marketplace.
            </p>
            <Button asChild className="rounded-xl font-bold">
              <Link to="/vault/add">
                <Plus className="w-4 h-4 mr-2" /> Add Your First Card
              </Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-6">Card / Item</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Listed</TableHead>
                  <TableHead className="px-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listings.map((listing) => {
                  const cfg = getStatusConfig(listing.status);
                  const StatusIcon = cfg.icon;
                  return (
                    <TableRow key={listing.id}>
                      <TableCell className="font-bold px-6 max-w-[220px] truncate">
                        {listing.card_name || listing.title || '—'}
                        {listing.set_name && (
                          <p className="text-xs text-muted-foreground font-normal mt-0.5">{listing.set_name}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className={`font-bold text-xs w-fit ${cfg.className}`}>
                            <StatusIcon className="w-3 h-3 mr-1.5 inline-block" />
                            {cfg.label}
                          </Badge>
                          {listing.accepts_offers && (
                            <Badge variant="outline" className="font-bold text-xs w-fit bg-primary/5 text-primary border-primary/30">
                              <Tag className="w-3 h-3 mr-1 inline-block" /> Offers On
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums font-medium">
                        {listing.price_aud != null ? `$${Number(listing.price_aud).toFixed(2)}` : '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm capitalize">
                        {listing.condition?.replace(/_/g, ' ') || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm tabular-nums">
                        {listing.created_at ? new Date(listing.created_at).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell className="text-right px-6">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(listing)} className="h-8 rounded-lg text-xs font-medium">
                            <Edit className="w-3.5 h-3.5 mr-1.5" /> Edit
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(listing)} className="h-8 rounded-lg text-xs font-medium text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Remove
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Edit Status Modal */}
      <Dialog open={!!editListing} onOpenChange={() => setEditListing(null)}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Update Listing Status</DialogTitle>
            <DialogDescription>
              Change visibility for <span className="font-bold text-foreground">{editListing?.card_name || editListing?.title}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger className="h-12 rounded-xl bg-background">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="For Sale">For Sale</SelectItem>
                <SelectItem value="For Trade">For Trade</SelectItem>
                <SelectItem value="For Sale & Trade">For Sale &amp; Trade</SelectItem>
                <SelectItem value="Sold">Sold (mark as completed)</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl border border-border">
              <div className="flex items-start gap-3">
                <Tag className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <Label className="font-bold text-sm cursor-pointer" htmlFor="accepts-offers-toggle">Accept Offers</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Allow buyers to make cash offers below your asking price</p>
                </div>
              </div>
              <Switch
                id="accepts-offers-toggle"
                checked={acceptsOffers}
                onCheckedChange={setAcceptsOffers}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditListing(null)} disabled={saving} className="rounded-xl">Cancel</Button>
            <Button onClick={handleUpdateStatus} disabled={saving} className="rounded-xl font-bold">
              {saving ? 'Saving...' : 'Update Status'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Modal */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Remove Listing</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <span className="font-bold text-foreground">{deleteTarget?.card_name || deleteTarget?.title}</span> from your listings? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting} className="rounded-xl">Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="rounded-xl font-bold">
              {deleting ? 'Removing...' : 'Yes, Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AccountListings;
