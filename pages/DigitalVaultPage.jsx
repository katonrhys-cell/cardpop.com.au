
import React, { useState, useEffect } from 'react';
import SEOHead from '@/components/SEOHead.jsx';
import { Layers, DollarSign, Plus, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import CardForm from '@/components/CardForm.jsx';
import VaultLogo from '@/components/VaultLogo.jsx';
import { toast } from 'sonner';

const DigitalVaultPage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalCards: 0, totalValue: 0, forTrade: 0 });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const fetchCards = async () => {
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('vault_items')
        .select('*')
        .eq('owner_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (fetchError) throw fetchError;
      const items = data || [];
      setCards(items);

      let val = 0, tradeCount = 0;
      items.forEach(c => {
        val += c.estimated_value_aud || 0;
        if (c.listing_type === 'trade' || c.listing_type === 'both') tradeCount++;
      });
      setStats({ totalCards: items.length, totalValue: val, forTrade: tradeCount });
    } catch (error) {
      toast.error('Failed to load vault');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) fetchCards();
  }, [currentUser]);

  const handleDelete = async (id) => {
    if(!window.confirm("Delete this card?")) return;
    try {
      await supabase.from('vault_items').delete().eq('id', id).eq('owner_id', currentUser.id);
      toast.success("Card deleted");
      fetchCards();
    } catch (e) {
      toast.error("Failed to delete card");
    }
  };

  return (
    <div className="flex flex-col font-sans">
      <SEOHead title="Digital Vault | CardPop" description="Securely store and manage your trading card collection in your CardPop digital vault." />
      
      <div className="bg-background py-12">
        <div className="container px-4 max-w-7xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 md:w-24 md:h-24 shrink-0">
                <VaultLogo />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold mb-2 uppercase tracking-wide" style={{ fontFamily: "var(--font-vault)" }}>
                  <span className="metallic-text">My Digital Vault</span>
                </h1>
                <p className="text-muted-foreground font-medium tracking-wide">Manage your private collection and public listings.</p>
              </div>
            </div>
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-full font-bold">
                  <Plus className="w-4 h-4 mr-2" /> Add Card
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle className="font-serif text-2xl">Add Card to Vault</DialogTitle>
                </DialogHeader>
                <CardForm onSuccess={() => { setIsAddModalOpen(false); fetchCards(); }} onCancel={() => setIsAddModalOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="premium-card p-6 flex items-center gap-4 border-l-4 border-l-primary">
              <div className="p-4 bg-primary/10 rounded-xl text-primary">
                <Layers className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-bold uppercase tracking-wider">Total Cards</p>
                <p className="text-3xl font-bold tabular-nums">{stats.totalCards}</p>
              </div>
            </div>
            <div className="premium-card p-6 flex items-center gap-4">
              <div className="p-4 bg-accent/20 rounded-xl text-accent">
                <DollarSign className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-bold uppercase tracking-wider">Est. Value</p>
                <p className="text-3xl font-bold tabular-nums">${stats.totalValue.toLocaleString()}</p>
              </div>
            </div>
            <div className="premium-card p-6 flex items-center gap-4">
              <div className="p-4 bg-secondary/10 rounded-xl text-secondary">
                <Settings className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-bold uppercase tracking-wider">For Trade</p>
                <p className="text-3xl font-bold tabular-nums">{stats.forTrade}</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => <div key={i} className="h-64 bg-muted animate-pulse rounded-2xl" />)}
            </div>
          ) : cards.length === 0 ? (
            <div className="text-center py-24 bg-muted/30 rounded-3xl border border-dashed border-border flex flex-col items-center justify-center">
              <div className="w-32 h-32 mb-8 opacity-80">
                <VaultLogo />
              </div>
              <h3 className="text-2xl font-bold mb-2 uppercase tracking-wide" style={{ fontFamily: "var(--font-vault)" }}>Your Vault is Empty</h3>
              <p className="text-muted-foreground text-lg mb-8 max-w-md">
                Secure your collection digitally. Add your first card to start tracking value and managing trades.
              </p>
              <Button size="lg" onClick={() => setIsAddModalOpen(true)} className="rounded-full px-8">
                <Plus className="w-5 h-5 mr-2" /> Add Your First Card
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {cards.map(card => (
                <div key={card.id} className="premium-card p-4 flex flex-col cursor-pointer hover:ring-2 hover:ring-primary transition-all" onClick={() => navigate(`/product/vault/${card.id}`)}>
                  <div className="aspect-[3/4] bg-muted rounded-xl mb-4 flex items-center justify-center overflow-hidden relative group">
                    {card.card_image ? (
                      <img src={card.card_image.startsWith('http') ? card.card_image : supabase.storage.from('vault-images').getPublicUrl(card.card_image).data.publicUrl} alt={card.card_name} className="object-cover w-full h-full" />
                    ) : (
                      <span className="text-muted-foreground text-sm font-medium">No Image</span>
                    )}
                  </div>
                  <h3 className="font-bold text-lg mb-1 truncate">{card.card_name}</h3>
                  <div className="text-sm text-muted-foreground mb-4 space-y-1 font-medium">
                    <p>{card.collection} • {card.condition}</p>
                    <p className="text-primary font-bold">Est: ${card.estimated_value_aud || 0}</p>
                    <p>Status: <span className="text-foreground">{card.listing_type === 'private' ? 'Private' : card.listing_type === 'trade' ? 'For Trade' : card.listing_type === 'both' ? 'For Sale & Trade' : 'For Sale'}</span></p>
                  </div>
                  <div className="mt-auto flex gap-2" onClick={e => e.stopPropagation()}>
                    <Button variant="outline" size="sm" className="flex-1 font-medium" onClick={() => navigate(`/vault/edit/${card.id}`)}>Edit</Button>
                    <Button variant="outline" size="sm" className="flex-1 font-medium" onClick={() => handleDelete(card.id)}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DigitalVaultPage;
