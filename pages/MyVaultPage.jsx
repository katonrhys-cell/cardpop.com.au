
import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import {
  Plus, ShieldCheck, AlertCircle, MoreHorizontal, Edit,
  Trash2, ImageOff, Lock, ArrowRightLeft, X
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

  const fetchVault = useCallback(async () => {
    if (!currentUser?.id) return;
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
      setCards(data || []);
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

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this card from your vault?")) return;
    try {
      const { error } = await supabase.from('vault_items').delete().eq('id', id);
      if (error) throw error;
      toast.success("Card deleted successfully");
      fetchVault();
    } catch (e) {
      toast.error(e.message || "Failed to delete card");
    }
  };

  const renderCard = (card) => {
    let imageUrl = null;
    if (card.card_image) {
      imageUrl = card.card_image.startsWith('http')
        ? card.card_image
        : supabase.storage.from('vault-images').getPublicUrl(card.card_image).data.publicUrl;
    }

    const isForTrade = card.trade_value_aud > 0;

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
              <DropdownMenuItem onClick={() => navigate(`/vault/edit/${card.id}`)} className="cursor-pointer gap-2 font-medium">
                <Edit className="w-4 h-4" /> Edit Details
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
          <div className="absolute top-3 left-3 z-10 pointer-events-none flex flex-col gap-1.5 items-start">
            <Badge className="bg-muted text-muted-foreground shadow-sm font-bold tracking-tight">
              <Lock className="w-3 h-3 mr-1.5" /> Private
            </Badge>
            {isForTrade && (
              <Badge className="bg-purple-500/10 text-purple-600 shadow-sm font-bold border-purple-500/20">
                <ArrowRightLeft className="w-3 h-3 mr-1.5" /> For Trade
              </Badge>
            )}
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
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Est. Value</span>
              <span className="font-extrabold text-lg tabular-nums text-foreground">
                ${(Number(card.estimated_value_aud) || 0).toFixed(2)}
              </span>
            </div>
            {isForTrade && (
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Trade Value</span>
                <span className="font-bold text-sm tabular-nums text-purple-600">
                  ${(Number(card.trade_value_aud) || 0).toFixed(2)}
                </span>
              </div>
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
    </div>
  );
};

export default MyVaultPage;
