import React, { useState, useEffect, useCallback } from 'react';
import { Store, CheckCircle2, Archive, MoreHorizontal, Loader2 } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/lib/supabaseClient.js';
import { toast } from 'sonner';

// Listings use a `listing_status` enum with three values. "Enable" relists a
// card, "Archive" pulls it from the marketplace (the effective "disable"), and
// "Mark as Sold" closes it out.
const STATUS_LABELS = { active: 'Active', sold: 'Sold', archived: 'Archived' };

const StatusBadge = ({ status }) => {
  if (status === 'active') return <Badge className="bg-emerald-500/10 text-emerald-600 border-none">Active</Badge>;
  if (status === 'sold') return <Badge className="bg-brand-red/10 text-brand-red border-none">Sold</Badge>;
  return <Badge variant="secondary" className="bg-muted text-muted-foreground border-none capitalize">{STATUS_LABELS[status] || status || 'archived'}</Badge>;
};

const MarketplaceManagementPage = () => {
  const [listings, setListings] = useState([]);
  const [counts, setCounts] = useState({ active: 0, sold: 0, archived: 0 });
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, activeRes, soldRes, archivedRes] = await Promise.all([
        supabase
          .from('listings')
          .select('*, seller:profiles!seller_id(id, display_name, username)')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'sold'),
        supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'archived'),
      ]);
      if (listRes.error) throw listRes.error;
      setListings(listRes.data ?? []);
      setCounts({
        active: activeRes.count ?? 0,
        sold: soldRes.count ?? 0,
        archived: archivedRes.count ?? 0,
      });
    } catch (error) {
      toast.error('Failed to load marketplace data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Chaining `.select()` returns the affected rows. If RLS silently filters the
  // update to 0 rows (e.g. the admin write policy is missing), we surface that
  // as an error instead of a misleading "success" toast.
  const changeStatus = async (listing, newStatus) => {
    const name = listing.card_name || listing.title || 'listing';
    if (newStatus === 'archived' && !window.confirm(`Archive "${name}"? It will be removed from the marketplace.`)) return;
    setActioningId(listing.id);
    try {
      const { data, error } = await supabase
        .from('listings')
        .update({ status: newStatus })
        .eq('id', listing.id)
        .select('id, status');
      if (error) throw error;
      if (!data || data.length === 0) {
        toast.error("No changes applied — you may not have permission to edit this listing.");
        return;
      }
      toast.success(`"${name}" marked as ${STATUS_LABELS[newStatus] || newStatus}.`);
      setListings(prev => prev.map(l => (l.id === listing.id ? { ...l, status: newStatus } : l)));
      // Keep the stat cards in sync without a full refetch.
      setCounts(prev => {
        const next = { ...prev };
        if (prev[listing.status] != null) next[listing.status] = Math.max(0, prev[listing.status] - 1);
        if (next[newStatus] != null) next[newStatus] += 1;
        return next;
      });
    } catch (err) {
      toast.error(`Failed to update listing: ${err.message || 'unknown error'}`);
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={Store}
        title="Marketplace Management"
        subtitle="Oversee user listings, disputes, and marketplace health."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Active Listings</CardTitle>
            <Store className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '—' : counts.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Sold</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '—' : counts.sold}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Archived</CardTitle>
            <Archive className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '—' : counts.archived}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="p-4 border-border shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Recent Listings</h2>
        <div className="admin-table-container">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-[60px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-4">Loading...</TableCell></TableRow>
              ) : listings.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-4">No recent listings.</TableCell></TableRow>
              ) : (
                listings.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.card_name || l.title || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{l.seller?.display_name || l.seller?.username || '—'}</TableCell>
                    <TableCell>{l.price_aud != null ? `$${Number(l.price_aud).toFixed(2)}` : '—'}</TableCell>
                    <TableCell><StatusBadge status={l.status} /></TableCell>
                    <TableCell>{l.created_at ? new Date(l.created_at).toLocaleDateString() : '—'}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={actioningId === l.id}>
                            {actioningId === l.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreHorizontal className="w-4 h-4" />}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Change status</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {l.status !== 'active' && (
                            <DropdownMenuItem onClick={() => changeStatus(l, 'active')}>Enable (make active)</DropdownMenuItem>
                          )}
                          {l.status !== 'sold' && (
                            <DropdownMenuItem onClick={() => changeStatus(l, 'sold')}>Mark as Sold</DropdownMenuItem>
                          )}
                          {l.status !== 'archived' && (
                            <DropdownMenuItem onClick={() => changeStatus(l, 'archived')}>Archive (remove from marketplace)</DropdownMenuItem>
                          )}
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
    </div>
  );
};

export default MarketplaceManagementPage;
