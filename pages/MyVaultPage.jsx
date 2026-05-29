
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { 
  Plus, ShieldCheck, AlertCircle, MoreHorizontal, Edit, 
  Trash2, ImageOff, Lock, ShoppingCart, ArrowRightLeft, Layers, X, Eye, EyeOff
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import VaultProductForm from '@/components/VaultProductForm.jsx';
import VaultListingModal from '@/components/VaultListingModal.jsx';

const getStatusBadge = (listingType) => {
  switch (listingType) {
    case 'Private': return { className: 'bg-muted text-muted-foreground', icon: Lock };
    case 'For Sale': return { className: 'bg-blue-500/10 text-blue-600', icon: ShoppingCart };
    case 'For Trade': return { className: 'bg-purple-500/10 text-purple-600', icon: ArrowRightLeft };
    case 'For Sale & Trade': return { className: 'bg-amber-500/10 text-amber-600', icon: Layers };
    default: return { className: 'bg-muted text-muted-foreground', icon: Lock };
  }
};

const MyVaultPage = () => {
  const { currentUser } = useAuth();
  
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusCard, setStatusCard] = useState(null);
  
  // Independent Filters
  const [filterCat, setFilterCat] = useState('');
  const [filterSub, setFilterSub] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterSeries, setFilterSeries] = useState('');
  
  // Filter Options Data
  const [catOpts, setCatOpts] = useState([]);
  const [subOpts, setSubOpts] = useState([]);
  const [brandOpts, setBrandOpts] = useState([]);
  const [seriesOpts, setSeriesOpts] = useState([]);

  const isMounted = useRef(true);

  // Load all filter options independently
  // categories, subcategories, brands, series no longer exist — return empty arrays
  useEffect(() => {
    if (isMounted.current) {
      setCatOpts([]);
      setSubOpts([]);
      setBrandOpts([]);
      setSeriesOpts([]);
    }
  }, []);

  const fetchVault = useCallback(async () => {
    if (!currentUser?.id) return;
    if (isMounted.current) setLoading(true);

    try {
      let query = supabase
        .from('vault_items')
        .select('*')
        .eq('owner_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (filterCat) query = query.eq('category_id', filterCat);
      if (filterSub) query = query.eq('subcategory_id', filterSub);
      if (filterBrand) query = query.eq('brand_id', filterBrand);
      if (filterSeries) query = query.eq('series_id', filterSeries);

      const { data, error: fetchError } = await query;

      if (isMounted.current) {
        if (fetchError) throw fetchError;
        setCards(data || []);
        setError(null);
      }
    } catch (err) {
      console.error("Failed to fetch vault:", err);
      if (isMounted.current) setError(err.message || 'Failed to load vault. Please try again.');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [currentUser, filterCat, filterSub, filterBrand, filterSeries]);

  useEffect(() => {
    isMounted.current = true;
    fetchVault();
    return () => { isMounted.current = false; };
  }, [fetchVault]);

  const clearFilters = () => {
    setFilterCat('');
    setFilterSub('');
    setFilterBrand('');
    setFilterSeries('');
  };

  const handleDelete = async (id) => {
    if(!window.confirm("Delete this card from your vault?")) return;
    try {
      await supabase.from('vault_items').delete().eq('id', id);
      toast.success("Card deleted successfully");
      fetchVault();
    } catch (e) {
      toast.error(e.message || "Failed to delete card");
    }
  };

  const handleEditClick = (card) => {
    setEditingCard(card);
    setIsFormOpen(true);
  };

  const renderCard = (card) => {
    let imageUrl = null;
    if (card.images && card.images.length > 0) {
      const img = card.images[0];
      imageUrl = img.startsWith('http') ? img : supabase.storage.from('vault-images').getPublicUrl(img).data.publicUrl;
    }

    const badgeConfig = getStatusBadge(card.listing_type);
    const StatusIcon = badgeConfig.icon;

    return (
      <div key={card.id} className="group bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:border-primary/40 transition-all duration-300 flex flex-col h-full relative">
        <div className="absolute top-3 right-3 z-20">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full bg-background/90 backdrop-blur-md hover:bg-background shadow-sm border border-border/50">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl w-48">
              <DropdownMenuItem onClick={() => { setStatusCard(card); setIsStatusModalOpen(true); }} className="cursor-pointer gap-2 font-medium">
                <Layers className="w-4 h-4 text-primary" /> Manage Listing
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleEditClick(card)} className="cursor-pointer gap-2 font-medium">
                <Edit className="w-4 h-4" /> Edit Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDelete(card.id)} className="cursor-pointer gap-2 text-destructive focus:text-destructive focus:bg-destructive/10 font-medium">
                <Trash2 className="w-4 h-4" /> Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="aspect-[4/5] bg-muted/40 relative flex items-center justify-center border-b border-border/50 p-4">
          {imageUrl ? (
            <img src={imageUrl} alt={card.name} className="object-contain w-full h-full group-hover:scale-105 transition-transform duration-500" loading="lazy" />
          ) : (
            <div className="flex flex-col items-center text-muted-foreground opacity-50">
              <ImageOff className="w-10 h-10 mb-2" />
              <span className="text-[10px] font-bold uppercase tracking-wider">No Image</span>
            </div>
          )}
          <div className="absolute top-3 left-3 z-10 pointer-events-none flex flex-col gap-1.5 items-start">
            <Badge className={`shadow-sm font-bold tracking-tight ${badgeConfig.className}`}>
              <StatusIcon className="w-3 h-3 mr-1.5" />
              {card.listing_type || 'Private'}
            </Badge>
            {card.is_public ? (
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 shadow-sm font-bold border-emerald-500/20">
                <Eye className="w-3 h-3 mr-1.5" /> Public
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm text-muted-foreground shadow-sm font-bold border-border/50">
                <EyeOff className="w-3 h-3 mr-1.5" /> Private
              </Badge>
            )}
          </div>
        </div>
        
        <div className="p-4 flex flex-col flex-1">
          <h3 className="font-bold text-base line-clamp-2 mb-2 leading-tight">{card.name}</h3>
          
          <div className="flex flex-wrap gap-1.5 mb-3">
            {card.category && <Badge variant="secondary" className="text-[10px] font-medium bg-muted/50 text-muted-foreground">Cat: {card.category}</Badge>}
            {card.subcategory && <Badge variant="secondary" className="text-[10px] font-medium bg-muted/50 text-muted-foreground">Sub: {card.subcategory}</Badge>}
            {card.brand && <Badge variant="secondary" className="text-[10px] font-medium bg-muted/50 text-muted-foreground">Brand: {card.brand}</Badge>}
            {card.series && <Badge variant="secondary" className="text-[10px] font-medium bg-muted/50 text-muted-foreground">Series: {card.series}</Badge>}
          </div>
          
          <div className="mt-auto pt-3 border-t border-border flex items-end justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Est. Value</span>
              <span className="font-extrabold text-lg tabular-nums text-foreground">
                ${(card.price || 0).toFixed(2)}
              </span>
            </div>
            {card.gradeScore && (
              <Badge variant="secondary" className="bg-muted text-foreground font-bold">
                {card.gradingService || 'Grade'} {card.gradeScore}
              </Badge>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col font-sans w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Helmet><title>My Digital Vault | CardPop</title></Helmet>
      
      <div className="mb-8">
        <h1 className="font-serif text-4xl md:text-5xl font-extrabold mb-4 text-foreground tracking-tight">My Digital Vault</h1>
        <p className="text-lg text-muted-foreground max-w-2xl text-balance">
          Manage your personal collection securely. Control visibility and list items on the community marketplace.
        </p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 mb-8 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
        <div className="flex-1 z-10 flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground mb-1">Add to Your Vault</h2>
            <p className="text-sm text-muted-foreground">Digitize your collection to track values and easily convert to marketplace listings.</p>
          </div>
        </div>
        <Button onClick={() => { setEditingCard(null); setIsFormOpen(true); }} className="w-full sm:w-auto rounded-xl font-bold h-12 px-6 shadow-md transition-transform active:scale-[0.98]">
          <Plus className="w-5 h-5 mr-2" /> Add New Card
        </Button>
      </div>

      {/* Independent Vault Filtering */}
      <div className="bg-muted/30 border border-border p-4 rounded-2xl mb-8 flex flex-wrap items-center gap-3">
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-[180px] bg-background border-border rounded-xl font-medium"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>{catOpts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        
        <Select value={filterSub} onValueChange={setFilterSub}>
          <SelectTrigger className="w-[180px] bg-background border-border rounded-xl font-medium"><SelectValue placeholder="All Subcategories" /></SelectTrigger>
          <SelectContent>{subOpts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>

        <Select value={filterBrand} onValueChange={setFilterBrand}>
          <SelectTrigger className="w-[180px] bg-background border-border rounded-xl font-medium"><SelectValue placeholder="All Brands" /></SelectTrigger>
          <SelectContent>{brandOpts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>

        <Select value={filterSeries} onValueChange={setFilterSeries}>
          <SelectTrigger className="w-[180px] bg-background border-border rounded-xl font-medium"><SelectValue placeholder="All Series" /></SelectTrigger>
          <SelectContent>{seriesOpts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>

        {(filterCat || filterSub || filterBrand || filterSeries) && (
          <Button variant="ghost" onClick={clearFilters} className="rounded-xl text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4 mr-2" /> Clear Filters
          </Button>
        )}
      </div>

      {error ? (
        <div className="p-8 text-center bg-destructive/5 rounded-2xl border border-destructive/20 text-destructive flex flex-col items-center">
          <AlertCircle className="w-10 h-10 mb-4 opacity-80" />
          <p className="font-bold text-lg mb-4">{error}</p>
          <Button onClick={fetchVault} variant="outline" className="rounded-xl">Retry Loading</Button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array(8).fill(0).map((_, i) => (
            <div key={i} className="space-y-3 bg-card border border-border p-4 rounded-2xl">
              <Skeleton className="aspect-[4/5] w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
            </div>
          ))}
        </div>
      ) : cards.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {cards.map(renderCard)}
        </div>
      ) : (
        <div className="py-20 text-center bg-card rounded-[2rem] border border-border shadow-sm">
          <ShieldCheck className="w-16 h-16 text-muted-foreground opacity-30 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">No matching cards</h3>
          <p className="text-muted-foreground mb-6">You don't have any cards matching these filters or your vault is empty.</p>
          <Button onClick={() => { clearFilters(); setIsFormOpen(true); }} className="rounded-xl font-bold">
            <Plus className="w-4 h-4 mr-2" /> Add Your First Item
          </Button>
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl border-border bg-background">
          <div className="p-6 md:p-10">
            <DialogHeader className="mb-8">
              <DialogTitle className="text-2xl md:text-3xl font-serif font-bold text-foreground">
                {editingCard ? 'Edit Vault Item' : 'Add to Vault'}
              </DialogTitle>
            </DialogHeader>
            <VaultProductForm card={editingCard} onSuccess={() => { setIsFormOpen(false); fetchVault(); }} onCancel={() => setIsFormOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>

      <VaultListingModal 
        isOpen={isStatusModalOpen} 
        onClose={() => setIsStatusModalOpen(false)} 
        product={statusCard} 
        onUpdate={fetchVault} 
      />
    </div>
  );
};

export default MyVaultPage;
