import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';
import { Search, Loader2, ImageOff } from 'lucide-react';
import pb from '@/lib/pocketbaseClient.js';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const FeaturedCardsAdminPage = () => {
  const [cards, setCards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [collectionFilter, setCollectionFilter] = useState('All');
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    setIsLoading(true);
    try {
      const response = await pb.collection('cards').getFullList({
        sort: '-created',
        expand: 'owner',
        $autoCancel: false,
      });
      setCards(response || []);
    } catch (error) {
      console.error('Error fetching cards:', error);
      toast.error('Failed to load cards. Please refresh the page.');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCards = useMemo(() => {
    return cards.filter(card => {
      const matchesSearch = !searchQuery || card.cardName?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCollection = collectionFilter === 'All' || card.collectionType === collectionFilter;
      return matchesSearch && matchesCollection;
    });
  }, [cards, searchQuery, collectionFilter]);

  const uniqueCollections = useMemo(() => {
    const collections = new Set(cards.map(c => c.collectionType).filter(Boolean));
    return ['All', ...Array.from(collections).sort()];
  }, [cards]);

  const handleToggleFeatured = async (card) => {
    if (!window.confirm(`Are you sure you want to ${card.featured ? 'unfeature' : 'feature'} "${card.cardName}"?`)) {
      return;
    }

    setProcessingId(card.id);
    try {
      const updatedCard = await pb.collection('cards').update(card.id, {
        featured: !card.featured
      }, { expand: 'owner', $autoCancel: false });

      setCards(prev => prev.map(c => c.id === card.id ? updatedCard : c));
      toast.success(`${updatedCard.cardName} is now ${updatedCard.featured ? 'featured' : 'unfeatured'}.`);
    } catch (error) {
      console.error('Error toggling featured status:', error);
      toast.error('Failed to update card featured status.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground py-12">
      <Helmet>
        <title>Admin - Manage Featured Cards | CardPop</title>
      </Helmet>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Featured Cards Management</h1>
          <p className="text-muted-foreground">Search and toggle which cards appear in the featured sections on the homepage.</p>
        </div>

        <div className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden flex flex-col">
          {/* Controls Bar */}
          <div className="p-6 border-b border-border bg-card flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by card name..." 
                className="pl-9 h-11 w-full rounded-xl bg-background border-border shadow-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="w-full sm:w-56">
              <Select value={collectionFilter} onValueChange={setCollectionFilter}>
                <SelectTrigger className="w-full h-11 rounded-xl bg-background border-border shadow-sm">
                  <SelectValue placeholder="Filter by Collection" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueCollections.map(col => (
                    <SelectItem key={col} value={col}>{col === 'All' ? 'All Collections' : col}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table/List Area */}
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg bg-background" />)}
              </div>
            ) : filteredCards.length === 0 ? (
              <div className="text-center py-16 px-4">
                <p className="text-foreground font-bold text-lg">No cards match your current filters.</p>
              </div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-background border-b border-border">
                  <tr>
                    <th className="px-6 py-4 font-bold">Card</th>
                    <th className="px-6 py-4 font-bold">Collection</th>
                    <th className="px-6 py-4 font-bold hidden md:table-cell">Owner</th>
                    <th className="px-6 py-4 font-bold text-right">Featured</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCards.map((card) => (
                    <tr key={card.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-16 bg-background rounded-lg flex items-center justify-center shrink-0 overflow-hidden border border-border shadow-sm">
                            {card.cardImage?.[0] ? (
                              <img 
                                src={pb.files.getUrl(card, card.cardImage[0])} 
                                alt={card.cardName} 
                                className="w-full h-full object-cover" 
                              />
                            ) : (
                              <ImageOff className="w-4 h-4 text-muted-foreground/50" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-foreground text-base leading-tight max-w-[200px] sm:max-w-xs truncate" title={card.cardName}>
                              {card.cardName}
                            </p>
                            <p className="text-muted-foreground text-xs mt-1 font-medium">
                              ${card.estimatedValue?.toFixed(2) || '0.00'} • {card.condition}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="secondary" className="whitespace-nowrap bg-background shadow-sm font-bold border border-border">
                          {card.collectionType}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <p className="text-foreground font-medium truncate max-w-[150px]">
                          {card.expand?.owner?.name || card.expand?.owner?.email || 'Unknown Owner'}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {processingId === card.id ? (
                            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                          ) : (
                            <Switch 
                              checked={card.featured} 
                              onCheckedChange={() => handleToggleFeatured(card)}
                              className={card.featured ? "data-[state=checked]:bg-primary" : ""}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          
          <div className="p-5 border-t border-border bg-background text-sm text-muted-foreground font-medium flex justify-between items-center rounded-b-3xl">
            <span>Showing {filteredCards.length} cards</span>
            <span className="hidden sm:inline">Toggle the switch to feature or unfeature a card.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeaturedCardsAdminPage;