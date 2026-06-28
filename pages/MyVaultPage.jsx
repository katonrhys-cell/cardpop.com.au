
import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, Link } from 'react-router-dom';
import {
  Plus, ShieldCheck, AlertCircle, MoreHorizontal, Edit,
  Trash2, ImageOff, Lock, ArrowRightLeft, X, ShoppingCart, Layers
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { COLLECTIONS_LIST } from '@/components/Header.jsx';
import VaultListingModal from '@/components/VaultListingModal.jsx';
import { VARIANT_BADGES } from '@/lib/cardVariants.js';
import { slugify } from '@/lib/slugify.js';
import GradeBadge from '@/components/GradeBadge.jsx';

const CONDITION_LABELS = {
  mint: 'Mint', near_mint: 'Near Mint', excellent: 'Excellent',
  good: 'Good', light_played: 'Light Played', played: 'Played', poor: 'Poor',
};

const MyVaultPage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filterCollection, setFilterCollection] = useState('');
  const [listingModal, setListingModal] = useState({ open: false, card: null });

  const fetchVault = useCallback(async () => {
    if (!currentUser?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      let query = supabase
        .from('vault_items')
        .select('*')
        .eq('owner_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (filterCollection) query = query.eq('collection', filterCollection);

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      // Fetch active listings for these vault items
      const vaultItemIds = (data || []).map(item => item.id);
      let listingMap = {};
      if (vaultItemIds.length > 0) {
        const { data: listings } = await supabase
          .from('listings')
          .select('id, vault_item_id, price_aud')
          .in('vault_item_id', vaultItemIds)
          .eq('status', 'active');

        if (listings) {
          listings.forEach(listing => {
            listingMap[listing.vault_item_id] = listing;
          });
        }
      }

      // Attach listing data to vault items
      const cardsWithListings = (data || []).map(card => ({
        ...card,
        listing: listingMap[card.id]
      }));

      setCards(cardsWithListings);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch vault:", err);
      setError(err.message || 'Failed to load vault. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [currentUser, filterCollection]);

  useEffect(() => {
    fetchVault();
  }, [fetchVault]);

  const handleDelete = async (cardId) => {
    try {
      const { data: activeListing } = await supabase
        .from('listings')
        .select('id')
        .eq('vault_item_id', cardId)
        .eq('status', 'active')
        .maybeSingle();

      if (activeListing) {
        if (!window.confirm(
          "This card has an active marketplace listing. Deleting it will also archive that listing. Continue?"
        )) return;
        const { error: archiveErr } = await supabase
          .from('listings')
          .update({ status: 'archived' })
          .eq('id', activeListing.id)
          .eq('seller_id', currentUser.id);
        if (archiveErr) throw archiveErr;
      } else {
        if (!window.confirm("Delete this card from your vault?")) return;
      }

      const { error } = await supabase.from('vault_items').delete().eq('id', cardId).eq('owner_id', currentUser.id);
      if (error) throw error;
      toast.success("Card deleted successfully");
      fetchVault();
    } catch (e) {
      toast.error(e.message || "Failed to delete card");
    }
  };

  const getListingBadge = (card) => {
    switch (card.listing_type) {
      case 'For Sale':
        return <Badge className="bg-emerald-500/10 text-emerald-700 shadow-sm font-bold border-emerald-500/20"><ShoppingCart className="w-3 h-3 mr-1.5" />For Sale</Badge>;
      case 'For Trade':
        return <Badge className="bg-violet-500/10 text-violet-700 shadow-sm font-bold border-violet-500/20"><ArrowRightLeft className="w-3 h-3 mr-1.5" />For Trade</Badge>;
      case 'For Sale & Trade':
        return <Badge className="bg-amber-500/10 text-amber-700 shadow-sm font-bold border-amber-500/20"><Layers className="w-3 h-3 mr-1.5" />Sale & Trade</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground shadow-sm font-bold"><Lock className="w-3 h-3 mr-1.5" />Private</Badge>;
    }
  };

  const renderCard = (card) => {
    let imageUrl = null;
    if (card.card_image) {
      imageUrl = card.card_image.startsWith('http')
        ? card.card_image
        : supabase.storage.from('vault-images').getPublicUrl(card.card_image).data.publicUrl;
    }

    const isForTrade = card.listing_type === 'For Trade' || card.listing_type === 'For Sale & Trade';
    const titleSlug = slugify(card.card_name || card.name || 'card');

    // Determine detail path - link to marketplace listing if available, otherwise vault edit
    const detailPath = card.listing
      ? `/marketplace/${card.listing.id}/${titleSlug}`
      : `/vault/edit/${card.id}`;

    // Get variant badges
    const rawVariants = card.variant
      ? card.variant.split(',').map(s => s.trim()).filter(Boolean)
      : (Array.isArray(card.cardVariants) ? card.cardVariants : (card.cardVariants ? [card.cardVariants] : []));
    const specialBadge = Object.entries(VARIANT_BADGES).find(([key]) => rawVariants.includes(key));

    return (
      <div key={card.id} className="group bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:border-primary/40 transition-all duration-300 flex flex-col h-full relative">
        <div className="absolute top-3 right-3 z-20">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full bg-background/90 backdrop-blur-md hover:bg-background shadow-sm border border-border/50">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl w-52">
              <DropdownMenuItem onClick={() => navigate(`/vault/edit/${card.id}`)} className="cursor-pointer gap-2 font-medium">
                <Edit className="w-4 h-4" /> Edit Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setTimeout(() => setListingModal({ open: true, card }), 0); }} className="cursor-pointer gap-2 font-medium">
                <ShoppingCart className="w-4 h-4" /> Manage Listing
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleDelete(card.id)} className="cursor-pointer gap-2 text-destructive focus:text-destructive focus:bg-destructive/10 font-medium">
                <Trash2 className="w-4 h-4" /> Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Link to={detailPath} className="aspect-[4/5] bg-muted/40 relative flex items-center justify-center border-b border-border/50 p-4 group-hover:opacity-95 transition-opacity overflow-hidden">
          {imageUrl ? (
            <img src={imageUrl} alt={card.card_name} className="object-contain w-full h-full group-hover:scale-105 transition-transform duration-500" loading="lazy" />
          ) : (
            <div className="flex flex-col items-center text-muted-foreground opacity-50">
              <ImageOff className="w-10 h-10 mb-2" />
              <span className="text-[10px] font-bold uppercase tracking-wider">No Image</span>
            </div>
          )}
          <div className="absolute top-3 left-3 z-10 pointer-events-none flex flex-col gap-1.5 items-start">
            {getListingBadge(card)}
          </div>

          {/* Special variant badge — top right */}
          {specialBadge && (
            <div className={`absolute top-3 right-3 z-10 px-2.5 py-1 rounded-full text-[11px] font-extrabold tracking-wide shadow-md ${specialBadge[1].bg} ${specialBadge[1].text}`}>
              {specialBadge[1].label}
            </div>
          )}

          {/* Grade badge — bottom left (only for graded slabs) */}
          {card?.grading_company && card.grading_company !== 'raw' && card?.grade && (
            <GradeBadge grade={card.grade} gradingCompany={card.grading_company} />
          )}

          {card.serial_number && (
            <div className="absolute bottom-3 right-3 z-10 pointer-events-none">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold tracking-wide bg-black/70 text-white backdrop-blur-sm border border-white/10 shadow-md">
                <span className="opacity-60">#</span>{card.serial_number}
              </span>
            </div>
          )}
        </Link>

        <Link to={detailPath} className="p-4 flex flex-col flex-1">
          <h3 className="font-bold text-base line-clamp-2 mb-1 leading-tight text-foreground group-hover:text-primary transition-colors">{card.card_name}</h3>
          {card.set_name && <p className="text-xs text-muted-foreground mb-2">{card.set_name}</p>}

          <div className="flex flex-wrap gap-1.5 mb-3">
            {card.collection && <Badge variant="secondary" className="text-[10px] font-medium bg-muted/50 text-muted-foreground">{card.collection}</Badge>}
            {card.year && <Badge variant="secondary" className="text-[10px] font-medium bg-muted/50 text-muted-foreground">{card.year}</Badge>}
            {card.card_number && <Badge variant="secondary" className="text-[10px] font-medium bg-muted/50 text-muted-foreground">#{card.card_number}</Badge>}
            {card.variant && card.variant.split(',').map(v => v.trim()).filter(Boolean).map(v => (
              <Badge key={v} variant="secondary" className="text-[10px] font-medium bg-violet-500/10 text-violet-700 border border-violet-200/50">{v}</Badge>
            ))}
            {card.condition && <Badge variant="secondary" className="text-[10px] font-medium bg-muted/50 text-muted-foreground">{CONDITION_LABELS[card.condition] || card.condition}</Badge>}
          </div>

          <div className="mt-auto pt-3 border-t border-border flex items-end justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Est. Value</span>
              <span className="font-extrabold text-lg tabular-nums text-foreground">
                ${(Number(card.estimated_value_aud) || 0).toFixed(2)}
              </span>
            </div>
            {isForTrade && card.trade_value_aud > 0 && (
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Trade Value</span>
                <span className="font-bold text-sm tabular-nums text-violet-600">
                  ${(Number(card.trade_value_aud) || 0).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </Link>
      </div>
    );
  };

  return (
    <div className="flex flex-col font-sans w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Helmet><title>My Digital Vault | CardPop</title></Helmet>

      <div className="mb-8">
        <h1 className="font-serif text-4xl md:text-5xl font-extrabold mb-4 text-foreground tracking-tight">My Digital Vault</h1>
        <p className="text-lg text-muted-foreground max-w-2xl text-balance">
          Manage your personal collection securely. Track values and mark cards for trading.
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
            <p className="text-sm text-muted-foreground">Digitize your collection to track values and mark cards for trading.</p>
          </div>
        </div>
        <Button onClick={() => navigate('/vault/add')} className="w-full sm:w-auto rounded-xl font-bold h-12 px-6 shadow-md transition-transform active:scale-[0.98]">
          <Plus className="w-5 h-5 mr-2" /> Add New Card
        </Button>
      </div>

      <div className="bg-muted/30 border border-border p-4 rounded-2xl mb-8 flex flex-wrap items-center gap-3">
        <Select value={filterCollection} onValueChange={setFilterCollection}>
          <SelectTrigger className="w-[200px] bg-background border-border rounded-xl font-medium">
            <SelectValue placeholder="All Collections" />
          </SelectTrigger>
          <SelectContent>
            {COLLECTIONS_LIST.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>

        {filterCollection && (
          <Button variant="ghost" onClick={() => setFilterCollection('')} className="rounded-xl text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4 mr-2" /> Clear
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
          <h3 className="text-xl font-bold mb-2">
            {filterCollection ? 'No cards in this collection' : 'Your vault is empty'}
          </h3>
          <p className="text-muted-foreground mb-6">
            {filterCollection ? 'Try clearing the filter to see all your cards.' : "Add your first card to start tracking your collection."}
          </p>
          <Button onClick={() => navigate('/vault/add')} className="rounded-xl font-bold">
            <Plus className="w-4 h-4 mr-2" /> Add Your First Card
          </Button>
        </div>
      )}

      <VaultListingModal
        isOpen={listingModal.open}
        onClose={() => setListingModal({ open: false, card: null })}
        product={listingModal.card}
        onUpdate={fetchVault}
      />
    </div>
  );
};

export default MyVaultPage;
