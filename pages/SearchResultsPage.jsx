import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';
import SEOHead from '@/components/SEOHead.jsx';
import MarketplaceListingCard from '@/components/MarketplaceListingCard.jsx';
import PaginationControls from '@/components/PaginationControls.jsx';
import SearchBar from '@/components/SearchBar.jsx';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const PER_PAGE = 16;

const SearchResultsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Reset to first page whenever the query changes.
  useEffect(() => { setPage(1); }, [query]);

  useEffect(() => {
    let cancelled = false;
    const fetchResults = async () => {
      setLoading(true);
      try {
        const from = (page - 1) * PER_PAGE;

        // Mirror the marketplace query: the searchable card details (name, set,
        // images) live on vault_items, not on the listings row itself.
        let dbQuery = supabase
          .from('listings')
          .select(
            '*, vault_item:vault_items!inner(*, vault_images(storage_path), parallel:parallels(id,name,color), subset:subsets(id,name)), seller:profiles!seller_id(id, display_name, username, avatar_url, is_verified, seller_tier, rating, reviews_count)',
            { count: 'exact' }
          )
          .eq('status', 'active')
          .neq('listing_type', 'vault')
          .order('created_at', { ascending: false })
          .range(from, from + PER_PAGE - 1);

        if (query.trim()) {
          const safeQuery = query.trim().replace(/[%,]/g, '');
          dbQuery = dbQuery.or(
            `card_name.ilike.%${safeQuery}%,set_name.ilike.%${safeQuery}%`,
            { referencedTable: 'vault_items' }
          );
        }

        const { data, count, error } = await dbQuery;
        if (error) throw error;

        if (!cancelled) {
          setResults(data || []);
          setTotalItems(count || 0);
          setTotalPages(Math.max(1, Math.ceil((count || 0) / PER_PAGE)));
        }
      } catch (error) {
        if (!cancelled) {
          setResults([]);
          setTotalItems(0);
          setTotalPages(1);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchResults();
    return () => { cancelled = true; };
  }, [query, page]);

  return (
    <div className="container-default section-padding">
      <SEOHead
        title={`Search Results for "${query}" | CardPop`}
        description={`Find ${query} trading cards and collectibles.`}
      />

      <div className="max-w-2xl mx-auto text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-bold font-heading mb-6">Search Results</h1>
        <SearchBar initialQuery={query} className="mx-auto" />
      </div>

      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">
          {loading ? 'Searching…' : <>{totalItems} results found {query && <span>for "{query}"</span>}</>}
        </h2>
        {query && (
          <Badge variant="outline" className="cursor-pointer" onClick={() => setSearchParams({})}>
            Clear Search ✕
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array(8).fill(0).map((_, i) => (
            <div key={i} className="flex flex-col space-y-4 bg-card border border-border rounded-2xl p-4">
              <Skeleton className="aspect-[4/5] w-full rounded-xl" />
              <Skeleton className="h-5 w-1/3 rounded-md" />
              <Skeleton className="h-6 w-3/4 rounded-md" />
              <Skeleton className="h-10 w-full rounded-xl mt-auto" />
            </div>
          ))}
        </div>
      ) : results.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {results.map((listing) => (
              <MarketplaceListingCard key={listing.id} listing={listing} />
            ))}
          </div>
          <PaginationControls
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 bg-card rounded-[2rem] border border-border shadow-sm text-center">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
            <Search className="w-10 h-10 text-muted-foreground opacity-50" />
          </div>
          <p className="text-foreground text-2xl font-bold mb-3 tracking-tight">No results found</p>
          <p className="text-muted-foreground max-w-sm">
            {query
              ? <>We couldn't find any listings matching "{query}". Try a different spelling or a broader term.</>
              : 'Enter a card name above to search the marketplace.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default SearchResultsPage;
