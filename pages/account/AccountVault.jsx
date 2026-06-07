import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, Package, ImageOff, Lock, ShoppingCart, ArrowRightLeft,
  Layers, Edit, Trash2, MoreHorizontal, AlertCircle, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import Breadcrumb from '@/components/Breadcrumb.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { toast } from 'sonner';
import { COLLECTIONS_LIST } from '@/components/Header.jsx';
import VaultListingModal from '@/components/VaultListingModal.jsx';

const CONDITION_LABELS = {
  mint: 'Mint', near_mint: 'Near Mint', excellent: 'Excellent',
  good: 'Good', light_played: 'Light Played', played: 'Played', poor: 'Poor',
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

const AccountVault = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterCollection, setFilterCollection] = useState('');
  const [listingModal, setListingModal] = useState({ open: false, card: null });

  const fetchVault = useCallback(async () => {
    if (!currentUser?.id) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('vault_items')
        .select('*')
        .eq('owner_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(200);
      if (filterCollection) query = query.eq('collection', filterCollection);
      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setCards(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load vault.');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id, filterCollection]);

  useEffect(() => { fetchVault(); }, [fetchVault]);

  const handleDelete = async (cardId) => {
    try {
      const { data: activeListing } = await supabase
        .from('listings').select('id').eq('vault_item_id', cardId).eq('status', 'active').maybeSingle();

      const confirmed = activeListing
        ? window.confirm('This card has an active marketplace listing. Deleting it will also archive that listing. Continue?')
        : window.confirm('Delete this card from your vault?');
      if (!confirmed) return;

      if (activeListing) {
        await supabase.from('listings').update({ status: 'archived' }).eq('id', activeListing.id).eq('seller_id', currentUser.id);
      }
      const { error } = await supabase.from('vault_items').delete().eq('id', cardId).eq('owner_id', currentUser.id);
      if (error) throw error;
      toast.success('Card deleted');
      fetchVault();
    } catch (e) {
      toast.error(e.message || 'Failed to delete card');
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

    return (
      <div
        key={card.id}
        className="group bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:border-primary/40 transition-all duration-300 flex flex-col h-full relative cursor-pointer"
        onClick={() => navigate(`/vault/edit/${card.id}`)}
      >
        {/* Actions menu — stop propagation so click doesn't navigate */}
        <div className="absolute top-3 right-3 z-20" onClick={e => e.stopPropagation()}>
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
              <DropdownMenuItem onClick={() => setListingModal({ open: true, card })} className="cursor-pointer gap-2 font-medium">
                <ShoppingCart className="w-4 h-4" /> Manage Listing
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleDelete(card.id)} className="cursor-pointer gap-2 text-destructive focus:text-destructive focus:bg-destructive/10 font-medium">
                <Trash2 className="w-4 h-4" /> Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="aspect-[4/5] bg-muted/40 relative flex items-center justify-center border-b border-border/50 p-4">
          {imageUrl ? (
            <img src={imageUrl} alt={card.card_name} className="object-contain w-full h-full group-hover:scale-105 transition-transform duration-500" loading="lazy" />
          ) : (
            <div className="flex flex-col items-center text-muted-foreground opacity-50">
              <ImageOff className="w-10 h-10 mb-2" />
              <span className="text-[10px] font-bold uppercase tracking-wider">No Image</span>
            </div>
          )}
          <div className="absolute top-3 left-3 z-10 pointer-events-none">
            {getListingBadge(card)}
          </div>
        </div>

        <div className="p-4 flex flex-col flex-1">
          <h3 className="font-bold text-base line-clamp-2 mb-1 leading-tight">{card.card_name}</h3>
          {card.set_name && <p className="text-xs text-muted-foreground mb-2">{card.set_name}</p>}

          <div className="flex flex-wrap gap-1.5 mb-3">
            {card.collection && <Badge variant="secondary" className="text-[10px] font-medium bg-muted/50 text-muted-foreground">{card.collection}</Badge>}
            {card.condition && <Badge variant="secondary" className="text-[10px] font-medium bg-muted/50 text-muted-foreground">{CONDITION_LABELS[card.condition] || card.condition}</Badge>}
            {card.grading_company && card.grading_company !== 'raw' && (
              <Badge variant="secondary" className="text-[10px] font-medium bg-muted/50 text-muted-foreground uppercase">{card.grading_company} {card.grade || ''}</Badge>
            )}
          </div>

          <div className="mt-auto pt-3 border-t border-border flex items-end justify-between">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest block">Est. Value</span>
              <span className="font-extrabold text-lg tabular-nums">${(Number(card.estimated_value_aud) || 0).toFixed(2)}</span>
            </div>
            {isForTrade && card.trade_value_aud > 0 && (
              <div className="text-right">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest block">Trade Value</span>
                <span className="font-bold text-sm tabular-nums text-violet-600">${(Number(card.trade_value_aud) || 0).toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Helmet><title>My Vault | CardPop</title></Helmet>

      <Breadcrumb items={[{ label: 'Account', path: '/account' }, { label: 'My Vault' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading mb-2">My Vault</h1>
          <p className="text-muted-foreground">
            {loading ? 'Loading your collection…' : `${cards.length} card${cards.length !== 1 ? 's' : ''} in your vault`}
          </p>
        </div>
        <Button asChild>
          <Link to="/vault/add" className="gap-2">
            <Plus className="w-4 h-4" /> Add Card
          </Link>
        </Button>
      </div>

      {/* Collection filter */}
      <div className="flex flex-wrap items-center gap-3">
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
          <Button onClick={fetchVault} variant="outline" className="rounded-xl">Retry</Button>
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
        <div className="bg-card border border-border rounded-2xl p-12 text-center shadow-sm">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-bold mb-2">
            {filterCollection ? 'No cards in this collection' : 'Your vault is empty'}
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {filterCollection ? 'Try clearing the filter to see all your cards.' : 'Start building your digital collection by adding your first card.'}
          </p>
          <Button asChild variant="outline">
            <Link to="/vault/add">Add Your First Card</Link>
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

export default AccountVault;
