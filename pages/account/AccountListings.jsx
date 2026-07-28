import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { List, Plus, RefreshCw, AlertCircle, Trash2, Edit, PackageOpen, ShoppingCart, ArrowRightLeft, Layers, Tag, HandCoins } from 'lucide-react';
import AccountPageShell from '@/components/account/AccountPageShell.jsx';
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
  'Expression of Interest': { label: 'Expression of Interest', className: 'bg-sky-500/10 text-sky-700 border-sky-300 dark:text-sky-400', icon: HandCoins },
  'sold':            { label: 'Sold',             className: 'bg-muted text-muted-foreground border-border', icon: ShoppingCart },
  'Sold':            { label: 'Sold',             className: 'bg-muted text-muted-foreground border-border', icon: ShoppingCart },
  'archived':        { label: 'Archived',         className: 'bg-muted text-muted-foreground border-border', icon: PackageOpen },
};

const getStatusConfig = (status) => STATUS_CONFIG[status] ?? { label: status ?? 'Unknown', className: 'bg-muted text-muted-foreground border-border', icon: List };

// Lifecycle state — the actual `listing_status` enum (active | sold | archived).
const STATUS_OPTIONS = [
  { value: 'active',   label: 'Active — visible in the marketplace' },
  { value: 'sold',     label: 'Sold — mark as completed' },
  { value: 'archived', label: 'Archived — hidden from the marketplace' },
];
const VALID_STATUSES = STATUS_OPTIONS.map((o) => o.value);

// Sale mode maps to (listing_type, accepts_trade). "For Sale & Trade" stays a
// fixed-price listing that also accepts trade offers — see migration
// 20260630000001_add_accepts_trade_to_listings.
const SALE_MODES = {
  'For Sale':         { listing_type: 'fixed', accepts_trade: false },
  'For Trade':        { listing_type: 'trade', accepts_trade: true },
  'For Sale & Trade': { listing_type: 'fixed', accepts_trade: true },
};
const saleModeOf = (l) => {
  if (l?.listing_type === 'trade') return 'For Trade';
  if (l?.accepts_trade) return 'For Sale & Trade';
  return 'For Sale';
};
// Only plain fixed/trade listings can flip between sale and trade here; auctions,
// vault items and expressions of interest keep their type untouched.
const SALE_MODE_TYPES = new Set(['fixed', 'trade']);
const saleModeEditable = (l) => !l?.listing_type || SALE_MODE_TYPES.has(l.listing_type);

// Listings created from the vault only store a vault_item_id reference — the
// card's name/set/grade live on the joined vault_items row, so read the
// listing's own columns first and fall back to the vault item.
const getCardDetails = (listing) => {
  const item = listing?.vault_item ?? {};
  return {
    name:           listing?.card_name ?? listing?.title ?? item.card_name ?? null,
    setName:        listing?.set_name ?? item.set_name ?? null,
    cardNumber:     listing?.card_number ?? item.card_number ?? null,
    gradingCompany: listing?.grading_company ?? item.grading_company ?? null,
    grade:          listing?.grade ?? item.grade ?? null,
    condition:      listing?.condition ?? item.condition ?? null,
  };
};

const AccountListings = () => {
  const { currentUser } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [editListing, setEditListing] = useState(null);
  const [newStatus, setNewStatus] = useState('active');
  const [saleMode, setSaleMode] = useState('For Sale');
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
          .select('*, vault_item:vault_items(card_name, set_name, card_number, grading_company, grade, condition)')
          .eq('seller_id', uid)
          .order('created_at', { ascending: false })
          .limit(100);

        if (fetchError) throw fetchError;
        if (!cancelled) setListings(data ?? []);
      } catch (err) {
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
      // status is the lifecycle enum; sale mode (only for fixed/trade listings)
      // maps to the listing_type enum + accepts_trade flag. Both are written as
      // valid values — the previous dialog wrote UI strings ("For Sale") into
      // the status enum, so every save failed.
      const payload = { status: newStatus, accepts_offers: acceptsOffers };
      if (saleModeEditable(editListing)) {
        const mode = SALE_MODES[saleMode];
        if (mode) {
          payload.listing_type = mode.listing_type;
          payload.accepts_trade = mode.accepts_trade;
        }
      }
      const { error } = await supabase
        .from('listings')
        .update(payload)
        .eq('id', editListing.id)
        .eq('seller_id', currentUser.id);
      if (error) throw error;
      toast.success('Listing updated');
      setEditListing(null);
      fetchRef.current?.();
    } catch (err) {
      toast.error(err.message || 'Failed to update listing');
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
        .eq('id', deleteTarget.id)
        .eq('seller_id', currentUser.id);
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
    setNewStatus(VALID_STATUSES.includes(listing.status) ? listing.status : 'active');
    setSaleMode(saleModeOf(listing));
    setAcceptsOffers(listing.accepts_offers ?? false);
  };

  return (
    <AccountPageShell
      documentTitle="My Listings | CardPop"
      breadcrumb={[{ label: 'Account', path: '/account' }, { label: 'Listings' }]}
      title="My Listings"
      description="Manage your active items for sale or trade."
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => fetchRef.current?.()} disabled={loading} className="rounded-xl shadow-sm h-10 px-4 font-bold">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button asChild size="sm" className="rounded-xl shadow-sm h-10 px-4 font-bold">
            <Link to="/vault/add">
              <Plus className="w-4 h-4 mr-2" /> Add Card
            </Link>
          </Button>
        </>
      }
    >
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
                  <TableHead>Grade</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Listed</TableHead>
                  <TableHead className="px-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listings.map((listing) => {
                  const cfg = getStatusConfig(listing.status);
                  const StatusIcon = cfg.icon;
                  const card = getCardDetails(listing);
                  return (
                    <TableRow key={listing.id}>
                      <TableCell className="font-bold px-6">
                        <div className="max-w-[240px]">
                          <p className="truncate">{card.name || '—'}</p>
                          {card.setName && (
                            <p className="text-xs text-muted-foreground font-normal mt-0.5">{card.setName}</p>
                          )}
                          {card.cardNumber && (
                            <p className="text-xs text-muted-foreground font-normal mt-0.5">#{card.cardNumber}</p>
                          )}
                        </div>
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
                      <TableCell className="text-sm">
                        {card.gradingCompany && card.gradingCompany !== 'raw' ? (
                          <Badge variant="secondary" className="text-[11px] font-bold bg-muted/50 text-muted-foreground uppercase">
                            {card.gradingCompany} {card.grade || ''}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground capitalize">{card.condition?.replace(/_/g, ' ') || '—'}</span>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums font-medium">
                        {listing.price_aud != null
                          ? `$${Number(listing.price_aud).toFixed(2)}`
                          : (listing.price_min_aud != null && listing.price_max_aud != null)
                            ? `$${Number(listing.price_min_aud).toFixed(2)} – $${Number(listing.price_max_aud).toFixed(2)}`
                            : '—'}
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
            <DialogTitle className="font-serif text-xl">Update Listing</DialogTitle>
            <DialogDescription>
              Change availability and sale options for <span className="font-bold text-foreground">{getCardDetails(editListing).name || 'this listing'}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-bold">Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="h-12 rounded-xl bg-background">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editListing && saleModeEditable(editListing) && (
              <div className="space-y-2">
                <Label className="text-sm font-bold">Sale mode</Label>
                <Select value={saleMode} onValueChange={setSaleMode}>
                  <SelectTrigger className="h-12 rounded-xl bg-background">
                    <SelectValue placeholder="Select sale mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="For Sale">For Sale</SelectItem>
                    <SelectItem value="For Trade">For Trade</SelectItem>
                    <SelectItem value="For Sale & Trade">For Sale &amp; Trade</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
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
              Are you sure you want to remove <span className="font-bold text-foreground">{getCardDetails(deleteTarget).name || 'this listing'}</span> from your listings? This cannot be undone.
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
    </AccountPageShell>
  );
};

export default AccountListings;
