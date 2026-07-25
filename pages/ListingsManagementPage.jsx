import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Filter, ArrowUpDown, Loader2, MoreHorizontal } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { useCategories } from '@/hooks/useCategories.js';
import { toast } from 'sonner';

// listings.price_aud is stored in whole dollars (not cents). The shared
// utils/formatCurrency helper expects cents + a currency descriptor and returns
// "" without one, so admin price columns use this plain AUD formatter instead.
const formatAud = (dollars) => `$${(Number(dollars) || 0).toFixed(2)}`;

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';

import ListingAnalyticsDashboard from '@/components/ListingAnalyticsDashboard.jsx';
import ListingDetailModal from '@/components/ListingDetailModal.jsx';
import ListingStatusModal from '@/components/ListingStatusModal.jsx';
import BulkActionsBar from '@/components/BulkActionsBar.jsx';
import { publicImageUrl } from '@/utils/imageUrl.js';

const ListingsManagementPage = () => {
  const [listings, setListings] = useState([]);
  const [allListingsForAnalytics, setAllListingsForAnalytics] = useState([]);
  const [loading, setLoading] = useState(true);

  // Resolve vault_items.category_id → category name for display.
  const { buildNameMap } = useCategories();
  const [nameMap, setNameMap] = useState({});

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('-created');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Selection & Modals
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [selectedListing, setSelectedListing] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      // Map the sort dropdown to real columns (was hardcoded created desc).
      const sortColumn = sortOrder.includes('price') ? 'price_aud' : 'created_at';
      const ascending = !sortOrder.startsWith('-');

      // listings has no display fields of its own — join the vault_item for the
      // card name / image / category.
      let query = supabase
        .from('listings')
        .select('*, vault_item:vault_items!inner(card_name, set_name, card_image, card_images, category_id, condition, grade)', { count: 'exact' })
        .range((page - 1) * 20, page * 20 - 1)
        .order(sortColumn, { ascending });

      if (searchQuery) query = query.ilike('vault_items.card_name', `%${searchQuery}%`);
      if (statusFilter === 'flagged') query = query.eq('flagged', true);
      else if (['active', 'sold', 'archived', 'pending'].includes(statusFilter)) query = query.eq('status', statusFilter);

      const { data: items, count, error } = await query;
      if (error) throw error;

      setListings(items ?? []);
      setTotalPages(Math.ceil((count ?? 0) / 20));
      setTotalItems(count ?? 0);

      if (page === 1) {
        const { data: allData } = await supabase.from('listings').select('*, vault_item:vault_items(card_name, card_image, card_images)').order('created_at', { ascending: false }).limit(200);
        setAllListingsForAnalytics(allData ?? []);
      }
    } catch (error) {
      toast.error('Failed to load listings');
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, statusFilter, sortOrder]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  useEffect(() => {
    buildNameMap().then(setNameMap).catch(() => {});
  }, [buildNameMap]);

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedItems(new Set(listings.map(l => l.id)));
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleSelectItem = (id, checked) => {
    const newSelected = new Set(selectedItems);
    if (checked) newSelected.add(id);
    else newSelected.delete(id);
    setSelectedItems(newSelected);
  };

  const handleDelete = async (listing) => {
    if (!window.confirm(`Are you sure you want to delete "${listing.vault_item?.card_name || 'this listing'}"?`)) return;
    try {
      const { error } = await supabase.from('listings').delete().eq('id', listing.id);
      if (error) throw error;
      toast.success('Listing deleted');
      fetchListings();
      if (selectedListing?.id === listing.id) setIsDetailModalOpen(false);
    } catch (err) {
      toast.error('Failed to delete listing');
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedItems.size} selected listings?`)) return;
    try {
      for (const id of selectedItems) {
        const { error } = await supabase.from('listings').delete().eq('id', id);
        if (error) throw error;
      }
      toast.success(`Deleted ${selectedItems.size} listings`);
      setSelectedItems(new Set());
      fetchListings();
    } catch (err) {
      toast.error('Bulk delete encountered errors');
    }
  };

  // Dismiss a banned-words auto-flag once an admin has reviewed the content.
  const handleClearFlag = async (listing) => {
    try {
      const { error } = await supabase.from('listings').update({ flagged: false, flag_reason: null }).eq('id', listing.id);
      if (error) throw error;
      toast.success('Flag cleared');
      fetchListings();
    } catch (err) {
      toast.error('Failed to clear flag');
    }
  };

  // Approve a listing that's awaiting review (listing_approval_required). Moving
  // it to 'active' publishes it to the marketplace.
  const handleApprove = async (listing) => {
    try {
      const { error } = await supabase.from('listings').update({ status: 'active' }).eq('id', listing.id);
      if (error) throw error;
      toast.success('Listing approved & published');
      fetchListings();
      if (selectedListing?.id === listing.id) setIsDetailModalOpen(false);
    } catch (err) {
      toast.error('Failed to approve listing');
    }
  };

  // Archive removes a listing from the marketplace without deleting it — the
  // intended way to clear out old sales. Sold/active both become archived.
  const handleArchive = async (listing) => {
    if (!window.confirm(`Archive "${listing.vault_item?.card_name || 'this listing'}"? It will be removed from the marketplace.`)) return;
    try {
      const { error } = await supabase.from('listings').update({ status: 'archived' }).eq('id', listing.id);
      if (error) throw error;
      toast.success('Listing archived');
      fetchListings();
      if (selectedListing?.id === listing.id) setIsDetailModalOpen(false);
    } catch (err) {
      toast.error('Failed to archive listing');
    }
  };

  const handleBulkArchive = async () => {
    if (!window.confirm(`Archive ${selectedItems.size} selected listings? They will be removed from the marketplace.`)) return;
    try {
      const { error } = await supabase.from('listings').update({ status: 'archived' }).in('id', Array.from(selectedItems));
      if (error) throw error;
      toast.success(`Archived ${selectedItems.size} listings`);
      setSelectedItems(new Set());
      fetchListings();
    } catch (err) {
      toast.error('Bulk archive encountered errors');
    }
  };

  const openDetailModal = (listing) => {
    setSelectedListing(listing);
    setIsDetailModalOpen(true);
  };

  const openStatusModal = (listing) => {
    setSelectedListing(listing);
    setIsStatusModalOpen(true);
  };

  return (
    <div className="text-foreground">
      <div className="space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Listings Management</h1>
            <p className="text-muted-foreground mt-1">Manage the official catalog inventory and moderation.</p>
          </div>
          <Button onClick={() => openDetailModal({})} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="w-4 h-4" />
            Add New Listing
          </Button>
        </div>

        {/* Analytics */}
        <ListingAnalyticsDashboard listings={allListingsForAnalytics} />

        {/* Toolbar */}
        <div className="admin-panel-container space-y-4">
          <div className="flex flex-col lg:flex-row gap-4 justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search by title, ID..." 
                className="pl-9"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending Approval</SelectItem>
                  <SelectItem value="flagged">Flagged</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortOrder} onValueChange={(v) => { setSortOrder(v); setPage(1); }}>
                <SelectTrigger className="w-[160px]">
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="-created">Newest First</SelectItem>
                  <SelectItem value="created">Oldest First</SelectItem>
                  <SelectItem value="-price">Price: High to Low</SelectItem>
                  <SelectItem value="price">Price: Low to High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-border overflow-hidden bg-background">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-12 text-center">
                    <Checkbox 
                      checked={listings.length > 0 && selectedItems.size === listings.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Listing Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="w-4 h-4" /></TableCell>
                      <TableCell><Skeleton className="h-10 w-[200px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[80px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[80px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[60px] ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8 rounded-full" /></TableCell>
                    </TableRow>
                  ))
                ) : listings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      No listings found matching your criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  listings.map(listing => {
                    const vi = listing.vault_item;
                    const rawImg = vi?.card_image || (Array.isArray(vi?.card_images) ? vi.card_images[0] : null);
                    const imgSrc = rawImg
                      ? (publicImageUrl(rawImg))
                      : null;
                    return (
                    <TableRow key={listing.id} className="admin-table-row">
                      <TableCell className="text-center">
                        <Checkbox
                          checked={selectedItems.has(listing.id)}
                          onCheckedChange={(checked) => handleSelectItem(listing.id, checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden shrink-0">
                            {imgSrc ? (
                              <img src={imgSrc} alt={vi?.card_name || 'Listing'} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs font-medium text-muted-foreground">Img</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{vi?.card_name || 'Untitled'}</p>
                            <p className="text-xs text-muted-foreground truncate">{vi?.set_name || ''}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">{nameMap[vi?.category_id] || '—'}</Badge>
                      </TableCell>
                      <TableCell>
                        {listing.status === 'active' ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-none">Active</Badge>
                        ) : listing.status === 'sold' ? (
                          <Badge className="bg-brand-red/10 text-brand-red border-none">Sold</Badge>
                        ) : listing.status === 'pending' ? (
                          <Badge className="bg-amber-500/10 text-amber-600 border-none">Pending Approval</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-muted text-muted-foreground border-none capitalize">{listing.status || 'archived'}</Badge>
                        )}
                        {listing.flagged && (
                          <Badge className="ml-1 bg-red-500/10 text-red-600 border-none" title={listing.flag_reason || 'Flagged'}>Flagged</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatAud(listing.price_aud)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openDetailModal(listing)}>View Details</DropdownMenuItem>
                            {listing.status === 'pending' && (
                              <DropdownMenuItem className="text-emerald-600 focus:text-emerald-600" onClick={() => handleApprove(listing)}>Approve &amp; publish</DropdownMenuItem>
                            )}
                            {listing.flagged && (
                              <DropdownMenuItem onClick={() => handleClearFlag(listing)}>Clear flag</DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => openStatusModal(listing)}>Change Status</DropdownMenuItem>
                            {listing.status !== 'archived' && (
                              <DropdownMenuItem onClick={() => handleArchive(listing)}>Archive (remove from marketplace)</DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(listing)}>
                              Delete Listing
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <span className="text-sm text-muted-foreground">
                Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, totalItems)} of {totalItems} entries
              </span>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button 
                  variant="outline" 
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ListingDetailModal 
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        listing={selectedListing}
        onUpdate={(updated) => {
          setListings(prev => prev.map(l => l.id === updated.id ? updated : l));
          setSelectedListing(updated);
          toast.success('Updated successfully');
        }}
        onDelete={handleDelete}
        onStatusChange={(l) => {
          setIsDetailModalOpen(false);
          openStatusModal(l);
        }}
      />

      <ListingStatusModal 
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        listing={selectedListing}
        onStatusUpdated={fetchListings}
      />

      <BulkActionsBar
        selectedCount={selectedItems.size}
        onBulkDelete={handleBulkDelete}
        onBulkArchive={handleBulkArchive}
        onClearSelection={() => setSelectedItems(new Set())}
      />
    </div>
  );
};

export default ListingsManagementPage;